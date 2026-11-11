# Stick

> A multiplayer AI platform that keeps teams aligned with the latest organizational context.
>
> Built at the c0mpiled-18 hackathon on 2026-11-11 (theme: Multiplayer AI).

## The problem

Engineering decides in a channel: no security announcements before Friday. PR never sees that message, and a press release is already scheduled for tomorrow. Nobody was careless. The teams simply do not share the same context, and the people who do have it are not allowed to forward all of it.

## What Stick does

Stick plugs into the chat tool a team already uses (Discord in this build) and adds three layers:

| Layer | What it does | Code |
|---|---|---|
| **Context** | Turns channel messages into short, continuously updated context items. Each item keeps a summary, a topic, a sensitivity level and the exact quote it came from. The model can raise a sensitivity level above the channel's floor, never lower it. | `src/ingest.js` |
| **Permission** | Decides what each viewer may see, based on their role and clearance. Plain code, no model call, so it cannot be talked into leaking. | `src/access.js` |
| **Review** | A supervisory agent reviews a team member's draft against the latest context, using the supervisor's clearance. It says what must change and which message is the evidence. | `src/review.js` |

Two things follow from combining them:

- **One review, two views.** The lead sees every issue with its source quote. A staff member sees the issues they are cleared for, plus one redacted line saying that something above their clearance also blocks the draft. They learn that they must wait, without learning the secret.
- **Reviews do not go stale.** When new context arrives, drafts that were already approved are reviewed again automatically.

## Demo scenario

All companies and people are fictional. Kestrel is about to announce a feature called Smart Export.

1. Ben (engineering) and Dana (legal) discuss a launch delay in `#eng-general` and a security incident in `#eng-incident`.
2. Erin (PR staff) posts her press release draft in `#pr-drafts`. She was in neither conversation.
3. Without Stick, an AI reviewer approves the draft. With Stick, the review blocks it and cites the engineering messages.
4. Alice (PR lead) sees all issues. Erin sees the ones she is cleared for and one redacted line.
5. Erin fixes the draft and it passes. Then a new message lands in engineering, and Stick re-reviews the approved draft and flags it again.

## Run it

Requires Node.js 22.5 or later, an Anthropic API key, and a Discord bot token for the bot.

```bash
npm install
cp .env.example .env        # fill in ANTHROPIC_API_KEY and DISCORD_BOT_TOKEN
npm run seed                # load the demo scenario into a local SQLite file
npm run server              # web view at http://localhost:3000
npm run bot                 # optional: live ingest and review from Discord
npm test
```

- The web view lets you switch viewer (Erin, Alice, Ben, Dana) and compare a review with and without Stick.
- `config/channels.json` maps each channel to a sensitivity floor and marks which channel holds drafts to review.
- `node scripts/leak-check.js` checks that no restricted text reaches a viewer who is not cleared for it.

## Layout

```
src/bot.js        Discord bot: listens, ingests, replies with the review
src/ingest.js     Context layer
src/access.js     Permission layer
src/review.js     Review layer and re-review on new context
src/server.js     Web API and static page
src/db.js         SQLite schema and helpers
public/           Web view
scripts/          Seed data, demo message sender, leak check
test/             Unit tests
docs/             Build notes written during the hackathon (mostly Chinese)
```

`.collab/`, `.claude/` and `organizer/` are team tooling used during the build. They are not part of the product.

## Limits of this build

- Discord only. Slack is the next connector and is not implemented.
- Roles and clearances come from a seed file, not from an identity provider.
- Built in four hours. The code has tests but has not been through a full review pass.

## Team

- Felix Lai: Discord bot, ingest, context layer
- 許碩展 (antonshuo): database, permission layer, review layer, demo scripts
- ryan234r32: web server and web view
