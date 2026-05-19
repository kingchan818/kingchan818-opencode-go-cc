import { RequestContextService } from "./request-context.service";

describe("RequestContextService", () => {
  it("exposes the request id inside the active async context", async () => {
    const service = new RequestContextService();

    await service.runWithRequestId("req_123", async () => {
      expect(service.getRequestId()).toBe("req_123");
      await Promise.resolve();
      expect(service.getRequestId()).toBe("req_123");
    });
  });

  it("returns undefined outside a request context", () => {
    const service = new RequestContextService();

    expect(service.getRequestId()).toBeUndefined();
  });
});
