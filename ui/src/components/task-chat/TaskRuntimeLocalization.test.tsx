// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n, useTranslation } from "@/i18n";
import { ThemeProvider } from "@/context/ThemeContext";
import { SystemNotice } from "../SystemNotice";
import { TaskChatStatusPill } from "./TaskChatStatusPill";
import { turnSummaryText } from "./TaskChatTurn";
import { taskChatDurationLabel, taskChatTokenLabel, taskChatToolActivityLabel } from "./task-chat-display";
import { humanizeSystemNotice, humanizeSystemNoticeDisplay } from "@/lib/system-notice-humanizer";
import { mapCommentMetadataToSystemNoticeSections } from "@/lib/system-notice-comment";
import { issueChatRunLabelDisplay, formatDurationWords } from "@/lib/issue-chat-messages";
import { nextWorkMode, workModeMetaList, titleForPendingWorkMode } from "@/lib/work-mode-meta";
import { issueReviewPolicyBadge, readIssueReviewPolicyMetadata } from "@/lib/review-policy";
import { fileKindForName, fileKindForNameDisplay, formatFileSize, formatFileSizeDisplay } from "./task-chat-attachments";
import { toolTaxonomy } from "./tool-taxonomy";
import type { TaskChatStatusItem } from "./task-chat-model";
import type { IssueCommentMetadata } from "@paperclipai/shared";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("task runtime live localization", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(async () => {
    await i18n.changeLanguage("ru");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    await i18n.changeLanguage("en");
  });
  async function render(node: ReactNode) {
    await act(async () => root.render(<ThemeProvider>{node}</ThemeProvider>));
  }
  async function locale(language: string) {
    await act(async () => { await i18n.changeLanguage(language); });
  }

  it("keeps expanded raw system metadata and links through ru → en → ru", async () => {
    const metadata: IssueCommentMetadata = { version: 1, sections: [{
      title: "Recovery", rows: [
        { type: "key_value", label: "Recovery action", value: "action-raw-123" },
        { type: "agent_link", label: "Recovery owner", agentId: "agent-raw", name: "Keep English Name" },
        { type: "run_link", label: "Source run", runId: "run-raw", agentId: "agent-raw", title: "succeeded" },
      ],
    }] };
    const sections = mapCommentMetadataToSystemNoticeSections(metadata);
    await render(<SystemNotice tone="danger" label="No live execution path" body="Keep stored English body." metadata={sections} />);
    const button = host.querySelector("button")!;
    await act(async () => button.click());
    const details = host.querySelector("#" + button.getAttribute("aria-controls"))!;
    const link = host.querySelector('a[href="/agents/agent-raw"]')!;
    for (const language of ["ru", "en", "ru"]) {
      await locale(language);
      expect(host.querySelector("button")).toBe(button);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      expect(host.contains(details)).toBe(true);
      expect(host.querySelector('a[href="/agents/agent-raw"]')).toBe(link);
      expect(host.textContent).toContain(language === "ru" ? "Нет активного запуска или запланированного продолжения" : "No live execution path");
      expect(host.textContent).toContain(language === "ru" ? "Ответственный за восстановление" : "Recovery owner");
      expect(host.textContent).toContain(language === "ru" ? "Скрыть подробности" : "Hide details");
      expect(host.textContent).toContain("Keep stored English body.");
      expect(host.textContent).toContain("Keep English Name");
      expect(host.textContent).toContain("action-raw-123");
      expect(mapCommentMetadataToSystemNoticeSections(metadata)).toEqual(sections);
      expect(sections[0]!.rows[0]!.label).toBe("Recovery action");
    }
  });

  it("updates approval text but leaves decision IDs and taxonomy icons untouched", async () => {
    const approve = vi.fn();
    const item: TaskChatStatusItem = {
      id: "permission-raw", kind: "status", status: "awaiting_approval", label: "Awaiting approval",
      approval: { toolName: "mcp__server__read_file", options: [{ id: "allow_once", label: "Allow once", kind: "allow_once" }] },
    };
    await render(<TaskChatStatusPill item={item} onApprovalDecision={approve} />);
    const button = host.querySelector("button")!;
    for (const language of ["ru", "en", "ru"]) {
      await locale(language);
      expect(host.querySelector("button")).toBe(button);
      expect(host.textContent).toContain(language === "ru" ? "Ожидание согласования" : "Awaiting approval");
      expect(button.textContent).toBe(language === "ru" ? "Разрешить один раз" : "Allow once");
      expect(item.status).toBe("awaiting_approval");
    }
    await act(async () => button.click());
    expect(approve).toHaveBeenCalledWith("allow_once");
  });

  it("refreshes getters and display projections while preserving recognition and raw formatting", async () => {
    const notice = { body: "The task has no live execution path. Recovery owner: [Keep Name](/agents/a)" };
    const rawNotice = humanizeSystemNotice(notice);
    const filename = "Keep original notes.txt";
    const rawKind = fileKindForName(filename);
    const rawTool = toolTaxonomy("Read");
    function Labels() {
      useTranslation();
      return <div>
        {workModeMetaList().map(mode => <span key={mode.value} title={titleForPendingWorkMode(mode.value)}>{mode.label}</span>)}
        <p>{issueReviewPolicyBadge("human_only")?.label}</p>
        <p>{humanizeSystemNoticeDisplay(notice).title}</p>
        <p>{fileKindForNameDisplay(filename).label}</p>
      </div>;
    }
    await render(<Labels />);
    for (const language of ["ru", "en", "ru"]) {
      await locale(language);
      expect(host.textContent).toContain(language === "ru" ? "Автоматический режим" : "Auto mode");
      expect(host.textContent).toContain(language === "ru" ? "Задача приостановлена: ожидается Keep Name" : "Task paused — waiting on Keep Name");
      expect(host.textContent).toContain(language === "ru" ? "Текст" : "Text");
      expect(nextWorkMode("ask")).toBe("standard");
      expect(workModeMetaList().map(mode => mode.value)).toEqual(["standard", "planning", "ask"]);
      expect(readIssueReviewPolicyMetadata({ reviewPolicy: "human_only" })).toBe("human_only");
      expect(humanizeSystemNotice(notice)).toEqual(rawNotice);
      expect(fileKindForName(filename)).toEqual(rawKind);
      expect(fileKindForNameDisplay(filename).icon).toBe(rawKind.icon);
      expect(toolTaxonomy("Read")).toEqual(rawTool);
      expect(rawTool.verbLabel).toBe("Reading files");
      expect(taskChatToolActivityLabel(rawTool.verbLabel)).toBe(language === "ru" ? "Чтение файлов" : "Reading files");
      expect(formatDurationWords(65000)).toBe("1 minute");
      expect(formatFileSize(1536)).toBe("1.5 KB");
      expect(formatFileSizeDisplay(1536)).toBe(language === "ru" ? "1,5 КБ" : "1.5 KB");
      expect(taskChatDurationLabel("1.5s")).toBe(language === "ru" ? "1,5 с" : "1.5s");
      expect(issueChatRunLabelDisplay("Interrupted by board after 1 minute", taskChatDurationLabel)).toBe(language === "ru" ? "Прервано руководством через 1 мин" : "Interrupted by board after 1 minute");
      expect(taskChatTokenLabel("12.3k tokens")).toContain(language === "ru" ? "токенов" : "tokens");
      for (const count of [1, 2, 5, 21, 22, 25, 101]) {
        const summary = turnSummaryText({ toolCount: count, added: 0, removed: 0 });
        expect(summary).toContain(language === "en" ? count + (count === 1 ? " tool" : " tools") : count + ([1, 21, 101].includes(count) ? " инструмент" : [2, 22].includes(count) ? " инструмента" : " инструментов"));
      }
    }
  });
});
