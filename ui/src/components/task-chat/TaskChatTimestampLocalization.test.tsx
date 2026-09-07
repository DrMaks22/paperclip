// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import type { IssueChatComment } from "@/lib/issue-chat-messages";
import { commentsToTaskChatItems, formatTaskChatTimestamp, taskChatSourceTimestamp } from "./task-chat-adapter";
import { TaskChatBubble } from "./TaskChatBubble";
import { TaskChatDescriptionBubble } from "./TaskChatDescriptionBubble";
import { RoutineActivityRow } from "../RoutineActivityRow";

vi.mock("@/components/MarkdownBody", () => ({ MarkdownBody: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

describe("stable display-only timestamp localization", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    await i18n.changeLanguage("en");
  });
  it("updates source-backed bubble and brief times without changing the canonical model serialization", async () => {
    const date = new Date("2026-08-01T14:05:00Z");
    const comment: IssueChatComment = {
      id: "comment-raw", companyId: "company-raw", issueId: "issue-raw", authorType: "user",
      authorAgentId: null, authorUserId: "user-raw", body: "Original English comment",
      presentation: null, metadata: null, createdAt: date, updatedAt: date,
    };
    const [item] = commentsToTaskChatItems([comment]);
    if (item.kind !== "message") throw new Error("Expected stable message model");
    const serialized = JSON.stringify(item);
    expect(JSON.parse(serialized)).toEqual({
      id: "comment-raw", kind: "message", author: "human", text: "Original English comment",
      timestamp: formatTaskChatTimestamp(date), queueTargetRunId: null,
    });
    expect(taskChatSourceTimestamp(item)).toBe(date);
    const save = vi.fn();
    await act(async () => { root.render(<>
      <div data-testid="bubble"><TaskChatBubble item={item} /></div>
      <div data-testid="brief"><TaskChatDescriptionBubble brief={{ description: "Original English brief", author: "human", createdAt: date, onSave: save }} /></div>
    </>); });
    const bubble = host.querySelector('[data-testid="bubble"]')!;
    for (const language of ["ru", "en", "ru"]) {
      await act(async () => { await i18n.changeLanguage(language); });
      const expected = date.toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" });
      expect(bubble.textContent).toContain(expected);
      expect(host.querySelector('[data-testid="brief"]')!.textContent).toContain(expected);
      expect(host.textContent).toContain(comment.body);
      expect(host.textContent).toContain("Original English brief");
      expect(JSON.stringify(item)).toBe(serialized);
      expect(JSON.stringify(commentsToTaskChatItems([comment])[0])).toBe(serialized);
      expect(save).not.toHaveBeenCalled();
    }
  });
  it("keeps a raw externally supplied timestamp verbatim when no source provenance exists", async () => {
    const item = { id: "external-raw", kind: "message" as const, author: "human" as const, text: "Raw provider message", timestamp: "provider-time-unchanged" };
    await act(async () => { root.render(<TaskChatBubble item={item} />); });
    for (const language of ["ru", "en", "ru"]) {
      await act(async () => { await i18n.changeLanguage(language); });
      expect(host.textContent).toContain("provider-time-unchanged");
      expect(taskChatSourceTimestamp(item)).toBeUndefined();
    }
  });
  it("updates routine activity time without collapsing its raw payload", async () => {
    const date = new Date("2026-08-01T14:05:00Z");
    const event = { id: "event-raw", action: "routine.triggered", details: { source_id: "original-raw", message: "Original English payload" }, createdAt: date };
    const serialized = JSON.stringify(event);
    await act(async () => { root.render(<RoutineActivityRow event={event} />); });
    const button = host.querySelector("button")!;
    await act(async () => { button.click(); });
    const payload = host.querySelector("pre")!;
    for (const language of ["ru", "en", "ru"]) {
      await act(async () => { await i18n.changeLanguage(language); });
      expect(host.querySelector("button")).toBe(button);
      expect(host.querySelector("pre")).toBe(payload);
      expect(host.textContent).toContain(date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" }));
      expect(payload.textContent).toBe(JSON.stringify(event.details, null, 2));
      expect(host.textContent).toContain("routine.triggered");
      expect(JSON.stringify(event)).toBe(serialized);
    }
  });
});
