/**
 * @pify/todo — the agent's working-memory checklist.
 *
 * Claude Code TodoWrite-style: one tool, complete-replacement writes, a live
 * widget, and next-item surfacing (completing an item echoes what's next —
 * avtc's idea) to keep the agent on track. Deliberately lightweight: no
 * dependencies between items, no evidence gates, no reminders — that heavier
 * discipline is @pify/task's job; this is the scratchpad.
 *
 * State persists as snapshot entries (last-wins replay), so the list is
 * branch-aware and survives /reload and compaction for free.
 *
 * Design synthesis: complete-replacement semantics (tintinweb/
 * pi-manage-todo-list, CC TodoWrite), next-item surfacing (avtc-pi-todo),
 * branch-aware snapshots (diegopetrucci/todo, pi's own example).
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import {
  TODO_STATE,
  newlyCompleted,
  nextUp,
  replayBranch,
  summary,
  validateItems,
  type TodoItem,
} from "../src/todo.ts";
import { parseTodoRoute, routeText } from "../src/route.ts";
import { buildWidgetLines } from "../src/widget.ts";

type UiContext = ExtensionContext;

export default function todo(pi: ExtensionAPI) {
  let items: TodoItem[] = [];

  function renderWidget(ctx: UiContext): void {
    if (!ctx.hasUI) return;
    if (items.length === 0) {
      ctx.ui.setWidget("todo", undefined);
      return;
    }
    ctx.ui.setWidget(
      "todo",
      (_tui: unknown, theme: { fg(c: string, s: string): string; bold(s: string): string }) =>
        new Text(buildWidgetLines(items, theme).join("\n"), 0, 0),
      { placement: "aboveEditor" },
    );
  }

  pi.registerTool({
    name: "todo_write",
    label: "Todo list",
    description:
      "Replace the working todo list (complete replacement — send the FULL list every time). " +
      "Use for multi-step work: create items before starting, keep exactly one in_progress, mark " +
      "items completed the moment they are done, and remove items that stopped mattering by " +
      "omitting them. An empty array clears the list. This is your scratchpad — for user-facing " +
      "tracking with dependencies and evidence, use the task tools instead (if installed).",
    parameters: Type.Object({
      items: Type.Array(
        Type.Object({
          content: Type.String({ description: "Short imperative description" }),
          status: StringEnum(["pending", "in_progress", "completed"] as const),
        }),
        { description: "The complete new list, in display order" },
      ),
    }),
    async execute(_id, params: { items: unknown }, _signal, _onUpdate, ctx) {
      const previous = items;
      const result = validateItems(params.items);
      items = result.items;
      pi.appendEntry(TODO_STATE, { items });
      renderWidget(ctx as UiContext);

      const parts: string[] = [summary(items)];
      const done = newlyCompleted(previous, items);
      if (done.length > 0) {
        const next = nextUp(items);
        parts.push(
          next
            ? `Completed: ${done.join(", ")}. Next up: ${next.content}`
            : `Completed: ${done.join(", ")}. All items done.`,
        );
      }
      if (result.warnings.length > 0) parts.push(`Warnings: ${result.warnings.join("; ")}`);

      return {
        content: [{ type: "text", text: parts.join("\n\n") }],
        details: { count: items.length, warnings: result.warnings },
      };
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    items = replayBranch(ctx.sessionManager.getBranch() as never);
    renderWidget(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    items = replayBranch(ctx.sessionManager.getBranch() as never);
    renderWidget(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setWidget("todo", undefined);
  });

  pi.registerCommand("todos", {
    description: "The agent's working todo list: /todos [status | next | clear]",
    handler: async (args, ctx) => {
      const outcome = routeText(parseTodoRoute(args ?? ""), items);
      if (outcome.clear) {
        items = [];
        pi.appendEntry(TODO_STATE, { items });
        renderWidget(ctx as UiContext);
      }
      if (ctx.hasUI) ctx.ui.notify(outcome.text, outcome.level);
    },
  });
}
