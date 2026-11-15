# The issue carries the spec, and a local reviewer approves the plan

- **Status:** Accepted, changed in part by [2026-11-15-owner-plans-get-a-review-that-runs.md](2026-11-15-owner-plans-get-a-review-that-runs.md)
- **Date:** 2026-11-15

## Context

The app is built by coding agents. Claude Code sessions on the owner's
machine implement, and a Claude session in the cloud, which holds the
project's memory, reviews.

In the owner's previous project the cloud session reviewed every plan. A plan
is a comment on an issue, and that doesn't wake the cloud session; nothing on
GitHub wakes a local session either. Every plan needed a relay, and the work
stalled whenever a message was missed.

An agent judges its own work generously, so a plan needs a reader that didn't
write it.

## Decision

- **The issue carries the weight.** It states the goal, the context with links
  to the ADRs, the workspace it touches, what is out of scope, the
  requirements, and "Done when": a list of checks that can be run. The cloud
  session drafts the issues with the owner, because the project's memory is
  there.
- **A local reviewer approves the plan.** It is a subagent with a fresh
  context and read-only tools. It approves when every "Done when" has its test
  in the plan and no choice is left open.
- **The owner reviews a plan only when the issue is flagged for it.**
- **Two limits.** After two rounds without agreement the plan goes to the
  owner. And a plan that touches dependencies, login, secrets, the data
  schema, Cloudflare, CI or `.claude/` always goes to the owner.
- **The cloud session reviews pull requests, not plans.**

## Alternatives considered

- **The owner approves every plan.** The safest, and the owner becomes the
  queue for every issue, the well specified ones included.
- **The cloud session reviews every plan**, as in the previous project. It
  has the memory, but it needs the relay that stalled.
- **No plan review.** Mistakes are found in the pull request, where they cost
  the most to fix.

## Consequences

- The quality of the issue decides the quality of everything after it, so
  writing issues is real work.
- The reviewer and the implementer can share blind spots. The real safety net
  is still the tests, the review of the pull request and the owner's merge.
- What the cloud session knows from memory has to be written in the repo, in
  these records and in [`../product.md`](../product.md), or the local reviewer
  can't use it.
- The issue template and the reviewer arrive in later pull requests. Until
  then the rule in `AGENTS.md` stands: the owner's OK on every plan.
