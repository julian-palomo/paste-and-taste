# Cloudflare Workflows for background work

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

Importing a recipe is slow and can fail halfway: fetch the source, perhaps
transcribe a video, ask a model, save the result. The import runs in the
background: a recipe may show as loading and be ready later.

The July plan used Cloudflare Queues and a state machine written by hand.

## Decision

Background work runs on **Cloudflare Workflows**. Each import is one run, made
of steps.

## Alternatives considered

- **Queues and a hand-written state machine.** Retries, waits and the state of
  each import would be code to write and test here.

## Consequences

- Retries, pauses and waiting for something from the user are steps of a run,
  not code of ours.
- Workflows' limits haven't been checked, and calling it from NestJS on
  Workers hasn't been tested.
- The import is tied to Cloudflare.
