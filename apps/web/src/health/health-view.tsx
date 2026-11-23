import type { Messages } from "../i18n/i18n.ts";
import type { HealthState } from "./read-health.ts";

export function HealthView({ state, messages }: { state: HealthState; messages: Messages }) {
  return (
    <main>
      <h1>{messages.heading}</h1>
      {state.kind === "ok" ? (
        <dl>
          <dt>{messages.status}</dt>
          <dd>{state.status}</dd>
          <dt>{messages.environment}</dt>
          <dd>{state.environment}</dd>
        </dl>
      ) : (
        <p role="alert">{state.kind === "api-error" ? messages.apiError : messages.unreachable}</p>
      )}
    </main>
  );
}
