import { counts, type TodoItem } from "./todo.ts";

const WIDTH = 54;
const MAX_SHOWN = 10;

export interface ThemeLike {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

/** Compact checklist widget above the editor; empty list renders nothing. */
export function buildWidgetLines(items: TodoItem[], theme: ThemeLike): string[] {
  if (items.length === 0) return [];

  const dim = (s: string) => theme.fg("dim", s);
  const { completed, total } = counts(items);

  const lines: string[] = [];
  const title = ` ☰ todo ${completed}/${total} `;
  const hint = " /todos ";
  const pad = Math.max(1, WIDTH - title.length - hint.length);
  lines.push(dim(`╭${title}${"─".repeat(pad)}${hint}╮`));

  const shown = items.slice(0, MAX_SHOWN);
  for (const item of shown) {
    const content = item.content.length > 44 ? `${item.content.slice(0, 44)}…` : item.content;
    switch (item.status) {
      case "completed":
        lines.push(dim(`│ ✔ ${content}`));
        break;
      case "in_progress":
        lines.push(`${dim("│ ")}${theme.fg("warning", "▸ ")}${theme.bold(content)}`);
        break;
      default:
        lines.push(`${dim("│ ")}◻ ${content}`);
    }
  }
  if (items.length > shown.length) {
    lines.push(dim(`│ … +${items.length - shown.length} more`));
  }

  lines.push(dim(`╰${"─".repeat(WIDTH)}╯`));
  return lines;
}
