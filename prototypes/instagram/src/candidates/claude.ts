// Candidate C: Claude reads the frames, the Whisper transcript and the caption,
// and writes the recipe in the schema through structured output.

import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE, claudeImageTokens, costUsd } from "../prices.ts";
import { INSTRUCTIONS, postText } from "../prompt.ts";
import { answerJsonSchema, checkAnswer } from "../recipe-schema.ts";
import { type Candidate, errorLabel, type PostInput } from "./candidate.ts";

const MAX_OUTPUT_TOKENS = 4096;

/** The instructions, the caption and the transcript, counted generously. */
const TEXT_TOKENS = 4000;

/** A frame's size for the estimate: 768 pixels wide, vertical 9:16. */
const FRAME_TOKENS = claudeImageTokens(768, 1365);

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({ apiKey });
  return client;
}

async function imageBlock(path: string): Promise<Anthropic.ImageBlockParam> {
  const data = (await readFile(path)).toString("base64");
  return { type: "image", source: { type: "base64", media_type: "image/jpeg", data } };
}

export const claudeCandidate: Candidate = {
  id: "C",
  label: "Claude writes it",
  model: CLAUDE.model,
  needsExtract: true,

  estimateUsd(input: PostInput): number {
    const pictures = input.frames.length + input.images.length;
    return costUsd(CLAUDE, pictures * FRAME_TOKENS + TEXT_TOKENS, MAX_OUTPUT_TOKENS);
  },

  async write(input: PostInput) {
    const started = Date.now();
    try {
      const pictures: Anthropic.ImageBlockParam[] = [];
      for (const path of [...input.frames, ...input.images]) pictures.push(await imageBlock(path));
      const response = await anthropic().messages.create({
        model: CLAUDE.model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: INSTRUCTIONS,
        output_config: { format: { type: "json_schema", schema: answerJsonSchema } },
        messages: [
          {
            role: "user",
            content: [
              ...pictures,
              { type: "text", text: postText(input.caption, input.transcript) },
            ],
          },
        ],
      });
      const { input_tokens: inputTokens, output_tokens: outputTokens } = response.usage;
      const cost = costUsd(CLAUDE, inputTokens, outputTokens);
      const text = response.content.find((block) => block.type === "text");
      const refused = response.stop_reason === "refusal";
      return {
        ...(refused || !text ? { valid: false, answer: null } : checkAnswer(text.text)),
        inputTokens,
        outputTokens,
        costUsd: cost,
        ms: Date.now() - started,
        error: refused ? "refusal" : null,
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
