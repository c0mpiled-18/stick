#!/usr/bin/env bash
# One-time setup for each teammate, run from the repo root: ./.collab/setup.sh
# Creates your status issue and writes CLAUDE.local.md (not committed).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

for cmd in git gh python3; do
  command -v "$cmd" >/dev/null || { echo "Missing '$cmd'. Install it, then run this again."; exit 1; }
done
command -v claude >/dev/null || echo "Note: Claude Code ('claude') is not on your PATH yet. Install it before step 3."
gh auth status >/dev/null 2>&1 || gh auth login

login=$(gh api user --jq .login)
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
mkdir -p .collab/state
echo "$login" > .collab/state/login

cat > CLAUDE.local.md <<EOT
# Who you are
You are the coding agent of GitHub user @$login in the team repo $repo.
Your status issue and your branches ($login/<topic>) use this name; requests for you are assigned to @$login.
EOT

num=$(gh issue list --label status --author "@me" --state open --json number --jq '.[0].number // empty')
if [ -z "$num" ]; then
  url=$(gh issue create --title "Status: $login" --label status --assignee "@me" \
        --body-file .collab/status-template.md)
  num=${url##*/}
fi
echo "$num" > .collab/state/status_issue

# Agent activity is posted as comments; switch this repo to "participating only" so they don't flood your inbox.
gh api -X PUT "repos/$repo/subscription" -F subscribed=false -F ignored=false >/dev/null || true
git config pull.rebase true

cat <<EOT

Done. You are @$login, your status issue is #$num.
Next: run \`claude\` in this folder (the repo root). Your agent gets a team brief at the start of every session.
EOT
