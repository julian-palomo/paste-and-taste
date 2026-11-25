// How a sign-in code reaches the person who asked for it. The rest of the
// login knows only this type, so sending real email is one more sender.
export type CodeSender = { send(email: string, code: string): Promise<void> };

// Development only: prints the address and the code in the API's terminal, so
// signing in locally needs no email service.
export const consoleCodeSender: CodeSender = {
  send: async (email, code) => {
    console.log(`Sign-in code for ${email}: ${code}`);
  },
};
