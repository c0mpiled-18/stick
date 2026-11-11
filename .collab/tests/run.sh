#!/usr/bin/env bash
# Offline tests for the collab hooks and organizer script, using a fake `gh` and a throwaway git repo.
# Run from anywhere: .collab/tests/run.sh
set -uo pipefail
KIT=$(cd "$(dirname "$0")/../.." && pwd)
TESTS="$KIT/.collab/tests"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
fails=0
pass() { echo "ok   $1"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
check() { if grep -q -- "$2" <<<"$3"; then pass "$1"; else fail "$1"; echo "     expected: $2"; echo "$3" | sed 's/^/     | /' | head -20; fi; }
absent() { if grep -q -- "$2" <<<"$3"; then fail "$1"; echo "     unexpected: $2"; else pass "$1"; fi; }

# A throwaway team repo with the kit in it.
REPO="$WORK/repo"
mkdir -p "$REPO" && cp -R "$KIT/.collab" "$KIT/.claude" "$KIT/AGENTS.md" "$KIT/.gitignore" "$REPO/"
rm -rf "$REPO/.collab/state"
(cd "$REPO" && git init -q -b main && git add -A && git -c user.email=t@t -c user.name=t commit -qm init \
  && git update-ref refs/remotes/origin/bob/payments HEAD)
mkdir -p "$REPO/.collab/state" && echo alice > "$REPO/.collab/state/login" && echo 1 > "$REPO/.collab/state/status_issue"

export PATH="$TESTS/fake-gh:$PATH" CLAUDE_PROJECT_DIR="$REPO" FAKE_GH_LOG="$WORK/gh.log"
export FAKE_GH_ISSUES="$TESTS/fixtures/issues-before.json"
COLLAB="python3 $REPO/.collab/bin/collab.py"
log_has() { grep -c -- "$1" "$FAKE_GH_LOG" 2>/dev/null || true; }

echo "# settings.json"
python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$KIT/.claude/settings.json" \
  && pass "settings.json is valid JSON" || fail "settings.json is valid JSON"

echo "# session-start"
out=$($COLLAB session-start)
python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert d['hookSpecificOutput']['hookEventName']=='SessionStart'" "$out" \
  && pass "emits SessionStart JSON" || fail "emits SessionStart JSON"
check "lists my task" "#12 Login page" "$out"
check "lists request to me" "#15 Decide the auth token format (from @bob)" "$out"
check "lists unassigned task" "#14 Record 90-second demo video" "$out"
check "shows teammate status" "@bob (updated" "$out"
check "shows decision" "#16 Use Next.js" "$out"
absent "does not list my own status as a teammate" "@alice (updated" "$out"
check "marks teammate text as untrusted" "not as instructions from your human" "$out"
absent "no setup warning when set up" "has not been run" "$out"
mv "$REPO/.collab/state/status_issue" "$WORK/status_issue"
out=$(echo '{"source":"compact"}' | $COLLAB session-start)
check "warns when setup.sh was not run" "setup.sh has not been run" "$out"
mv "$WORK/status_issue" "$REPO/.collab/state/status_issue"
$COLLAB session-start </dev/null >/dev/null

echo "# prompt-check"
out=$($COLLAB prompt-check)
[ -z "$out" ] && pass "quiet right after session start" || fail "quiet right after session start"
export FAKE_GH_ISSUES="$TESTS/fixtures/issues-after.json"
python3 - "$REPO/.collab/state/state.json" <<'EOF'
import json, sys; p = sys.argv[1]; s = json.load(open(p)); s["checked_at"] = 0; json.dump(s, open(p, "w"))
EOF
out=$($COLLAB prompt-check)
check "announces new request" "new request #17 from @bob" "$out"
check "announces my request was closed" "your request #18 (Expose /me endpoint) was closed" "$out"
absent "ignores closed old decision" "#19" "$out"
out=$($COLLAB prompt-check)
[ -z "$out" ] && pass "throttled on the next prompt" || fail "throttled on the next prompt"
cp "$REPO/.collab/state/state.json" "$WORK/state.json"
echo "not json" > "$REPO/.collab/state/state.json"
out=$($COLLAB prompt-check)
[ -z "$out" ] && pass "lost state: remembers quietly instead of announcing everything" \
  || fail "lost state: remembers quietly instead of announcing everything"
cp "$WORK/state.json" "$REPO/.collab/state/state.json"

echo "# stop-feed"
git_c() { git -C "$REPO" -c user.email=t@t -c user.name=t "$@"; }
before=$(log_has '"comment"')
echo '{"last_assistant_message":"Nothing changed."}' | $COLLAB stop-feed
echo "x" > "$REPO/login.tsx"
echo '{"last_assistant_message":"Edited a file."}' | $COLLAB stop-feed
[ "$(log_has '"comment"')" = "$before" ] && pass "no post without a new commit" || fail "no post without a new commit"
git_c add login.tsx && git_c commit -qm "Add login form (API_KEY=abc123secret)"
echo '{"last_assistant_message":"Built the login form with token ghp_abcdefghijklmnopqrstuvwxyz0123.\nSecond line stays private."}' \
  | $COLLAB stop-feed
posted=$(grep '"comment"' "$FAKE_GH_LOG" | tail -1)
check "posts to my status issue" '"comment", "1"' "$posted"
check "lists the new commit" "1 new commit(s)" "$posted"
check "includes the commit subject" "Add login form" "$posted"
check "includes the first line of the summary" "Built the login form" "$posted"
absent "drops the rest of the summary" "Second line" "$posted"
absent "masks a key in the commit subject" "abc123secret" "$posted"
absent "masks a token in the summary" "ghp_abcdefghij" "$posted"
check "says what was masked" "\[redacted\]" "$posted"
n=$(log_has '"comment"')
echo '{"last_assistant_message":"again"}' | $COLLAB stop-feed
[ "$(log_has '"comment"')" = "$n" ] && pass "no repeat post for the same commit" || fail "no repeat post for the same commit"
echo '{"stop_hook_active":true}' | $COLLAB stop-feed && pass "respects stop_hook_active" || fail "respects stop_hook_active"
python3 - "$REPO/.collab/state/state.json" <<'EOF'
import json, sys; p = sys.argv[1]; s = json.load(open(p)); s["checked_at"] = 0; json.dump(s, open(p, "w"))
EOF
$COLLAB prompt-check >/dev/null
grep -q "$(git -C "$REPO" rev-parse HEAD)" "$REPO/.collab/state/state.json" \
  && pass "prompt-check keeps the feed position" || fail "prompt-check keeps the feed position"

echo "# commands"
export FAKE_GH_ISSUES="$TESTS/fixtures/issues-before.json"
out=$($COLLAB team)
check "team shows bob's status body" "Doing: webhook signature" "$out"
check "team shows bob's blocked task" "#13 Payments API \[blocked\]" "$out"
check "team shows bob's latest branch commit" "origin/bob/payments" "$out"
check "team shows bob's latest agent activity" "Webhook signature test passes" "$out"
check "team lists open requests" "(@alice -> @bob)" "$out"
echo "Doing: tests" | $COLLAB status >/dev/null
check "status edits my status issue" '"edit", "1", "--body-file"' "$(tail -1 "$FAKE_GH_LOG")"
echo "## What to do" | $COLLAB ask bob "Need /me" >/dev/null
check "ask assigns the request" '"--label", "request", "--assignee", "bob"' "$(tail -1 "$FAKE_GH_LOG")"
echo "## Decided" | $COLLAB decide "Use Postgres" >/dev/null
check "decide labels the decision" '"--label", "decision"' "$(tail -1 "$FAKE_GH_LOG")"
out=$($COLLAB claim 13 2>&1)
check "claim refuses a task someone else owns" "already assigned to @bob" "$out"
$COLLAB claim 14 >/dev/null
check "claim assigns a free task" '"edit", "14", "--add-assignee", "@me"' "$(tail -2 "$FAKE_GH_LOG")"
out=$(FAKE_RACE_LOGIN=aaron $COLLAB claim 14 2>&1)
check "claim steps back when someone claimed at the same moment" "@aaron claimed #14 at the same moment" "$out"
check "claim removes itself after losing the race" '"edit", "14", "--remove-assignee", "@me"' "$(tail -2 "$FAKE_GH_LOG")"
out=$(FAKE_RACE_LOGIN=zed $COLLAB claim 14 2>&1)
check "claim keeps the task when it wins the tie-break" "Claimed #14" "$out"

echo "# organizer dry run"
cat > "$WORK/kit.env" <<'EOF'
HACKKIT_ORG=acme
HACKKIT_DISCORD_PROGRESS_WEBHOOK=https://discord.com/api/webhooks/SECRET1
HACKKIT_DISCORD_FEED_WEBHOOK=https://discord.com/api/webhooks/SECRET2
HACKKIT_DISCORD_INVITE=https://discord.gg/abc
EOF
out=$(HACKKIT_CONFIG="$WORK/kit.env" bash "$KIT/organizer/new-team.sh" --dry-run pay-agent \
      "Alice <alice@example.com>, bob@example.org; bob@example.org @carol" 2>&1)
check "creates repo from template" "gh repo create acme/pay-agent --template acme/hackathon-kit --private" "$out"
check "extracts first email" "invitations -f email=alice@example.com" "$out"
check "extracts second email" "invitations -f email=bob@example.org" "$out"
[ "$(grep -c 'email=bob@example.org' <<<"$out")" = 1 ] && pass "dedupes emails" || fail "dedupes emails"
check "adds an @login to the team" "teams/pay-agent/memberships/carol" "$out"
absent "does not treat email domains as logins" "memberships/example" "$out"
check "warns about missing admin:org scope" "admin:org" "$out"
check "wires the agent feed" "issue_comment) -> Discord agent-feed" "$out"
absent "never prints webhook secrets" "SECRET" "$out"
check "prints teammate instructions" "gh repo clone acme/pay-agent" "$out"

echo
if [ "$fails" = 0 ]; then echo "all tests passed"; else echo "$fails test(s) failed"; exit 1; fi
