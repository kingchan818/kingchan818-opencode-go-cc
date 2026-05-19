import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "./core/config/config.module";
import { LoggerMiddleware } from "./core/logger/logger.middleware";
import { LoggerModule } from "./core/logger/logger.module";
import { ClaudeCodeModule } from "./modules/claude-code/claude-code.module";

@Module({
  imports: [ConfigModule, LoggerModule, ClaudeCodeModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
