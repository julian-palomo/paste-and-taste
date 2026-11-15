# The `.claude/` folder: a guide

This folder configures Claude Code for this repo. It's written for the person
working with Claude here, not for Claude: Claude Code doesn't load this file on
its own. The docs are at code.claude.com/docs.

## What loads when

| Piece                     | Where                                                                                  | Loads                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Project instructions      | `AGENTS.md` (repo root), imported by `CLAUDE.md`                                       | At the start of every session, in full. Kept short on purpose. Other coding agents read `AGENTS.md` directly.      |
| Your private instructions | `CLAUDE.local.md` (repo root, gitignored)                                              | At the start of every session, after `CLAUDE.md`.                                                                  |
| Rules                     | `.claude/rules/*.md`                                                                   | A rule with a `paths:` list loads the first time Claude reads or edits a matching file. All of ours have `paths:`. |
| Hooks                     | `.claude/hooks/*.sh`, wired in `settings.json`                                         | Run by Claude Code itself on every matching tool call. Claude can't skip or argue with them.                       |
| Settings                  | `.claude/settings.json` (committed), `.claude/settings.local.json` (yours, gitignored) | Read at start and reloaded when they change: permissions, hooks, attribution.                                      |
| Skills                    | `.claude/skills/<name>/SKILL.md`                                                       | Only the description is in context. The body loads when Claude decides the task matches, or when you type `/<name>`. |
| Subagents                 | `.claude/agents/<name>.md`                                                             | Run in their own context when a skill or Claude starts them, with only the tools and the model the file gives them.  |

`CLAUDE.md` holds one line, `@AGENTS.md`. Keep it: without a `CLAUDE.md`,
adding a `CLAUDE.local.md` would stop Claude Code from reading `AGENTS.md`.

**Cloud sessions** run on a fresh clone, on Linux, which is why every script
here avoids macOS-only syntax.

## Every file

| File                           | What it does                                                                                                                                                                                                                      | When it runs              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `../AGENTS.md`, `../CLAUDE.md` | One line per hard constraint, the workflow, commands, where things live, the docs map                                                                                                                                              | Every session             |
| `rules/comments.md`            | The comment register: present-tense facts, no history or attribution                                                                                                                                                               | Touching any code file    |
| `hooks/guard-bash.sh`          | Blocks stash, `add -A`/`--all`/`.`, amend, rebase, force-push, `reset --hard`, `clean -f`, push to `main`, merging, attribution and identity changes; asks before discarding changes, dependency changes and wrangler               | Before every Bash command |
| `hooks/check-invariants.sh`    | Flags anything that looks like an Anthropic API key or a UK phone number, and invisible or non-breaking characters in source                                                                                                        | After every edit          |
| `hooks/lib.sh`                 | Shared helpers: reads the hook input with jq, or node when jq is missing                                                                                                                                                           | Sourced by the hooks      |
| `hooks/tests/`                 | The case table for `guard-bash.sh`, fixtures for `check-invariants.sh`, cases for `wait-for-reply.sh`, and a check that every repo path a skill, a subagent or `AGENTS.md` names exists. Run with `bash .claude/hooks/tests/run.sh`, or as part of `pnpm verify`; CI runs it on every pull request | When a hook or a skill changes |
| `settings.json`                | Permissions (deny, ask, allow), the hooks, `attribution` turned off                                                                                                                                                                | Always                    |
| `skills/implement-issue/`      | The whole loop for one issue: read it, branch, plan, plan review, implement, handoff, pull request, act on the review. `wait-for-reply.sh` is its bounded wait for the owner                                                       | `/implement-issue <N>`    |
| `skills/handoff/`              | Closes a unit of work: the checks, each "Done when" run again, the docs, the commit and the change summary                                                                                                                         | `/handoff`                |
| `skills/ship-pr/`              | Pushes the branch, opens the pull request assigned to the owner and reports CI. Never merges                                                                                                                                       | `/ship-pr`                |
| `agents/plan-reviewer.md`      | Reads a plan against its issue and the code, and the versions and documentation it cites against the web. Changes nothing, runs nothing, and answers `APPROVED`, `CHANGES` or `OWNER`. Its model is set in its first lines          | Step 4 of implement-issue |

## How a plan gets its OK

The implementer posts its plan on the issue, then starts the plan reviewer in a
fresh context: it didn't write the plan, so it reads it without the
implementer's reasons for liking it. Every plan gets this review, also one
that only you can approve, so what reaches you has already been checked. The
reviewer's answer is posted on the issue too, so the trail is public.
`APPROVED` starts the work. `CHANGES` sends the plan back: twice at most when
the reviewer can approve it, once when the plan is yours, because you read it
anyway. `OWNER` means the review found nothing left to fix and the plan waits
for you: you asked for that in the issue, or the plan touches something an
agent never approves (dependencies, login, secrets, the data schema,
Cloudflare, CI or `.claude/`).

The reviewer reads the web, so it checks the versions and the documentation a
plan cites. It can't run anything, so it lists what only a run can show. For a
plan that is yours, you can ask the cloud session to run those before you
answer: it tries them in a scratch project and gives you the reply to post
(`docs/adr/2026-11-15-owner-plans-get-a-review-that-runs.md`).

## "I keep correcting Claude about X. Where does the fix go?"

| If X…                                             | Put it in                                                |
| ------------------------------------------------- | -------------------------------------------------------- |
| must never happen, even if Claude forgets         | a hook (`hooks/`), plus a test in `hooks/tests/`         |
| applies to one area of the code                   | the rule file for that area, or a new rule with `paths:` |
| is a multi-step procedure you repeat              | a skill                                                  |
| applies everywhere and fits in one line           | `AGENTS.md`                                              |
| is about you, your machine or your accounts, here | `CLAUDE.local.md`                                        |
| is about you, in every repo                       | `~/.claude/CLAUDE.md`                                    |

A check a script can make belongs in a hook, not in prose: keep the written
rules for judgement calls.

## Adding things

**A rule.** Create `.claude/rules/<topic>.md` and start it with the files it
covers, like `comments.md`.

**A hook.** Write the script in `.claude/hooks/`, source `lib.sh` for the input,
add it under `hooks` in `settings.json` (copy an existing entry), and add cases
to `hooks/tests/`. Use only portable `sed -E` / `grep -E`. `/hooks` shows what's
configured.

**A subagent.** Create `.claude/agents/<name>.md` with `name`, `description`,
`tools` and `model`. Give a reviewer read-only tools, and say in its prompt
what shape its answer has.

**A skill.** Create `.claude/skills/<name>/SKILL.md` with `name` and
`description`. Claude reads only the description to decide when to use the
skill, so it says when the skill applies, not what its steps are.

## When a hook blocks something

The reason appears in the conversation as `PreToolUse:Bash hook error: … guard-bash blocked this command: <reason>`.
Claude should change course, not retry. To see what a hook does with a command,
run it by hand:

```bash
echo '{"tool_input":{"command":"git stash list"}}' | bash .claude/hooks/guard-bash.sh; echo "exit $?"
```

Exit 2 = blocked (reason on stderr), exit 0 with JSON = ask, exit 0 and nothing
= allowed. If a hook is wrong, fix the script and add a case to
`hooks/tests/guard-bash.cases`. For an emergency, `"disableAllHooks": true` in
`.claude/settings.local.json` turns all hooks off until you remove it.

## Where this setup comes from

The files, hooks and tests are adapted from the setup of
[julianpalomo.dev](https://github.com/julian-palomo/julianpalomo.dev). Four
workflow rules in `AGENTS.md` (evidence before claims, test first, root cause
before a fix, checking a review before applying it) and the shape of a plan
follow ideas from [obra/superpowers](https://github.com/obra/superpowers) (MIT),
rewritten for this repo's issue-based flow. The plugin itself isn't installed
here: its own brainstorm, plan and review steps would compete with the issues.
