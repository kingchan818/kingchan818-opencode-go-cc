import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  generateText,
  jsonSchema,
  ModelMessage,
  streamText,
  ToolChoice,
  ToolSet,
} from "ai";
import {
  AnthropicContentBlock,
  AnthropicMessagesRequest,
  AnthropicTextBlock,
  AnthropicToolInput,
} from "../../modules/claude-code/message/dto/anthropic-message.dto";
import { OpenCodeGoModel } from "./opencode-go-model.catalog";
import {
  AiGenerateResult,
  AiStreamEvent,
  OpenCodeGoAiClientPort,
} from "./opencode-go.types";

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
      toolChoice: normalizeToolChoice(request.tool_choice),
      providerOptions: getProviderOptions(model),
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
  ): AsyncIterable<AiStreamEvent> {
    const result = streamText({
      model: this.createLanguageModel(model, authToken),
      system: normalizeSystem(request.system),
      messages: normalizeMessages(request.messages),
      tools: normalizeTools(request.tools),
      toolChoice: normalizeToolChoice(request.tool_choice),
      providerOptions: getProviderOptions(model),
      maxOutputTokens: request.max_tokens,
      temperature: request.temperature,
      topP: request.top_p,
      stopSequences: request.stop_sequences,
    });

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        yield { type: "text_delta", text: part.text };
      }
      if (part.type === "tool-call") {
        yield {
          type: "tool_use",
          id: part.toolCallId,
          name: part.toolName,
          input: part.input,
        };
      }
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

function getProviderOptions(model: OpenCodeGoModel) {
  if (!model.upstreamModelId.startsWith("deepseek-")) return undefined;

  return {
    "opencode-go": {
      thinking: { type: "disabled" },
    },
  };
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
  const toolNamesById = new Map<string, string>();
  const normalizedMessages: ModelMessage[] = [];

  for (const message of messages) {
    if (typeof message.content === "string") {
      normalizedMessages.push({ role: message.role, content: message.content });
      continue;
    }

    if (message.role === "assistant") {
      const content = message.content
        .map((block) => {
          if (block.type === "text") {
            return { type: "text" as const, text: block.text };
          }
          if (block.type === "tool_use") {
            toolNamesById.set(block.id, block.name);
            return {
              type: "tool-call" as const,
              toolCallId: block.id,
              toolName: block.name,
              input: block.input,
            };
          }
          return undefined;
        })
        .filter((block) => block !== undefined);

      normalizedMessages.push({ role: "assistant", content });
      continue;
    }

    const userTextParts = message.content
      .filter((block): block is AnthropicTextBlock => block.type === "text")
      .map((block) => ({ type: "text" as const, text: block.text }));
    const toolResultParts = message.content
      .filter((block) => block.type === "tool_result")
      .map((block) => ({
        type: "tool-result" as const,
        toolCallId: block.tool_use_id,
        toolName: toolNamesById.get(block.tool_use_id) ?? block.tool_use_id,
        output: toToolResultOutput(block),
      }));

    if (toolResultParts.length > 0) {
      normalizedMessages.push({ role: "tool", content: toolResultParts });
    }
    if (userTextParts.length > 0) {
      normalizedMessages.push({ role: "user", content: userTextParts });
    }
  }

  return normalizedMessages;
}

function toToolResultOutput(
  block: Extract<AnthropicContentBlock, { type: "tool_result" }>,
) {
  if (!block.content) {
    return block.is_error
      ? { type: "error-text" as const, value: "" }
      : { type: "text" as const, value: "" };
  }

  if (typeof block.content === "string") {
    return block.is_error
      ? { type: "error-text" as const, value: block.content }
      : { type: "text" as const, value: block.content };
  }

  if (block.is_error) {
    return {
      type: "error-text" as const,
      value: block.content.map((entry) => entry.text).join("\n"),
    };
  }

  return {
    type: "content" as const,
    value: block.content.map((entry) => ({
      type: "text" as const,
      text: entry.text,
    })),
  };
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

function normalizeToolChoice(
  toolChoice: AnthropicMessagesRequest["tool_choice"],
): ToolChoice<ToolSet> | undefined {
  if (!toolChoice || typeof toolChoice !== "object" || !("type" in toolChoice)) {
    return undefined;
  }

  const choice = toolChoice as { type?: string; name?: string };
  if (choice.type === "auto") return "auto";
  if (choice.type === "none") return "none";
  if (choice.type === "any") return "required";
  if (choice.type === "tool" && choice.name) {
    return { type: "tool", toolName: choice.name };
  }

  return undefined;
}
