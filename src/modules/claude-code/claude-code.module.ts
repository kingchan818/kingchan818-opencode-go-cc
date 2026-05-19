import { Module } from "@nestjs/common";
import { OPENCODE_GO_AI_CLIENT } from "../../integrations/opencode-go/opencode-go.types";
import { OpenCodeGoAiClient } from "../../integrations/opencode-go/opencode-go-ai.client";
import { MessageController } from "./message/message.controller";
import { MessageService } from "./message/message.service";
import { ModelController } from "./model/model.controller";
import { ModelService } from "./model/model.service";

@Module({
  controllers: [MessageController, ModelController],
  providers: [
    MessageService,
    ModelService,
    {
      provide: OPENCODE_GO_AI_CLIENT,
      useClass: OpenCodeGoAiClient,
    },
  ],
  exports: [MessageService, ModelService],
})
export class ClaudeCodeModule {}
