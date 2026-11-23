// The spike's measurements, run from the owner's machine against the deployed
// Worker (or `wrangler dev`). One request at a time, one a second, unless a
// step says otherwise. It prints only steps, hosts, counts, statuses, error
// bodies, UTC windows and timings: never the token, a cookie, a password or
// the address. Test users are made up, under example.com.
//
//   pnpm -C prototypes/login measure <address> cpu [--count 20]
//   pnpm -C prototypes/login measure <address> warm [--count 50]
//   pnpm -C prototypes/login measure <address> hung [--count 500]
//   pnpm -C prototypes/login measure <address> cold [--rounds 15] [--idle-minutes 35]

import { parseArgs } from "node:util";
import {
  type Account,
  HOSTS,
  type Host,
  type Outcome,
  readSession,
  signIn,
  signUp,
  WorkerClient,
  wake,
} from "./client.ts";
import { failures, summarize } from "./stats.ts";

const PACE_MS = 1_000;
const SIGN_UP_ATTEMPTS = 5;
const GAPS_MS = [2_000, 10_000];

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
    "usage: measure <address> <cpu|warm|hung|cold> [--count N] [--rounds N] [--idle-minutes N]",
  );
  process.exit(2);
}
const token = process.env.RUN_TOKEN;
if (!token) console.error("RUN_TOKEN is not set: every request will answer 401.");
const client = new WorkerClient(address, token);
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
  default:
    console.error(`unknown step ${step}`);
    process.exit(2);
}
console.log(`step ${step} ended ${now()}`);
