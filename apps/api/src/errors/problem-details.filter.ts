import { STATUS_CODES } from "node:http";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injects by the class it reads from decorator metadata at runtime; a type-only import erases it.
import { HttpAdapterHost } from "@nestjs/core";
import { AppError } from "./app-error";

type Problem = { type: string; title: string; status: number; detail: string };

// The one place an error becomes a response: Problem Details, RFC 9457.
// Catches everything, so no error leaves the API in another format.
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const problem = this.toProblem(exception);

    const { httpAdapter } = this.adapterHost;
    const response = host.switchToHttp().getResponse();
    httpAdapter.setHeader(response, "Content-Type", "application/problem+json");
    httpAdapter.reply(response, problem, problem.status);
  }

  private toProblem(exception: unknown): Problem {
    if (exception instanceof AppError) {
      const { type, title, status, message } = exception;
      return { type, title, status, detail: message };
    }

    // Nest's own errors, such as the NotFoundException for an unknown route.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return { type: "about:blank", title: title(status), status, detail: exception.message };
    }

    // Unexpected: its message and stack go to the log only. Never put them in
    // the body, they can name hosts, queries or values.
    this.logger.error(exception);
    return {
      type: "about:blank",
      title: title(500),
      status: 500,
      detail: "The server could not complete the request.",
    };
  }
}

function title(status: number): string {
  return STATUS_CODES[status] ?? "Error";
}
