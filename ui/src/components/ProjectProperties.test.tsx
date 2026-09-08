// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Project } from "@paperclipai/shared";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectProperties } from "./ProjectProperties";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../api/projects", () => ({ projectsApi: { createWorkspace: vi.fn(), removeWorkspace: vi.fn(), updateWorkspace: vi.fn() } }));
vi.mock("../api/goals", () => ({ goalsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/secrets", () => ({ secretsApi: { list: vi.fn().mockResolvedValue([]), listUserSecretDefinitions: vi.fn().mockResolvedValue([]), create: vi.fn() } }));
vi.mock("../api/environments", () => ({ environmentsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/instanceSettings", () => ({ instanceSettingsApi: { getExperimental: vi.fn().mockResolvedValue({ enableIsolatedWorkspaces: false }) } }));
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));
// Keep the real status picker and popover; these editors are unrelated to status.
vi.mock("./environment-variables-editor", () => ({ EnvironmentVariablesEditor: () => null }));
vi.mock("./InlineEditor", () => ({ InlineEditor: ({ value }: { value?: ReactNode }) => <div>{value}</div> }));
vi.mock("./PathInstructionsModal", () => ({ ChoosePathButton: () => null }));

function project(status: string): Project {
  const now = new Date("2026-09-08T00:00:00Z");
  return {
    id: "project-1",
    companyId: "company-1",
    urlKey: "project-1",
    goalId: null,
    goalIds: [],
    goals: [],
    name: "Operator project name",
    description: "",
    status: status as Project["status"],
    leadAgentId: null,
    targetDate: null,
    color: null,
    icon: null,
    env: null,
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "/tmp/project-1",
      effectiveLocalFolder: "/tmp/project-1",
      origin: "managed_checkout",
    },
    workspaces: [],
    primaryWorkspace: null,
    managedByPlugin: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("ProjectProperties status picker localization", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); await i18n.changeLanguage("en"); });
    client.clear();
    container.remove();
    vi.clearAllMocks();
  });

  async function render(status: string, onFieldUpdate = vi.fn()) {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <QueryClientProvider client={client}>
            <TooltipProvider>
              <ProjectProperties project={project(status)} onFieldUpdate={onFieldUpdate} />
            </TooltipProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    });
    return onFieldUpdate;
  }

  function trigger() {
    const button = container.querySelector<HTMLButtonElement>('button[data-slot="popover-trigger"].rounded-full');
    expect(button).not.toBeNull();
    return button!;
  }

  it.each([
    ["backlog", "Backlog", "В очереди"],
    ["planned", "Planned", "Запланировано"],
    ["in_progress", "In Progress", "В работе"],
    ["completed", "Completed", "Завершено"],
    ["cancelled", "Cancelled", "Отменено"],
    ["future_custom_state", "future custom_state", "future custom_state"],
  ])("updates the selected %s label live and keeps unknown fallback unchanged", async (status, english, russian) => {
    const onFieldUpdate = await render(status);
    for (const [locale, expected] of [["en", english], ["ru", russian], ["en", english]]) {
      await act(async () => { await i18n.changeLanguage(locale); });
      expect(trigger().textContent).toBe(expected);
      expect(onFieldUpdate).not.toHaveBeenCalled();
    }
  });

  it("keeps the open menu localized and sends the raw selected status to the update callback", async () => {
    const onFieldUpdate = await render("backlog");
    expect(trigger().textContent).toBe("Backlog");
    await act(async () => { trigger().click(); });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const optionLabels = () => [...document.querySelectorAll('[data-slot="popover-content"] button')].map((button) => button.textContent);
    expect(optionLabels()).toEqual(["Backlog", "Planned", "In Progress", "Completed", "Cancelled"]);
    await act(async () => { await i18n.changeLanguage("ru"); });
    expect(trigger().textContent).toBe("В очереди");
    expect(optionLabels()).toEqual(["В очереди", "Запланировано", "В работе", "Завершено", "Отменено"]);
    const inProgress = [...document.querySelectorAll<HTMLButtonElement>('[data-slot="popover-content"] button')].find((button) => button.textContent === "В работе")!;
    await act(async () => { inProgress.click(); });
    expect(onFieldUpdate).toHaveBeenCalledExactlyOnceWith("status", { status: "in_progress" });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    await render("in_progress", onFieldUpdate);
    expect(trigger().textContent).toBe("В работе");
    await act(async () => { await i18n.changeLanguage("en"); });
    expect(trigger().textContent).toBe("In Progress");
    expect(onFieldUpdate).toHaveBeenCalledTimes(1);
  });
});
