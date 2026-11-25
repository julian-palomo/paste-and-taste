import { NotSignedInError } from "./login-errors.ts";
import type { WithAuth } from "./with-auth.ts";

type SessionReader = (request: Request) => Promise<{ user: { id: string }; setCookies: string[] }>;

// Reads the request's session for another module, the way GET /login/session
// does: one Better Auth instance and one client for the read. Better Auth
// renews a remembered session at most once a day and says so in Set-Cookie;
// those cookies are returned for the caller to send on, or a user who only
// uses that module would lose a session they keep using.
export function createSessionReader(withAuth: WithAuth): SessionReader {
  return (request) =>
    withAuth(request, async (auth) => {
      const headers = new Headers();
      const cookie = request.headers.get("cookie");
      if (cookie) headers.set("cookie", cookie);
      const result = await auth.api.getSession({ headers, returnHeaders: true });
      if (!result.response) throw new NotSignedInError();
      return { user: { id: result.response.user.id }, setCookies: result.headers.getSetCookie() };
    });
}
