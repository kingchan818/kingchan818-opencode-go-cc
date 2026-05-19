import { Injectable, Logger, NestMiddleware, Optional } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { RequestContextService } from "./request-context.service";

const REQUEST_ID_HEADER = "x-request-id";

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContext: RequestContextService,
    @Optional()
    private readonly logger: Pick<Logger, "log"> = new Logger(
      LoggerMiddleware.name,
    ),
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = getRequestId(request);
    const startTime = Date.now();

    response.setHeader(REQUEST_ID_HEADER, requestId);

    this.requestContext.runWithRequestId(requestId, () => {
      response.on("finish", () => {
        this.logger.log(
          [
            `requestId=${requestId}`,
            request.method,
            request.originalUrl,
            `status=${response.statusCode}`,
            `durationMs=${Date.now() - startTime}`,
            `model=${getRequestModel(request)}`,
          ].join(" "),
        );
      });

      next();
    });
  }
}

function getRequestId(request: Request): string {
  const header = request.headers[REQUEST_ID_HEADER];
  if (typeof header === "string" && header.length > 0) return header;
  if (Array.isArray(header) && header[0]) return header[0];
  return crypto.randomUUID();
}

function getRequestModel(request: Request): string {
  const body = request.body as { model?: unknown } | undefined;
  return typeof body?.model === "string" ? body.model : "none";
}
