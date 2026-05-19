export type OpenCodeProviderKind =
  | "openai-compatible"
  | "anthropic"
  | "alibaba";

export interface OpenCodeGoModel {
  readonly displayName: string;
  readonly upstreamModelId: string;
  readonly anthropicModelId: `opencode-go/${string}`;
  readonly upstreamBaseUrl: "https://opencode.ai/zen/go/v1";
  readonly providerKind: OpenCodeProviderKind;
}

const OPEN_CODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1" as const;

function model(
  displayName: string,
  upstreamModelId: string,
  providerKind: OpenCodeProviderKind,
): OpenCodeGoModel {
  return {
    displayName,
    upstreamModelId,
    anthropicModelId: `opencode-go/${upstreamModelId}`,
    upstreamBaseUrl: OPEN_CODE_GO_BASE_URL,
    providerKind,
  };
}

export const OPEN_CODE_GO_MODELS: readonly OpenCodeGoModel[] = [
  model("GLM-5.1", "glm-5.1", "openai-compatible"),
  model("GLM-5", "glm-5", "openai-compatible"),
  model("Kimi K2.5", "kimi-k2.5", "openai-compatible"),
  model("Kimi K2.6", "kimi-k2.6", "openai-compatible"),
  model("DeepSeek V4 Pro", "deepseek-v4-pro", "openai-compatible"),
  model("DeepSeek V4 Flash", "deepseek-v4-flash", "openai-compatible"),
  model("MiMo-V2.5", "mimo-v2.5", "openai-compatible"),
  model("MiMo-V2.5-Pro", "mimo-v2.5-pro", "openai-compatible"),
  model("MiniMax M2.7", "minimax-m2.7", "anthropic"),
  model("MiniMax M2.5", "minimax-m2.5", "anthropic"),
  model("Qwen3.6 Plus", "qwen3.6-plus", "alibaba"),
  model("Qwen3.5 Plus", "qwen3.5-plus", "alibaba"),
];

export function resolveOpenCodeGoModel(
  anthropicModelId: string,
): OpenCodeGoModel | undefined {
  return OPEN_CODE_GO_MODELS.find(
    (modelEntry) => modelEntry.anthropicModelId === anthropicModelId,
  );
}
