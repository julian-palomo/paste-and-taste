# A model per agent

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

Three kinds of agent work on the repo: the Claude Code sessions that
implement, the local subagent that reviews plans, and the cloud session that
reviews pull requests. A subagent's file can name its own model and effort
level.

The strongest models draw on usage credits. The owner has enough of them for
reviewing, and finds Opus good for implementing.

## Decision

| Agent                                  | Model      |
| -------------------------------------- | ---------- |
| Claude Code sessions that implement    | Opus       |
| The plan reviewer                      | Fable 5.1  |
| The cloud session that reviews the PRs | Fable 5.2  |

## Alternatives considered

- **One model for everything.** The reviewer would share the blind spots of
  the session that wrote the plan.
- **The strongest model everywhere.** It spends credits on implementing, where
  Opus is enough.

## Consequences

- A plan is reviewed by a different model from the one that wrote it.
- The choice hasn't been measured in this repo. A small test, the same plans
  with a seeded defect through two models, would say whether it holds.
- The models for the other subagents aren't chosen yet.
- Model names age. A change is a new ADR.
