// Speech to text for candidates B and C: Whisper on Workers AI, run once per
// post and shared, so both candidates read the same transcript.

import { readFile } from "node:fs/promises";
import { at } from "../media.ts";
import { WHISPER } from "../prices.ts";
import { errorLabel } from "./candidate.ts";
import { workersAi } from "./cloudflare.ts";

export type Transcript = {
  text: string;
  /** The audio's length as the response reports it. */
  seconds: number | null;
  costUsd: number;
  ms: number;
  error: string | null;
};

/** The worst case, from the audio's length as ffprobe measures it. */
export function transcribeEstimateUsd(seconds: number): number {
  return (seconds / 60) * WHISPER.perAudioMinute;
}

export async function transcribe(audioPath: string): Promise<Transcript> {
  const started = Date.now();
  try {
    const audio = (await readFile(audioPath)).toString("base64");
    const answer = await workersAi(`run/${WHISPER.model}`, { audio });
    const text = at(answer, "result", "text");
    const seconds = at(answer, "result", "transcription_info", "duration");
    const reported = typeof seconds === "number" ? seconds : null;
    return {
      text: typeof text === "string" ? text : "",
      seconds: reported,
      costUsd: reported === null ? 0 : transcribeEstimateUsd(reported),
      ms: Date.now() - started,
      error: null,
    };
  } catch (error) {
    return {
      text: "",
      seconds: null,
      costUsd: 0,
      ms: Date.now() - started,
      error: errorLabel(error),
    };
  }
}
