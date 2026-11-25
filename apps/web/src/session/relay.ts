// What every feature that calls the API on the browser's behalf shares: the
// browser's headers passed on, the API's cookies handed back, and a form's
// answer when it was posted with no JavaScript.

// What the web app's server passes on to the API about the browser. Only
// these three, so a browser can't set anything else on the API's request.
// The IP is read as the cf-connecting-ip header, never with Start's
// getRequestIP, which reads x-forwarded-for or the socket's address and finds
// nothing on Workers.
const RELAYED = ["cookie", "cf-connecting-ip", "user-agent"] as const;

export function relayHeaders(get: (name: string) => string | undefined): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of RELAYED) {
    const value = get(name);
    if (value) headers[name] = value;
  }
  return headers;
}

// The options of a client call that relays: the browser's headers out, and
// each Set-Cookie of the API's answer back, unchanged and in order.
export function relayed(
  headers: Record<string, string>,
  appendSetCookie: (cookie: string) => void,
) {
  return {
    headers,
    onSetCookie: (cookies: string[]) => {
      for (const cookie of cookies) appendSetCookie(cookie);
    },
  };
}

// Where the browser goes next after a form: a 303 to this address, or a 404
// where the page isn't shown.
export type FormResult = { redirect: string } | { notFound: true };

// A form posted with no JavaScript gets this Response as it is: a 303 back to
// the page, carrying every cookie to set, or a 404 with none.
export function formResponse(result: FormResult, cookies: string[]): Response {
  if ("notFound" in result) return new Response(null, { status: 404 });
  const headers = new Headers({ Location: result.redirect });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
