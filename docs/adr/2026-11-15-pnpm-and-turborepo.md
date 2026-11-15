# pnpm workspaces and Turborepo

- **Status:** Accepted
- **Date:** 2026-11-15

## Context

The repo holds a native app, a web app and an API
([2026-11-14-monorepo-with-a-native-app.md](2026-11-14-monorepo-with-a-native-app.md)),
and the types they share are what keeps the two frontends from drifting away
from the API. That needs a package manager that links workspaces to each
other from one lockfile, and a task runner that runs `typecheck`, `test` and
`build` in each workspace in dependency order and skips what hasn't changed.

The owner uses pnpm in other projects, and Turborepo in one of them.

## Decision

pnpm workspaces, with every dependency version in the pnpm catalog in
`pnpm-workspace.yaml`, and Turborepo to run the tasks. A workspace opts into
a task by having the script.

## Alternatives considered

- **npm workspaces.** No extra tool to install, but no catalog to keep versions
  in one place, and a flat `node_modules` lets a workspace import a package it
  never declared.
- **Bun workspaces.** Fast installs. The API runs on Cloudflare Workers and the
  native app's tooling on Node, so Bun would be one more runtime, kept for
  installing alone.
- **Nx instead of Turborepo.** More features (generators, a project graph
  editor, its own plugins), and more config and concepts to learn. Turborepo
  does the one job needed here, running scripts in order with a cache, from one
  small `turbo.json`.

## Consequences

- One lockfile, and versions only in the catalog: a `package.json` refers to
  them as `catalog:`, and to another workspace as `workspace:*`.
- pnpm 12 refuses to finish an install while a dependency has a build script
  nobody reviewed. Each one gets a line in `allowBuilds`.
- pnpm 12 holds back versions published less than a day ago. When the only
  matching version is newer than that, it installs it anyway and lists it under
  `minimumReleaseAgeExclude`; the catalog pins a version at least a day old
  instead, so that list stays empty.
- `pnpm add` and `pnpm install` change the lockfile, so agents ask first
  (`AGENTS.md`, section 3).
- Turborepo's task settings in `turbo.json` are a draft until the first
  workspace with code runs them.
