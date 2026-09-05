# @pify/todo

The agent's working-memory checklist for [pi](https://github.com/earendil-works/pi) — Claude Code TodoWrite-style: one tool, complete-replacement writes, a live widget, and next-item surfacing that keeps the agent on track.

Part of the [Pify suite](https://github.com/pifydev). Install with [`pify install todo`](https://github.com/pifydev/cli) or `pi install npm:@pify/todo`.

## What it does

- **`todo_write`** — the agent maintains its checklist by sending the complete list each call (`content` + `pending`/`in_progress`/`completed`). Invalid entries drop with warnings; more than one `in_progress` warns but is allowed (parallel subagent work).
- **Next-item surfacing** — completing an item makes the tool echo `Completed: X. Next up: Y`, so the agent's attention lands on the right thing without re-reading the plan.
- **Live widget** — `☰ todo 2/5` with `✔` done (dim), `▸` in progress (bold), `◻` pending. Past ten items the window follows the active item instead of the top of the list (v0.2), so what you're working on is always on screen: `… +4 above` / `… +2 more`.
- **`/todos [status | next | clear]`** (v0.2) — `next` answers "what now?", `clear` drops a stale list that would otherwise keep nagging the agent for the rest of the session.
- **Branch-aware persistence for free** — snapshot entries with last-wins replay: the list survives `/reload` and compaction, and switching session branches shows the right list for that branch.

## todo vs task

| | `@pify/todo` | [`@pify/task`](https://github.com/pifydev/task) |
|---|---|---|
| Audience | The agent's own scratchpad | User-facing tracking |
| Structure | Flat list | Dependency graph (`blockedBy`/`blocks`) |
| Completion | Just mark it | Evidence required |
| Reminders | None (stays quiet) | CC-style system reminders |

They coexist: quick working memory here, verifiable project tracking there.

## License

MIT © [Pify maintainers](https://github.com/pifydev)
