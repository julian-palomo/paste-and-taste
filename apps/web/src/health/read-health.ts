import { type ApiClient, ApiError, ApiUnreachableError } from "@paste-and-taste/api-client";

// What the page shows. The error states carry no message: the page never
// shows an error's own words.
export type HealthState = Awaited<ReturnType<typeof readHealth>>;

export async function readHealth(client: ApiClient) {
  try {
    const { status, environment } = await client.get("/health");
    return { kind: "ok", status, environment } as const;
  } catch (error) {
    if (error instanceof ApiError) return { kind: "api-error" } as const;
    if (error instanceof ApiUnreachableError) return { kind: "unreachable" } as const;
    // Anything else is a bug here, not a state of the API.
    throw error;
  }
}
