// What a candidate is given and what it returns. The input holds other
// people's content and file paths in a temporary folder; a result holds no
// text from the post except the answer, which goes to the owner's folder.

export type CandidateId = "A" | "B" | "C";

export type PostInput = {
  caption: string;
  /** Paths in the temporary folder. */
  video: string | null;
  videoSeconds: number | null;
  images: string[];
  frames: string[];
  transcript: string | null;
  /** Above this size a video is sent through a provider's file upload, not inline. */
  inlineLimitBytes: number;
};

/** One call to the model that writes the recipe. */
type Written = {
  valid: boolean;
  answer: unknown;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ms: number;
  /** The error's name and status, never its message, which may quote the input. */
  error: string | null;
};

export type Candidate = {
  id: CandidateId;
  label: string;
  model: string;
  /** Whether it reads the transcript and the frames rather than the video. */
  needsExtract: boolean;
  /** The worst case of `write`, from the published prices and `max_tokens`. */
  estimateUsd(input: PostInput): number;
  write(input: PostInput): Promise<Written>;
};

/** The error's name, its status, and the code of its cause, such as a socket error under fetch's TypeError. */
export function errorLabel(error: unknown): string {
  if (!(error instanceof Error)) return "error";
  const status = (error as { status?: unknown }).status;
  const cause = (error as { cause?: { code?: unknown } }).cause;
  return [
    error.name,
    typeof status === "number" ? String(status) : "",
    typeof cause?.code === "string" ? `(${cause.code})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
