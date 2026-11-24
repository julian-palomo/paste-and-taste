import { createMiddleware } from "@tanstack/react-start";

// Gives a server function the config that src/server.ts validated, and the
// origin the page was asked on, which absolute links are built from.
export const withConfig = createMiddleware().server(({ next, context, request }) =>
  next({ context: { config: context.config, origin: new URL(request.url).origin } }),
);
