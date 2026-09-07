// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { ThemeProvider } from "@/context/ThemeContext";
import { TaskChatActivityPhase } from "./TaskChatActivityPhase";
import { taskChatPhaseSummaryDisplay } from "./task-chat-phase-summary-display";
import { buildActivityPhases } from "./transcript-adapter";
import type { TaskChatActivityPhaseItem, TaskChatItem, TaskChatToolItem } from "./task-chat-model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COUNTS = [1, 2, 5, 11, 21, 22, 25, 101, 111];
const fixtureKinds = [
  { name: "Read", verb: "Read", noun: "file", key: "localizationPhaseSummary.readFiles" },
  { name: "Edit", verb: "Edited", noun: "file", key: "localizationPhaseSummary.editedFiles" },
  { name: "Bash", verb: "Ran", noun: "command", key: "localizationPhaseSummary.commands" },
  { name: "Grep", verb: "Searched", noun: "time", key: "localizationPhaseSummary.searches" },
  { name: "Glob", verb: "Searched", noun: "time", key: "localizationPhaseSummary.searches" },
  { name: "tool call", verb: "Called", noun: "tool", key: "stableTaskChat.calledTools" },
  { name: "vendor_magic", verb: "Called", noun: "tool", key: "stableTaskChat.calledTools" },
  { name: "mcp__server__read_file", verb: "Called", noun: "tool", key: "stableTaskChat.calledTools" },
] as const;

function tools(name: string, count: number): TaskChatToolItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: name + "-" + index, kind: "tool", name, rawName: name, status: "completed",
    target: "Keep English Filename.ts", detail: "Read 2 files, but keep this provider output",
  }));
}

describe("stable TaskChatActivityPhase generated-summary localization", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    await i18n.changeLanguage("en");
  });
  async function render(item: TaskChatActivityPhaseItem) {
    await act(async () => {
      root.render(<ThemeProvider><TaskChatActivityPhase item={item} renderChild={(child) => (
        <span data-testid="raw-child">{child.kind === "tool" ? [child.rawName, child.target, child.detail].join(" | ") : child.id}</span>
      )} /></ThemeProvider>);
    });
  }
  async function locale(language: string) {
    await act(async () => { await i18n.changeLanguage(language); });
  }

  it.each(fixtureKinds.flatMap((fixture) => COUNTS.map((count) => ({ ...fixture, count }))))(
    "$name: count=$count keeps the stable model while its visible and accessible summaries switch",
    async ({ name, verb, noun, key, count }) => {
      const input = tools(name, count);
      const beforeInput = JSON.stringify(input);
      const phase = buildActivityPhases(input, false)[0]!;
      const canonical = verb + " " + count + " " + noun + (count === 1 ? "" : "s");
      expect(phase.summary).toBe(canonical);
      const beforePhase = JSON.stringify(phase);
      await render(phase);
      const button = host.querySelector<HTMLButtonElement>('[data-testid="task-chat-phase-summary"]')!;
      expect(button.textContent).toBe(canonical);

      for (const language of ["ru", "en", "ru"]) {
        await locale(language);
        const expected = language === "en" ? canonical : i18n.t(key, { count });
        expect(host.querySelector('[data-testid="task-chat-phase-summary"]')).toBe(button);
        expect(button.textContent).toBe(expected);
        expect(button.getAttribute("aria-label")).toBe(i18n.t("localizationTaskRuntime.expandActivity", { summary: expected }));
        expect(button.getAttribute("aria-expanded")).toBe("false");
        expect(expected).not.toContain("localization");
        expect(expected).toContain(String(count));
        if (language === "ru") expect(expected).toMatch(/[а-яё]/i);
        expect(JSON.stringify(phase)).toBe(beforePhase);
        expect(JSON.stringify(input)).toBe(beforeInput);
        expect(buildActivityPhases(input, false)[0]!.summary).toBe(canonical);
      }
    },
  );

  it.each([
    [1, "Прочитан 1 файл"], [2, "Прочитано 2 файла"], [5, "Прочитано 5 файлов"],
    [11, "Прочитано 11 файлов"], [21, "Прочитан 21 файл"], [22, "Прочитано 22 файла"],
    [25, "Прочитано 25 файлов"], [101, "Прочитан 101 файл"], [111, "Прочитано 111 файлов"],
  ] as const)("uses Russian file agreement for %i", async (count, expected) => {
    const phase = buildActivityPhases(tools("Read", count), false)[0]!;
    await render(phase);
    await locale("ru");
    expect(host.querySelector('[data-testid="task-chat-phase-summary"]')?.textContent).toBe(expected);
  });

  it("localizes all five stable groups and retains the expanded subtree and raw provider data", async () => {
    const phase = buildActivityPhases([
      ...tools("Read", 1), ...tools("Edit", 2), ...tools("Bash", 5),
      ...tools("Grep", 10), ...tools("Glob", 11), ...tools("mcp__server__read_file", 22),
    ], false)[0]!;
    expect(phase.summary).toBe("Read 1 file, Edited 2 files, Ran 5 commands, Searched 21 times, Called 22 tools");
    phase.interstitial = {
      id: "commentary", kind: "message", author: "agent", text: "Keep provider-authored English update.",
      interstitial: true,
    };
    const before = JSON.stringify(phase);
    await render(phase);
    const button = host.querySelector<HTMLButtonElement>('[data-testid="task-chat-phase-summary"]')!;
    await act(async () => button.click());
    const subtree = host.querySelector('[data-testid="task-chat-phase-children"]')!;
    const rawChild = subtree.querySelector('[data-testid="raw-child"]');
    for (const language of ["ru", "en", "ru"]) {
      await locale(language);
      expect(host.querySelector('[data-testid="task-chat-phase-summary"]')).toBe(button);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      expect(host.querySelector('[data-testid="task-chat-phase-children"]')).toBe(subtree);
      expect(subtree.querySelector('[data-testid="raw-child"]')).toBe(rawChild);
      const expected = language === "en" ? phase.summary
        : "Прочитан 1 файл, изменено 2 файла, выполнено 5 команд, поиск выполнен 21 раз, вызваны 22 инструмента";
      expect(button.textContent).toBe(expected);
      expect(button.getAttribute("aria-label")).toBe(i18n.t("localizationTaskRuntime.collapseActivity", { summary: expected }));
      expect(host.textContent).toContain("Keep English Filename.ts");
      expect(host.textContent).toContain("mcp__server__read_file");
      expect(host.textContent).toContain("Read 2 files, but keep this provider output");
      expect(host.textContent).toContain("Keep provider-authored English update.");
      expect(JSON.stringify(phase)).toBe(before);
    }
  });

  it("localizes the stable usage-only fallback without rewriting raw usage", async () => {
    const input: TaskChatItem[] = [{ id: "usage", kind: "usage", usage: { used: 1, size: 100 } }];
    const phase = buildActivityPhases(input, false)[0]!;
    expect(phase.summary).toBe("No tool activity");
    await render(phase);
    await locale("ru");
    expect(host.querySelector('[data-testid="task-chat-phase-summary"]')?.textContent).toBe("Действий с инструментами нет");
    expect(phase.summary).toBe("No tool activity");
    expect(input).toEqual([{ id: "usage", kind: "usage", usage: { used: 1, size: 100 } }]);
  });

  it.each([
    "Keep provider summary", "Read a file", "Read 2 files, and keep user text", "Read 1 file, +2 more",
    "Read 1 files", "Read 0 files", "Read 02 files", "Read 2 files.", "Read 2 files\nKeep text",
    "Read 9007199254740992 files", "Read 1 file, edited 2 files", "Called 1 tool, Read 1 file",
    "Read 1 file, Read 2 files", "Read 1 file, Edited 2 files, Ran 5 commands, Searched 21 times, Called 22 tools, Called 1 tool",
    "Reasoning", "Runner activity", "Run interrupted", "Used a tool",
  ])("leaves unknown/noncanonical grammar untouched: %s", async (summary) => {
    const phase: TaskChatActivityPhaseItem = {
      id: "unknown", kind: "activity_phase", summary, active: false, items: tools("vendor_magic", 1),
    };
    await render(phase);
    for (const language of ["ru", "en", "ru"]) {
      await locale(language);
      expect(taskChatPhaseSummaryDisplay(summary)).toBe(summary);
      const button = host.querySelector<HTMLButtonElement>('[data-testid="task-chat-phase-summary"]')!;
      expect(button.textContent).toBe(summary);
      expect(button.getAttribute("aria-label")).toBe(i18n.t("localizationTaskRuntime.expandActivity", { summary }));
      expect(phase.summary).toBe(summary);
    }
  });
});
