import { createRouter } from "@tanstack/react-router";
import { ErrorPage } from "./layout/error-page.tsx";
import { routeTree } from "./routeTree.gen.ts";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // The default, not the root's errorComponent: the root's would replace the
    // root itself, <html> and the layout included.
    defaultErrorComponent: ErrorPage,
  });
}
