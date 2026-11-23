import { createRootRoute, HeadContent, Outlet, Scripts, useParams } from "@tanstack/react-router";
import { parseLanguage } from "../i18n/i18n.ts";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  // The language of the matched page; "en" where there is none, as on a 404.
  const { lang } = useParams({ strict: false });
  return (
    <html lang={parseLanguage(lang ?? "") ?? "en"}>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
