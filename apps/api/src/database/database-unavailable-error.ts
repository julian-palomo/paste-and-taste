import { AppError } from "../errors/app-error.ts";

// The database could not be reached, or did not answer in time. The message
// becomes the response's `detail`: it never carries the driver's message,
// which can name the host.
export class DatabaseUnavailableError extends AppError {
  readonly type = "about:blank";
  readonly title = "Service Unavailable";
  readonly status = 503;

  static unreachable(): DatabaseUnavailableError {
    return new DatabaseUnavailableError("The database could not be reached.");
  }

  static timedOut(limitMs: number): DatabaseUnavailableError {
    return new DatabaseUnavailableError(
      `The database did not answer within ${limitMs / 1000} seconds.`,
    );
  }
}
