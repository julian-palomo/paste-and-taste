// The base of every error the API answers on purpose. A subclass names the
// problem; ProblemDetailsFilter turns it into the response, with the message
// as `detail`, so a message must be safe for a client to read.
export abstract class AppError extends Error {
  // A URI that identifies the kind of problem (RFC 9457, section 3.1.1).
  abstract readonly type: string;
  abstract readonly title: string;
  abstract readonly status: number;

  override get name() {
    return this.constructor.name;
  }
}
