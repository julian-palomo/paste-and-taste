Superseded in part by `2026-11-25-the-apps-own-domain.md`: only when production is indexed.

# How the web app deploys, and how its server reaches the API

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The web app, `apps/web`, is TanStack Start on Cloudflare Workers, built with
the Cloudflare Vite plugin. Its server calls the API through
`@paste-and-taste/api-client`. Until this record it ran only locally. The API
deploys from GitHub Actions
([2026-11-15-how-the-api-deploys.md](2026-11-15-how-the-api-deploys.md)) to a
preview Worker and a production Worker, each followed by a smoke.

What Cloudflare's documentation says, read on 23 November 2026:

- [Cloudflare environments with the Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/):
  the environment is chosen at build time with `CLOUDFLARE_ENV`, and
  specifying it "when running `vite preview` or `wrangler deploy` will have no
  effect". The build writes a flattened configuration, and
  `.wrangler/deploy/config.json` points `wrangler deploy` to it
  ([Generated Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#generated-wrangler-configuration)).
  The [Vite plugin's get-started page](https://developers.cloudflare.com/workers/vite-plugin/get-started/)
  deploys with `npm run build && wrangler deploy`.
- [Workers errors](https://developers.cloudflare.com/workers/observability/errors/),
  error 1042: "Worker tried to fetch from another Worker on the same zone,
  which is only supported when the `global_fetch_strictly_public`
  compatibility flag is used." The page doesn't say whether two Workers on one
  `workers.dev` subdomain are the same zone, and neither does
  [the flag's section](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public).
- [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
  "allow one Worker to call into another, without going through a
  publicly-accessible URL", and "don't increase costs". A Worker with
  environments is bound as `<WORKER_NAME>-<ENVIRONMENT_NAME>`.

## Decision

The owner decided, on the plan for
[#48](https://github.com/julian-palomo/paste-and-taste/issues/48):

- **Each web environment is built for itself.** `CLOUDFLARE_ENV=<env> pnpm
  build`, then `wrangler deploy --env <env>`, in a job of `deploy.yml` per
  environment. The `--env` doesn't choose anything: wrangler 4.162.0 refuses
  to deploy a build made for another environment ("This does not match the
  target environment"), which guards against crossing them. That refusal was
  observed, not read in the documentation.
- **Deployed, the web's server reaches the API through a Service binding**,
  `API`, to that environment's API Worker. Locally, under `vite dev`, it calls
  `API_URL` over HTTP, as before. `parseConfig` accepts exactly one of the two.
  The binding's `fetch` is called on the binding, never detached: workerd
  rejects that with
  [`Illegal invocation`](https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors).
- **No environment is indexed by search engines** while the app is on
  `workers.dev`. With `INDEXING: "blocked"`, every response from the Worker
  carries `X-Robots-Tag: noindex`, which
  [Google reads like the robots meta tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
  Static assets are served before the Worker runs
  ([routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/))
  and don't carry it; pages always come from the Worker.
- **One chain of jobs:** Checks, API preview, web preview, API production,
  web production. A commit that fails on preview, in either service, reaches
  neither production Worker.
- **A check after each web deploy**, `pnpm -C apps/web smoke <address>
  <environment>`, reads the rendered `/en` and `/es` and the 302 of `/`.

## Alternatives considered

- **The API's public address with `global_fetch_strictly_public`.** One path,
  locally and deployed. It lost because the documentation doesn't settle
  whether it works between two Workers on one `workers.dev` subdomain, so only
  a red deploy would have told, and each call would go out through
  Cloudflare's front door as a public request.
- **A Service binding everywhere, local development included.** One path, like
  the above. Under `vite dev`, the binding first answered `503 Worker
  "paste-and-taste-api" not found` with `pnpm -C apps/api dev` running. The
  cause: wrangler 4.162.0 and `@cloudflare/vite-plugin` 1.69.1 keep their local
  dev registries in different folders, so the two sessions never see each
  other. With the same `CLOUDFLARE_DEV_REGISTRY_PATH` for both they do; the
  variable is read by miniflare in both tools, observed and not documented.
  It lost because local development would depend on that variable.
- **Production indexed now.** The one page shows the API's health, and
  addresses indexed on `workers.dev` would have to be redirected or dropped
  once the app has its own domain.
- **The web's production job beside the API's**, needing only API production
  and web preview. The API wouldn't be held back by the web, but a new API
  could reach production under a web that failed on preview.

## Consequences

- The binding is exercised locally only by building for an environment and
  running both Workers with a shared registry (`docs/deploying-the-api.md`);
  under `vite dev` the HTTP path runs.
- Locally, with the API stopped, the binding's 503 makes the page show the
  API-error state, not the not-reachable one.
- Each GitHub environment needs a `WEB_URL` variable for the check.
- A red web job on preview also holds back the API's production deploy.
- To index production: set its `INDEXING` to `"allowed"` in
  `apps/web/wrangler.jsonc` and remove `production` from
  `NOINDEX_ENVIRONMENTS` in `apps/web/scripts/check-web.ts`, in one pull
  request.
- Whether the token, with Workers Scripts Edit, may upload static assets is
  shown only by the first deploy. Cloudflare's API reference for the
  [assets upload session](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/assets/subresources/upload/methods/create/)
  lists "Workers Admin" or "Workers Scripts Write".
