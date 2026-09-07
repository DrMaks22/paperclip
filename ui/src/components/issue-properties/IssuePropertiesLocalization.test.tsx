// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Agent, Issue, IssueAttachment, IssueDocument, IssueWorkProduct } from "@paperclipai/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { IssueProperties } from "./IssueProperties";
import { IssuePropertiesArtifactsTab } from "./IssuePropertiesArtifactsTab";
import { IssuePropertiesPlansTab } from "./IssuePropertiesPlansTab";

const fixtures = vi.hoisted(() => ({
  agents: [] as Agent[],
  documents: [] as IssueDocument[],
  attachments: [] as IssueAttachment[],
  workProducts: [] as IssueWorkProduct[],
}));
const update = vi.hoisted(() => vi.fn());
vi.mock("@/context/CompanyContext", () => ({ useCompany: () => ({ selectedCompanyId: "company-1" }) }));
vi.mock("@/context/SidebarContext", () => ({ useSidebar: () => ({ isMobile: false }) }));
vi.mock("@/context/ToastContext", () => ({ useToastActions: () => ({ pushToast: vi.fn() }) }));
vi.mock("@/api/agents", () => ({ agentsApi: {
  list: async () => fixtures.agents,
  adapterModels: async () => [],
  adapterModelProfiles: async () => [],
} }));
vi.mock("@/api/projects", () => ({ projectsApi: { list: async () => [] } }));
vi.mock("@/api/auth", () => ({ authApi: { getSession: async () => ({ user: { id: "user-1" } }) } }));
vi.mock("@/api/access", () => ({ accessApi: { listUserDirectory: async () => ({ users: [] }) } }));
vi.mock("@/api/instanceSettings", () => ({ instanceSettingsApi: { getExperimental: async () => ({
  enableClassicTaskInterface: true, enableTaskWatchdogs: false,
}) } }));
vi.mock("@/api/issues", () => ({ issuesApi: {
  list: async () => [], listLabels: async () => [], listAcceptedPlanDecompositions: async () => [],
  listAttachments: async () => fixtures.attachments,
  listWorkProducts: async () => fixtures.workProducts,
  listInteractions: async () => [],
} }));
vi.mock("@/hooks/useIssuePlanDocument", () => ({ useIssuePlanDocument: () => ({ data: null }) }));
vi.mock("@/hooks/useIssueDocuments", () => ({ useIssueDocuments: () => ({ data: fixtures.documents }) }));
vi.mock("@/hooks/useProjectOrder", () => ({ useProjectOrder: ({ projects }: { projects: unknown[] }) => ({ orderedProjects: projects }) }));
vi.mock("@/components/IssueCasesPanel", () => ({ IssueCasesPanel: () => null }));
vi.mock("@/components/MarkdownBody", () => ({ MarkdownBody: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/IssueDocumentAnnotations", () => ({
  DocumentAnnotationsCountChip: () => null,
  IssueDocumentAnnotations: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useLocation: () => ({ hash: "", pathname: "/issues/PAP-1", search: "", state: null }),
  useCaseHref: () => (id: string) => `/cases/${id}`,
}));

const issue: Issue = {
  id: "issue-1", companyId: "company-1", identifier: "PAP-1", title: "User task title",
  status: "todo", priority: "medium", workMode: "standard", createdByUserId: "user-1",
  projectId: null, parentId: null, assigneeAgentId: null, assigneeUserId: null,
  projectWorkspaceId: null, goalId: null, description: null, reviewPolicy: null,
  checkoutRunId: null, executionRunId: null, executionAgentNameKey: null, executionLockedAt: null,
  createdByAgentId: null, responsibleUserId: null, issueNumber: 1, billingCode: null,
  executionWorkspacePreference: null, executionWorkspaceSettings: null,
  startedAt: null, completedAt: null, cancelledAt: null, hiddenAt: null,
  assigneeAdapterOverrides: null, executionWorkspaceId: null, executionPolicy: null,
  labels: [], labelIds: [], blockedBy: [], blocks: [], requestDepth: 0,
  createdAt: new Date("2026-08-01T12:00:00Z"), updatedAt: new Date("2026-08-01T12:00:00Z"),
};

function inputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("stable issue properties localization", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    await i18n.changeLanguage("ru");
    fixtures.agents = [];
    fixtures.documents = [];
    fixtures.attachments = [];
    fixtures.workProducts = [];
    update.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    queryClient.clear();
    container.remove();
    await i18n.changeLanguage("en");
  });

  async function render(node: ReactNode) {
    await act(async () => {
      root.render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }

  async function openProperty(key: string) {
    const row = container.querySelector(`[data-property-label="${i18n.t(key)}"]`)?.closest('[data-property-row="true"]');
    const button = row?.querySelector("button");
    expect(button).toBeTruthy();
    await act(async () => { button!.click(); });
  }

  it("keeps the assignee search and monitor draft while switching ru → en → ru", async () => {
    fixtures.agents = [{ id: "agent-1", name: "Ada", status: "idle", adapterType: "codex_local", role: "engineer" } as Agent];
    await render(<IssueProperties issue={issue} childIssues={[]} onUpdate={update} inline />);
    await openProperty("localizationFilters.assignee");
    const search = container.querySelector<HTMLInputElement>('input[placeholder="Поиск исполнителей…"]')!;
    expect(search).toBeTruthy();
    await act(async () => { inputValue(search, "Ada"); });
    expect(container.textContent).toContain("Ada");
    await openProperty("localizationIssueDetail.ui_Monitor");
    const notes = container.querySelector<HTMLInputElement>('input[placeholder="Что агенту нужно проверить повторно?"]')!;
    const date = container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    expect(notes).toBeTruthy();
    await act(async () => {
      inputValue(notes, "Проверить сохранённый черновик");
      inputValue(date, "2030-01-02T12:30");
    });

    await act(async () => { await i18n.changeLanguage("en"); });
    expect(search.placeholder).toBe("Search assignees...");
    expect(search.value).toBe("Ada");
    expect(notes.placeholder).toBe("What should the agent re-check?");
    expect(notes.value).toBe("Проверить сохранённый черновик");
    expect(date.value).toBe("2030-01-02T12:30");
    expect(update).not.toHaveBeenCalled();

    await act(async () => { await i18n.changeLanguage("ru"); });
    expect(container.querySelector('input[placeholder="Поиск исполнителей…"]')).toBe(search);
    expect(search.value).toBe("Ada");
    expect(notes.value).toBe("Проверить сохранённый черновик");
    const save = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === i18n.t("localizationRoutines.schedule"))!;
    await act(async () => { save.click(); });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ executionPolicy: expect.objectContaining({ monitor: expect.objectContaining({
      notes: "Проверить сохранённый черновик", nextCheckAt: new Date("2030-01-02T12:30").toISOString(), scheduledBy: "board",
    }) }) }));
  });

  it("localizes the stable cheap lane while retaining its adapter protocol value", async () => {
    fixtures.agents = [{ id: "agent-1", name: "Ada", status: "idle", adapterType: "codex_local", role: "engineer", adapterConfig: {} } as Agent];
    await render(<IssueProperties issue={{ ...issue, assigneeAgentId: "agent-1", assigneeAdapterOverrides: { modelProfile: "cheap" } }} childIssues={[]} onUpdate={update} inline />);
    expect(container.textContent).toContain("Экономичная модель");
    const cheap = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Экономичная модель")!;
    await act(async () => { cheap.click(); });
    expect(container.textContent).toContain('modelProfile: "cheap"');
    expect(container.textContent).toContain("использует основную модель, если экономичный профиль не настроен");
    await act(async () => { await i18n.changeLanguage("en"); });
    expect(container.textContent).toContain("Cheap model");
    expect(container.textContent).toContain('modelProfile: "cheap"');
    const radio = Array.from(container.querySelectorAll<HTMLButtonElement>('button[role="radio"]')).find((button) => button.textContent === "Cheap")!;
    await act(async () => { radio.click(); });
    expect(update).toHaveBeenCalledWith({ assigneeAdapterOverrides: { modelProfile: "cheap" } });
  });

  it("updates grouped artifacts, status and file sizes without closing an expanded document", async () => {
    fixtures.workProducts = [{ id: "wp-1", type: "branch", status: "ready_for_review", title: "Keep original branch title", metadata: {}, url: null } as IssueWorkProduct];
    fixtures.documents = [{ id: "doc-1", key: "notes", title: "Keep original document title", body: "Original document body", latestRevisionNumber: 2 } as IssueDocument];
    fixtures.attachments = [{ id: "attachment-1", createdByAgentId: "agent-1", issueCommentId: null, originalFilename: "report.txt", byteSize: 1536, contentType: "text/plain", objectKey: "report.txt" } as IssueAttachment];
    await render(<IssuePropertiesArtifactsTab issue={issue} />);
    expect(container.textContent).toContain("Документы");
    expect(container.textContent).toContain("Файлы");
    expect(container.textContent).toContain("1,5 КБ");
    expect(container.textContent).toContain("На проверку");
    const document = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Keep original document title"))!;
    await act(async () => { document.click(); });
    expect(container.textContent).toContain("Original document body");
    await act(async () => { await i18n.changeLanguage("en"); });
    expect(container.textContent).toContain("Work products");
    expect(container.textContent).toContain("Documents");
    expect(container.textContent).toContain("1.5 KB");
    expect(container.textContent).toContain("For review");
    expect(document.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Original document body");
  });

  it("updates other-document revision and date while preserving document identity and content", async () => {
    const date = new Date("2026-08-01T14:05:00Z");
    const doc: IssueDocument = {
      id: "doc-raw", companyId: issue.companyId, issueId: issue.id, key: "synthesis",
      title: "Original English title", body: "Original English body", format: "markdown",
      latestRevisionId: "revision-raw", latestRevisionNumber: 21,
      createdByAgentId: null, createdByUserId: "user-raw", updatedByAgentId: null,
      updatedByUserId: "user-raw", lockedAt: null, lockedByAgentId: null,
      lockedByUserId: null, createdAt: date, updatedAt: date,
    };
    fixtures.documents = [doc];
    const raw = JSON.stringify(doc);
    await render(<IssuePropertiesPlansTab issue={issue} />);
    const section = container.querySelector('[data-testid="issue-other-document"]')!;
    for (const language of ["ru", "en", "ru"]) {
      await act(async () => { await i18n.changeLanguage(language); });
      expect(container.querySelector('[data-testid="issue-other-document"]')).toBe(section);
      expect(section.textContent).toContain(i18n.t("localizationIssueDetail.revisionUpdated", {
        revision: 21, date: date.toLocaleString(language, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      }));
      expect(section.textContent).toContain(doc.title);
      expect(section.textContent).toContain(doc.body);
      expect(JSON.stringify(doc)).toBe(raw);
      expect(update).not.toHaveBeenCalled();
    }
  });
});
