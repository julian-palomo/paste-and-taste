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

export const SCOUT: Price = {
  model: "@cf/meta/llama-4-scout-17b-16e-instruct",
  inputPerM: 0.27,
  outputPerM: 0.85,
  source: "https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/",
  read: "2026-11-17",
};

/**
 * Tokens a frame is assumed to cost Llama 4 Scout, for the worst-case estimate
 * only: its documentation gives no rate, and the run counts the real figure.
 */
export const SCOUT_FRAME_TOKENS_ASSUMED = 1600;

export const WHISPER = {
  model: "@cf/openai/whisper-large-v3-turbo",
  perAudioMinute: 0.000513,
  source: "https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/",
  read: "2026-11-17",
};

export const CLAUDE: Price = {
  model: "claude-haiku-5-5",
  // For prompts up to 100,000 input tokens, which every post here stays under.
  inputPerM: 0.1,
  outputPerM: 0.5,
  source: "https://platform.claude.com/docs/en/about-claude/pricing",
  read: "2026-11-16",
};

/**
 * Tokens Claude counts for an image, ceil(width / 28) * ceil(height / 28), from
 * https://platform.claude.com/docs/en/build-with-claude/vision; a vertical frame
 * 768 pixels wide is about 768 x 1365, so 28 * 49 = 1,372 tokens.
 */
export function claudeImageTokens(width: number, height: number): number {
  return Math.ceil(width / 28) * Math.ceil(height / 28);
}

export function costUsd(price: Price, inputTokens: number, outputTokens: number): number {
  return (inputTokens * price.inputPerM + outputTokens * price.outputPerM) / 1e6;
}
