import { createFileRoute, notFound } from "@tanstack/react-router";
import { pageHead } from "../../head.ts";
import { messagesFor, parseLanguage } from "../../i18n/i18n.ts";
import { keepErrorOnServer } from "../../layout/keep-error-on-server.ts";
import { PasskeyRegister, PasskeySignIn } from "../../sign-in/passkey.tsx";
import { parseErrorKind } from "../../sign-in/relay.ts";
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
  validateSearch: ({ error, step }: Record<string, unknown>) => ({
    error: parseErrorKind(error),
    step: (["passkey", "passkey-added"] as const).find((known) => known === step),
  }),
  loader: async () => {
    const page = await getSignInPage();
    if (!page.shown) throw notFound();
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
  const { error, step } = Route.useSearch();
  const messages = messagesFor(lang);
  return (
    <SignInView
      lang={lang}
      messages={messages}
      session={session}
      pending={pending}
      error={error}
      step={step}
      actions={{
        sendCode: sendCodeForm.url,
        signIn: signInForm.url,
        changeAddress: changeAddressForm.url,
        signOut: signOutForm.url,
      }}
      passkeySignIn={<PasskeySignIn lang={lang} messages={messages} />}
      passkeyRegister={<PasskeyRegister lang={lang} messages={messages} />}
    />
  );
}
