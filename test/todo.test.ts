import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ITEMS,
  TODO_STATE,
  counts,
  newlyCompleted,
  nextUp,
  replayBranch,
  summary,
  validateItems,
  type TodoItem,
} from "../src/todo.ts";
import { buildWidgetLines, visibleWindow, type ThemeLike } from "../src/widget.ts";
import { parseTodoRoute, routeText } from "../src/route.ts";

const theme: ThemeLike = { fg: (_c, t) => t, bold: (t) => t };

function item(content: string, status: TodoItem["status"] = "pending"): TodoItem {
  return { content, status };
}

test("validateItems accepts a clean list", () => {
  const result = validateItems([
    { content: "design", status: "completed" },
    { content: "implement", status: "in_progress" },
    { content: "verify", status: "pending" },
  ]);
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.warnings, []);
});

test("validateItems drops junk, defaults bad statuses, trims", () => {
  const result = validateItems([
    { content: "  ok  ", status: "pending" },
    { content: "", status: "pending" },
    { status: "pending" },
    { content: "weird", status: "done" },
    "not an object",
  ]);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0]!.content, "ok");
  assert.equal(result.items[1]!.status, "pending");
  assert.ok(result.warnings.some((w) => w.includes("without content")));
  assert.ok(result.warnings.some((w) => w.includes("invalid status")));
});

test("validateItems warns on multiple in_progress but allows them", () => {
  const result = validateItems([
    { content: "a", status: "in_progress" },
    { content: "b", status: "in_progress" },
  ]);
  assert.equal(result.items.length, 2);
  assert.ok(result.warnings.some((w) => w.includes("in_progress")));
});

test("validateItems caps oversized lists", () => {
  const raw = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => ({ content: `t${i}`, status: "pending" }));
  const result = validateItems(raw);
  assert.equal(result.items.length, MAX_ITEMS);
  assert.ok(result.warnings.some((w) => w.includes("capped")));
});

test("validateItems rejects non-arrays", () => {
  assert.equal(validateItems("nope").items.length, 0);
  assert.equal(validateItems(null).items.length, 0);
});

test("newlyCompleted diffs by content", () => {
  const prev = [item("a", "completed"), item("b", "in_progress"), item("c")];
  const next = [item("a", "completed"), item("b", "completed"), item("c", "in_progress")];
  assert.deepEqual(newlyCompleted(prev, next), ["b"]);
  assert.deepEqual(newlyCompleted(next, next), []);
});

test("nextUp prefers in_progress, then first pending, then null", () => {
  assert.equal(nextUp([item("a"), item("b", "in_progress")])!.content, "b");
  assert.equal(nextUp([item("a", "completed"), item("b")])!.content, "b");
  assert.equal(nextUp([item("a", "completed")]), null);
  assert.equal(nextUp([]), null);
});

test("summary and counts", () => {
  const items = [item("a", "completed"), item("b", "in_progress"), item("c")];
  assert.deepEqual(counts(items), { completed: 1, total: 3 });
  const text = summary(items);
  assert.ok(text.startsWith("1/3 done"));
  assert.ok(text.includes("✔ a"));
  assert.ok(text.includes("▸ b"));
  assert.ok(text.includes("◻ c"));
  assert.equal(summary([]), "Todo list is empty.");
});

test("replayBranch: last snapshot wins, junk skipped", () => {
  const restored = replayBranch([
    { type: "custom", customType: TODO_STATE, data: { items: [{ content: "old", status: "pending" }] } },
    { type: "custom", customType: TODO_STATE, data: { bogus: 1 } },
    { type: "custom", customType: "other", data: { items: [] } },
    {
      type: "custom",
      customType: TODO_STATE,
      data: { items: [{ content: "new", status: "in_progress" }] },
    },
  ]);
  assert.equal(restored.length, 1);
  assert.equal(restored[0]!.content, "new");
  assert.deepEqual(replayBranch([]), []);
});

test("widget renders statuses, count, and cap; empty renders nothing", () => {
  const many = [
    item("done", "completed"),
    item("doing", "in_progress"),
    ...Array.from({ length: 11 }, (_, i) => item(`later ${i}`)),
  ];
  const lines = buildWidgetLines(many, theme);
  const text = lines.join("\n");
  assert.ok(text.includes("☰ todo 1/13"));
  assert.ok(text.includes("✔ done"));
  assert.ok(text.includes("▸ doing"));
  assert.ok(text.includes("+3 more"));
  assert.deepEqual(buildWidgetLines([], theme), []);
});

test("v0.2 visibleWindow keeps the active item in frame", () => {
  const items: TodoItem[] = Array.from({ length: 15 }, (_, i) => ({
    content: `item ${i + 1}`,
    status: i < 11 ? "completed" : "pending",
  }));
  items[11]!.status = "in_progress";

  const win = visibleWindow(items, 10);
  assert.equal(win.shown.length, 10);
  assert.ok(win.shown.some((i) => i.status === "in_progress"));
  assert.equal(win.before + win.shown.length + win.after, items.length);

  // short lists are shown whole, with no markers
  assert.deepEqual(visibleWindow(items.slice(0, 4), 10), { shown: items.slice(0, 4), before: 0, after: 0 });

  // an all-done list clamps to the end rather than running off it
  const done = items.map((i) => ({ ...i, status: "completed" as const }));
  const tail = visibleWindow(done, 10);
  assert.equal(tail.shown.length, 10);
  assert.equal(tail.before + tail.after, 5);
});

test("v0.2 widget renders the above/more markers", () => {
  const items: TodoItem[] = Array.from({ length: 15 }, (_, i) => ({
    content: `item ${i + 1}`,
    status: i < 12 ? "completed" : "pending",
  }));
  const text = buildWidgetLines(items, theme).join("\n");
  assert.ok(text.includes("above"));
  assert.ok(text.includes("item 13"));
});

test("v0.2 /todos routes parse and render", () => {
  assert.deepEqual(parseTodoRoute(""), { kind: "status" });
  assert.deepEqual(parseTodoRoute("  NEXT "), { kind: "next" });
  assert.deepEqual(parseTodoRoute("clear"), { kind: "clear" });
  assert.deepEqual(parseTodoRoute("wat"), { kind: "unknown", input: "wat" });

  const items: TodoItem[] = [
    { content: "write tests", status: "completed" },
    { content: "ship it", status: "in_progress" },
  ];
  assert.ok(routeText(parseTodoRoute("next"), items).text.includes("ship it (in progress)"));
  assert.ok(routeText(parseTodoRoute(""), items).text.includes("1/2 done"));

  const cleared = routeText(parseTodoRoute("clear"), items);
  assert.equal(cleared.clear, true);
  assert.ok(cleared.text.includes("2"));
  assert.equal(routeText(parseTodoRoute("clear"), []).clear, false);

  const unknown = routeText(parseTodoRoute("wat"), items);
  assert.equal(unknown.level, "warning");
  assert.ok(unknown.text.includes("Usage:"));

  assert.ok(routeText(parseTodoRoute("next"), []).text.includes("empty"));
  assert.ok(
    routeText(parseTodoRoute("next"), [{ content: "x", status: "completed" }]).text.includes("all items are done"),
  );
});
