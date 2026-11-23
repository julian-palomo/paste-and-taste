import { createFileRoute } from "@tanstack/react-router";
import { pickLanguage } from "../i18n/i18n.ts";

// "/" has no page of its own: a server handler sends each visitor to their
// language's address. Vary tells caches the answer depends on the header.
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(null, {
          status: 302,
          headers: {
            Location: `/${pickLanguage(request.headers.get("Accept-Language"))}`,
            Vary: "Accept-Language",
          },
        }),
    },
  },
});
