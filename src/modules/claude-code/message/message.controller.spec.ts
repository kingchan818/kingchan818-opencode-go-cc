import { BadRequestException } from "@nestjs/common";
import { Response } from "express";
import { MessageController } from "./message.controller";
import { MessageService } from "./message.service";
import { RequestContextService } from "../../../core/logger/request-context.service";
import { OpenCodeGoAiClientPort } from "../../../integrations/opencode-go/opencode-go.types";

class FakeOpenCodeGoAiClient implements OpenCodeGoAiClientPort {
  async generateText() {
    return {
      text: "hello from opencode",
      stopReason: "end_turn",
      usage: { inputTokens: 4, outputTokens: 3 },
    };
  }

  streamText() {
    return (async function* () {
      yield "hello ";
      yield "from stream";
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
