import { createRootRoute, HeadContent, Outlet, Scripts, useLocation } from "@tanstack/react-router";
import { languageOfPath } from "../layout/language-path.ts";
import { Layout } from "../layout/layout.tsx";
import { NotFoundPage } from "../layout/not-found-page.tsx";
import appCss from "../styles/app.css?url";
import { fontPreloads } from "../styles/fonts.ts";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [{ rel: "stylesheet", href: appCss }, ...fontPreloads],
  }),
  component: RootDocument,
  // Any address no route matches, and any notFound() a route throws, lands
  // here: the root still renders the layout and its <Outlet> shows this, 404.
  notFoundComponent: NotFoundPage,
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
