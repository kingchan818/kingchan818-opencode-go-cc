import { BadRequestException } from "@nestjs/common";
import { Response } from "express";
import { MessageController } from "./message.controller";
import { MessageService } from "./message.service";
import { RequestContextService } from "../../../core/logger/request-context.service";
import {
  AiStreamEvent,
  OpenCodeGoAiClientPort,
} from "../../../integrations/opencode-go/opencode-go.types";

class FakeOpenCodeGoAiClient implements OpenCodeGoAiClientPort {
  async generateText() {
    return {
      text: "hello from opencode",
      stopReason: "end_turn",
      usage: { inputTokens: 4, outputTokens: 3 },
    };
  }

  streamText(): AsyncIterable<AiStreamEvent> {
    return (async function* () {
      yield { type: "text_delta" as const, text: "hello " };
      yield { type: "text_delta" as const, text: "from stream" };
    })();
  }
}

function createResponseRecorder(): Response & {
  statusCodeValue?: number;
  jsonBody?: unknown;
  body: string;
} {
  const recorder = {
    body: "",
    statusCodeValue: undefined as number | undefined,
    jsonBody: undefined as unknown,
    status(code: number) {
      this.statusCodeValue = code;
      return this;
    },
    setHeader() {
      return this;
    },
    write(chunk: string) {
      this.body += chunk;
      return true;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
    end() {
      return this;
    },
  };
  return recorder as unknown as Response & {
    statusCodeValue?: number;
    jsonBody?: unknown;
    body: string;
  };
}

describe("Anthropic-compatible messages API", () => {
  const service = new MessageService(
    new FakeOpenCodeGoAiClient(),
    new RequestContextService(),
  );
  const controller = new MessageController(service);

  it("returns Anthropic Messages JSON for non-stream requests", async () => {
    const response = createResponseRecorder();

    await controller.createMessage(
      {
        model: "opencode-go/kimi-k2.6",
        max_tokens: 128,
        messages: [{ role: "user", content: "Say hello" }],
      },
      undefined,
      undefined,
      response,
    );

    expect(response.statusCodeValue).toBe(200);
    expect(response.jsonBody).toMatchObject({
      type: "message",
      role: "assistant",
      model: "opencode-go/kimi-k2.6",
      content: [{ type: "text", text: "hello from opencode" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 4, output_tokens: 3 },
    });
  });

  it("streams Anthropic-style server-sent events", async () => {
    const response = createResponseRecorder();

    await controller.createMessage(
      {
        model: "opencode-go/minimax-m2.7",
        max_tokens: 128,
        stream: true,
        messages: [{ role: "user", content: "Say hello" }],
      },
      undefined,
      undefined,
      response,
    );

    expect(response.statusCodeValue).toBe(200);
    expect(response.body).toContain("event: message_start");
    expect(response.body).toContain("event: content_block_delta");
    expect(response.body).toContain("hello ");
    expect(response.body).toContain("event: message_stop");
  });

  it("streams tool_use blocks for Claude Code tool calls", async () => {
    class ToolCallingClient extends FakeOpenCodeGoAiClient {
      override streamText(): AsyncIterable<AiStreamEvent> {
        return (async function* () {
          yield {
            type: "tool_use" as const,
            id: "toolu_123",
            name: "Read",
            input: { file_path: "/tmp/example.ts" },
          };
        })();
      }
    }
    const toolService = new MessageService(
      new ToolCallingClient(),
      new RequestContextService(),
    );
    const toolController = new MessageController(toolService);
    const response = createResponseRecorder();

    await toolController.createMessage(
      {
        model: "opencode-go/kimi-k2.6",
        max_tokens: 128,
        stream: true,
        tools: [
          {
            name: "Read",
            input_schema: {
              type: "object",
              properties: { file_path: { type: "string" } },
              required: ["file_path"],
            },
          },
        ],
        messages: [{ role: "user", content: "Read the file" }],
      },
      undefined,
      undefined,
      response,
    );

    expect(response.body).toContain("event: content_block_start");
    expect(response.body).toContain('"type":"tool_use"');
    expect(response.body).toContain('"name":"Read"');
    expect(response.body).toContain('\\"file_path\\":\\"/tmp/example.ts\\"');
    expect(response.body).toContain('"stop_reason":"tool_use"');
  });

  it("rejects unsupported models", async () => {
    await expect(
      service.createMessage({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 128,
        messages: [{ role: "user", content: "Say hello" }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
