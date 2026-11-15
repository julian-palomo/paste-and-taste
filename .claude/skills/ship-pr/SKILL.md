---
name: ship-pr
description: Use after /handoff, once the checks pass, to push the current paste-and-taste branch and open its pull request. Never merges.
---

# Ship a PR

## 1. Pre-flight: stop if any check fails

```bash
git config --get user.name
git config --get user.email
git shortlog -sne origin/main
git rev-parse --abbrev-ref HEAD
git status --short
```

- The name and email aren't among the authors `git shortlog` lists for `main`: stop and say so. A new address is the owner's to confirm. That list has more than one address for the owner: commits made through GitHub, which are the cloud session's and the merge button's, carry the account's noreply address. Never pass `--author` or `-c user.*`, and never change `git config`.
- The branch is `main`: stop.
- Uncommitted task files: `/handoff` first. Unrelated files stay as they are and are named in the report.
- No issue number for `Closes #N`: ask for it.

## 2. Push

```bash
git push -u origin <branch>
```

## 3. Open the pull request

Write the body to a file outside the repo. Its first line is `Closes #N.`,
plus `Part of #M.` when the issue belongs to an epic. Then the handoff
summary's sections, in this order: "What changed and why", "Done when",
"Checks", "Not verified" and "What this practises". Leave out "Not staged" and
"Needs from you": those are for the session. No attribution anywhere in the
title or the body.

```bash
gh pr create --base main --head <branch> --title "<lowercase imperative, like the commits>" --body-file <file> --assignee @me
```

`@me` is the authenticated `gh` user, which assigns the repo owner.

## 4. Report CI

```bash
gh pr checks <number> --watch
```

On a failure, read the log (`gh run view <run-id> --log-failed`), find the
cause before changing anything, and fix it on the same branch with a new
commit. Never skip a test to get a green run.

## 5. Hand over

Give the pull request's link and the summary. Never merge and never enable
auto-merge: the owner merges. If told it is merged, confirm with
`gh pr view <number> --json state,mergedAt` before building on it.
