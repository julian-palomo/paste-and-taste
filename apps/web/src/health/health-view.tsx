import type { Messages } from "../i18n/i18n.ts";
import type { HealthState } from "./read-health.ts";

// <h1>, <dt>, <dd> and <p role="alert"> carry no attributes: the deploy check
// (scripts/check-web.ts) and the tests match them exactly, so they are styled
// from their parents.
export function HealthView({ state, messages }: { state: HealthState; messages: Messages }) {
  return (
    <section className="flex flex-col gap-6">
      <h1>{messages.heading}</h1>
      {state.kind === "ok" ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-control bg-surface-raised p-4 [&_dd]:font-mono [&_dt]:text-text-muted">
          <dt>{messages.status}</dt>
          <dd>{state.status}</dd>
          <dt>{messages.environment}</dt>
          <dd>{state.environment}</dd>
        </dl>
      ) : (
        <div className="rounded-control border border-danger p-4 text-danger">
          <p role="alert">
            {state.kind === "api-error" ? messages.apiError : messages.unreachable}
          </p>
        </div>
      )}
    </section>
  );
}
