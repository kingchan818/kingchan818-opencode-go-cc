import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, jsonSchema, ModelMessage, streamText, ToolSet } from "ai";
import {
  AnthropicContentBlock,
  AnthropicMessagesRequest,
  AnthropicTextBlock,
  AnthropicToolInput,
} from "../../modules/claude-code/message/dto/anthropic-message.dto";
import { OpenCodeGoModel } from "./opencode-go-model.catalog";
import { AiGenerateResult, OpenCodeGoAiClientPort } from "./opencode-go.types";

@Injectable()
export class OpenCodeGoAiClient implements OpenCodeGoAiClientPort {
  constructor(private readonly configService: ConfigService) {}

  async generateText(
    model: OpenCodeGoModel,
    request: AnthropicMessagesRequest,
    authToken?: string,
  ): Promise<AiGenerateResult> {
    const result = await generateText({
      model: this.createLanguageModel(model, authToken),
      system: normalizeSystem(request.system),
      messages: normalizeMessages(request.messages),
      tools: normalizeTools(request.tools),
      maxOutputTokens: request.max_tokens,
      temperature: request.temperature,
      topP: request.top_p,
      stopSequences: request.stop_sequences,
    });

    return {
      text: result.text,
      stopReason: result.finishReason,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      },
      toolCalls: result.toolCalls.map((toolCall) => ({
        id: toolCall.toolCallId,
        name: toolCall.toolName,
        input: toolCall.input,
      })),
    };
  }

  async *streamText(
    model: OpenCodeGoModel,
    request: AnthropicMessagesRequest,
    authToken?: string,
  ): AsyncIterable<string> {
    const result = streamText({
      model: this.createLanguageModel(model, authToken),
      system: normalizeSystem(request.system),
      messages: normalizeMessages(request.messages),
      tools: normalizeTools(request.tools),
      maxOutputTokens: request.max_tokens,
      temperature: request.temperature,
      topP: request.top_p,
      stopSequences: request.stop_sequences,
    });

    for await (const delta of result.textStream) {
      yield delta;
    }
  }

  private createLanguageModel(model: OpenCodeGoModel, authToken?: string) {
    const apiKey =
      this.configService.get<string>("OPENCODE_API_KEY") ??
      authToken ??
      this.configService.get<string>("ANTHROPIC_API_KEY");

    if (model.providerKind === "anthropic") {
      return createAnthropic({
        baseURL: model.upstreamBaseUrl,
        apiKey,
        name: "opencode-go.anthropic",
      })(model.upstreamModelId);
    }

    return createOpenAICompatible({
      baseURL: model.upstreamBaseUrl,
      name: "opencode-go",
      apiKey,
    }).chatModel(model.upstreamModelId);
  }
}

function normalizeSystem(
  system: AnthropicMessagesRequest["system"],
): string | undefined {
  if (!system) return undefined;
  if (typeof system === "string") return system;
  return system.map((block) => block.text).join("\n");
}

function normalizeMessages(
  messages: AnthropicMessagesRequest["messages"],
): ModelMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content:
      typeof message.content === "string"
        ? message.content
        : contentBlocksToText(message.content),
  }));
}

function contentBlocksToText(blocks: readonly AnthropicContentBlock[]): string {
  return blocks
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "tool_result") return stringifyToolResult(block.content);
      return JSON.stringify(block);
    })
    .filter((value) => value.length > 0)
    .join("\n");
}

function stringifyToolResult(
  content: string | readonly AnthropicTextBlock[] | undefined,
): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content.map((block) => block.text).join("\n");
}

function normalizeTools(tools: readonly AnthropicToolInput[] | undefined): ToolSet | undefined {
  if (!tools || tools.length === 0) return undefined;

  return Object.fromEntries(
    tools.map((tool) => [
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonSchema(tool.input_schema as Parameters<typeof jsonSchema>[0]),
      },
    ]),
  );
}
