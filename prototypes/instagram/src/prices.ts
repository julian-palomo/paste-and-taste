// Each model's published prices, in USD, with where they were read and when.
// Costs are computed from these and from the usage each response reports;
// estimates also use the token rates below. Update a price only from its
// source, and change `read` with it.

export type Price = {
  model: string;
  inputPerM: number;
  outputPerM: number;
  source: string;
  read: string;
  /** A price change the source announces, if any. */
  changes?: string;
};

export const GEMINI: Price = {
  model: "gemini-3.8-flash",
  // Text, image, video and audio input alike.
  inputPerM: 0.75,
  // Thinking tokens are billed as output.
  outputPerM: 3.75,
  source: "https://aistudio.google.com/docs/pricing",
  read: "2026-11-16",
  changes: "input 1.50 and output 7.50 from 2027-01-01",
};

/** Tokens a second of video costs Gemini at its default (low) media resolution. */
export const GEMINI_VIDEO_TOKENS_PER_S = 100;

/** Tokens an image costs Gemini at standard resolution. */
export const GEMINI_IMAGE_TOKENS = 258;

export function costUsd(price: Price, inputTokens: number, outputTokens: number): number {
  return (inputTokens * price.inputPerM + outputTokens * price.outputPerM) / 1e6;
}
