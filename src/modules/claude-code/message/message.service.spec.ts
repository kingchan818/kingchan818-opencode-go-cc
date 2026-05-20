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
      usage: { inputTokens: 42, outputTokens: 7 },
    };
  }

  streamText(): AsyncIterable<AiStreamEvent> {
    return (async function* () {
      yield { type: "text_delta" as const, text: "hello" };
    })();
  }
}

describe("MessageService", () => {
  it("logs request id, model, token usage, and a truncated message preview", async () => {
    const logger = { log: jest.fn() };
    const requestContext = new RequestContextService();
    const service = new MessageService(
      new FakeOpenCodeGoAiClient(),
      requestContext,
      logger,
    );

    await requestContext.runWithRequestId("req_123", async () => {
      await service.createMessage({
        model: "opencode-go/kimi-k2.6",
        max_tokens: 128,
        messages: [
          {
            role: "user",
            content: "one two three four five six seven eight nine ten eleven",
          },
        ],
      });
    });

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("requestId=req_123"),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("model=opencode-go/kimi-k2.6"),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("upstreamModel=kimi-k2.6"),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("inputTokens=42 outputTokens=7"),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining(
        'message="one two three four five six seven eight nine ten....."',
      ),
    );
  });
});
