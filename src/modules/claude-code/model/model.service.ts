import { Injectable } from "@nestjs/common";
import { OPEN_CODE_GO_MODELS } from "../../../integrations/opencode-go/opencode-go-model.catalog";

@Injectable()
export class ModelService {
  listModels() {
    return {
      data: OPEN_CODE_GO_MODELS.map((model) => ({
        id: model.anthropicModelId,
        type: "model",
        display_name: model.displayName,
      })),
      has_more: false,
      first_id: OPEN_CODE_GO_MODELS[0]?.anthropicModelId ?? null,
      last_id:
        OPEN_CODE_GO_MODELS[OPEN_CODE_GO_MODELS.length - 1]
          ?.anthropicModelId ?? null,
    };
  }
}
