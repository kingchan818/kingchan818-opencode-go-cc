import { ConfigService } from "@nestjs/config";
import { generateText, streamText } from "ai";
import { OpenCodeGoAiClient } from "./opencode-go-ai.client";
import { resolveOpenCodeGoModel } from "./opencode-go-model.catalog";

jest.mock("ai", () => ({
  generateText: jest.fn(async () => ({
    text: "",
    finishReason: "stop",
    usage: { inputTokens: 0, outputTokens: 0 },
    toolCalls: [],
  })),
  jsonSchema: jest.fn((schema: unknown) => schema),
  streamText: jest.fn(() => ({
    fullStream: (async function* () {})(),
  })),
}));

jest.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: jest.fn(() => ({
    chatModel: jest.fn(() => "openai-compatible-model"),
  })),
}));

jest.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: jest.fn(() => jest.fn(() => "anthropic-model")),
}));

describe("OpenCodeGoAiClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("places tool results immediately after assistant tool calls", async () => {
    const model = resolveOpenCodeGoModel("opencode-go/deepseek-v4-pro");
    expect(model).toBeDefined();

    const client = new OpenCodeGoAiClient(new ConfigService());

    await client.generateText(model!, {
      model: "opencode-go/deepseek-v4-pro",
      max_tokens: 128,
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_123",
              name: "Read",
              input: { file_path: "/tmp/example.ts" },
            },
          ],
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Use that result to continue." },
            {
              type: "tool_result",
              tool_use_id: "toolu_123",
              content: "export const value = 1;",
            },
          ],
        },
      ],
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: "assistant",
            content: [
              {
                type: "tool-call",
                toolCallId: "toolu_123",
                toolName: "Read",
                input: { file_path: "/tmp/example.ts" },
              },
            ],
          },
          {
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: "toolu_123",
                toolName: "Read",
                output: { type: "text", value: "export const value = 1;" },
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Use that result to continue." },
            ],
          },
        ],
      }),
    );
  });

  it("disables DeepSeek thinking mode to avoid unroundtripped reasoning content", async () => {
    const model = resolveOpenCodeGoModel("opencode-go/deepseek-v4-flash");
    expect(model).toBeDefined();

    const client = new OpenCodeGoAiClient(new ConfigService());

    await client.generateText(model!, {
      model: "opencode-go/deepseek-v4-flash",
      max_tokens: 128,
      messages: [{ role: "user", content: "Use a tool if needed." }],
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          "opencode-go": {
            thinking: { type: "disabled" },
          },
        },
      }),
    );
  });

  it("disables DeepSeek thinking mode for streaming requests", async () => {
    const model = resolveOpenCodeGoModel("opencode-go/deepseek-v4-flash");
    expect(model).toBeDefined();

    const client = new OpenCodeGoAiClient(new ConfigService());

    for await (const _event of client.streamText(model!, {
      model: "opencode-go/deepseek-v4-flash",
      max_tokens: 128,
      stream: true,
      messages: [{ role: "user", content: "Use a tool if needed." }],
    })) {
      // Exhaust the stream so streamText is invoked.
    }

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          "opencode-go": {
            thinking: { type: "disabled" },
          },
        },
      }),
    );
  });
});
