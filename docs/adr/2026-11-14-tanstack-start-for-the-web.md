# TanStack Start for the web app

- **Status:** Accepted
- **Date:** 2026-11-14

## Context

The July plan named Next.js for the web app, with doubts. Since then TanStack
Start has reached a stable 1.0 (as read on 14 November 2026).

The owner already runs two sites on TanStack Start and has used Next.js at
work. In this project the new things to learn are the API and React Native.

## Decision

The web app is built with **TanStack Start**.

## Alternatives considered

- **Next.js.** It runs on Cloudflare through the OpenNext adapter. It lost
  because the framework already in daily use leaves the learning effort for
  the API and the native app.
- **Astro.** Made for content sites, and this is an app.

## Consequences

- The setup, the conventions and the deploy carry over from the owner's other
  two projects.
- TanStack Start moves quickly, so upgrades need reading the release notes
  rather than trusting older examples.
