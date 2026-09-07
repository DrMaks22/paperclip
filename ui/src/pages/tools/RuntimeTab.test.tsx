// @vitest-environment jsdom

import { flushSync } from "react-dom";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RuntimeTab } from "./RuntimeTab";
import { act as reactAct } from "react";
import { i18n } from "@/i18n";
import { runtimeAlertFieldDisplay } from "@/lib/runtime-alert-display";
import type { ToolRuntimeAlertRecommendation } from "@paperclipai/shared";

const listRuntimeSlotsMock = vi.hoisted(() => vi.fn());
const getRuntimeHealthMock = vi.hoisted(() => vi.fn());
const listConnectionsMock = vi.hoisted(() => vi.fn());
const stopRuntimeSlotMock = vi.hoisted(() => vi.fn());
const restartRuntimeSlotMock = vi.hoisted(() => vi.fn());

vi.mock("@/api/tools", () => ({
  toolsApi: {
    listRuntimeSlots: (companyId: string) => listRuntimeSlotsMock(companyId),
    getRuntimeHealth: (companyId: string) => getRuntimeHealthMock(companyId),
    listConnections: (companyId: string) => listConnectionsMock(companyId),
    stopRuntimeSlot: (companyId: string, slotId: string) => stopRuntimeSlotMock(companyId, slotId),
    restartRuntimeSlot: (companyId: string, slotId: string) => restartRuntimeSlotMock(companyId, slotId),
  },
}));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => ({ pushToast: vi.fn() }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

async function flushReact() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  }
}

function slot(overrides: Record<string, unknown> = {}) {
  return {
    id: "slot-1",
    companyId: "company-1",
    applicationId: "app-1",
    connectionId: "conn-1",
    projectWorkspaceId: null,
    executionWorkspaceId: null,
    issueId: null,
    ownerScopeType: "company",
    ownerScopeId: null,
    runtimeKind: "local_stdio",
    slotKey: "gmail-stdio-local",
    status: "running",
    reuseKey: null,
    workspaceScope: null,
    credentialScopeHash: null,
    provider: null,
    providerRef: null,
    processId: 41832,
    commandTemplateKey: "gmail",
    healthStatus: "healthy",
    lastHealthCheckAt: null,
    idleExpiresAt: null,
    startedAt: new Date("2026-06-13T10:00:00Z"),
    stoppedAt: null,
    lastUsedAt: new Date("2026-06-13T12:55:00Z"),
    lastError: null,
    metadata: null,
    createdAt: new Date("2026-06-13T10:00:00Z"),
    updatedAt: new Date("2026-06-13T10:00:00Z"),
    ...overrides,
  };
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    id: "conn-1",
    companyId: "company-1",
    applicationId: "app-1",
    name: "Gmail",
    connectionKind: "managed",
    transport: "local_stdio",
    status: "active",
    transportConfig: {},
    credentialSecretRefs: [],
    healthStatus: "healthy",
    healthCheckedAt: null,
    lastError: null,
    enabled: true,
    createdByAgentId: null,
    createdByUserId: null,
    createdAt: new Date("2026-06-13T10:00:00Z"),
    updatedAt: new Date("2026-06-13T10:00:00Z"),
    ...overrides,
  };
}

function alert(overrides: Record<string, unknown> = {}) {
  return {
    name: "mcp_runtime_connection_health_degraded",
    severity: "critical",
    status: "ok",
    threshold: "Any degraded connection.",
    observed: "1 degraded connection(s), 0 disabled connection(s).",
    description: "A configured MCP connection is not healthy or has been disabled.",
    firstResponderAction: "Run a connection health check.",
    runbookSection: "runbook#health",
    ...overrides,
  };
}

function health(overrides: Record<string, unknown> = {}) {
  return {
    status: "ok",
    generatedAt: new Date("2026-06-13T13:00:00Z"),
    runbookPath: "docs/runbook.md",
    metrics: {
      averageToolLatencyMsLastHour: 1200,
      p95ToolLatencyMsLastHour: 2400,
      timeoutRateLastHour: 0,
      toolFailuresLastHour: 0,
      toolTimeoutsLastHour: 0,
      capacityDeferralsLastHour: 0,
      activeSlots: 1,
      runningSlots: 1,
    },
    supportMatrix: {},
    alerts: [],
    recommendations: [],
    ...overrides,
  };
}

describe("RuntimeTab", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    listRuntimeSlotsMock.mockResolvedValue({ runtimeSlots: [slot()] });
    getRuntimeHealthMock.mockResolvedValue(health());
    listConnectionsMock.mockResolvedValue({ connections: [connection()] });
    stopRuntimeSlotMock.mockResolvedValue(slot({ status: "stopped" }));
    restartRuntimeSlotMock.mockResolvedValue(slot());
  });

  afterEach(async () => {
    flushSync(() => root?.unmount());
    container.remove();
    await i18n.changeLanguage("en");
    vi.clearAllMocks();
  });

  async function render() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <TooltipProvider>
            <RuntimeTab companyId="company-1" />
          </TooltipProvider>
        </QueryClientProvider>,
      );
    });
    await flushReact();
  }

  it("refreshes status and alert labels while keeping runtime expansion and routes", async () => {
    getRuntimeHealthMock.mockResolvedValue(health({ alerts: [alert({ status: "firing" })] }));
    await render();
    await reactAct(async () => container.querySelector<HTMLTableRowElement>("tbody tr")!.click());
    for (const locale of ["ru", "en"]) {
      await reactAct(async () => { await i18n.changeLanguage(locale); });
      expect(container.textContent).toContain(i18n.t("stableTools.copy135"));
      expect(container.textContent).toContain(i18n.t("stableTools.copy65"));
      expect(container.textContent).toContain("gmail-stdio-local");
      expect(container.querySelector('a[href="/apps/conn-1"]')?.textContent).toBe("Gmail");
      expect(stopRuntimeSlotMock).not.toHaveBeenCalled();
      expect(restartRuntimeSlotMock).not.toHaveBeenCalled();
    }
  });

  it("updates finite operational instructions and plain-body counts without closing technical details or mutating runtime state", async () => {
    const failure: ToolRuntimeAlertRecommendation = {
      name: "mcp_runtime_high_error_rate", status: "firing", severity: "critical",
      threshold: "Warning at >=5 failures and >=10% failure rate in 1 hour; critical at >=10 failures or >=25%.",
      observed: "21 failure(s), 17.5% failure rate.",
      description: "Tool gateway calls are failing after policy authorization.",
      firstResponderAction: "Group audit failures by reasonCode, then fix credentials/config or disable the affected connection.",
      runbookSection: "runbook#unchanged-raw-id",
    };
    const raw = JSON.stringify(failure);
    getRuntimeHealthMock.mockResolvedValue(health({ alerts: [failure] }));
    await reactAct(async () => { await render(); });
    const toggle = Array.from(container.querySelectorAll("button")).find(button => button.textContent?.includes(i18n.t("localizationIssueDetail.ui_Technical_details")))!;
    await reactAct(async () => { toggle.click(); });
    const details = container.querySelector("dl")!;
    expect(details).toBeTruthy();
    for (const language of ["ru", "en", "ru"]) {
      await reactAct(async () => { await i18n.changeLanguage(language); });
      expect(container.contains(toggle)).toBe(true);
      expect(container.querySelector("dl")).toBe(details);
      for (const field of ["threshold", "observed", "firstResponderAction"] as const) {
        expect(details.textContent).toContain(runtimeAlertFieldDisplay(failure, field));
      }
      expect(details.textContent).toContain(language === "ru" ? i18n.t("stableRuntimeAlerts.severity.critical") : "critical");
      expect(container.textContent).toContain(i18n.t("stableTools.failedActions", { observed: runtimeAlertFieldDisplay(failure, "observed") }));
      expect(details.textContent).toContain(failure.name);
      expect(details.textContent).toContain(failure.runbookSection);
      expect(details.textContent).toContain("reasonCode");
      expect(JSON.stringify(failure)).toBe(raw);
      expect(stopRuntimeSlotMock).not.toHaveBeenCalled();
      expect(restartRuntimeSlotMock).not.toHaveBeenCalled();
    }
  });

  it("shows the plain-words summary strip and a Working row linked to the app page", async () => {
    await render();

    expect(container.textContent).toContain("Apps running");
    expect(container.textContent).toContain("1 of 1");
    expect(container.textContent).toContain("about 1.2s");
    expect(container.textContent).toContain("Working");

    const appLink = container.querySelector<HTMLAnchorElement>('a[href="/apps/conn-1"]');
    expect(appLink?.textContent).toContain("Gmail");
    // No ops vocabulary on the primary surface.
    expect(container.textContent).not.toContain("P95 latency");
    expect(container.textContent).not.toContain("local_stdio");
  });

  it("renders a plain needs-attention card for a firing alert and marks the row", async () => {
    getRuntimeHealthMock.mockResolvedValue(
      health({ status: "degraded", alerts: [alert({ status: "firing" })] }),
    );
    listConnectionsMock.mockResolvedValue({ connections: [connection({ healthStatus: "degraded" })] });

    await render();

    // Plain title, not the raw alert name / runbook on the surface.
    expect(container.textContent).toContain("An app needs reconnecting");
    expect(container.textContent).toContain("Needs attention");
    expect(container.textContent).not.toContain("mcp_runtime_connection_health_degraded");
  });

  it("opens a confirm dialog before restarting and only mutates after confirm", async () => {
    await render();

    const restartButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.trim() === "Restart",
    );
    expect(restartButton).toBeTruthy();

    await act(async () => {
      restartButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    // Confirm modal copy is present; nothing has been restarted yet.
    expect(document.body.textContent).toContain("Restart Gmail?");
    expect(restartRuntimeSlotMock).not.toHaveBeenCalled();

    const confirmButton = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Restart" && b.closest('[data-slot="dialog-content"]'),
    );
    await act(async () => {
      confirmButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(restartRuntimeSlotMock).toHaveBeenCalledWith("company-1", "slot-1");
  });
});
