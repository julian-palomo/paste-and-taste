import { AppError } from "./app-error.ts";

// A request whose body or path doesn't match its route's schema. Thrown by a
// module's defaultHook, so the answer is Problem Details like every error.
export class InvalidRequestError extends AppError {
  readonly type = "about:blank";
  readonly title = "Bad Request";
  readonly status = 400;
}
