@AGENTS.md

Claude Code specifics:
- The team brief you receive at session start comes from the SessionStart hook in `.claude/settings.json`.
- Mid-session "Collab update" notes come from the UserPromptSubmit hook; act on them as described in AGENTS.md.
