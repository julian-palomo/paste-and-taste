import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { ENV_SOURCE } from "../src/config/config.module";
import { AppError } from "../src/errors/app-error";

const INTERNAL_MESSAGE = "internal detail: db-node-7 refused the query";

class TeapotError extends AppError {
  readonly type = "https://example.com/problems/teapot";
  readonly title = "The server is a teapot";
  readonly status = 418;
}

// Exist only in these tests: the application has no route that fails.
@Controller("broken")
class BrokenController {
  @Get()
  fail() {
    throw new Error(INTERNAL_MESSAGE);
  }

  @Get("teapot")
  teapot() {
    throw new TeapotError("It brews tea, not coffee.");
  }
}

let app: INestApplication;

beforeEach(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [BrokenController],
  })
    .overrideProvider(ENV_SOURCE)
    .useValue({ APP_ENV: "development" })
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterEach(async () => {
  await app.close();
});

it("answers an unknown route with a 404 problem", async () => {
  const response = await request(app.getHttpServer()).get("/no-such-route");

  expect(response.status).toBe(404);
  expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
  expect(response.body).toEqual({
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: expect.any(String),
  });
});

it("answers an unexpected error with a 500 problem that hides it", async () => {
  const response = await request(app.getHttpServer()).get("/broken");

  expect(response.status).toBe(500);
  expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
  expect(response.body).toEqual({
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: expect.any(String),
  });
  expect(response.text).not.toContain(INTERNAL_MESSAGE);
  expect(response.text).not.toMatch(/\bat \S+:\d+/);
});

it("answers a named error with its own problem", async () => {
  const response = await request(app.getHttpServer()).get("/broken/teapot");

  expect(response.status).toBe(418);
  expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
  expect(response.body).toEqual({
    type: "https://example.com/problems/teapot",
    title: "The server is a teapot",
    status: 418,
    detail: "It brews tea, not coffee.",
  });
});
