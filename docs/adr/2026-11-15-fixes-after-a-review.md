# The reviewer applies the fixes only when they close the review

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

The cloud session reviews each pull request. After a review, the local Claude
Code session that wrote the code has to notice it and come back. Nothing on
GitHub wakes a local session, and in the owner's previous project this is
where the work stalled.

Many reviews ask only for mechanical changes: a typo, a link, a line in a
doc. `AGENTS.md` says a branch has one driver.

## Decision

If everything a review asks for is mechanical, the cloud session applies it
and the pull request is ready for the owner. If any point changes behaviour,
the cloud session applies nothing, and the whole review goes back to the
Claude Code session that drives the branch.

## Alternatives considered

- **Claude Code applies every fix.** The simplest rule. Every fix, however
  small, depends on the local session coming back.
- **The cloud session applies every small fix.** Fewer waits, but both
  sessions could push to the same branch at the same time.

## Consequences

- A branch still has one driver at a time. The driver changes hands with the
  review; the branch is never shared.
- "Mechanical" is a judgement call. When in doubt, the review goes back.
- No other agent reviews the cloud session's fixes. CI and the owner's merge
  check them.
- The cloud session doesn't run this repo's Claude Code hooks, so it checks
  its own commits against `AGENTS.md` by hand.
