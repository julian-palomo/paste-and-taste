import nunitoSans from "@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2?url";
import outfit from "@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?url";

// The files fonts.css uses, preloaded from the root's <head> so the browser
// fetches them with the stylesheet and they are ready for the first paint.
// Fonts are fetched in CORS mode, so a preload without crossOrigin isn't used.
export const fontPreloads = [outfit, nunitoSans].map((href) => ({
  rel: "preload",
  as: "font",
  type: "font/woff2",
  crossOrigin: "anonymous" as const,
  href,
}));
