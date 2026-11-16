import type { PostLink } from "../links.ts";
import type { Measurement, RouteName } from "../types.ts";
import { measureEmbed } from "./embed.ts";
import { measureOembed } from "./oembed.ts";
import { measurePage } from "./page.ts";

export function measureRoute(route: RouteName, link: PostLink): Promise<Measurement> {
  switch (route) {
    case "embed":
      return measureEmbed(link);
    case "oembed":
      return measureOembed(link);
    case "page":
      return measurePage(link);
  }
}
