import type { ReactNode } from "react";
import type { Messages } from "../i18n/i18n.ts";
import { Button } from "../pieces/button.tsx";
import { Card } from "../pieces/card.tsx";
import { Checkbox } from "../pieces/checkbox.tsx";
import { TextField } from "../pieces/text-field.tsx";

// Every piece in every state, each named in words, for the owner to look at
// on a phone. The checkboxes sit in a GET form, so sending it shows in the
// address which ones the browser sent.
export function ShowcaseView({ messages }: { messages: Messages }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h1>{messages.showcaseHeading}</h1>
        <p className="text-body text-text-muted">{messages.showcaseIntro}</p>
      </div>

      <Section title={messages.showcaseButtons}>
        <State name={messages.showcaseMain}>
          <Button kind="main" type="button">
            {messages.showcaseContinue}
          </Button>
        </State>
        <State name={messages.showcaseMainDisabled}>
          <Button kind="main" type="button" disabled>
            {messages.showcaseContinue}
          </Button>
        </State>
        <State name={messages.showcaseSecondary}>
          <Button kind="secondary" type="button">
            {messages.showcaseBack}
          </Button>
        </State>
        <State name={messages.showcaseSecondaryDisabled}>
          <Button kind="secondary" type="button" disabled>
            {messages.showcaseBack}
          </Button>
        </State>
        <State name={messages.showcaseText}>
          <Button kind="text" type="button">
            {messages.showcaseBack}
          </Button>
        </State>
        <State name={messages.showcaseTextDisabled}>
          <Button kind="text" type="button" disabled>
            {messages.showcaseBack}
          </Button>
        </State>
      </Section>

      <Section title={messages.showcaseTextFields}>
        <State name={messages.showcaseWithHint}>
          <TextField
            label={messages.showcaseEmail}
            name="email"
            type="email"
            autoComplete="email"
            hint={messages.showcaseEmailHint}
          />
        </State>
        <State name={messages.showcasePlain}>
          <TextField
            label={messages.showcaseCode}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </State>
        <State name={messages.showcaseWithError}>
          <TextField
            label={messages.showcaseEmail}
            name="email-with-error"
            type="email"
            defaultValue="name@"
            hint={messages.showcaseEmailHint}
            error={messages.showcaseEmailError}
          />
        </State>
        <State name={messages.showcaseDisabled}>
          <TextField label={messages.showcaseCode} name="code-disabled" type="text" disabled />
        </State>
      </Section>

      <Section title={messages.showcaseCheckboxes}>
        <form method="get" className="flex flex-col items-start gap-4">
          <p className="text-small text-text-muted">{messages.showcaseFormNote}</p>
          <State name={messages.showcaseUnticked}>
            <Checkbox label={messages.showcaseRemember} name="remember" value="yes" />
          </State>
          <State name={messages.showcaseTicked}>
            <Checkbox label={messages.showcaseRemember} name="ticked" value="yes" defaultChecked />
          </State>
          <State name={messages.showcaseDisabled}>
            <Checkbox label={messages.showcaseRemember} name="disabled" value="yes" disabled />
          </State>
          <Button kind="main" type="submit">
            {messages.showcaseSend}
          </Button>
        </form>
      </Section>

      <Section title={messages.showcaseCards}>
        <Card>
          <p className="text-body">{messages.showcaseCardBody}</p>
        </Card>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function State({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-small text-text-muted">{name}</p>
      {children}
    </div>
  );
}
