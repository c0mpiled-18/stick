# hackathon-kit

A template repo that lets 2–4 people build together, each with their own Claude Code,
while every agent knows what the others are doing. Agents never talk to each other directly:
tasks, requests, status and decisions live in GitHub Issues, and hooks keep each agent briefed.
Humans discuss face to face; Discord (optional) only mirrors GitHub activity to phones.

## Teammates: three steps

1. Accept the GitHub invitation in your email.
2. Check `gh api user --jq .login` shows the account that accepted; if not, `gh auth login`.
3. `gh repo clone <org>/<repo> && cd <repo> && ./.collab/setup.sh`
4. Run `claude` in that folder, the repo root (hooks only load there).

You need `git`, `gh` (logged in), `python3` and Claude Code. `setup.sh` creates your status issue,
writes a git-ignored `CLAUDE.local.md`, and switches this repo's
GitHub notifications to "participating only" so agent activity doesn't flood your inbox.
Read `.collab/setup.sh` and `.claude/settings.json` before running them: the hooks run on your machine.
Anyone with push access can change those hooks for everyone, so review changes to `.claude/` and
`.collab/` before you pull them, and keep permission prompts on (the rules mean nothing in a mode that
skips them). Only `collab team`, `gh issue list` and `gh issue view` run without asking.

To see how everyone is doing, ask your agent ("how far along is everyone?"); it runs `collab team`.
Discuss face to face, then tell your agent what was agreed so it records a decision issue.

## What your agent does automatically

| When | Hook | What happens |
| --- | --- | --- |
| A session starts or resumes | SessionStart | fast-forward pull, then a brief: your tasks, requests assigned to you, unassigned tasks, teammates' status, recent decisions |
| You send a prompt (at most once a minute) | UserPromptSubmit | tells your agent about new requests, replies to its requests, and new decisions |
| A turn ends with new commits | Stop (async) | comments on your status issue: branch, commit subjects, first line of the agent's summary (secret-looking strings masked) |

Rules the agents follow are in `AGENTS.md`. Agent commands:

```
.collab/bin/collab team                 # everyone's status, tasks, latest commit, latest activity
.collab/bin/collab status  <<< "..."    # replace your status
.collab/bin/collab claim 14             # take an unassigned task
.collab/bin/collab ask bob "Title" <<< "..."   # open a request assigned to @bob
.collab/bin/collab decide "Title" <<< "..."    # record a team decision
```

## Organizer: one-time setup

1. Create a free GitHub organization you own (inviting by email needs one), push this repo into it,
   and tick **Settings → Template repository**.
2. `gh auth refresh -h github.com -s admin:org` so `gh` may send org invitations.
3. Copy `organizer/config.example.env` to `~/.config/hackathon-kit.env` and fill it in.
4. Optional Discord: make a server with a progress channel (and an agent-feed channel if you want
   status comments too), create a webhook in each, and put the URLs plus an invite link in the config.

## Organizer: starting a team

```
organizer/new-team.sh --dry-run my-idea "alice@example.com, @bob"   # preview
organizer/new-team.sh my-idea "alice@example.com, @bob"
```

It creates `<org>/my-idea` from this template, adds the labels, creates a team with push access,
emails each address an org invitation into that team (or adds each `@login`), connects the Discord
webhooks, and prints a message to paste to your teammates. Paste any text containing emails or
`@logins`; duplicates are ignored. Use `@login` for people already in the org.
Rerun with the same repo name to invite more people.

## Turning it off

Delete the `hooks` block in `.claude/settings.json` (or the whole file). Nothing outside this repo is installed.

## Tests

`.collab/tests/run.sh` runs everything offline against a fake `gh`.
