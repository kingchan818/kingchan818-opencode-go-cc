import { Response } from "express";
import { AnthropicMessagesRequest } from "./dto/anthropic-message.dto";

export async function writeAnthropicMessageStream(
  response: Response,
  request: AnthropicMessagesRequest,
  textStream: AsyncIterable<string>,
): Promise<void> {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");

  const messageId = `msg_${crypto.randomUUID().replaceAll("-", "")}`;
  writeSse(response, "message_start", {
    type: "message_start",
    message: {
      id: messageId,
      type: "message",
      role: "assistant",
      model: request.model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  });
  writeSse(response, "content_block_start", {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  });

  for await (const text of textStream) {
    writeSse(response, "content_block_delta", {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text },
    });
  }

  writeSse(response, "content_block_stop", {
    type: "content_block_stop",
    index: 0,
  });
  writeSse(response, "message_delta", {
    type: "message_delta",
    delta: { stop_reason: "end_turn", stop_sequence: null },
    usage: { output_tokens: 0 },
  });
  writeSse(response, "message_stop", { type: "message_stop" });
  response.end();
}

function writeSse(response: Response, event: string, data: unknown): void {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}
