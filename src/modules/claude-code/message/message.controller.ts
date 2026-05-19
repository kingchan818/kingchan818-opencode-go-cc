import { Body, Controller, Headers, Post, Res } from "@nestjs/common";
import { Response } from "express";
import { AnthropicMessagesRequest } from "./dto/anthropic-message.dto";
import { extractAuthToken } from "./message-auth.util";
import { MessageService } from "./message.service";
import { writeAnthropicMessageStream } from "./message-sse.presenter";

@Controller("v1/messages")
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  async createMessage(
    @Body() request: AnthropicMessagesRequest,
    @Headers("x-api-key") xApiKey: string | undefined,
    @Headers("authorization") authorization: string | undefined,
    @Res({ passthrough: false }) response: Response,
  ): Promise<void> {
    const authToken = extractAuthToken(xApiKey, authorization);

    if (request.stream) {
      await writeAnthropicMessageStream(
        response,
        request,
        this.messageService.streamMessage(request, authToken),
      );
      return;
    }

    const message = await this.messageService.createMessage(request, authToken);
    response.status(200).json(message);
  }

  @Post("count_tokens")
  countTokens(@Body() request: AnthropicMessagesRequest) {
    return this.messageService.countTokens(request);
  }
}
