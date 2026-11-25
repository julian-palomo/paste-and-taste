// Candidate A: Gemini reads the video itself, with its audio, plus the caption
// and any carousel images, in one call that answers in the recipe schema. A
// video above the inline limit goes through the Files API and is deleted right
// after the call: these are other people's videos, and Google would otherwise
// keep the file 48 hours.

import { readFile, stat } from "node:fs/promises";
import { FileState, GoogleGenAI, type Part } from "@google/genai";
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

/** Every upload's display name starts with this, so a check can list what is left. */
const UPLOAD_PREFIX = "instagram-spike-";

/** How long to wait for an uploaded video to finish processing, and how often to ask. */
const READY_TIMEOUT_MS = 120_000;
const READY_POLL_MS = 2_000;

async function remove(name: string): Promise<void> {
  try {
    await gemini().files.delete({ name });
  } catch (error) {
    // Only the file's name: never anything from the post.
    console.error(
      `Gemini file ${name} could not be deleted (${errorLabel(error)}); it expires in 48 hours`,
    );
  }
}

/** Uploads a video and waits until Gemini can read it; deletes it again if it never can. */
async function upload(path: string, mimeType: string): Promise<{ part: Part; name: string }> {
  const file = await gemini().files.upload({
    file: path,
    config: { mimeType, displayName: `${UPLOAD_PREFIX}${Date.now()}` },
  });
  if (!file.name) throw new Error("the upload returned no file name");
  const name = file.name;
  try {
    let current = file;
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (current.state === FileState.PROCESSING) {
      if (Date.now() > deadline) throw new Error("the uploaded video was not ready in time");
      await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
      current = await gemini().files.get({ name });
    }
    if (current.state !== FileState.ACTIVE || !current.uri) {
      throw new Error(`the uploaded video is ${current.state ?? "in no state"}`);
    }
    return { part: { fileData: { fileUri: current.uri, mimeType } }, name };
  } catch (error) {
    await remove(name);
    throw error;
  }
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
    let uploaded: string | null = null;
    try {
      const parts: Part[] = [];
      if (input.video && (await stat(input.video)).size > input.inlineLimitBytes) {
        const file = await upload(input.video, "video/mp4");
        uploaded = file.name;
        parts.push(file.part);
      } else if (input.video) {
        parts.push(await inline(input.video, "video/mp4"));
      }
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
    } finally {
      if (uploaded) await remove(uploaded);
    }
  },
};
