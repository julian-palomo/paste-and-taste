import { AppError } from "../errors/app-error.ts";

// The same answer for a recipe that doesn't exist and for another user's, so
// no answer says whether a recipe exists.
export class RecipeNotFoundError extends AppError {
  readonly type = "about:blank";
  readonly title = "Not Found";
  readonly status = 404;

  constructor() {
    super("No such recipe.");
  }
}
