// The sign-in code Better Auth generated for this request, waiting to be sent.
// Better Auth calls its sender through runInBackgroundOrAwait, which catches
// and only logs any error, so a send inside that callback that failed would
// still answer "sent". Better Auth's callback therefore only puts the code
// here, and the route sends it, where a failure reaches the answer. One outbox
// per request, made by withAuth; never shared.
export type Outbox = {
  put(email: string, code: string): void;
  take(): { email: string; code: string } | undefined;
};

export function createOutbox(): Outbox {
  let pending: { email: string; code: string } | undefined;
  return {
    put: (email, code) => {
      pending = { email, code };
    },
    take: () => {
      const taken = pending;
      pending = undefined;
      return taken;
    },
  };
}
