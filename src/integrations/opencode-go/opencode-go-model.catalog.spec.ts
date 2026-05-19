import {
  OPEN_CODE_GO_MODELS,
  resolveOpenCodeGoModel,
} from "./opencode-go-model.catalog";

describe("OpenCode Go model catalog", () => {
  it("exposes every requested model with opencode-go ids", () => {
    expect(OPEN_CODE_GO_MODELS.map((model) => model.anthropicModelId)).toEqual([
      "opencode-go/glm-5.1",
      "opencode-go/glm-5",
      "opencode-go/kimi-k2.5",
      "opencode-go/kimi-k2.6",
      "opencode-go/deepseek-v4-pro",
      "opencode-go/deepseek-v4-flash",
      "opencode-go/mimo-v2.5",
      "opencode-go/mimo-v2.5-pro",
      "opencode-go/minimax-m2.7",
      "opencode-go/minimax-m2.5",
      "opencode-go/qwen3.6-plus",
      "opencode-go/qwen3.5-plus",
    ]);
  });

  it("routes Anthropic-package models to the messages endpoint", () => {
    expect(resolveOpenCodeGoModel("opencode-go/minimax-m2.7")).toMatchObject({
      providerKind: "anthropic",
      upstreamModelId: "minimax-m2.7",
      upstreamBaseUrl: "https://opencode.ai/zen/go/v1",
    });
  });

  it("routes OpenAI-compatible models to the chat completions endpoint", () => {
    expect(resolveOpenCodeGoModel("opencode-go/kimi-k2.6")).toMatchObject({
      providerKind: "openai-compatible",
      upstreamModelId: "kimi-k2.6",
      upstreamBaseUrl: "https://opencode.ai/zen/go/v1",
    });
  });
});
