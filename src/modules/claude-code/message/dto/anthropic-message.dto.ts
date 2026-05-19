export type AnthropicRole = "user" | "assistant";

export interface AnthropicTextBlock {
  readonly type: "text";
  readonly text: string;
}

export interface AnthropicToolUseBlock {
  readonly type: "tool_use";
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export interface AnthropicToolResultBlock {
  readonly type: "tool_result";
  readonly tool_use_id: string;
  readonly content?: string | AnthropicTextBlock[];
  readonly is_error?: boolean;
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicMessageInput {
  readonly role: AnthropicRole;
  readonly content: string | AnthropicContentBlock[];
}

export interface AnthropicToolInput {
  readonly name: string;
  readonly description?: string;
  readonly input_schema: unknown;
}

export interface AnthropicMessagesRequest {
  readonly model: string;
  readonly messages: AnthropicMessageInput[];
  readonly system?: string | AnthropicTextBlock[];
  readonly max_tokens?: number;
  readonly temperature?: number;
  readonly top_p?: number;
  readonly stop_sequences?: string[];
  readonly stream?: boolean;
  readonly tools?: AnthropicToolInput[];
  readonly tool_choice?: unknown;
}

export interface AnthropicMessagesResponse {
  readonly id: string;
  readonly type: "message";
  readonly role: "assistant";
  readonly model: string;
  readonly content: AnthropicContentBlock[];
  readonly stop_reason: string;
  readonly stop_sequence: string | null;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
  };
}
