import { createServerFn } from "@tanstack/react-start";
import { withConfig } from "../config/config.middleware.ts";
import { showcaseShown } from "./showcase-shown.ts";

// A server function, because the environment is in the config, which only
// the web app's server has. It sends the browser whether the page is shown,
// never the environment itself.
export const getShowcasePage = createServerFn({ method: "GET" })
  .middleware([withConfig])
  .handler(async ({ context }) => ({
    shown: showcaseShown(context.config.environment),
    origin: context.origin,
  }));
