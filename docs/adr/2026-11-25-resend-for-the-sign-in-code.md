# Resend sends the sign-in code, from the app's own subdomain

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

A user signs in with a code sent to their email address
([the record](2026-11-25-login-without-a-password.md)), which also asks that the
email come from the app's own domain with SPF, DKIM and DMARC, and that the
owner learn when sending fails or bounces. Until now the code was only printed
in the API's terminal, in development. The owner bought `pasteandtaste.app` on
25 Nov 2026.

Better Auth calls the app's sender through a function that catches and only
logs any error (better-auth 1.7.27, `runInBackgroundOrAwait`), so a send made
there that failed would still answer "sent".

## Decision

The sign-in code is sent by **Resend**, the owner's choice of 25 Nov 2026, from
`Paste & Taste <login@mail.pasteandtaste.app>`: a subdomain, as
[Resend's domains page](https://resend.com/docs/dashboard/domains/introduction)
recommends "to isolate your sending reputation". There is no reply-to: help
comes through a form, never a published address.

- **The app has its own Resend account**, apart from the one the owner uses for
  another project. The free plan's limits are per account, and so is the bounce
  rate Resend asks to keep under 4%, above which it may pause sending
  ([account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)):
  another project's bounces could otherwise stop the app's codes. The app's key,
  domain and dashboard also stay apart.
- **The free plan**, read on [Resend's pricing page](https://resend.com/pricing)
  on 25 Nov 2026: 3,000 emails a month, 100 a day, 3 domains, 1 webhook
  endpoint and 30-day data retention.
- **The API calls Resend with `fetch`**, one `POST https://api.resend.com/emails`
  ([send email](https://resend.com/docs/api-reference/emails/send-email)), not
  its SDK: no dependency for one call. The key, `RESEND_API_KEY`, is a
  sending-only key limited to the domain, a server-side secret.
- **The code is sent by the API's route, not by Better Auth's callback**, which
  only keeps it (`apps/api/src/login/outbox.ts`). A failed send then answers
  502 and logs Resend's status and error name only.
- **DMARC starts at `p=none` with no `rua=`**, as
  [Resend's DMARC page](https://resend.com/docs/dashboard/domains/dmarc) advises
  starting, so no address is published in DNS; it moves to `quarantine` and
  `reject` once the mail passes.
- **The alert on failures and bounces waits for the deployed login.** A Resend
  webhook ([event types](https://resend.com/docs/dashboard/webhooks/event-types):
  `email.failed`, `email.bounced`, `email.complained`,
  `email.delivery_delayed`, signed through Svix) needs a public address, and the
  login runs only locally. Until then the owner reads the dashboard's Metrics
  page. The issue that deploys the login adds the webhook route.

## Alternatives considered

- **Another email service**, such as Amazon SES, Postmark, or Cloudflare's own
  sending. Not compared on price or limits for this record: the owner already
  runs Resend for another project and chose it, and its free plan covers the
  app's first users many times over.
- **Resend's SDK**: the same one request, plus a dependency.
- **The owner's existing Resend account**: one dashboard, but shared limits and
  a shared bounce rate (above).
- **The root domain, `pasteandtaste.app`, as the sender**: mixes the codes'
  reputation with anything the domain sends later.
- **Sending inside Better Auth's callback**: a failure would still answer
  "sent" (above).

## Consequences

- The owner creates the account, verifies the subdomain with the DNS records
  Resend shows, adds the DMARC record and the key
  (`docs/deploying-the-api.md`, "Sending the sign-in code").
- Without the key, development prints the code, and preview and production
  refuse to start once the login is mounted there.
- More than 100 codes a day, or 3,000 a month, needs a paid plan.
- The webhook alert is owed by the issue that deploys the login.
