import { createContext } from "react";
import type { Language } from "../i18n/i18n.ts";

// The language and address of the page being shown. Layout provides it, so
// the not-found and error pages, which the router renders with no params of
// their own, read them here and need no router hook.
type Page = { lang: Language; path: string };

export const PageContext = createContext<Page>({ lang: "en", path: "/en" });
