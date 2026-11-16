// The Workers entry: boots NestJS once, when the Worker starts, and hands its
// Express instance to the runtime as a Node HTTP server.

import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// Keep abortOnError false. With Nest's default (true) a startup error, such as
// a missing APP_ENV, is only logged: the Worker starts anyway and every route
// answers 500. False makes create() reject, so the Worker fails to start and
// the error names the variable.
const app = await NestFactory.create(AppModule, { abortOnError: false });
await app.init();

// Inside a Worker the port is only the key the runtime routes requests by; no
// socket opens. The server form, httpServerHandler(server), fails to typecheck:
// the generated NodeStyleServer and @types/node disagree on address().
const PORT = 8080;
createServer(app.getHttpAdapter().getInstance()).listen(PORT);

export default httpServerHandler({ port: PORT });
