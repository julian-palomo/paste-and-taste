# The Workers answer on pasteandtaste.app, and production stays unindexed until launch

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

The owner bought `pasteandtaste.app` on 25 Nov 2026, and it is a zone in the
owner's Cloudflare account. The web app and the API answered on their
`workers.dev` addresses. The web reaches the API through a Service binding,
which names the Worker, not an address
([the record](2026-11-23-how-the-web-app-deploys.md)). That record kept
every environment unindexed "while the app is on `workers.dev`".
Production's home is the building page
([the record](2026-11-25-production-home-is-the-building-page.md)). Passkeys
and cookies will belong to this domain once the login is deployed.

From Cloudflare's pages, read on 25 Nov 2026:

- **[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/):**
  - a Custom Domain is a `routes` entry with `custom_domain: true`, and
    `wrangler deploy` creates its DNS record and certificate;
  - it can't be created over an existing CNAME;
  - each one generates an Advanced Certificate for its hostname, at any
    depth, with "no separate Advanced Certificate Manager subscription";
  - that certificate is not deleted with the domain.
- **[The token](https://developers.cloudflare.com/workers/authorization/workers/):**
  creating one needs "*Zone* > *Workers Routes* > *Write*".
- **[workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
  and the [configuration keys](https://developers.cloudflare.com/workers/wrangler/configuration/):**
  - `workers_dev` turns a Worker's `workers.dev` address off, and
    `preview_urls` its Version and Preview URLs;
  - both are inherited by environments;
  - no redirect to a custom domain is offered.

## Decision

The owner's choices, 25 Nov 2026:

- **The addresses**, each a Custom Domain in that environment's block of
  `wrangler.jsonc`:

  | Worker | preview | production |
  | --- | --- | --- |
  | web | `preview.pasteandtaste.app` | `pasteandtaste.app` |
  | API | `api.preview.pasteandtaste.app` | `api.pasteandtaste.app` |

  Preview mirrors production one level down, so whatever the login does with
  the two hostnames works the same way in both. The top level, which is local
  development, has no route.
- **The API keeps a public address.** The deploy's smoke reads it, and the
  mobile app and the deployed login will need it.
- **`workers.dev` is off.** `workers_dev: false` and `preview_urls: false` are
  written in each environment. No page there was ever indexed, so nothing is
  lost.
- **Production stays unindexed until launch.** This replaces the condition in
  [How the web app deploys](2026-11-23-how-the-web-app-deploys.md). Indexing a
  building page would only list a placeholder. At launch, in its own pull
  request, production's `INDEXING` becomes `"allowed"` and `production` leaves
  `NOINDEX_ENVIRONMENTS` in `apps/web/scripts/check-web.ts`.

## Alternatives considered

- **`api-preview.pasteandtaste.app`**, one level deep: the same certificate
  terms, but preview's two hostnames wouldn't mirror production's.
- **`www.pasteandtaste.app` as well:** it needs a redirect rule, a zone setting
  made in the dashboard. That is left to launch.
- **The API on `workers.dev` only:** one Worker would stay off the domain, and
  the login will need it there.
- **Keeping `workers.dev` beside the domain, with `noindex`:** two addresses for
  each Worker, and nothing reads the old ones.
- **Indexing production now:** search engines would list the building page.

## Consequences

- The deploy token needs the zone policy, and the GitHub variables `API_URL`
  and `WEB_URL` hold the new addresses (`docs/deploying-the-api.md`).
- A test in each workspace reads each environment's resolved configuration
  with wrangler's `unstable_readConfig`, an unstable API: a wrangler upgrade
  that changes it fails that test.
- Undoing this means removing the domains, and each leaves its Advanced
  Certificate to delete by hand.
