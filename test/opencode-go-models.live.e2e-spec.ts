import { existsSync, readFileSync } from "fs";
import { join } from "path";
import request from "supertest";
import { OPEN_CODE_GO_MODELS } from "../src/integrations/opencode-go/opencode-go-model.catalog";
import { createApp } from "../src/main";

const LIVE_E2E_ENABLED = process.env.OPENCODE_LIVE_E2E === "1";
const describeLive = LIVE_E2E_ENABLED ? describe : describe.skip;
const DEEPSEEK_MODELS = OPEN_CODE_GO_MODELS.filter((model) =>
  model.upstreamModelId.startsWith("deepseek-"),
);

function hasConfiguredApiKey(): boolean {
  if (process.env.OPENCODE_API_KEY || process.env.ANTHROPIC_API_KEY) {
    return true;
  }

  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return false;

  const envFile = readFileSync(envPath, "utf8");
  return /^(OPENCODE_API_KEY|ANTHROPIC_API_KEY)=\S+/m.test(envFile);
}

function redactProviderResponse(body: unknown): string {
  return JSON.stringify(body).replaceAll(/sk-[A-Za-z0-9_-]+/g, "sk-***");
}

describeLive("OpenCode Go live models", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    if (!hasConfiguredApiKey()) {
      throw new Error(
        "Set OPENCODE_API_KEY or ANTHROPIC_API_KEY before running live model e2e tests.",
      );
    }

    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("lists every configured model through the public models API", async () => {
    const response = await request(app.getHttpServer()).get("/v1/models");

    expect(response.status).toBe(200);
    expect(response.body.data.map((model: { id: string }) => model.id)).toEqual(
      OPEN_CODE_GO_MODELS.map((model) => model.anthropicModelId),
    );
  });

  it.each(OPEN_CODE_GO_MODELS)(
    "$anthropicModelId returns an Anthropic-compatible text message",
    async (model) => {
      const response = await postMessage()
        .set("x-request-id", `req_live_text_${model.upstreamModelId}`)
        .send({
          model: model.anthropicModelId,
          max_tokens: 128,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: "Reply with a short plain text acknowledgement.",
            },
          ],
        });

      if (response.status !== 200) {
        throw new Error(
          `${model.anthropicModelId} text returned ${response.status}: ${redactProviderResponse(response.body)}`,
        );
      }

      expect(response.headers["x-request-id"]).toBe(
        `req_live_text_${model.upstreamModelId}`,
      );
      expect(response.body).toMatchObject({
        type: "message",
        role: "assistant",
        model: model.anthropicModelId,
      });
      expect(Array.isArray(response.body.content)).toBe(true);
      expect(response.body.usage.input_tokens).toBeGreaterThan(0);
      expect(response.body.usage.output_tokens).toBeGreaterThan(0);
    },
    60_000,
  );

  it.each(OPEN_CODE_GO_MODELS)(
    "$anthropicModelId returns an Anthropic-compatible tool call",
    async (model) => {
      const response = await postMessage()
        .set("x-request-id", `req_live_tool_${model.upstreamModelId}`)
        .send({
          model: model.anthropicModelId,
          max_tokens: 256,
          temperature: 0,
          system:
            "When a tool is available and the user asks for status, call the tool. Do not answer from memory.",
          tools: [
            {
              name: "report_status",
              description: "Report the status for a named service.",
              input_schema: {
                type: "object",
                properties: {
                  service: {
                    type: "string",
                    description: "The service name to check.",
                  },
                },
                required: ["service"],
              },
            },
          ],
          messages: [
            {
              role: "user",
              content:
                "Call the report_status tool for the service named api. Do not write a text answer.",
            },
          ],
        });

      if (response.status !== 200) {
        throw new Error(
          `${model.anthropicModelId} tool returned ${response.status}: ${redactProviderResponse(response.body)}`,
        );
      }

      const toolUseBlocks = response.body.content.filter(
        (block: { type?: string }) => block.type === "tool_use",
      );

      if (toolUseBlocks.length === 0) {
        throw new Error(
          `${model.anthropicModelId} did not return a tool_use block: ${redactProviderResponse(response.body)}`,
        );
      }

      expect(response.headers["x-request-id"]).toBe(
        `req_live_tool_${model.upstreamModelId}`,
      );
      expect(response.body).toMatchObject({
        type: "message",
        role: "assistant",
        model: model.anthropicModelId,
        stop_reason: "tool_use",
      });
      expect(toolUseBlocks).toHaveLength(1);
      expect(toolUseBlocks[0]).toMatchObject({
        type: "tool_use",
        name: "report_status",
      });
      expect(toolUseBlocks[0].input).toEqual(
        expect.objectContaining({ service: expect.any(String) }),
      );
      expect(response.body.usage.input_tokens).toBeGreaterThan(0);
      expect(response.body.usage.output_tokens).toBeGreaterThan(0);
    },
    60_000,
  );

  it.each(DEEPSEEK_MODELS)(
    "$anthropicModelId streams after a prior tool call without reasoning_content",
    async (model) => {
      const response = await postMessage()
        .set("x-request-id", `req_live_deepseek_reasoning_${model.upstreamModelId}`)
        .send({
          model: model.anthropicModelId,
          stream: true,
          max_tokens: 128,
          tools: [
            {
              name: "report_status",
              description: "Report the status for a named service.",
              input_schema: {
                type: "object",
                properties: {
                  service: { type: "string" },
                },
                required: ["service"],
              },
            },
          ],
          tool_choice: { type: "auto" },
          messages: [
            {
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: "toolu_reasoning_regression",
                  name: "report_status",
                  input: { service: "api" },
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "toolu_reasoning_regression",
                  content: "api is healthy",
                },
                {
                  type: "text",
                  text: "Continue with a short answer.",
                },
              ],
            },
          ],
        });

      if (response.status !== 200) {
        throw new Error(
          `${model.anthropicModelId} streamed continuation returned ${response.status}: ${redactProviderResponse(response.body)}`,
        );
      }

      expect(response.headers["x-request-id"]).toBe(
        `req_live_deepseek_reasoning_${model.upstreamModelId}`,
      );
      expect(response.text).toContain("event: message_start");
      expect(response.text).toContain("event: message_stop");
    },
    60_000,
  );

  function postMessage() {
    const httpRequest = request(app.getHttpServer()).post("/v1/messages");
    const apiKey = process.env.OPENCODE_API_KEY ?? process.env.ANTHROPIC_API_KEY;

    if (apiKey) {
      httpRequest.set("x-api-key", apiKey);
    }

    return httpRequest;
  }
});
