import request from "supertest";
import { createApp } from "../src/main";

describe("request body parsing", () => {
  it("accepts Anthropic message payloads larger than Express' default 100kb limit", async () => {
    const previousLimit = process.env.REQUEST_BODY_LIMIT;
    process.env.REQUEST_BODY_LIMIT = "1mb";

    const app = await createApp();
    await app.init();

    try {
      const response = await request(app.getHttpServer())
        .post("/v1/messages/count_tokens")
        .set("x-request-id", "req_e2e")
        .send({
          model: "opencode-go/kimi-k2.6",
          max_tokens: 128,
          messages: [{ role: "user", content: "x".repeat(120_000) }],
        });

      expect(response.status).toBe(201);
      expect(response.headers["x-request-id"]).toBe("req_e2e");
      expect(response.body.input_tokens).toBeGreaterThan(25_000);
    } finally {
      await app.close();
      if (previousLimit === undefined) {
        delete process.env.REQUEST_BODY_LIMIT;
      } else {
        process.env.REQUEST_BODY_LIMIT = previousLimit;
      }
    }
  });
});
