---
name: handoff
description: Use when an implementation in paste-and-taste is finished and before /ship-pr, to check it, leave the docs true, commit it and write the change summary.
---

# Handoff

Run these in order. A step that is skipped is named in the summary.

## 1. Checks

Run every command in the table in `AGENTS.md` section 3. A failure stops the
handoff: report it with its output, find the cause, and start again from here
after the fix.

## 2. Done when

Take the issue's "Done when" one line at a time. Run its check now, after the
last change, and keep the output: a check that passed before the last edit
proves nothing about the code as it is. A line that can't be checked from this
session (a phone, a deploy, a new Claude Code session) is listed as not
verified, with what was checked instead.

## 3. Leave the docs true

`AGENTS.md` section 5 lists the docs. For each one the change could have made
false or incomplete, read what it says now and fix it. The test is "does a doc
now say something untrue?", not "did I add a feature?". A new command belongs
in the table in section 3, a new workspace in section 4, and a new file under
`.claude/` in `.claude/README.md`. Records in `docs/adr/` are history: never
edit one to match the present.

## 4. Stage and commit

```bash
git branch --show-current
git status --short
git diff origin/main --stat
```

If that isn't this issue's branch, stop and say so: another session may be
using this folder. List the files that belong to the task; anything else is
left untouched and named under "not staged".

```bash
git add <path> <path>
git commit -m "<short lowercase imperative subject>"
```

Several commits are fine when the work splits into steps a reviewer can read
one at a time, as long as each passes the checks on its own.

## 5. Summary

End with this, in plain words that stand alone, since the owner may paste it
into another conversation:

```markdown
## What changed and why

- `path/to/file`: what changed, and why, in one line.

## Done when

- <line from the issue>: the command run and what it showed.

## Checks

- Ran: each command and its result.
- Not run: each one, and why.

## Not verified

- What wasn't checked, and what was checked instead. "Nothing" if nothing.

## Not staged

- Files left alone because they aren't this task's. "Nothing" if nothing.

## What this practises

The concept the issue names, and one sentence on how it was applied here.

## Needs from you

- Anything to run, approve or decide. "Nothing" if nothing.
```

Then `/ship-pr`.
