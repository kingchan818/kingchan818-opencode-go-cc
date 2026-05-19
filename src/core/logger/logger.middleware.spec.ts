import { EventEmitter } from "events";
import { Request, Response } from "express";
import { LoggerMiddleware } from "./logger.middleware";
import { RequestContextService } from "./request-context.service";

class ResponseRecorder extends EventEmitter {
  readonly headers = new Map<string, string>();
  statusCode = 200;

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
    return this;
  }
}

describe("LoggerMiddleware", () => {
  it("uses the incoming x-request-id and exposes it on the response", () => {
    const logger = { log: jest.fn() };
    const context = new RequestContextService();
    const middleware = new LoggerMiddleware(context, logger);
    const request = {
      headers: { "x-request-id": "req_incoming" },
      method: "POST",
      originalUrl: "/v1/messages",
      body: { model: "opencode-go/kimi-k2.6" },
    } as unknown as Request;
    const response = new ResponseRecorder() as unknown as ResponseRecorder &
      Response;

    middleware.use(request, response, () => {
      expect(context.getRequestId()).toBe("req_incoming");
    });
    response.emit("finish");

    expect(response.headers.get("x-request-id")).toBe("req_incoming");
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("requestId=req_incoming"),
    );
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("model=opencode-go/kimi-k2.6"),
    );
  });
});
