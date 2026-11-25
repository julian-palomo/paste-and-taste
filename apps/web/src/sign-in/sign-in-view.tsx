import type { ReactNode } from "react";
import type { Language, Messages } from "../i18n/i18n.ts";
import { Button } from "../pieces/button.tsx";
import { Card } from "../pieces/card.tsx";
import { Checkbox } from "../pieces/checkbox.tsx";
import { TextField } from "../pieces/text-field.tsx";
import type { Pending, SignInErrorKind } from "./relay.ts";
import type { Session } from "./sign-in.ts";

// Where each form posts: a server function's address. The forms work with
// no JavaScript, and each answers with a redirect back to this page.
type Actions = { sendCode: string; signIn: string; changeAddress: string; signOut: string };

type Props = {
  lang: Language;
  messages: Messages;
  session: Session;
  pending: Pending | undefined;
  error: SignInErrorKind | undefined;
  step: "passkey" | "passkey-added" | undefined;
  actions: Actions;
  // The passkey buttons, which need JavaScript; null when rendered without.
  passkeySignIn: ReactNode;
  passkeyRegister: ReactNode;
};

function errorText(messages: Messages, kind: SignInErrorKind): string {
  return {
    "invalid-email": messages.signInErrorInvalidEmail,
    "too-many-codes": messages.signInErrorTooManyCodes,
    "wrong-code": messages.signInErrorWrongCode,
    "too-many": messages.signInErrorTooMany,
    unreachable: messages.signInErrorUnreachable,
    "too-soon": messages.signInErrorTooSoon,
    "start-again": messages.signInErrorStartAgain,
    "passkey-failed": messages.signInErrorPasskeyFailed,
    "passkey-not-created": messages.signInErrorPasskeyNotCreated,
    "code-not-sent": messages.signInErrorCodeNotSent,
  }[kind];
}

// The passkey's errors belong to the passkey, not to a step's field.
const PASSKEY_KINDS: readonly SignInErrorKind[] = ["passkey-failed", "passkey-not-created"];
const fieldErrorOf = (error: SignInErrorKind | undefined) =>
  error && !PASSKEY_KINDS.includes(error) ? error : undefined;

// <h1> and <p role="alert"> carry no class: tests match them exactly.
export function SignInView(props: Props) {
  if (props.session.kind === "signed-in") return <SignedIn {...props} user={props.session.user} />;
  if (props.pending?.sentAt !== undefined)
    return <CodeStep {...props} email={props.pending.email} />;
  return <AddressStep {...props} />;
}

// A form that posts to a server function, with the page's language, which
// the redirect goes back to.
function PostForm({
  action,
  lang,
  children,
}: {
  action: string;
  lang: Language;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      method="post"
      encType="multipart/form-data"
      className="flex flex-col items-start gap-4"
    >
      <input type="hidden" name="lang" value={lang} />
      {children}
    </form>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <div className="text-body text-danger">
      <p role="alert">{text}</p>
    </div>
  );
}

function AddressStep({ lang, messages, pending, error, actions, passkeySignIn }: Props) {
  // A failed passkey is said next to the passkey; creating one happens only
  // from the offer, so passkey-not-created shows nothing here.
  const fieldError = fieldErrorOf(error);
  return (
    <section className="flex flex-col gap-8">
      <h1>{messages.signInHeading}</h1>
      <PostForm action={actions.sendCode} lang={lang}>
        <TextField
          label={messages.signInEmail}
          name="email"
          type="email"
          autoComplete="email"
          required
          hint={messages.signInEmailHint}
          defaultValue={pending?.email}
          error={fieldError && errorText(messages, fieldError)}
          autoFocus={fieldError !== undefined}
        />
        <Button kind="main" type="submit">
          {messages.signInSendCode}
        </Button>
      </PostForm>
      <div className="flex flex-col items-start gap-4">
        {passkeySignIn}
        {error === "passkey-failed" && <Alert text={errorText(messages, error)} />}
      </div>
    </section>
  );
}

function CodeStep({ lang, messages, error, actions, email }: Props & { email: string }) {
  // A code that couldn't be sent sends the page back to the email step.
  const fieldError = error === "code-not-sent" ? undefined : fieldErrorOf(error);
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1>{messages.signInCodeHeading}</h1>
        <p className="text-body">
          {messages.signInCodeSentTo} <strong>{email}</strong>
        </p>
        <p className="text-body text-text-muted">{messages.signInSpam}</p>
      </div>
      <PostForm action={actions.signIn} lang={lang}>
        <TextField
          label={messages.signInCode}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          hint={messages.signInCodeHint}
          error={fieldError && errorText(messages, fieldError)}
          autoFocus={fieldError !== undefined}
        />
        <Checkbox label={messages.signInRemember} name="remember" value="on" />
        <Button kind="main" type="submit">
          {messages.signInEnter}
        </Button>
      </PostForm>
      <PostForm action={actions.sendCode} lang={lang}>
        <input type="hidden" name="email" value={email} />
        <p className="text-small text-text-muted">{messages.signInResendHint}</p>
        <Button kind="secondary" type="submit">
          {messages.signInResend}
        </Button>
      </PostForm>
      <PostForm action={actions.changeAddress} lang={lang}>
        <Button kind="secondary" type="submit">
          {messages.signInChangeAddress}
        </Button>
      </PostForm>
    </section>
  );
}

function SignedIn({
  lang,
  messages,
  error,
  step,
  actions,
  passkeyRegister,
  user,
}: Props & { user: { email: string } }) {
  // A code that couldn't be sent belongs to the email step only.
  const shownError = error === "code-not-sent" ? undefined : error;
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1>{messages.signInSignedInHeading}</h1>
        <p className="text-body">
          {messages.signInSignedInAs} <strong>{user.email}</strong>
        </p>
      </div>
      {step === "passkey" && (
        <Card>
          <div className="flex flex-col items-start gap-4">
            <h2 className="font-display text-xl font-bold">{messages.signInPasskeyOfferHeading}</h2>
            <p className="text-body">{messages.signInPasskeyOfferBody}</p>
            {passkeyRegister}
            {shownError && <Alert text={errorText(messages, shownError)} />}
            <a
              href={`/${lang}`}
              className="text-body text-accent underline underline-offset-4 transition-colors hover:text-text"
            >
              {messages.signInNotNow}
            </a>
          </div>
        </Card>
      )}
      {step === "passkey-added" && <p className="text-body">{messages.signInPasskeyAdded}</p>}
      {step !== "passkey" && shownError && <Alert text={errorText(messages, shownError)} />}
      <PostForm action={actions.signOut} lang={lang}>
        <Button kind="secondary" type="submit">
          {messages.signInSignOut}
        </Button>
      </PostForm>
    </section>
  );
}
