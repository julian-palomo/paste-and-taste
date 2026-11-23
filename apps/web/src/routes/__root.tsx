import { createRootRoute, HeadContent, Outlet, Scripts, useLocation } from "@tanstack/react-router";
import { languageOfPath } from "../layout/language-path.ts";
import { Layout } from "../layout/layout.tsx";
import appCss from "../styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

// The language comes from the address, not the matched route's params, so a
// not-found page under /es is in Spanish too: it has no params of its own.
function RootDocument() {
  const { pathname } = useLocation();
  const lang = languageOfPath(pathname);
  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        <Layout lang={lang} path={pathname}>
          <Outlet />
        </Layout>
        <Scripts />
      </body>
    </html>
  );
}
