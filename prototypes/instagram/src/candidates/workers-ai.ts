// Candidate B, all on Cloudflare: Llama 4 Scout on Workers AI reads the
// frames, the Whisper transcript and the caption, and writes the recipe,
// through Workers AI's OpenAI-compatible chat completions endpoint.

import { readFile } from "node:fs/promises";
import { at } from "../media.ts";
import { costUsd, SCOUT, SCOUT_FRAME_TOKENS_ASSUMED } from "../prices.ts";
import { INSTRUCTIONS, postText } from "../prompt.ts";
import { answerJsonSchema, checkAnswer } from "../recipe-schema.ts";
import { type Candidate, errorLabel, type PostInput } from "./candidate.ts";
import { workersAi } from "./cloudflare.ts";

const MAX_OUTPUT_TOKENS = 4096;

/** The instructions, the caption and the transcript, counted generously. */
const TEXT_TOKENS = 4000;

async function imagePart(path: string): Promise<unknown> {
  const data = (await readFile(path)).toString("base64");
  return { type: "image_url", image_url: { url: `data:image/jpeg;base64,${data}` } };
}

function number(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

export const workersAiCandidate: Candidate = {
  id: "B",
  label: "All on Cloudflare",
  model: SCOUT.model,
  needsExtract: true,

  estimateUsd(input: PostInput): number {
    const pictures = input.frames.length + input.images.length;
    return costUsd(SCOUT, pictures * SCOUT_FRAME_TOKENS_ASSUMED + TEXT_TOKENS, MAX_OUTPUT_TOKENS);
  },

  async write(input: PostInput) {
    const started = Date.now();
    try {
      const pictures = [];
      for (const path of [...input.frames, ...input.images]) pictures.push(await imagePart(path));
      const answer = await workersAi("v1/chat/completions", {
        model: SCOUT.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: {
          type: "json_schema",
          json_schema: { name: "answer", schema: answerJsonSchema },
        },
        messages: [
          { role: "system", content: INSTRUCTIONS },
          {
            role: "user",
            content: [
              ...pictures,
              { type: "text", text: postText(input.caption, input.transcript) },
            ],
          },
        ],
      });
      const text = at(answer, "choices", 0, "message", "content");
      const inputTokens = number(at(answer, "usage", "prompt_tokens"));
      const outputTokens = number(at(answer, "usage", "completion_tokens"));
      return {
        ...checkAnswer(typeof text === "string" ? text : JSON.stringify(text ?? null)),
        inputTokens,
        outputTokens,
        costUsd: costUsd(SCOUT, inputTokens, outputTokens),
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
