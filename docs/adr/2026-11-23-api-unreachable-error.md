# ApiUnreachableError when no usable answer comes back from the API

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

[2026-11-16-api-contract-from-openapi.md](2026-11-16-api-contract-from-openapi.md)
says "Every failure is thrown as `ApiError`". That holds for every response
that is an error, whatever its body. It did not hold for a call that gets no
usable answer. Read in `openapi-fetch` 0.17.0 and run in the client's tests
on 23 November 2026:

- When `fetch` rejects, as it does with no network, the client threw the
  platform's error: `TypeError: fetch failed` in Node. React Native's
  `fetch`, by the source of the `whatwg-fetch` polyfill it bundles (not
  run), rejects with `TypeError: Network request failed`.
- A 200 whose body is HTML, as a captive portal or a wrong address gives,
  threw a bare `SyntaxError`.
- A 200 with an empty body, with or without `Content-Length: 0`, resolved
  `undefined`, typed as the documented body.

On a phone, no network is the most common failure.

## Decision

The owner decided that these three cases throw a second class,
**`ApiUnreachableError`**, exported by `@paste-and-taste/api-client`, with the
platform's error as its `cause` when there is one. `ApiError` means the API
answered with an error; `ApiUnreachableError` means no usable answer came
back. The client reads a 200's body as text and parses the JSON itself.

## Alternatives considered

- **`ApiError` with `status: 0`.** One class to catch. It lost because every
  caller has to know that 0 is special, and `problem` would be invented
  rather than read from a response.
- **The platform's errors, with the docs corrected.** No code. It lost
  because the app would match a `TypeError` whose message differs by
  runtime, and a 200 that isn't JSON would still throw a bare `SyntaxError`.
- **The name `NetworkError`.** It lost because the class also covers a 200
  with an HTML or empty body, which is not a network failure, and browsers
  already use the name: it is a `DOMException` name, and Firefox's `fetch`
  failure message.

## Consequences

- A caller handles two named classes and picks its message from the class:
  check the connection, or something went wrong on the API's side.
- A 200 with a body that the network cuts off while it is being read still
  rejects with the platform's error.
- The client still trusts a JSON body's shape; it doesn't validate a
  successful body against the document at runtime.
