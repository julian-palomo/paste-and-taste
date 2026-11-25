// Who is signed in, as the recipes module needs it: the user, and any cookie
// the session's renewal sets, which the response must carry. It throws when
// there is no session. The module declares the type; createApp gives it one
// built by the login, so recipes never imports the login.
export type CurrentUser = (
  request: Request,
) => Promise<{ user: { id: string }; setCookies: string[] }>;
