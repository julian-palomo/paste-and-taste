import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Tailwind first, as Tailwind's guide for TanStack Start lists it. Then the
// order the TanStack Start and Cloudflare guides give: the Cloudflare plugin
// runs the server side ("ssr") in the Workers runtime.
export default defineConfig({
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    viteReact(),
  ],
});
