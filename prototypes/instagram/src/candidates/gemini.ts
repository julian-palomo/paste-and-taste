// Candidate A: Gemini reads the video itself, with its audio, plus the caption
// and any carousel images, in one call that answers in the recipe schema.

import { readFile } from "node:fs/promises";
import { GoogleGenAI, type Part } from "@google/genai";
import { costUsd, GEMINI, GEMINI_IMAGE_TOKENS, GEMINI_VIDEO_TOKENS_PER_S } from "../prices.ts";
import { INSTRUCTIONS, postText } from "../prompt.ts";
import { answerJsonSchema, checkAnswer } from "../recipe-schema.ts";
import { type Candidate, errorLabel, type PostInput } from "./candidate.ts";

/** Room for the thinking tokens, which count against it, and the answer. */
const MAX_OUTPUT_TOKENS = 8192;

/** The instructions and the caption, counted generously. */
const TEXT_TOKENS = 3000;

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

async function inline(path: string, mimeType: string): Promise<Part> {
  return { inlineData: { mimeType, data: (await readFile(path)).toString("base64") } };
}

export const geminiCandidate: Candidate = {
  id: "A",
  label: "Gemini, the video whole",
  model: GEMINI.model,
  needsExtract: false,

  estimateUsd(input: PostInput): number {
    const inputTokens =
      (input.videoSeconds ?? 0) * GEMINI_VIDEO_TOKENS_PER_S +
      input.images.length * GEMINI_IMAGE_TOKENS +
      TEXT_TOKENS;
    return costUsd(GEMINI, inputTokens, MAX_OUTPUT_TOKENS);
  },

  async write(input: PostInput) {
    const started = Date.now();
    try {
      const parts: Part[] = [];
      if (input.video) parts.push(await inline(input.video, "video/mp4"));
      for (const image of input.images) parts.push(await inline(image, "image/jpeg"));
      parts.push({ text: postText(input.caption, null) });

      const response = await gemini().models.generateContent({
        model: GEMINI.model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: INSTRUCTIONS,
          responseMimeType: "application/json",
          responseJsonSchema: answerJsonSchema,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      });
      const usage = response.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? 0;
      const outputTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
      const checked = checkAnswer(response.text ?? "");
      return {
        ...checked,
        inputTokens,
        outputTokens,
        costUsd: costUsd(GEMINI, inputTokens, outputTokens),
        ms: Date.now() - started,
        error: null,
      };
    } catch (error) {
      return {
        valid: false,
        answer: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        ms: Date.now() - started,
        error: errorLabel(error),
      };
    }
  },
};
