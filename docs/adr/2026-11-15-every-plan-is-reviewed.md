# Every plan is reviewed, the owner's too

- **Status:** Accepted, changed in part by [2026-11-15-owner-plans-get-a-review-that-runs.md](2026-11-15-owner-plans-get-a-review-that-runs.md)
- **Date:** 2026-11-15

## Context

[The issue carries the spec](2026-11-15-the-issue-carries-the-spec.md) gave
plans a local reviewer, and sent some plans to the owner whatever the reviewer
says: the ones the issue flags, and the ones that touch dependencies, login,
secrets, the data schema, Cloudflare, CI or `.claude/`.

On the first run of the loop, the plan was one of those. The implementing
session skipped the reviewer, because its answer would have been `OWNER`
whatever the plan said, and the owner received a plan nobody had read. The
owner then asked the cloud session to read it. That reading raised two points
the plan didn't cover: what the pre-commit hook does with a commit of only
Markdown files, and which existing files a formatting commit would rewrite.

The plans that go to the owner are the ones with the most at stake.

## Decision

The plan reviewer reads every plan. When the plan is the owner's to approve,
the review still checks it, sends it back for changes like any other, and
answers `OWNER` only when it has nothing left to fix. The owner reads the
plan together with its review.

## Alternatives considered

- **Review only the plans the reviewer can approve.** It saves one subagent
  run per plan. It lost because it leaves the riskiest plans as the only ones
  without a second reader.
- **The cloud session reads the owner's plans.** It has the project's memory,
  and it is what happened by hand on the first run. It needs the owner to
  carry the message both ways, which is the relay the earlier record removed.

## Consequences

- Every issue spends a reviewer run, the flagged ones included.
- The reviewer and the implementer can share blind spots, as before. The
  owner's reading is still the decision; the review only makes it better
  informed.
- A choice that is the owner's to make is not a gap in the plan. The reviewer
  lists those choices for the owner instead of sending the plan back.
