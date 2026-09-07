// @vitest-environment jsdom

import type { ReactElement } from "react";
import { act, forwardRef, useImperativeHandle, type ForwardedRef } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { ThemeProvider } from "@/context/ThemeContext";
import { TaskChatThread } from "./TaskChatThread";

const transcriptState = vi.hoisted(() => ({ transcriptByRun: new Map() }));
const transcriptHookRuns = vi.hoisted(() => ({ runs: [] as unknown[] }));
const sidebarState = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@/components/transcript/useLiveRunTranscripts", () => ({
  useLiveRunTranscripts: ({ runs }: { runs: unknown }) => {
    transcriptHookRuns.runs.push(runs);
    return transcriptState;
  },
}));
vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({ isMobile: sidebarState.isMobile }),
}));
vi.mock("@/hooks/useIssuePlanDocument", () => ({
  useIssuePlanDocument: () => ({ data: null }),
}));
vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));
vi.mock("@/components/MarkdownEditor", () => ({
  MarkdownEditor: forwardRef(function MockMarkdownEditor(
    { value }: { value: string },
    ref: ForwardedRef<unknown>,
  ) {
    useImperativeHandle(ref, () => ({ insertMarkdown: () => {}, focus: () => {} }));
    return <div data-testid="mock-editor">{value}</div>;
  }),
}));

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  await i18n.changeLanguage("en");
  transcriptHookRuns.runs = [];
  localStorage.clear();
  transcriptState.transcriptByRun.clear();
  sidebarState.isMobile = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  flushSync(() => root?.unmount());
  root = null;
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  await i18n.changeLanguage("en");
});

function render(ui: ReactElement) {
  flushSync(() => root!.render(<ThemeProvider>{ui}</ThemeProvider>));
}

function fakeScrollGeometry(
  element: HTMLElement,
  { scrollHeight = 1000, clientHeight = 400, scrollTop = 600 } = {},
) {
  let currentScrollTop = scrollTop;
  Object.defineProperty(element, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(element, "clientHeight", { value: clientHeight, configurable: true });
  Object.defineProperty(element, "scrollTop", {
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = value;
    },
    configurable: true,
  });
}

describe("TaskChatThread draft pass-through", () => {
  it("keeps the composer dock aligned with the thread's horizontal padding", () => {
    render(
      <TaskChatThread
        comments={[{
          id: "comment-1",
          companyId: "company-1",
          issueId: "issue-1",
          authorType: "user",
          authorAgentId: null,
          authorUserId: "user-1",
          body: "Waiting for the dependency.",
          presentation: null,
          metadata: null,
          createdAt: new Date("2026-08-15T12:00:00.000Z"),
          updatedAt: new Date("2026-08-15T12:00:00.000Z"),
        }]}
        onAdd={async () => {}}
      />,
    );

    const dock = container.querySelector('[data-testid="task-chat-composer-dock"]');
    expect(dock?.classList).toContain("px-4");
    expect(dock?.classList).not.toContain("px-1");
  });

  it("forwards draftKey so the composer restores a task's saved draft", () => {
    localStorage.setItem("task-chat-draft:issue-1", "half-written thought");

    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        draftKey="task-chat-draft:issue-1"
      />,
    );

    expect(container.querySelector('[data-testid="mock-editor"]')?.textContent)
      .toBe("half-written thought");
  });
});

describe("TaskChatThread composer alignment", () => {
  it("matches the thread width at every breakpoint", () => {
    render(<TaskChatThread comments={[]} onAdd={async () => {}} />);

    const dock = container
      .querySelector('[data-testid="mock-editor"]')
      ?.closest("div.sticky") as HTMLElement | null;

    expect(dock?.className).toContain("w-full");
    expect(dock?.className).toContain("max-w-(--tc-shell-max-w)");
    expect(dock?.className).not.toContain("md:w-(--pct-80)");
  });
});

describe("TaskChatThread blocker links", () => {
  it("shows the direct and server-selected terminal blocker at the top and bottom", () => {
    const terminalBlocker = {
      id: "terminal-2",
      identifier: "PAP-777",
      title: "Actual work",
      status: "in_progress" as const,
      priority: "high" as const,
      assigneeAgentId: "agent-2",
      assigneeUserId: null,
    };
    const directBlocker = {
      id: "direct-2",
      identifier: "PAP-600",
      title: "Waiting in review",
      status: "in_review" as const,
      priority: "medium" as const,
      assigneeAgentId: "agent-1",
      assigneeUserId: null,
      terminalBlockers: [terminalBlocker],
    };

    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="blocked"
        blockedBy={[
          {
            id: "direct-1",
            identifier: "PAP-500",
            title: "Different dependency",
            status: "todo",
            priority: "low",
            assigneeAgentId: null,
            assigneeUserId: null,
          },
          directBlocker,
        ]}
        blockerAttention={{
          state: "needs_attention",
          reason: "attention_required",
          unresolvedBlockerCount: 2,
          coveredBlockerCount: 0,
          stalledBlockerCount: 0,
          attentionBlockerCount: 1,
          sampleBlockerIdentifier: "PAP-777",
          sampleStalledBlockerIdentifier: null,
          terminalBlockerIssueId: terminalBlocker.id,
        }}
      />,
    );

    const notices = container.querySelectorAll('[data-testid="task-chat-blocker-links"]');
    expect(notices).toHaveLength(2);
    expect(notices[0]?.getAttribute("data-placement")).toBe("top");
    expect(notices[1]?.getAttribute("data-placement")).toBe("bottom");
    for (const notice of notices) {
      expect(notice.textContent).toContain("Blocked byPAP-600Waiting in review");
      expect(notice.textContent).toContain("Ultimately blocked byPAP-777Actual work");
      expect(notice.querySelector('a[href="/issues/PAP-600"]')).not.toBeNull();
      expect(notice.querySelector('a[href="/issues/PAP-777"]')).not.toBeNull();
    }
    expect(container.textContent).not.toContain("Different dependency");
    expect(container.textContent).not.toContain("This task resumes automatically");
  });

  it("shows the ordered live-work queue at the top and bottom", () => {
    const terminalBlocker = {
      id: "terminal-running",
      identifier: "PAP-17426",
      title: "Restore live alias projection",
      status: "in_progress" as const,
      priority: "high" as const,
      assigneeAgentId: "agent-3",
      assigneeUserId: null,
    };

    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="blocked"
        liveIssueIds={new Set(["direct-running", "terminal-running"])}
        blockerAttention={{
          state: "covered",
          reason: "active_dependency",
          unresolvedBlockerCount: 2,
          coveredBlockerCount: 2,
          stalledBlockerCount: 0,
          attentionBlockerCount: 0,
          sampleBlockerIdentifier: "PAP-17426",
          sampleStalledBlockerIdentifier: null,
          blockingTreeLive: true,
          directBlockerIssueId: "direct-running",
          terminalBlockerIssueId: terminalBlocker.id,
          terminalBlocker,
        }}
        blockedBy={[
          {
            id: "direct-queued",
            identifier: "PAP-17427",
            title: "Verify the completed projection",
            status: "todo",
            priority: "medium",
            assigneeAgentId: "agent-4",
            assigneeUserId: null,
          },
          {
            id: "direct-running",
            identifier: "PAP-17425",
            title: "Verify the live projection",
            status: "in_progress",
            priority: "medium",
            assigneeAgentId: "agent-2",
            assigneeUserId: null,
            terminalBlockers: [terminalBlocker],
          },
          {
            id: "direct-done",
            identifier: "PAP-17424",
            title: "Run the guarded cutover",
            status: "done",
            priority: "medium",
            assigneeAgentId: "agent-1",
            assigneeUserId: null,
          },
        ]}
      />,
    );

    const notices = container.querySelectorAll('[data-testid="task-chat-live-work-links"]');
    expect(notices).toHaveLength(2);
    expect(notices[0]?.getAttribute("data-placement")).toBe("top");
    expect(notices[1]?.getAttribute("data-placement")).toBe("bottom");
    for (const notice of notices) {
      expect(notice.textContent).toContain("Waiting on live work");
      const orderedLinks = [...notice.querySelectorAll('[data-testid="task-chat-live-work-step"] a')]
        .map((link) => link.textContent);
      expect(orderedLinks).toEqual([
        "PAP-17424Run the guarded cutover",
        "PAP-17425Verify the live projection",
        "PAP-17427Verify the completed projection",
      ]);
      expect(notice.textContent).toContain("Now runningPAP-17426Restore live alias projection");
      expect(notice.querySelector('a[href="/issues/PAP-17426"]')).not.toBeNull();
    }
    expect(container.querySelector('[data-testid="task-chat-blocker-links"]')).toBeNull();
  });

  it("keeps the compact blocker rows when covered work is no longer live", () => {
    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="blocked"
        liveIssueIds={new Set()}
        blockerAttention={{
          state: "covered",
          reason: "active_dependency",
          unresolvedBlockerCount: 1,
          coveredBlockerCount: 1,
          stalledBlockerCount: 0,
          attentionBlockerCount: 0,
          sampleBlockerIdentifier: "PAP-500",
          sampleStalledBlockerIdentifier: null,
          blockingTreeLive: false,
        }}
        blockedBy={[{
          id: "direct-1",
          identifier: "PAP-500",
          title: "Direct dependency",
          status: "todo",
          priority: "medium",
          assigneeAgentId: "agent-1",
          assigneeUserId: null,
        }]}
      />,
    );

    expect(container.querySelector('[data-testid="task-chat-live-work-links"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="task-chat-blocker-links"]')).toHaveLength(2);
  });

  it("shows only the direct row when the blocker has no deeper unresolved leaf", () => {
    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="blocked"
        blockedBy={[{
          id: "direct-1",
          identifier: "PAP-500",
          title: "Direct dependency",
          status: "in_progress",
          priority: "medium",
          assigneeAgentId: "agent-1",
          assigneeUserId: null,
        }]}
      />,
    );

    expect(container.querySelectorAll('[data-testid="task-chat-blocker-links"]')).toHaveLength(2);
    expect(container.textContent).toContain("Blocked byPAP-500Direct dependency");
    expect(container.textContent).not.toContain("Ultimately blocked by");
  });

  it("keeps a server-selected intermediate blocker on its direct chain", () => {
    const selectedIntermediate = {
      id: "intermediate-2",
      identifier: "PAP-650",
      title: "Stalled intermediate review",
    };
    const selectedDirect = {
      id: "direct-2",
      identifier: "PAP-600",
      title: "Selected dependency",
      status: "blocked" as const,
      priority: "medium" as const,
      assigneeAgentId: "agent-1",
      assigneeUserId: null,
      terminalBlockers: [{
        id: "leaf-2",
        identifier: "PAP-700",
        title: "Deeper structural leaf",
        status: "todo" as const,
        priority: "medium" as const,
        assigneeAgentId: "agent-2",
        assigneeUserId: null,
      }],
    };

    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="blocked"
        blockedBy={[
          {
            id: "direct-1",
            identifier: "PAP-500",
            title: "Unrelated dependency",
            status: "todo",
            priority: "low",
            assigneeAgentId: null,
            assigneeUserId: null,
          },
          selectedDirect,
        ]}
        blockerAttention={{
          state: "stalled",
          reason: "stalled_review",
          unresolvedBlockerCount: 2,
          coveredBlockerCount: 0,
          stalledBlockerCount: 1,
          attentionBlockerCount: 1,
          sampleBlockerIdentifier: "PAP-650",
          sampleStalledBlockerIdentifier: "PAP-650",
          directBlockerIssueId: selectedDirect.id,
          terminalBlockerIssueId: selectedIntermediate.id,
          terminalBlocker: selectedIntermediate,
        }}
      />,
    );

    for (const notice of container.querySelectorAll('[data-testid="task-chat-blocker-links"]')) {
      expect(notice.textContent).toContain("Blocked byPAP-600Selected dependency");
      expect(notice.textContent).toContain("Ultimately blocked byPAP-650Stalled intermediate review");
    }
    expect(container.textContent).not.toContain("Unrelated dependency");
    expect(container.textContent).not.toContain("Deeper structural leaf");
  });

  it("auto-follows the new bottom blocker row when a pinned thread becomes blocked", () => {
    const comment = {
      id: "comment-1",
      companyId: "company-1",
      issueId: "issue-1",
      authorType: "user" as const,
      authorAgentId: null,
      authorUserId: "user-1",
      body: "Waiting for the dependency.",
      presentation: null,
      metadata: null,
      createdAt: new Date("2026-08-15T12:00:00.000Z"),
      updatedAt: new Date("2026-08-15T12:00:00.000Z"),
    };
    const directBlocker = {
      id: "direct-1",
      identifier: "PAP-500",
      title: "Direct dependency",
      status: "in_progress" as const,
      priority: "medium" as const,
      assigneeAgentId: "agent-1",
      assigneeUserId: null,
    };
    const baseProps = {
      comments: [comment],
      onAdd: async () => {},
      blockedBy: [directBlocker],
    };

    render(<TaskChatThread {...baseProps} issueStatus="in_progress" />);
    const scroller = container.querySelector<HTMLElement>('[data-testid="task-chat-scroller"]')!;
    fakeScrollGeometry(scroller);

    render(<TaskChatThread {...baseProps} issueStatus="blocked" />);

    expect(scroller.scrollTop).toBe(scroller.scrollHeight);
  });

  it("does not show blocker rows outside the blocked state", () => {
    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="in_progress"
        blockedBy={[{
          id: "direct-1",
          identifier: "PAP-500",
          title: "Direct dependency",
          status: "in_progress",
          priority: "medium",
          assigneeAgentId: "agent-1",
          assigneeUserId: null,
        }]}
      />,
    );

    expect(container.querySelector('[data-testid="task-chat-blocker-links"]')).toBeNull();
  });
});

describe("TaskChatThread queued message actions", () => {
  it("interrupts the exact run that a persisted queued message is waiting behind", () => {
    const onInterruptQueued = vi.fn(async () => {});
    const queuedComment = {
      id: "comment-queued",
      companyId: "company-1",
      issueId: "issue-1",
      authorType: "user" as const,
      authorAgentId: null,
      authorUserId: "user-1",
      body: "Use the latest requirements instead.",
      presentation: null,
      metadata: null,
      queueState: "queued" as const,
      queueTargetRunId: "run-active",
      createdAt: new Date("2026-08-14T12:00:00.000Z"),
      updatedAt: new Date("2026-08-14T12:00:00.000Z"),
    };

    render(
      <TaskChatThread
        comments={[queuedComment]}
        onAdd={async () => {}}
        onInterruptQueued={onInterruptQueued}
      />,
    );

    const interrupt = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Interrupt",
    );
    expect(container.textContent).toContain("Queued");
    expect(interrupt).not.toBeUndefined();

    flushSync(() => interrupt!.click());
    expect(onInterruptQueued).toHaveBeenCalledOnce();
    expect(onInterruptQueued).toHaveBeenCalledWith("run-active");
  });

  it("disables the action while the queued run is being interrupted", () => {
    render(
      <TaskChatThread
        comments={[{
          id: "comment-queued",
          companyId: "company-1",
          issueId: "issue-1",
          authorType: "user",
          authorAgentId: null,
          authorUserId: "user-1",
          body: "Use the latest requirements instead.",
          presentation: null,
          metadata: null,
          clientStatus: "queued",
          queueTargetRunId: "run-active",
          createdAt: new Date("2026-08-14T12:00:00.000Z"),
          updatedAt: new Date("2026-08-14T12:00:00.000Z"),
        }]}
        onAdd={async () => {}}
        onInterruptQueued={async () => {}}
        interruptingQueuedRunId="run-active"
      />,
    );

    const interrupting = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Interrupting…",
    );
    expect(interrupting).not.toBeUndefined();
    expect(interrupting?.disabled).toBe(true);
  });
});

describe("TaskChatThread mobile composer dock (PAP-495)", () => {
  it("pins the composer to the nav-aware bottom offset so its action row clears the auto-hiding bottom nav", () => {
    sidebarState.isMobile = true;

    render(<TaskChatThread comments={[]} onAdd={async () => {}} draftKey="task-chat-draft:issue-mobile" />);

    const dock = container
      .querySelector('[data-testid="mock-editor"]')
      ?.closest("div.sticky") as HTMLElement | null;

    expect(dock).not.toBeNull();
    // Bottom offset comes from --tc-composer-bottom (Layout raises it to the nav
    // height while the nav is on screen) — NOT the raw safe-area dock, which is
    // what let the nav occlude the action row before PAP-495.
    expect(dock?.className).toContain("bottom-(--tc-composer-bottom)");
    expect(dock?.className).not.toContain("bottom-(--sz-calc-8)");
  });
});

describe("TaskChatThread live transcript", () => {
  it("surfaces the live runtime status while no transcript has streamed yet", () => {
    // Sandbox runs spend their first minutes in preparation phases (config
    // seed, workspace sync) with zero transcript entries. The tail must show
    // the run's runtime-progress status instead of an opaque wait message.
    const baseRun = {
      id: "run-prep",
      status: "running" as const,
      invocationSource: "issue" as const,
      triggerDetail: null,
      startedAt: "2026-08-07T00:00:00.000Z",
      finishedAt: null,
      createdAt: "2026-08-07T00:00:00.000Z",
      agentId: "agent-1",
      agentName: "Coder",
      adapterType: "claude_local",
    };

    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="in_progress"
        activeRun={{ ...baseRun, currentStatusMessage: "Syncing workspace to environment" }}
      />,
    );

    const tail = container.querySelector('[data-testid="task-chat-live-transcript"]');
    expect(tail).not.toBeNull();
    expect(tail!.textContent).toContain("Syncing workspace to environment");
    expect(tail!.textContent).not.toContain("Waiting for transcript...");

    // Without a runtime status, the generic wait message still shows.
    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="in_progress"
        activeRun={{ ...baseRun, id: "run-prep-2" }}
      />,
    );
    const tail2 = container.querySelector('[data-testid="task-chat-live-transcript"]');
    expect(tail2!.textContent).toContain("Waiting for transcript...");
  });

  it("renders in-flight output through TaskChatLiveTail, dropping the debug plumbing (PAP-463 C1)", () => {
    // Interleave the exact noise the old RunTranscriptView tail surfaced (init
    // row, stdout/stderr/system dumps) with real content. Only the streamed
    // reply markdown and the tool row may reach the thread.
    transcriptState.transcriptByRun.set("run-1", [
      { kind: "init", ts: "2026-08-07T00:00:00.000Z", model: "claude", sessionId: "sess-INITMARKER" },
      { kind: "system", ts: "2026-08-07T00:00:00.000Z", text: "SYSTEMNOISE environment hint" },
      { kind: "stdout", ts: "2026-08-07T00:00:00.000Z", text: "STDOUTNOISE raw json dump" },
      { kind: "stderr", ts: "2026-08-07T00:00:00.000Z", text: "STDERRNOISE adapter timeout note" },
      {
        kind: "assistant",
        ts: "2026-08-07T00:00:00.000Z",
        text: "Streaming through the shared renderer",
      },
      { kind: "tool_call", ts: "2026-08-07T00:00:00.000Z", name: "Read", toolUseId: "t1", input: { file_path: "src/app.ts" } },
    ]);

    render(
      <TaskChatThread
        comments={[]}
        onAdd={async () => {}}
        issueStatus="in_progress"
        activeRun={{
          id: "run-1",
          status: "running",
          invocationSource: "issue",
          triggerDetail: null,
          startedAt: "2026-08-07T00:00:00.000Z",
          finishedAt: null,
          createdAt: "2026-08-07T00:00:00.000Z",
          agentId: "agent-1",
          agentName: "Coder",
          adapterType: "codex_local",
        }}
      />,
    );

    const tail = container.querySelector('[data-testid="task-chat-live-transcript"]');
    expect(tail).not.toBeNull();
    // Clean content survives: streamed reply markdown + compact phase summary.
    expect(tail!.textContent).toContain("Streaming through the shared renderer");
    const phaseSummary = tail!.querySelector<HTMLButtonElement>('[data-testid="task-chat-phase-summary"]');
    expect(phaseSummary?.getAttribute("aria-expanded")).toBe("false");
    flushSync(() => phaseSummary!.click());
    expect(tail!.textContent).toContain("src/app.ts");
    // None of the debug plumbing reaches the thread.
    for (const noise of ["INITMARKER", "SYSTEMNOISE", "STDOUTNOISE", "STDERRNOISE"]) {
      expect(container.textContent).not.toContain(noise);
    }
  });

  it("keeps the transcript mounted through run settle until the settled turn renders (PAP-462 B4)", () => {
    transcriptState.transcriptByRun.set("run-1", [
      {
        kind: "assistant",
        ts: "2026-08-07T00:00:00.000Z",
        text: "Last words before the run stops",
      },
    ]);

    const liveProps = {
      comments: [] as never[],
      onAdd: async () => {},
      issueStatus: "in_progress",
      activeRun: {
        id: "run-1",
        status: "running",
        invocationSource: "issue" as const,
        triggerDetail: null,
        startedAt: "2026-08-07T00:00:00.000Z",
        finishedAt: null,
        createdAt: "2026-08-07T00:00:00.000Z",
        agentId: "agent-1",
        agentName: "Coder",
        adapterType: "codex_local",
      },
    };

    render(<TaskChatThread {...liveProps} />);
    expect(
      container.querySelector('[data-testid="task-chat-live-transcript"]'),
    ).not.toBeNull();

    // The run settles: the issue goes terminal and the run reports succeeded, so
    // `liveRun` flips to null — but no reply comment has landed yet. The
    // transcript must NOT vanish; it stays mounted (now as a settled tail) until
    // its settled turn/comment renders.
    render(
      <TaskChatThread
        {...liveProps}
        issueStatus="done"
        activeRun={{
          ...liveProps.activeRun,
          status: "succeeded",
          finishedAt: "2026-08-07T00:01:00.000Z",
        }}
      />,
    );

    expect(
      container.querySelector('[data-testid="task-chat-live-transcript"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Last words before the run stops");
    // The pill has settled to its "Worked" state rather than flipping back to a
    // spinner while it waits for the reply comment.
    expect(container.textContent).toContain("Worked");
  });
});

describe("TaskChatThread live localization invariants", () => {
  beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); });
  afterEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false }); });
  async function locale(language: "ru" | "en") { await act(async () => { await i18n.changeLanguage(language); }); }

  it.each([
    [1, "called 1 tool", "вызван 1 инструмент"],
    [2, "called 2 tools", "вызваны 2 инструмента"],
    [5, "called 5 tools", "вызвано 5 инструментов"],
    [21, "called 21 tools", "вызван 21 инструмент"],
    [22, "called 22 tools", "вызваны 22 инструмента"],
    [25, "called 25 tools", "вызвано 25 инструментов"],
    [101, "called 101 tools", "вызван 101 инструмент"],
  ] as const)("refreshes %i live tool counts across en → ru → en without new entries or resetting the draft", async (count, englishTools, russianTools) => {
    await locale("en");
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected localization fetch"));
    const add = vi.fn();
    const draftKey = "thread-live-count-draft";
    localStorage.setItem(draftKey, "Keep original **live draft**");
    const entries = [
      { kind: "tool_call", ts: "2026-08-25T18:00:01Z", name: "bash", toolUseId: "command-raw-1", input: { command: "ls" } },
      { kind: "tool_call", ts: "2026-08-25T18:00:02Z", name: "bash", toolUseId: "command-raw-2", input: { command: "pwd" } },
      ...Array.from({ length: count }, (_, index) => ({
        kind: "tool_call", ts: "2026-08-25T18:00:03Z", name: "read_file", toolUseId: `tool-raw-${index}`, input: { path: `src/raw-${index}.ts` },
      })),
    ];
    const originalEntries = structuredClone(entries);
    transcriptState.transcriptByRun.set("run-live-counts", entries);
    render(<TaskChatThread comments={[]} onAdd={add} issueStatus="in_progress" draftKey={draftKey}
      activeRun={{ id: "run-live-counts", status: "running", invocationSource: "issue", triggerDetail: null,
        startedAt: "2026-08-25T18:00:00Z", finishedAt: null, createdAt: "2026-08-25T18:00:00Z", agentId: "agent-raw", agentName: "Original agent", adapterType: "codex_local" }}
    />);
    const pill = container.querySelector('[data-testid="task-chat-live-run-pill"]')!;
    const tail = container.querySelector('[data-testid="task-chat-live-transcript"]')!;
    const editor = container.querySelector('[data-testid="mock-editor"]')!;
    const runs = transcriptHookRuns.runs.at(-1);
    expect(pill).toBeTruthy();
    expect(tail).toBeTruthy();
    expect(editor).toBeTruthy();
    for (const language of ["en", "ru", "en"] as const) {
      await locale(language);
      const expected = language === "ru" ? `выполнены 2 команды, ${russianTools}` : `ran 2 commands, ${englishTools}`;
      expect(pill.textContent).toContain(expected);
      expect(pill.textContent).not.toContain(language === "ru" ? "called " : "вызван");
      expect(container.querySelector('[data-testid="task-chat-live-run-pill"]')).toBe(pill);
      expect(container.querySelector('[data-testid="task-chat-live-transcript"]')).toBe(tail);
      expect(container.querySelector('[data-testid="mock-editor"]')).toBe(editor);
      expect(editor.textContent).toBe("Keep original **live draft**");
      expect(localStorage.getItem(draftKey)).toBe("Keep original **live draft**");
      expect(transcriptState.transcriptByRun.get("run-live-counts")).toBe(entries);
      expect(entries).toEqual(originalEntries);
      expect(transcriptHookRuns.runs.at(-1)).toBe(runs);
      expect(fetch).not.toHaveBeenCalled();
      expect(add).not.toHaveBeenCalled();
    }
  });

  it("keeps expanded stable activity and raw provider data across ru → en → ru", async () => {
    await locale("ru");
    const entries = [
      { kind: "tool_call", ts: "2026-08-25T18:00:01Z", name: "Read", toolUseId: "provider-tool", input: { file_path: "src/KeepRawName.ts" } },
      { kind: "tool_result", ts: "2026-08-25T18:00:02Z", toolUseId: "provider-tool", content: "Keep provider output: Read 21 files", isError: false },
    ];
    const before = JSON.stringify(entries);
    transcriptState.transcriptByRun.set("run-raw", entries);
    render(<TaskChatThread comments={[]} onAdd={vi.fn()} issueStatus="in_progress"
      activeRun={{ id: "run-raw", status: "running", invocationSource: "issue", triggerDetail: null,
        startedAt: "2026-08-25T18:00:00Z", finishedAt: null, createdAt: "2026-08-25T18:00:00Z", agentId: "agent-raw", agentName: "Original agent", adapterType: "codex_local" }}
    />);
    const toggle = container.querySelector<HTMLButtonElement>('[data-testid="task-chat-phase-summary"]')!;
    await act(async () => toggle.click());
    const details = container.querySelector('[data-testid="task-chat-phase-children"]')!;
    expect(details.textContent).toContain("src/KeepRawName.ts");
    const toolToggle = details.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')!;
    await act(async () => toolToggle.click());
    const rawOutput = details.querySelector("pre")!;
    expect(rawOutput.textContent).toBe("Keep provider output: Read 21 files");
    for (const language of ["ru", "en", "ru"] as const) {
      await locale(language);
      expect(container.querySelector('[data-testid="task-chat-phase-summary"]')).toBe(toggle);
      expect(toggle.textContent).toBe(language === "ru" ? "Прочитан 1 файл" : "Read 1 file");
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      expect(container.querySelector('[data-testid="task-chat-phase-children"]')).toBe(details);
      expect(details.textContent).toContain("src/KeepRawName.ts");
      expect(details.querySelector("pre")).toBe(rawOutput);
      expect(rawOutput.textContent).toBe("Keep provider output: Read 21 files");
      expect(toolToggle.getAttribute("aria-expanded")).toBe("true");
      expect(JSON.stringify(entries)).toBe(before);
      expect(transcriptState.transcriptByRun.get("run-raw")).toBe(entries);
    }
  });

  it("preserves the exact queued run callback and pending disabled state", async () => {
    await locale("ru");
    const interrupt = vi.fn();
    const comment = {
      id: "comment-queued", companyId: "company-raw", issueId: "issue-raw", authorType: "user" as const,
      authorAgentId: null, authorUserId: "user-raw", presentation: null, metadata: null,
      clientStatus: "queued" as const, queueTargetRunId: "run-raw", body: "Original queued message",
      createdAt: new Date("2026-08-25T18:00:00Z"), updatedAt: new Date("2026-08-25T18:00:00Z"),
    };
    const originalComment = JSON.stringify(comment);
    const props = { comments: [comment], onAdd: vi.fn(), onInterruptQueued: interrupt };
    render(<TaskChatThread {...props} />);
    const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Прервать")!;
    await locale("en");
    expect(button.textContent).toBe("Interrupt");
    await locale("ru");
    expect(container.contains(button)).toBe(true);
    await act(async () => { button.click(); });
    expect(interrupt).toHaveBeenCalledExactlyOnceWith("run-raw");
    render(<TaskChatThread {...props} interruptingQueuedRunId="run-raw" />);
    const pending = [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Прерываем…")!;
    expect(pending.disabled).toBe(true);
    await locale("en");
    expect(pending.textContent).toBe("Interrupting…");
    await locale("ru");
    expect(pending.disabled).toBe(true);
    expect(container.contains(pending)).toBe(true);
    expect(JSON.stringify(comment)).toBe(originalComment);
    expect(interrupt).toHaveBeenCalledOnce();
    expect(props.onAdd).not.toHaveBeenCalled();
  });

});
