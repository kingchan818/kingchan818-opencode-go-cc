import { Response } from "express";
import { AiStreamEvent } from "../../../integrations/opencode-go/opencode-go.types";
import { AnthropicMessagesRequest } from "./dto/anthropic-message.dto";

export async function writeAnthropicMessageStream(
  response: Response,
  request: AnthropicMessagesRequest,
  streamEvents: AsyncIterable<AiStreamEvent>,
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
  let nextContentIndex = 0;
  let activeTextIndex: number | undefined;
  let sawToolUse = false;

  for await (const event of streamEvents) {
    if (event.type === "text_delta") {
      if (activeTextIndex === undefined) {
        activeTextIndex = nextContentIndex;
        nextContentIndex += 1;
        writeSse(response, "content_block_start", {
          type: "content_block_start",
          index: activeTextIndex,
          content_block: { type: "text", text: "" },
        });
      }
      writeSse(response, "content_block_delta", {
        type: "content_block_delta",
        index: activeTextIndex,
        delta: { type: "text_delta", text: event.text },
      });
      continue;
    }

    if (activeTextIndex !== undefined) {
      writeSse(response, "content_block_stop", {
        type: "content_block_stop",
        index: activeTextIndex,
      });
      activeTextIndex = undefined;
    }

    sawToolUse = true;
    const toolIndex = nextContentIndex;
    nextContentIndex += 1;
    writeSse(response, "content_block_start", {
      type: "content_block_start",
      index: toolIndex,
      content_block: {
        type: "tool_use",
        id: event.id,
        name: event.name,
        input: {},
      },
    });
    writeSse(response, "content_block_delta", {
      type: "content_block_delta",
      index: toolIndex,
      delta: {
        type: "input_json_delta",
        partial_json: JSON.stringify(event.input ?? {}),
      },
    });
    writeSse(response, "content_block_stop", {
      type: "content_block_stop",
      index: toolIndex,
    });
  }

  if (activeTextIndex !== undefined) {
    writeSse(response, "content_block_stop", {
      type: "content_block_stop",
      index: activeTextIndex,
    });
  }
  writeSse(response, "message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: sawToolUse ? "tool_use" : "end_turn",
      stop_sequence: null,
    },
    usage: { output_tokens: 0 },
  });
  writeSse(response, "message_stop", { type: "message_stop" });
  response.end();
}

function writeSse(response: Response, event: string, data: unknown): void {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}
