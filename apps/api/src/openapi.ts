import type { OpenAPIHono } from "@hono/zod-openapi";

// The OpenAPI document of an application built by createApp, from the routes
// and schemas its modules declare. scripts/openapi.ts writes it to
// openapi.json; nothing serves it.
export function openApiDocument(app: OpenAPIHono) {
  return app.getOpenAPI31Document({
    openapi: "3.1.0",
    // OpenAPI requires a version. The API isn't versioned: keep 0.0.0 until it is.
    info: { title: "Paste & Taste API", version: "0.0.0" },
  });
}
