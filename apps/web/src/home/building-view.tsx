import type { Messages } from "../i18n/i18n.ts";

// Production's home while the app isn't open: what it is, and that it is being
// built. Text only, and nothing about a visitor is asked for or sent: no form,
// no input, no script of its own and no other site. <h1> carries no class:
// tests match it exactly.
export function BuildingView({ messages }: { messages: Messages }) {
  return (
    <section className="flex flex-col gap-4">
      <h1>{messages.buildingHeading}</h1>
      <p className="text-body">{messages.buildingAbout}</p>
      <p className="text-body text-text-muted">{messages.buildingNotOpen}</p>
    </section>
  );
}
