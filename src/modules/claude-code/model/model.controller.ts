import { Controller, Get } from "@nestjs/common";
import { ModelService } from "./model.service";

@Controller("v1/models")
export class ModelController {
  constructor(private readonly modelService: ModelService) {}

  @Get()
  listModels() {
    return this.modelService.listModels();
  }
}
