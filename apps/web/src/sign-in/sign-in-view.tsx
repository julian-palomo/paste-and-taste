import { type ReactNode, useId } from "react";
import type { Language, Messages } from "../i18n/i18n.ts";
import { Button } from "../pieces/button.tsx";
import { Card } from "../pieces/card.tsx";
import { Checkbox } from "../pieces/checkbox.tsx";
import { TextField } from "../pieces/text-field.tsx";
import { EnvelopeSent } from "./notice-drawing.tsx";
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
  // The page to go back to after signing in, sent back by every form.
  next: string | undefined;
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
  next,
  children,
}: {
  action: string;
  lang: Language;
  next?: string | undefined;
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
      {next && <input type="hidden" name="next" value={next} />}
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

// A notice: an action worked. Not an alert, which reports an error, and not
// told by colour alone: the envelope, hidden from screen readers, and the
// words, whose id a field names in aria-describedby. A soft card that arrives
// once with the page; with reduced motion it is simply there.
function Notice({ id, text }: { id: string; text: string }) {
  return (
    <div className="flex animate-arrive items-center justify-center gap-3 rounded-row bg-accent-soft px-4 py-3">
      <EnvelopeSent />
      <span id={id} className="font-bold text-body text-text">
        {text}
      </span>
    </div>
  );
}

// The sign-in's two steps: one centred column, as narrow as a phone's at
// every width, with its heading and the lines under it centred.
const column = "mx-auto flex w-full max-w-sm flex-col gap-8";

function AddressStep({ lang, messages, pending, error, actions, passkeySignIn, next }: Props) {
  // A failed passkey is said next to the passkey; creating one happens only
  // from the offer, so passkey-not-created shows nothing here.
  const fieldError = fieldErrorOf(error);
  return (
    <section className={column}>
      <div className="text-center">
        <h1>{messages.signInHeading}</h1>
      </div>
      <PostForm action={actions.sendCode} lang={lang} next={next}>
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
        <Button kind="main" type="submit" wide>
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

function CodeStep({
  lang,
  messages,
  pending,
  error,
  actions,
  email,
  next,
}: Props & { email: string }) {
  // A code that couldn't be sent sends the page back to the email step.
  const fieldError = error === "code-not-sent" ? undefined : fieldErrorOf(error);
  // Another code went out, and nothing failed since: say so, and give the
  // field the focus so a screen reader reads it out with the field.
  const resent = pending?.resent === true && error === undefined;
  const noticeId = useId();
  return (
    <section className={column}>
      <div className="flex flex-col gap-2 text-center">
        <h1>{messages.signInCodeHeading}</h1>
        <p className="text-body">
          {messages.signInCodeSentTo} <strong>{email}</strong>
        </p>
        <p className="text-body text-text-muted">{messages.signInSpam}</p>
      </div>
      {resent && <Notice id={noticeId} text={messages.signInCodeResent} />}
      <PostForm action={actions.signIn} lang={lang} next={next}>
        <TextField
          label={messages.signInCode}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          error={fieldError && errorText(messages, fieldError)}
          autoFocus={fieldError !== undefined || resent}
          describedBy={resent ? noticeId : undefined}
        />
        <div className="flex w-full justify-center">
          <Checkbox label={messages.signInRemember} name="remember" value="on" />
        </div>
        <Button kind="main" type="submit" wide>
          {messages.signInEnter}
        </Button>
      </PostForm>
      {/* Side by side and centred, two lines when the column is too narrow;
          each still its own form, sent with no JavaScript. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <PostForm action={actions.sendCode} lang={lang} next={next}>
          <input type="hidden" name="email" value={email} />
          <Button kind="text" type="submit">
            {messages.signInResend}
          </Button>
        </PostForm>
        <PostForm action={actions.changeAddress} lang={lang} next={next}>
          <Button kind="text" type="submit">
            {messages.signInChangeAddress}
          </Button>
        </PostForm>
      </div>
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
