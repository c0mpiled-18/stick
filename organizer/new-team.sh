#!/usr/bin/env bash
# Organizer only: create a team repo from the kit and invite teammates by email or GitHub login.
#   organizer/new-team.sh [--dry-run] <repo-name> <emails or @logins, any separators>
#   e.g. organizer/new-team.sh pay-agent "alice@example.com, @bob"
# GitHub emails each person an org invitation; accepting it gives them push access to the new repo.
# Settings come from ~/.config/hackathon-kit.env (see organizer/config.example.env).
set -euo pipefail

CONFIG=${HACKKIT_CONFIG:-$HOME/.config/hackathon-kit.env}
# shellcheck disable=SC1090
[ -f "$CONFIG" ] && source "$CONFIG"
DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; shift; fi
[ $# -ge 1 ] || { sed -n '2,6p' "$0"; exit 1; }
: "${HACKKIT_ORG:?Set HACKKIT_ORG in $CONFIG}"
ORG=$HACKKIT_ORG
TEMPLATE=${HACKKIT_TEMPLATE:-$ORG/hackathon-kit}
NAME=$1; shift
REPO="$ORG/$NAME"
EMAILS=$(printf '%s\n' "$*" | grep -Eo '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | sort -u || true)
LOGINS=$(printf '%s\n' "$*" | tr ',;<>()' '      ' | tr -s ' \t' '\n' \
         | sed -n 's/^@\([A-Za-z0-9][A-Za-z0-9-]*\)$/\1/p' | sort -u || true)

say() { printf '\n== %s\n' "$*"; }
act() { if [ "$DRY" = 1 ]; then echo "[dry-run] $*" >&2; else "$@"; fi; }

if [ -n "$EMAILS$LOGINS" ] && ! gh auth status 2>&1 | grep -q "admin:org"; then
  msg="gh lacks the admin:org scope needed to invite by email. Run: gh auth refresh -h github.com -s admin:org"
  if [ "$DRY" = 1 ]; then echo "warning: $msg"; else echo "$msg"; exit 1; fi
fi

EXISTING=0
if gh repo view "$REPO" >/dev/null 2>&1; then
  EXISTING=1
  say "Repo $REPO already exists: only adding people"
else
  say "Repo $REPO from template $TEMPLATE"
  act gh repo create "$REPO" --template "$TEMPLATE" --private
fi
if [ "$DRY" = 0 ] && [ "$EXISTING" = 0 ]; then
  for _ in $(seq 30); do  # template copies are generated asynchronously
    gh api "repos/$REPO/contents/AGENTS.md" >/dev/null 2>&1 && break
    sleep 1
  done
fi

say "Labels"
for spec in "task:0E8A16:A piece of work one person owns" \
            "request:FBCA04:Ask a teammate for something" \
            "status:C5DEF5:One per person: current status and agent feed" \
            "decision:5319E7:Something the team agreed on" \
            "blocked:D93F0B:Waiting on someone or something"; do
  IFS=: read -r label color desc <<<"$spec"
  act gh label create "$label" -R "$REPO" --color "$color" --description "$desc" --force >/dev/null
done

say "Team $NAME with push access"
if [ "$DRY" = 1 ]; then
  team_id=0 team_slug=$NAME
  echo "[dry-run] gh api orgs/$ORG/teams -f name=$NAME -f privacy=closed"
else
  team=$(gh api "orgs/$ORG/teams/$NAME" --jq '"\(.id) \(.slug)"' 2>/dev/null) \
    || team=$(gh api "orgs/$ORG/teams" -f name="$NAME" -f privacy=closed --jq '"\(.id) \(.slug)"')
  read -r team_id team_slug <<<"$team"
fi
act gh api -X PUT "orgs/$ORG/teams/$team_slug/repos/$REPO" -f permission=push >/dev/null

say "Invitations"
[ -n "$EMAILS$LOGINS" ] || echo "Nobody given. To invite later, rerun with the same repo name plus emails or @logins."
for email in $EMAILS; do
  if act gh api "orgs/$ORG/invitations" -f email="$email" -f role=direct_member \
       -F "team_ids[]=$team_id" >/dev/null; then
    echo "invited $email"
  else
    echo "could not invite $email (already in the org? rerun with their @login instead)"
  fi
done
for login in $LOGINS; do  # adds org members to the team; invites everyone else to the org and team
  if act gh api -X PUT "orgs/$ORG/teams/$team_slug/memberships/$login" -f role=member >/dev/null; then
    echo "added or invited @$login"
  else
    echo "could not add @$login (is the login spelled right?)"
  fi
done

say "Discord"
existing_hooks=""
if [ "$EXISTING" = 1 ]; then
  existing_hooks=$(gh api "repos/$REPO/hooks" --jq '[.[].config.url] | join(" ")' 2>/dev/null || true)
fi
add_hook() {  # add_hook <webhook url> <label> <events...>; the URL is a secret, so it is never printed
  local url=$1 label=$2; shift 2
  case " $existing_hooks " in *" $url/github "*) echo "$label already connected"; return;; esac
  local args=(-f name=web -F active=true -f "config[url]=$url/github" -f "config[content_type]=json")
  for e in "$@"; do args+=(-f "events[]=$e"); done
  if [ "$DRY" = 1 ]; then echo "[dry-run] repo webhook ($*) -> Discord $label"
  else gh api "repos/$REPO/hooks" "${args[@]}" >/dev/null && echo "connected $label ($*)"; fi
}
if [ -z "${HACKKIT_DISCORD_PROGRESS_WEBHOOK:-}${HACKKIT_DISCORD_FEED_WEBHOOK:-}" ]; then
  echo "skipped (no webhooks in $CONFIG)"
else
  if [ -n "${HACKKIT_DISCORD_PROGRESS_WEBHOOK:-}" ]; then
    add_hook "$HACKKIT_DISCORD_PROGRESS_WEBHOOK" progress push pull_request issues
  fi
  if [ -n "${HACKKIT_DISCORD_FEED_WEBHOOK:-}" ]; then
    add_hook "$HACKKIT_DISCORD_FEED_WEBHOOK" agent-feed issue_comment
  fi
fi

discord_line=""
if [ -n "${HACKKIT_DISCORD_INVITE:-}" ]; then
  discord_line="5. Watch everyone's agents live: $HACKKIT_DISCORD_INVITE"
fi
cat <<EOF

Team repo: https://github.com/$REPO
Paste this to your teammates (GitHub has already emailed them the invite):
----------------------------------------------------------------
1. Accept the GitHub invitation from $ORG in your email.
2. Check that gh is logged in as the account that accepted: gh api user --jq .login
   (if it shows another account, run: gh auth login)
3. gh repo clone $REPO && cd $NAME && ./.collab/setup.sh
4. Run \`claude\` in that folder.
$discord_line
----------------------------------------------------------------
You too: clone it, run ./.collab/setup.sh, then open tasks with the Task issue template.
EOF
