import { Global, Module } from "@nestjs/common";
import { LoggerMiddleware } from "./logger.middleware";
import { RequestContextService } from "./request-context.service";

@Global()
@Module({
  providers: [LoggerMiddleware, RequestContextService],
  exports: [LoggerMiddleware, RequestContextService],
})
export class LoggerModule {}
