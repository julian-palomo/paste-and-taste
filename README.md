# Paste & Taste

A working name. An app that saves a recipe shared from Instagram, YouTube or a
web page, so it can be kept, edited and cooked from.

## Status

Nothing is built yet. The repo holds the working agreement for the coding
agents that will build it: [`AGENTS.md`](AGENTS.md) has the rules and
[`.claude/README.md`](.claude/README.md) explains the Claude Code setup.

## Decided so far

- A monorepo with a React Native app, a web app and an API.
- Web: TanStack Start.
- API: NestJS on Cloudflare Workers. The first step is deploying the bare skeleton to a real Worker; if that fails, the fallbacks are NestJS on a Node host, or Hono on Workers.
- Login: Better Auth.
- Background work, such as importing a recipe: Cloudflare Workflows.
- The interface is in Spanish and English from day one.

## Commands

```bash
bash .claude/hooks/tests/run.sh   # tests for the Claude Code hooks
```

## Licence

None yet, so all rights are reserved for now.
