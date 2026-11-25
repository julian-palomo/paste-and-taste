// Every page route's `onError`. The router sends a failed load's error to the
// browser with its message, inside the page's hydration script. This logs the
// original, where only the Worker's log keeps it, and throws a bare error in
// its place: the router renders the error page and answers 500 either way.
// The router calls it for errors only, never for notFound() or a redirect.
export function keepErrorOnServer(error: unknown): never {
  console.error(error);
  throw new Error("unexpected");
}
