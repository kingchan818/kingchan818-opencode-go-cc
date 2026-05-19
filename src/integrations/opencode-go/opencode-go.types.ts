import { AnthropicMessagesRequest } from "../../modules/claude-code/message/dto/anthropic-message.dto";
import { OpenCodeGoModel } from "./opencode-go-model.catalog";

export const OPENCODE_GO_AI_CLIENT = Symbol("OPENCODE_GO_AI_CLIENT");

export interface AiGenerateResult {
  readonly text: string;
  readonly stopReason: string;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly toolCalls?: Array<{
    readonly id: string;
    readonly name: string;
    readonly input: unknown;
  }>;
}

export interface OpenCodeGoAiClientPort {
  generateText(
    model: OpenCodeGoModel,
    request: AnthropicMessagesRequest,
    authToken?: string,
  ): Promise<AiGenerateResult>;

  streamText(
    model: OpenCodeGoModel,
    request: AnthropicMessagesRequest,
    authToken?: string,
  ): AsyncIterable<string>;
}
