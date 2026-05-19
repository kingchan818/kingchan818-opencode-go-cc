import { NestFactory } from "@nestjs/core";
import { INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

const DEFAULT_REQUEST_BODY_LIMIT = "10mb";

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const requestBodyLimit =
    process.env.REQUEST_BODY_LIMIT ?? DEFAULT_REQUEST_BODY_LIMIT;

  app.use(json({ limit: requestBodyLimit }));
  app.use(urlencoded({ extended: true, limit: requestBodyLimit }));

  return app;
}

export async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

if (require.main === module) {
  void bootstrap();
}
