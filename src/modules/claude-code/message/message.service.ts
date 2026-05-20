import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import { RequestContextService } from "../../../core/logger/request-context.service";
import {
  OPEN_CODE_GO_MODELS,
  resolveOpenCodeGoModel,
} from "../../../integrations/opencode-go/opencode-go-model.catalog";
import {
  AiGenerateResult,
  AiStreamEvent,
  OPENCODE_GO_AI_CLIENT,
  OpenCodeGoAiClientPort,
} from "../../../integrations/opencode-go/opencode-go.types";
import {
  AnthropicContentBlock,
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
} from "./dto/anthropic-message.dto";

@Injectable()
export class MessageService {
  constructor(
    @Inject(OPENCODE_GO_AI_CLIENT)
    private readonly openCodeGoAiClient: OpenCodeGoAiClientPort,
    private readonly requestContext: RequestContextService,
    @Optional()
    private readonly logger: Pick<Logger, "log"> = new Logger(
      MessageService.name,
    ),
  ) {}

  async createMessage(
    request: AnthropicMessagesRequest,
    authToken?: string,
  ): Promise<AnthropicMessagesResponse> {
    const model = this.resolveModelOrThrow(request);
    const result = await this.openCodeGoAiClient.generateText(
      model,
      request,
      authToken,
    );

    this.logger.log(
      [
        `requestId=${this.requestContext.getRequestId() ?? "none"}`,
        `model=${request.model}`,
        `upstreamModel=${model.upstreamModelId}`,
        `inputTokens=${result.usage.inputTokens}`,
        `outputTokens=${result.usage.outputTokens}`,
        `message="${getMessagePreview(request)}"`,
      ].join(" "),
    );

    return this.toAnthropicMessage(request.model, result);
  }

  streamMessage(
    request: AnthropicMessagesRequest,
    authToken?: string,
  ): AsyncIterable<AiStreamEvent> {
    const model = this.resolveModelOrThrow(request);
    return this.openCodeGoAiClient.streamText(model, request, authToken);
  }

  countTokens(request: AnthropicMessagesRequest) {
    this.resolveModelOrThrow(request);
    const text = JSON.stringify(request.messages ?? []);
    return { input_tokens: Math.ceil(text.length / 4) };
  }

  private resolveModelOrThrow(request: AnthropicMessagesRequest) {
    const model = resolveOpenCodeGoModel(request.model);
    if (!model) {
      throw new BadRequestException(
        `Unsupported model: ${request.model}. Use one of: ${OPEN_CODE_GO_MODELS.map((entry) => entry.anthropicModelId).join(", ")}`,
      );
    }
    return model;
  }

  private toAnthropicMessage(
    modelId: string,
    result: AiGenerateResult,
  ): AnthropicMessagesResponse {
    const content: AnthropicContentBlock[] = [];
    if (result.text.length > 0) {
      content.push({ type: "text", text: result.text });
    }
    for (const toolCall of result.toolCalls ?? []) {
      content.push({
        type: "tool_use",
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      });
    }

    return {
      id: `msg_${crypto.randomUUID().replaceAll("-", "")}`,
      type: "message",
      role: "assistant",
      model: modelId,
      content,
      stop_reason: mapStopReason(result.stopReason),
      stop_sequence: null,
      usage: {
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
      },
    };
  }
}

function mapStopReason(stopReason: string): string {
  if (stopReason === "tool-calls") return "tool_use";
  if (stopReason === "length") return "max_tokens";
  if (stopReason === "stop") return "end_turn";
  return stopReason;
}

function getMessagePreview(request: AnthropicMessagesRequest): string {
  const words = request.messages
    .flatMap((message) => contentToText(message.content).split(/\s+/))
    .filter((word) => word.length > 0);
  const preview = words.slice(0, 10).join(" ");

  return words.length > 10 ? `${preview}.....` : preview;
}

function contentToText(
  content: AnthropicMessagesRequest["messages"][number]["content"],
): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "tool_result") {
        if (!block.content) return "";
        if (typeof block.content === "string") return block.content;
        return block.content.map((entry) => entry.text).join(" ");
      }
      return "";
    })
    .join(" ");
}
