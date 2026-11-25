// A scratch Worker that tries Media Transformations' binding on one video: it
// asks for one frame and for the audio, and answers with each output's type,
// size and time, never the media itself. The script on the owner's machine
// POSTs the video; the Worker keeps nothing.

/** The binding's methods this Worker uses, as its documentation describes them. */
type MediaResult = { response(): Promise<Response> };
type MediaOutputOptions = {
  mode: "frame" | "audio";
  time?: string;
  duration?: string;
  format?: "jpg" | "png" | "m4a";
};
type MediaTransformer = { output(options: MediaOutputOptions): MediaResult };
type MediaInput = MediaTransformer & { transform(options: { width?: number }): MediaTransformer };
type MediaBinding = { input(stream: ReadableStream<Uint8Array>): MediaInput };

type Env = { MEDIA: MediaBinding; RUN_TOKEN?: string };

/** Longest audio asked for: the documented default stops at 60 s. */
const MAX_AUDIO_SECONDS = 60;

type Outcome = {
  ok: boolean;
  contentType: string | null;
  bytes: number;
  ms: number;
  error: string | null;
};

async function measure(work: () => Promise<Response>): Promise<Outcome> {
  const started = Date.now();
  try {
    const response = await work();
    const bytes = (await response.arrayBuffer()).byteLength;
    return {
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      bytes,
      ms: Date.now() - started,
      error: response.ok ? null : `status ${response.status}`,
    };
  } catch (error) {
    const label = error instanceof Error ? `${error.name}: ${error.message}` : "error";
    return {
      ok: false,
      contentType: null,
      bytes: 0,
      ms: Date.now() - started,
      error: label.slice(0, 200),
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Fails closed: until the owner sets RUN_TOKEN every request gets 401, so
    // nobody else can make this Worker spend transformations. Don't relax this.
    if (!env.RUN_TOKEN || request.headers.get("authorization") !== `Bearer ${env.RUN_TOKEN}`) {
      return new Response("unauthorized", { status: 401 });
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== "/extract") {
      return new Response("not found", { status: 404 });
    }
    const seconds = Number(request.headers.get("x-video-seconds"));
    if (!(seconds > 0 && seconds <= MAX_AUDIO_SECONDS)) {
      return new Response(`x-video-seconds must be between 0 and ${MAX_AUDIO_SECONDS}`, {
        status: 400,
      });
    }

    // One input can't serve two outputs, so each gets its own stream of the same bytes.
    const video = await request.arrayBuffer();
    const stream = () => new Blob([video]).stream();
    const frame = await measure(() =>
      env.MEDIA.input(stream())
        .transform({ width: 768 })
        .output({ mode: "frame", time: "2s", format: "jpg" })
        .response(),
    );
    const audio = await measure(() =>
      env.MEDIA.input(stream())
        .output({ mode: "audio", time: "0s", duration: `${Math.ceil(seconds)}s`, format: "m4a" })
        .response(),
    );
    return Response.json({ videoBytes: video.byteLength, frame, audio });
  },
};
