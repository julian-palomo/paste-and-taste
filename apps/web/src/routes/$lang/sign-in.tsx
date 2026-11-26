import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { pageHead } from "../../head.ts";
import { messagesFor, parseLanguage } from "../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../layout/keep-error-on-server.ts";
import { PasskeyRegister, PasskeySignIn } from "../../sign-in/passkey.tsx";
import { parseErrorKind, parseNext } from "../../sign-in/relay.ts";
import {
  changeAddressForm,
  getSignInPage,
  sendCodeForm,
  signInForm,
  signOutForm,
} from "../../sign-in/sign-in.functions.ts";
import { SignInView } from "../../sign-in/sign-in-view.tsx";

// Outside development the loader's notFound() makes it the root's not-found
// page, with status 404. ?error= and ?step= come from the page's address,
// read here rather than by the server function, so a client-side navigation
// shows them too.
export const Route = createFileRoute("/$lang/sign-in")({
  params: {
    parse: ({ lang }) => {
      const language = parseLanguage(lang);
      if (!language) throw notFound();
      return { lang: language };
    },
  },
  validateSearch: ({ error, step, next }: Record<string, unknown>) => ({
    next: parseNext(next),
    error: parseErrorKind(error),
    step: (["passkey", "passkey-added"] as const).find((known) => known === step),
  }),
  loaderDeps: ({ search }) => ({ next: search.next }),
  loader: async ({ deps }) => {
    const page = await getSignInPage();
    if (!page.shown) throw notFound();
    // Already signed in, and sent here from a page: straight back to it.
    if (page.session.kind === "signed-in" && deps.next) throw redirect({ href: deps.next });
    return page;
  },
  onError: keepErrorOnServer,
  head: ({ params, loaderData }) =>
    loaderData ? pageHead(params.lang, loaderData.origin, "signIn") : {},
  component: SignInPage,
});

function SignInPage() {
  const { lang } = Route.useParams();
  const { session, pending } = Route.useLoaderData();
  const { error, step, next } = Route.useSearch();
  const messages = messagesFor(lang);
  return (
    <SignInView
      lang={lang}
      messages={messages}
      session={session}
      pending={pending}
      error={error}
      step={step}
      next={next}
      actions={{
        sendCode: sendCodeForm.url,
        signIn: signInForm.url,
        changeAddress: changeAddressForm.url,
        signOut: signOutForm.url,
      }}
      passkeySignIn={<PasskeySignIn lang={lang} messages={messages} next={next} />}
      passkeyRegister={<PasskeyRegister lang={lang} messages={messages} />}
    />
  );
}
