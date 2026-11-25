# Opus reviews when Fable is out of credits

- **Status:** Accepted
- **Date:** 2026-11-25

## Context

[A model per agent](2026-11-15-a-model-per-agent.md) gave the plan reviewer
and the cloud session that reviews pull requests Fable, and Opus to the
sessions that implement, so that a plan is reviewed by another model than the
one that wrote it.

On 25 Nov 2026 the owner's Fable credits ran out. The plan review of #67
failed before answering, with HTTP 429 "out of usage credits", and the
implement-issue skill stopped, since every plan is reviewed
([the record](2026-11-15-every-plan-is-reviewed.md)). The cloud session was
already running on Opus.

A subagent's file names one model. The Agent tool that runs it can override
that model for one run.

## Decision

Fable stays the reviewers' model. **When Fable is unavailable, Opus reviews.**

| Agent                                  | Model                          |
| -------------------------------------- | ------------------------------ |
| Claude Code sessions that implement    | Opus                           |
| The plan reviewer                      | Fable, or Opus when it is out  |
| The cloud session that reviews the PRs | Fable, or Opus when it is out  |

For the plan reviewer, the implement-issue skill runs it once more with the
model set to Opus when the first run fails before answering because Fable is
unavailable, and the posted review says Opus wrote it. The exact version of
each model lives in the agents' own configuration.

The owner chose it on 25 Nov 2026.

## Alternatives considered

- **Opus for every review, always.** Simpler, but it gives up the second model
  for good, even when Fable credits are back.
- **Sonnet for the reviews.** Another model than the writer's, so blind spots
  are less likely to be shared, but a weaker reader. Not measured.
- **Stopping until credits return.** Every issue would wait on the account.

## Consequences

- While Fable is out, a plan is reviewed by the same model that wrote it, and
  may share its blind spots. The review says which model wrote it, so the
  owner knows.
- A run that failed before answering is not a review, so running the reviewer
  again on Opus is not running it twice for a different answer.
- When Fable credits return, nothing changes: the reviewer's file still names
  Fable, and Opus is only used when that run fails.
