// The spike's measurements, run from the owner's machine against the deployed
// Worker (or `wrangler dev`). One request at a time, one a second, unless a
// step says otherwise. It prints only steps, hosts, counts, statuses, error
// bodies, UTC windows and timings: never the token, a cookie, a password, a
// code or the address (pnpm's echo of the command line, above its output, does show
// the address). Test users are made up, under example.com.
//
//   pnpm -C prototypes/login measure <address> cpu [--count 20]
//   pnpm -C prototypes/login measure <address> warm [--count 50]
//   pnpm -C prototypes/login measure <address> hung [--count 500]
//   pnpm -C prototypes/login measure <address> cold [--rounds 15] [--idle-minutes 35]
//   pnpm -C prototypes/login measure <address> passwordless [--count 20]

import { parseArgs } from "node:util";
import { Passkey } from "./authenticator.ts";
import {
  type Account,
  askForCode,
  HOSTS,
  type Host,
  mergeCookies,
  type Outcome,
  passkeyRegisterOptions,
  passkeySignInOptions,
  passkeyVerifyRegistration,
  passkeyVerifySignIn,
  readCode,
  readSession,
  signIn,
  signInWithCode,
  signUp,
  WorkerClient,
  wake,
} from "./client.ts";
import { failures, summarize } from "./stats.ts";

const PACE_MS = 1_000;
const SIGN_UP_ATTEMPTS = 5;
const GAPS_MS = [2_000, 10_000];
/** Between the passwordless batches: their UTC windows must not overlap, and a code lives 300 s. */
const PASSWORDLESS_GAP_MS = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
const now = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

const run = Date.now().toString(36);
let users = 0;
function newAccount(): Account & { n: number } {
  users += 1;
  return { n: users, email: `spike-${run}-${users}@example.com`, password: crypto.randomUUID() };
}

/** Runs `send` `count` times, each start at least PACE_MS after the one before. */
async function paced(count: number, send: (i: number) => Promise<Outcome>): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (let i = 0; i < count; i++) {
    const start = performance.now();
    outcomes.push(await send(i));
    if (i < count - 1) await sleep(PACE_MS - (performance.now() - start));
  }
  return outcomes;
}

async function batch(label: string, count: number, send: (i: number) => Promise<Outcome>) {
  const from = now();
  const outcomes = await paced(count, send);
  console.log(`${label}: ${summarize(outcomes)}, window ${from}..${now()}`);
  for (const line of failures(outcomes)) console.log(line);
  return outcomes;
}

/** What a step reads: the session when a sign-up got one, otherwise /wake. */
type Reader = { read: "session" | "wake"; once: () => Promise<Outcome> };

async function reader(client: WorkerClient, host: Host): Promise<Reader> {
  for (let attempt = 1; attempt <= SIGN_UP_ATTEMPTS; attempt++) {
    const account = newAccount();
    const sent = await signUp(client, host, account, account.n);
    if (sent.status === 200 && sent.cookie) {
      const cookie = sent.cookie;
      return { read: "session", once: () => readSession(client, host, cookie) };
    }
    console.log(`${host}: sign-up ${attempt} of ${SIGN_UP_ATTEMPTS} answered ${sent.status}`);
    for (const line of failures([sent])) console.log(line);
    await sleep(PACE_MS * 2);
  }
  console.log(`${host}: no sign-up succeeded, so this step reads /wake instead of the session`);
  return { read: "wake", once: () => wake(client, host) };
}

async function cpu(client: WorkerClient, count: number) {
  for (const host of HOSTS) {
    const accounts = Array.from({ length: count }, newAccount);
    const cookies: string[] = [];
    await batch(`cpu ${host} sign-up`, count, async (i) => {
      const account = accounts[i] as (typeof accounts)[number];
      const sent = await signUp(client, host, account, account.n);
      if (sent.cookie && sent.status === 200) cookies.push(sent.cookie);
      return sent;
    });
    await sleep(60_000);
    await batch(`cpu ${host} sign-in right password`, count, (i) =>
      signIn(client, host, accounts[i] as Account),
    );
    await sleep(60_000);
    await batch(`cpu ${host} sign-in wrong password`, count, async (i) => {
      const sent = await signIn(client, host, { ...(accounts[i] as Account), password: "wrong" });
      // 401 is the expected answer to a wrong password, so it is timed like a success.
      return sent.status === 401 ? { status: 401, ms: sent.ms } : sent;
    });
    await sleep(60_000);
    const cookie = cookies[0];
    if (!cookie) {
      console.log(`cpu ${host} session read: skipped, no sign-up succeeded`);
    } else {
      await batch(`cpu ${host} session read`, count, () => readSession(client, host, cookie));
    }
    await sleep(60_000);
  }
}

async function warm(client: WorkerClient, count: number) {
  for (const host of HOSTS) {
    const read = await reader(client, host);
    await wake(client, host);
    await batch(`warm ${host} ${read.read} read`, count, () => read.once());
  }
}

async function hung(client: WorkerClient, count: number) {
  for (const host of HOSTS) {
    const read = await reader(client, host);
    await batch(`hung ${host} ${read.read} read`, count, () => read.once());
  }
}

async function cold(client: WorkerClient, rounds: number, idleMinutes: number) {
  if (rounds % 3 !== 0) throw new Error("--rounds must be a multiple of 3");
  const perKind = rounds / 3;
  const readers = {
    neon: await reader(client, "neon"),
    planetscale: await reader(client, "planetscale"),
  };
  console.log(
    `cold: neon reads ${readers.neon.read}, planetscale reads ${readers.planetscale.read}`,
  );

  const results = new Map<string, Outcome[]>();
  const record = (label: string, outcome: Outcome) => {
    results.set(label, [...(results.get(label) ?? []), outcome]);
    const error = outcome.error ? ` (${outcome.error.replaceAll(/\s+/g, " ")})` : "";
    console.log(`  ${label}: ${outcome.status} in ${outcome.ms.toFixed(0)} ms${error}`);
  };

  for (let round = 0; round < rounds; round++) {
    console.log(`cold round ${round + 1} of ${rounds}: idle ${idleMinutes} min from ${now()}`);
    await sleep(idleMinutes * 60_000);
    console.log(`cold round ${round + 1} starts ${now()}`);

    if (round < perKind) {
      // Without the token the Worker answers 401 before any database, so this
      // takes the isolate's cold start and the first host is timed warm.
      const unauthorized = await client.send("/", { withToken: false });
      // 401 is this request's expected answer, so it is timed like a success.
      record(
        "first: no token (401, no database)",
        unauthorized.status === 401 ? { status: 401, ms: unauthorized.ms } : unauthorized,
      );
      const order: Host[] = round % 2 ? ["planetscale", "neon"] : ["neon", "planetscale"];
      for (const [position, host] of order.entries()) {
        const label = `first: ${host} ${readers[host].read} read (${position ? "second" : "first"})`;
        record(label, await readers[host].once());
      }
    } else {
      const gap = GAPS_MS[Math.floor(round / perKind) - 1] as number;
      // The app's idea: fire the wake and don't wait; the person acts a moment later.
      const sentAt = performance.now();
      const woken = wake(client, "neon");
      await sleep(gap - (performance.now() - sentAt));
      record(`wake ${gap / 1000} s: neon ${readers.neon.read} read`, await readers.neon.once());
      record(`wake ${gap / 1000} s: the /wake itself`, await woken);
    }
  }

  console.log("cold summary:");
  for (const [label, outcomes] of results) console.log(`  ${label}: ${summarize(outcomes)}`);
}

type Ceremony = { challenge: string; rpId: string; origin: string };

/** The challenge and site id a ceremony's options carry, or undefined when the answer had none. */
function ceremonyFrom(client: WorkerClient, body: unknown): Ceremony | undefined {
  const options = body as
    | { challenge?: unknown; rp?: { id?: unknown }; rpId?: unknown }
    | undefined;
  const rpId = options?.rp?.id ?? options?.rpId;
  if (typeof options?.challenge !== "string" || typeof rpId !== "string") return undefined;
  return { challenge: options.challenge, rpId, origin: client.origin };
}

const missing = (what: string): Outcome => ({ status: 0, ms: 0, error: `skipped: no ${what}` });

/**
 * Login without a password, Neon only: CPU time is the Worker's, so one host
 * is enough. Each batch is one kind of request, so its UTC window reads one
 * kind in the Query Builder; the code reads between them are not measured.
 */
async function passwordless(client: WorkerClient, count: number) {
  const host: Host = "neon";
  const people = Array.from({ length: count }, () => ({
    email: newAccount().email,
    code: undefined as string | undefined,
    cookie: undefined as string | undefined,
    challenge: undefined as { ceremony: Ceremony; cookie: string } | undefined,
    passkey: new Passkey(),
  }));
  const pause = () => sleep(PASSWORDLESS_GAP_MS);

  const readCodes = async (label: string) => {
    const read = await batch(`${label} (not measured)`, count, async (i) => {
      const person = people[i] as (typeof people)[number];
      const sent = await readCode(client, host, person.email);
      person.code = sent.otp;
      return sent.otp ? sent : { ...sent, error: sent.error ?? "no code stored" };
    });
    await pause();
    return read;
  };
  const signInEach = async (label: string) => {
    await batch(label, count, async (i) => {
      const person = people[i] as (typeof people)[number];
      if (!person.code) return missing("code");
      const sent = await signInWithCode(client, host, person.email, person.code);
      if (sent.status === 200 && sent.cookie) person.cookie = sent.cookie;
      return sent;
    });
    await pause();
  };

  for (const kind of ["new person", "existing person"]) {
    await batch(`passwordless ask for a code, ${kind}`, count, (i) =>
      askForCode(client, host, (people[i] as (typeof people)[number]).email),
    );
    await pause();
    await readCodes(`passwordless read the code, ${kind}`);
    await signInEach(`passwordless sign in with the code, ${kind}`);
  }

  // Registering needs the fresh session the code sign-in gave.
  await batch("passwordless passkey register: options", count, async (i) => {
    const person = people[i] as (typeof people)[number];
    if (!person.cookie) return missing("session");
    const sent = await passkeyRegisterOptions(client, host, person.cookie);
    const ceremony = ceremonyFrom(client, sent.body);
    if (sent.status === 200 && ceremony && sent.cookie)
      person.challenge = { ceremony, cookie: mergeCookies(person.cookie, sent.cookie) };
    return sent;
  });
  await pause();
  await batch("passwordless passkey register: verify", count, async (i) => {
    const person = people[i] as (typeof people)[number];
    if (!person.challenge) return missing("challenge");
    const { ceremony, cookie } = person.challenge;
    person.challenge = undefined;
    return passkeyVerifyRegistration(client, host, cookie, person.passkey.register(ceremony));
  });
  await pause();

  // Signing in with a passkey starts with no session, as on a device after sign-out.
  await batch("passwordless passkey sign-in: options", count, async (i) => {
    const person = people[i] as (typeof people)[number];
    const sent = await passkeySignInOptions(client, host);
    const ceremony = ceremonyFrom(client, sent.body);
    if (sent.status === 200 && ceremony && sent.cookie)
      person.challenge = { ceremony, cookie: sent.cookie };
    return sent;
  });
  await pause();
  await batch("passwordless passkey sign-in: verify", count, async (i) => {
    const person = people[i] as (typeof people)[number];
    if (!person.challenge) return missing("challenge");
    const { ceremony, cookie } = person.challenge;
    person.challenge = undefined;
    const sent = await passkeyVerifySignIn(client, host, cookie, person.passkey.signIn(ceremony));
    if (sent.status === 200 && sent.cookie) person.cookie = mergeCookies(cookie, sent.cookie);
    return sent;
  });
  await pause();

  // The checks: each must be refused, and the passkey's session must read back.
  console.log("passwordless checks:");
  const first = people[0] as (typeof people)[number];
  if (first.cookie) {
    const session = await readSession(client, host, first.cookie);
    console.log(
      `  session after a passkey sign-in: ${session.status}${session.error ? ` (${session.error})` : ""}`,
    );
  }
  const stranger = newAccount().email;
  await askForCode(client, host, stranger);
  const real = (await readCode(client, host, stranger)).otp ?? "000000";
  const wrong = real.replace(/^./, (digit) => String((Number(digit) + 1) % 10));
  const refusedCode = await signInWithCode(client, host, stranger, wrong);
  console.log(`  wrong code: ${refusedCode.status} (must not be 200)`);
  const options = await passkeySignInOptions(client, host);
  const ceremony = ceremonyFrom(client, options.body);
  if (ceremony && options.cookie) {
    const forged = first.passkey.signIn(ceremony, { forged: true });
    const refusedPasskey = await passkeyVerifySignIn(client, host, options.cookie, forged);
    console.log(`  signature from another key: ${refusedPasskey.status} (must not be 200)`);
  } else {
    console.log(`  signature from another key: not tried, options answered ${options.status}`);
  }
  const notTest = await client.send(
    `/${host}/spike/code?email=${encodeURIComponent("someone@example.org")}`,
  );
  console.log(`  code for an address that isn't a test one: ${notTest.status} (must be 404)`);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    count: { type: "string" },
    rounds: { type: "string", default: "15" },
    "idle-minutes": { type: "string", default: "35" },
  },
});
const [address, step] = positionals;
if (!address || !step) {
  console.error(
    "usage: measure <address> <cpu|warm|hung|cold|passwordless> [--count N] [--rounds N] [--idle-minutes N]",
  );
  process.exit(2);
}
const token = process.env.RUN_TOKEN;
if (!token) {
  console.error("RUN_TOKEN is not set: every request would answer 401.");
  process.exit(2);
}
const client = new WorkerClient(address, token);

// Stops before any batch or idle wait when the Worker refuses the token, so
// an overnight run never collects nine hours of 401s. `/` passes the token
// check and then answers 404 without touching a database.
const check = await client.send("/");
if (check.status !== 404) {
  console.error(`the Worker answered ${check.status} to the token check, not 404: stopping.`);
  if (check.error) console.error(`  ${check.error.replaceAll(/\s+/g, " ")}`);
  process.exit(1);
}
const count = (fallback: number) => Number(values.count ?? fallback);

console.log(`step ${step}, run ${run}, started ${now()}`);
switch (step) {
  case "cpu":
    await cpu(client, count(20));
    break;
  case "warm":
    await warm(client, count(50));
    break;
  case "hung":
    await hung(client, count(500));
    break;
  case "cold":
    await cold(client, Number(values.rounds), Number(values["idle-minutes"]));
    break;
  case "passwordless":
    await passwordless(client, count(20));
    break;
  default:
    console.error(`unknown step ${step}`);
    process.exit(2);
}
console.log(`step ${step} ended ${now()}`);
