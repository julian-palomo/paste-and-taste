import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { ENV_SOURCE } from "../src/config/config.module";

let app: INestApplication;

beforeEach(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ENV_SOURCE)
    .useValue({ APP_ENV: "development" })
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterEach(async () => {
  await app.close();
});

it("answers /health with ok and the environment", async () => {
  const response = await request(app.getHttpServer()).get("/health");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok", environment: "development" });
});
