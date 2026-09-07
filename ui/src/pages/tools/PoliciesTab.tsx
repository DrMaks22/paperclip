import { t, useTranslation } from "@/i18n";
import { Trans } from "react-i18next";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Copy,
  FlaskConical,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
} from "lucide-react";
import {
  humanizeConnectionDisplayName,
  type ToolAccessDecision,
  type ToolCatalogEntry,
  type ToolPolicy,
  type ToolPolicyType,
  type ToolRiskLevel,
} from "@paperclipai/shared";
import { queryKeys } from "@/lib/queryKeys";
import { toolsApi } from "@/api/tools";
import { agentsApi } from "@/api/agents";
import { projectsApi } from "@/api/projects";
import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useToast } from "@/context/ToastContext";
import { EmptyState } from "@/components/EmptyState";
import {
  ToolsPageHeader,
  LoadingState,
  ErrorState,
  DecisionBadge,
  RelativeTime,
  toolEntityLabel,
} from "./shared";
import { groupCatalogByApp, type AppGroup } from "./profiles/profile-model";

const ANY_VALUE = "__any__";

type BuilderPolicyType = Exclude<ToolPolicyType, "trust_rule">;
type ActorTypeValue = "agent" | "user" | "system" | "plugin";
type RateLimitKeyBy = "company" | "agent" | "application" | "connection" | "tool";
type WhenMode = "everyone" | "agent" | "project";
type UsesMode = "anything" | "app" | "actions" | "capability";

const RISK_LEVELS: ToolRiskLevel[] = ["read", "write", "destructive", "low", "medium", "high", "critical"];
const RATE_LIMIT_KEY_FIELDS: RateLimitKeyBy[] = ["company", "agent", "application", "connection", "tool"];
const CAPABILITY_OPTIONS: Array<{ value: ToolRiskLevel; label: string; sentence: string }> = [
  { value: "read", get label() { return t("localizationSkills.readOnly459"); }, get sentence() { return t("stableTools.copy121"); } },
  { value: "write", get label() { return t("localizationTools.makesChanges86"); }, get sentence() { return t("stableTools.copy122"); } },
  { value: "destructive", get label() { return t("localizationTools.destructive87"); }, get sentence() { return t("stableTools.copy123"); } },
];
const OUTCOMES: Array<{ value: BuilderPolicyType; label: string }> = [
  { value: "allow", get label() { return t("localizationProjects.ui_Allow"); } },
  { value: "block", get label() { return t("localizationTools.block216"); } },
  { value: "require_approval", get label() { return t("pages.apps.connect.actions.askFirst"); } },
  { value: "rate_limit", get label() { return t("stableTools.copy1"); } },
];
const SUPPORTED_BUILDER_POLICY_TYPES = new Set<string>(OUTCOMES.map((outcome) => outcome.value));

type PolicyFormState = {
  id: string | null;
  name: string;
  description: string;
  policyType: BuilderPolicyType;
  priority: string;
  enabled: boolean;
  whenMode: WhenMode;
  usesMode: UsesMode;
  actorType: typeof ANY_VALUE | ActorTypeValue;
  agentId: string;
  projectId: string;
  applicationId: string;
  connectionId: string;
  riskLevel: string;
  toolNames: string;
  rateLimitLimit: string;
  rateLimitWindowSeconds: string;
  rateLimitKeyBy: RateLimitKeyBy[];
};

type ConfirmState =
  | { kind: "delete-rule"; policy: ToolPolicy; hits: number }
  | { kind: "forget-approval"; policy: ToolPolicy }
  | null;

function emptyPolicyForm(template?: Partial<PolicyFormState>): PolicyFormState {
  return {
    id: null,
    name: "",
    description: "",
    policyType: "require_approval",
    priority: "100",
    enabled: true,
    whenMode: "everyone",
    usesMode: "anything",
    actorType: ANY_VALUE,
    agentId: ANY_VALUE,
    projectId: ANY_VALUE,
    applicationId: ANY_VALUE,
    connectionId: ANY_VALUE,
    riskLevel: ANY_VALUE,
    toolNames: "",
    rateLimitLimit: "50",
    rateLimitWindowSeconds: "3600",
    rateLimitKeyBy: ["agent", "tool"],
    ...template,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringList(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectValue(selectors: Record<string, unknown>, key: string) {
  const value = selectors[key];
  return typeof value === "string" && value.trim() ? value : ANY_VALUE;
}

function policyToForm(policy: ToolPolicy): PolicyFormState {
  const selectors = policy.selectors ?? {};
  const toolNames = [
    ...stringList(selectors.toolName),
    ...stringList(selectors.toolNames),
  ].join(", ");
  const config = isRecord(policy.config) ? { ...policy.config } : {};
  const rawRateLimit = isRecord(config.rateLimit) ? config.rateLimit : config;
  const rateLimitKeyBy = stringList(rawRateLimit.keyBy).filter((item): item is RateLimitKeyBy =>
    RATE_LIMIT_KEY_FIELDS.includes(item as RateLimitKeyBy),
  );
  const agentId = selectValue(selectors, "agentId");
  const projectId = selectValue(selectors, "projectId");
  const applicationId = selectValue(selectors, "applicationId");
  const riskLevel = selectValue(selectors, "riskLevel");

  return {
    ...emptyPolicyForm(),
    id: policy.id,
    name: policy.name,
    description: policy.description ?? "",
    policyType: SUPPORTED_BUILDER_POLICY_TYPES.has(String(policy.policyType)) ? (policy.policyType as BuilderPolicyType) : "block",
    priority: String(policy.priority),
    enabled: policy.enabled,
    whenMode: agentId !== ANY_VALUE ? "agent" : projectId !== ANY_VALUE ? "project" : "everyone",
    usesMode:
      toolNames.length > 0
        ? "actions"
        : applicationId !== ANY_VALUE
          ? "app"
          : riskLevel !== ANY_VALUE
            ? "capability"
            : "anything",
    actorType: selectValue(selectors, "actorType") as PolicyFormState["actorType"],
    agentId,
    projectId,
    applicationId,
    connectionId: selectValue(selectors, "connectionId"),
    riskLevel,
    toolNames,
    rateLimitLimit: String(rawRateLimit.limit ?? "50"),
    rateLimitWindowSeconds: String(rawRateLimit.windowSeconds ?? "3600"),
    rateLimitKeyBy: rateLimitKeyBy.length > 0 ? rateLimitKeyBy : ["agent", "tool"],
  };
}

function buildPolicyPayload(form: PolicyFormState) {
  const priority = Number(form.priority);
  if (!Number.isInteger(priority) || priority < 0 || priority > 10000) {
    throw new Error(t("stableTools.copy2"));
  }
  const selectors: Record<string, unknown> = {};
  if (form.actorType !== ANY_VALUE) selectors.actorType = form.actorType;
  if (form.whenMode === "agent" && form.agentId !== ANY_VALUE) selectors.agentId = form.agentId;
  if (form.whenMode === "project" && form.projectId !== ANY_VALUE) selectors.projectId = form.projectId;
  if (form.usesMode === "app" && form.applicationId !== ANY_VALUE) selectors.applicationId = form.applicationId;
  if (form.connectionId !== ANY_VALUE) selectors.connectionId = form.connectionId;
  if (form.usesMode === "capability" && form.riskLevel !== ANY_VALUE) selectors.riskLevel = form.riskLevel;
  const toolNames = form.usesMode === "actions" ? parseList(form.toolNames) : [];
  if (toolNames.length === 1) selectors.toolName = toolNames[0];
  if (toolNames.length > 1) selectors.toolNames = toolNames;

  let config: Record<string, unknown> | null = null;
  if (form.policyType === "rate_limit") {
    const limit = Number(form.rateLimitLimit);
    const windowSeconds = Number(form.rateLimitWindowSeconds);
    if (!Number.isInteger(limit) || limit <= 0) throw new Error(t("stableTools.copy3"));
    if (!Number.isInteger(windowSeconds) || windowSeconds <= 0) {
      throw new Error(t("stableTools.copy4"));
    }
    config = { rateLimit: { limit, windowSeconds, keyBy: form.rateLimitKeyBy } };
  }

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    policyType: form.policyType,
    priority,
    enabled: form.enabled,
    selectors,
    conditions: null,
    config,
  };
}

function windowLabel(seconds: string | number | null | undefined) {
  const value = Number(seconds);
  if (value === 3600) return t("stableTools.copy124");
  if (value === 86400) return t("stableTools.copy125");
  if (value === 60) return t("stableTools.copy126");
  return t("localizationApps.durationSeconds", { seconds: Number.isFinite(value) && value > 0 ? value : 3600 });
}

function outcomeLabel(policy: Pick<ToolPolicy, "policyType" | "config"> | PolicyFormState) {
  const policyType = String(policy.policyType);
  if (policyType === "allow") return t("localizationProjects.ui_Allow");
  if (policyType === "block") return t("localizationTools.block216");
  if (policyType === "require_approval") return t("pages.apps.connect.actions.askFirst");
  if (policyType === "redact") return t("stableTools.copy127");
  if (policyType === "trust_rule") return t("localizationProjects.ui_Allow");
  if (policyType === "validate") return t("stableTools.copy128");
  const config = "config" in policy && isRecord(policy.config) ? policy.config : {};
  const rateLimit = isRecord(config.rateLimit) ? config.rateLimit : config;
  const limit = "rateLimitLimit" in policy ? policy.rateLimitLimit : rateLimit.limit;
  const seconds = "rateLimitWindowSeconds" in policy ? policy.rateLimitWindowSeconds : rateLimit.windowSeconds;
  return t("stableTools.limitTo", { limit: limit ?? 50, window: windowLabel(seconds as string | number | null | undefined) });
}

function capabilitySentence(value: string | null | undefined) {
  return CAPABILITY_OPTIONS.find((item) => item.value === value)?.sentence ?? t("stableTools.actions", { value });
}

function toolDisplayName(toolName: string, catalogByToolName: Map<string, ToolCatalogEntry>) {
  const tool = catalogByToolName.get(toolName);
  return humanizeConnectionDisplayName(toolName, { title: tool?.title || undefined });
}

function policySentence(
  policy: Pick<ToolPolicy, "policyType" | "selectors" | "config">,
  maps: LookupMaps,
  catalogByToolName: Map<string, ToolCatalogEntry>,
) {
  const selectors = policy.selectors ?? {};
  const agentIds = [...stringList(selectors.agentId), ...stringList(selectors.agentIds)];
  const projectIds = [...stringList(selectors.projectId), ...stringList(selectors.projectIds)];
  const appIds = [...stringList(selectors.applicationId), ...stringList(selectors.applicationIds)];
  const connectionIds = [...stringList(selectors.connectionId), ...stringList(selectors.connectionIds)];
  const catalogEntryIds = [...stringList(selectors.catalogEntryId), ...stringList(selectors.catalogEntryIds)];
  const tools = [...stringList(selectors.toolName), ...stringList(selectors.toolNames)];
  const risk = selectValue(selectors, "riskLevel");
  const actorType = selectValue(selectors, "actorType");
  const catalogById = new Map([...catalogByToolName.values()].map((tool) => [tool.id, tool]));

  let who = t("stableTools.copy129");
  if (agentIds.length === 1) who = maps.agent.get(agentIds[0]!) ?? t("stableTools.copy130");
  else if (agentIds.length > 1) who = t("pages.agents.agentCount", { count: agentIds.length });
  else if (projectIds.length === 1) who = t("stableTools.projectAgents", { project: maps.project.get(projectIds[0]!) ?? t("stableTools.copy131") });
  else if (projectIds.length > 1) who = t("stableTools.projectsAgents", { count: projectIds.length });
  else if (actorType !== ANY_VALUE && actorType !== "agent") who = actorType === "plugin" ? t("stableTools.plugins") : toolEntityLabel(actorType);

  let uses = t("stableTools.copy132");
  if (tools.length === 1) uses = toolDisplayName(tools[0]!, catalogByToolName);
  else if (tools.length > 1) uses = t("stableTools.specificActions", { count: tools.length });
  else if (catalogEntryIds.length === 1) {
    const tool = catalogById.get(catalogEntryIds[0]!);
    uses = tool ? tool.title || toolDisplayName(tool.toolName, catalogByToolName) : t("stableTools.copy133");
  }
  else if (catalogEntryIds.length > 1) uses = t("stableTools.specificActions", { count: catalogEntryIds.length });
  else if (appIds.length === 1) uses = maps.application.get(appIds[0]!) ?? t("stableTools.copy134");
  else if (appIds.length > 1) uses = t("stableTools.apps", { count: appIds.length });
  else if (connectionIds.length === 1) uses = maps.connection.get(connectionIds[0]!) ?? t("stableTools.copy134");
  else if (risk !== ANY_VALUE) uses = capabilitySentence(risk);

  return { who, uses, outcome: outcomeLabel(policy) };
}

function formSentence(form: PolicyFormState, maps: LookupMaps, catalogByToolName: Map<string, ToolCatalogEntry>) {
  const payload = buildPreviewSelectors(form);
  return policySentence(
    { policyType: form.policyType, selectors: payload, config: buildPreviewConfig(form) },
    maps,
    catalogByToolName,
  );
}

function buildPreviewSelectors(form: PolicyFormState) {
  const selectors: Record<string, unknown> = {};
  if (form.actorType !== ANY_VALUE) selectors.actorType = form.actorType;
  if (form.whenMode === "agent" && form.agentId !== ANY_VALUE) selectors.agentId = form.agentId;
  if (form.whenMode === "project" && form.projectId !== ANY_VALUE) selectors.projectId = form.projectId;
  if (form.usesMode === "app" && form.applicationId !== ANY_VALUE) selectors.applicationId = form.applicationId;
  if (form.usesMode === "capability" && form.riskLevel !== ANY_VALUE) selectors.riskLevel = form.riskLevel;
  const toolNames = form.usesMode === "actions" ? parseList(form.toolNames) : [];
  if (toolNames.length === 1) selectors.toolName = toolNames[0];
  if (toolNames.length > 1) selectors.toolNames = toolNames;
  return selectors;
}

function buildPreviewConfig(form: PolicyFormState) {
  if (form.policyType === "rate_limit") {
    return { rateLimit: { limit: form.rateLimitLimit, windowSeconds: form.rateLimitWindowSeconds } };
  }
  return null;
}

function sentenceText(sentence: ReturnType<typeof policySentence>) {
  return t("stableTools.sentence", sentence);
}

function OutcomeChip({ type, config }: { type: BuilderPolicyType | ToolPolicyType; config?: Record<string, unknown> | null }) {
  useTranslation();
  const label = outcomeLabel({ policyType: type, config: config ?? null });
  const variant =
    type === "block"
      ? "destructive"
      : type === "require_approval" || type === "rate_limit"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}

type LookupMaps = {
  agent: Map<string, string>;
  project: Map<string, string>;
  application: Map<string, string>;
  connection: Map<string, string>;
};

function RuleSentence({ sentence }: { sentence: ReturnType<typeof policySentence> }) {
  useTranslation();
  return (
    <span><Trans i18nKey="stableTools.sentenceRich" values={sentence} components={{ who: <strong />, uses: <strong />, outcome: <strong /> }} /></span>
  );
}

function PolicySimulator({
  companyId,
  agents,
  policies,
  maps,
  catalogByToolName,
  open,
  onOpenChange,
  onEditPolicy,
}: {
  companyId: string;
  agents: Array<{ id: string; name: string }>;
  policies: ToolPolicy[];
  maps: LookupMaps;
  catalogByToolName: Map<string, ToolCatalogEntry>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditPolicy: (policy: ToolPolicy) => void;
}) {
  useTranslation();
  const { pushToast } = useToast();
  const [agentId, setAgentId] = useState<string>("");
  const [toolName, setToolName] = useState("");
  const [result, setResult] = useState<ToolAccessDecision | null>(null);

  const test = useMutation({
    mutationFn: () =>
      toolsApi.testPolicy(companyId, {
        actor: { actorType: "agent", actorId: agentId, agentId },
        request: { toolName: toolName.trim() },
      }),
    onSuccess: (res) => setResult(res.decision),
    onError: (err) => {
      setResult(null);
      pushToast({
        title: t("stableTools.copy5"),
        body: err instanceof ApiError ? err.message : String(err),
        tone: "error",
      });
    },
  });

  const decidingPolicy = result?.matchedPolicyIds[0]
    ? policies.find((policy) => policy.id === result.matchedPolicyIds[0])
    : null;
  const verdict = result
    ? `${outcomeLabel({ policyType: result.decision as ToolPolicyType, config: null })} - ${
        decidingPolicy ? t("stableTools.ruleNumber", { number: policies.findIndex((policy) => policy.id === decidingPolicy.id) + 1 }) : result.explanation
      }`
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />{t("stableTools.copy6")}</SheetTitle>
          <SheetDescription>{t("stableTools.copy7")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("pages.agentDetail.agentFallback")}</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("localizationRoutines.selectAgent")} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="test-action">{t("localizationSettings.action")}</Label>
              <Input
                id="test-action"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
                placeholder={t("stableTools.actionExample")}
              />
            </div>
          </div>
          <Button size="sm" disabled={!agentId || !toolName.trim() || test.isPending} onClick={() => test.mutate()}>
            {test.isPending ? t("pages.apps.connect.checking") : t("stableTools.copy8")}
          </Button>

          {result ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{verdict}</p>
                {decidingPolicy ? (
                  <button
                    type="button"
                    className="text-left text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => onEditPolicy(decidingPolicy)}
                  >
                    <RuleSentence sentence={policySentence(decidingPolicy, maps, catalogByToolName)} />
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">{result.explanation}</p>
                )}
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer text-foreground">{t("pages.pipelines.details")}</summary>
                <div className="mt-2 space-y-1 font-mono">
                  <div>{t("stableTools.reason")} {result.reasonCode}</div>
                  <div>{t("stableTools.matchedRules")} {result.matchedPolicyIds.length ? result.matchedPolicyIds.join(", ") : t("pages.caseDetail.markdownNone")}</div>
                  <div>{t("stableTools.effectiveProfiles")} {result.effectiveProfileIds.length ? result.effectiveProfileIds.join(", ") : t("pages.caseDetail.markdownNone")}</div>
                </div>
              </details>
            </div>
          ) : null}
        </div>
        <SheetFooter className="border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RuleBuilder({
  form,
  setForm,
  maps,
  agents,
  projects,
  applications,
  appGroups,
  catalogByToolName,
  saving,
  onCancel,
  onSave,
}: {
  form: PolicyFormState;
  setForm: (form: PolicyFormState) => void;
  maps: LookupMaps;
  agents: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  applications: Array<{ id: string; name: string }>;
  appGroups: AppGroup[];
  catalogByToolName: Map<string, ToolCatalogEntry>;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  useTranslation();
  const sentence = formSentence(form, maps, catalogByToolName);
  const selectedTools = new Set(parseList(form.toolNames));
  const setToolNames = (next: Set<string>) => setForm({ ...form, usesMode: "actions", toolNames: [...next].sort().join(", ") });
  const toggleTool = (toolName: string) => {
    const next = new Set(selectedTools);
    if (next.has(toolName)) next.delete(toolName);
    else next.add(toolName);
    setToolNames(next);
  };
  const toggleGroup = (group: AppGroup) => {
    const next = new Set(selectedTools);
    const allSelected = group.tools.every((tool) => next.has(tool.toolName));
    for (const tool of group.tools) {
      if (allSelected) next.delete(tool.toolName);
      else next.add(tool.toolName);
    }
    setToolNames(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="px-0" onClick={onCancel}>{t("stableTools.copy9")}</Button>
          <h2 className="text-lg font-semibold text-foreground">{form.id ? t("stableTools.copy10") : t("stableTools.copy11")}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>{t("pages.apps.common.cancel")}</Button>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? t("pages.companySettings.saving") : t("stableTools.copy12")}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
        <RuleSentence sentence={sentence} />
      </div>

      <div className="grid gap-4 lg:grid-cols-(--gtc-61)">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t("stableTools.copy13")}</h3>
          <div className="grid gap-2">
            {[
              ["everyone", t("stableTools.everyone")],
              ["agent", t("stableTools.specificAgent")],
              ["project", t("stableTools.agentsInProject")],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant={form.whenMode === value ? "secondary" : "outline"}
                size="sm"
                className="justify-start"
                onClick={() => setForm({ ...form, whenMode: value as WhenMode })}
              >
                {label}
              </Button>
            ))}
          </div>
          {form.whenMode === "agent" ? (
            <Select value={form.agentId} onValueChange={(agentId) => setForm({ ...form, agentId })}>
              <SelectTrigger><SelectValue placeholder={t("stableTools.copy15")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>{t("stableTools.copy15")}</SelectItem>
                {agents.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          {form.whenMode === "project" ? (
            <Select value={form.projectId} onValueChange={(projectId) => setForm({ ...form, projectId })}>
              <SelectTrigger><SelectValue placeholder={t("stableTools.copy16")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>{t("stableTools.copy16")}</SelectItem>
                {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t("stableTools.copy14")}</h3>
          <div className="grid gap-2">
            {[
              ["anything", t("stableTools.anything")],
              ["app", t("stableTools.specificApp")],
              ["actions", t("stableTools.specificActionsLabel")],
              ["capability", t("stableTools.actionsByCapability")],
            ].map(([value, label]) => (
              <Button
                key={value}
                variant={form.usesMode === value ? "secondary" : "outline"}
                size="sm"
                className="justify-start"
                onClick={() => setForm({ ...form, usesMode: value as UsesMode })}
              >
                {label}
              </Button>
            ))}
          </div>
          {form.usesMode === "app" ? (
            <Select value={form.applicationId} onValueChange={(applicationId) => setForm({ ...form, applicationId })}>
              <SelectTrigger><SelectValue placeholder={t("stableTools.copy17")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>{t("stableTools.copy17")}</SelectItem>
                {applications.map((app) => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
          {form.usesMode === "capability" ? (
            <Select value={form.riskLevel} onValueChange={(riskLevel) => setForm({ ...form, riskLevel })}>
              <SelectTrigger><SelectValue placeholder={t("stableTools.copy18")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>{t("stableTools.copy18")}</SelectItem>
                {CAPABILITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {form.usesMode === "actions" ? (
            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              {appGroups.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">{t("stableTools.copy19")}</div>
              ) : (
                appGroups.map((group) => {
                  const selectedCount = group.tools.filter((tool) => selectedTools.has(tool.toolName)).length;
                  return (
                    <div key={group.appKey} className="border-b border-border last:border-b-0">
                      <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
                        <Checkbox
                          checked={selectedCount === group.tools.length ? true : selectedCount > 0 ? "indeterminate" : false}
                          onCheckedChange={() => toggleGroup(group)}
                        />
                        <span className="flex-1">{group.name}</span>
                        <span className="text-xs text-muted-foreground">{t("stableTools.selectionCount", { selected: selectedCount, total: group.tools.length })}</span>
                      </label>
                      <div className="pb-2 pl-8 pr-3">
                        {group.tools.map((tool) => (
                          <label key={tool.id} className="flex items-center gap-2 py-1 text-sm">
                            <Checkbox checked={selectedTools.has(tool.toolName)} onCheckedChange={() => toggleTool(tool.toolName)} />
                            <span className="min-w-0 flex-1 truncate">{tool.title || toolDisplayName(tool.toolName, catalogByToolName)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{t("stableTools.copy20")}</h3>
          <div className="grid gap-2">
            {OUTCOMES.map((outcome) => (
              <Button
                key={outcome.value}
                variant={form.policyType === outcome.value ? "secondary" : "outline"}
                size="sm"
                className="justify-start"
                onClick={() => setForm({ ...form, policyType: outcome.value })}
              >
                {outcome.label}
              </Button>
            ))}
          </div>
          {form.policyType === "rate_limit" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="limit-count">{t("stableTools.copy21")}</Label>
                <Input id="limit-count" inputMode="numeric" value={form.rateLimitLimit} onChange={(e) => setForm({ ...form, rateLimitLimit: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("stableTools.copy22")}</Label>
                <Select value={form.rateLimitWindowSeconds} onValueChange={(rateLimitWindowSeconds) => setForm({ ...form, rateLimitWindowSeconds })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3600">{t("stableTools.copy23")}</SelectItem>
                    <SelectItem value="86400">{t("stableTools.copy24")}</SelectItem>
                    <SelectItem value="60">{t("stableTools.copy25")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <details className="rounded-md border border-border p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
          <ChevronDown className="h-4 w-4" />{t("pages.apps.tabs.advanced")}</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">{t("stableTools.copy26")}</Label>
            <Input id="rule-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={sentenceText(sentence)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rule-priority">{t("localizationFilters.sortPriority")}</Label>
            <Input id="rule-priority" inputMode="numeric" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("stableTools.copy27")}</Label>
            <Select value={form.connectionId} onValueChange={(connectionId) => setForm({ ...form, connectionId })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>{t("stableTools.copy28")}</SelectItem>
                {[...maps.connection.entries()].map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 lg:col-span-2">
            <div>
              <p className="text-sm font-medium text-foreground">{t("pages.instanceSettings.on")}</p>
              <p className="text-xs text-muted-foreground">{t("stableTools.copy29")}</p>
            </div>
            <ToggleSwitch checked={form.enabled} onCheckedChange={(enabled) => setForm({ ...form, enabled })} />
          </div>
        </div>
      </details>
    </div>
  );
}

function StarterCards({ onStart }: { onStart: (form: PolicyFormState) => void }) {
  useTranslation();
  const starters = [
    {
      title: t("stableTools.copy30"),
      form: emptyPolicyForm({ policyType: "block", usesMode: "capability", riskLevel: "destructive", name: "Block destructive actions everywhere" }),
    },
    {
      title: t("stableTools.copy31"),
      form: emptyPolicyForm({ policyType: "require_approval", usesMode: "actions", name: "Ask first before selected actions" }),
    },
    {
      title: t("stableTools.copy32"),
      form: emptyPolicyForm({ policyType: "rate_limit", usesMode: "actions", rateLimitLimit: "50", name: "Limit a noisy action" }),
    },
    { title: t("localizationTools.startFromScratch98"), form: emptyPolicyForm() },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {starters.map((starter) => (
        <button
          key={starter.title}
          type="button"
          className="rounded-md border border-border p-4 text-left text-sm hover:bg-muted/50"
          onClick={() => onStart(starter.form)}
        >
          <span className="font-medium text-foreground">{starter.title}</span>
        </button>
      ))}
    </div>
  );
}

export function PoliciesTab({ companyId }: { companyId: string }) {
  useTranslation();
  const qc = useQueryClient();
  const { pushToast } = useToast();
  const [form, setForm] = useState<PolicyFormState | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [draggingPolicyId, setDraggingPolicyId] = useState<string | null>(null);
  const draggingPolicyIdRef = useRef<string | null>(null);

  const policies = useQuery({
    queryKey: queryKeys.tools.policies(companyId),
    queryFn: () => toolsApi.listPolicies(companyId),
  });
  const agents = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });
  const projects = useQuery({
    queryKey: queryKeys.projects.list(companyId, { includeArchived: true }),
    queryFn: () => projectsApi.list(companyId, { includeArchived: true }),
  });
  const applications = useQuery({
    queryKey: queryKeys.tools.applications(companyId),
    queryFn: () => toolsApi.listApplications(companyId),
  });
  const connections = useQuery({
    queryKey: queryKeys.tools.connections(companyId),
    queryFn: () => toolsApi.listConnections(companyId),
  });
  const connectionList = connections.data?.connections ?? [];
  const catalogQueries = useQueries({
    queries: connectionList.map((connection) => ({
      queryKey: queryKeys.tools.catalog(connection.id),
      queryFn: () => toolsApi.listCatalog(connection.id),
      staleTime: 60_000,
    })),
  });
  const trustRules = useQuery({
    queryKey: queryKeys.tools.trustRules(companyId),
    queryFn: () => toolsApi.listTrustRules(companyId),
  });
  const audit = useQuery({
    queryKey: queryKeys.tools.audit(companyId, 250),
    queryFn: () => toolsApi.listAudit(companyId, 250),
  });

  const catalog = useMemo(() => catalogQueries.flatMap((query) => query.data?.catalog ?? []), [catalogQueries]);
  const maps = useMemo<LookupMaps>(() => ({
    agent: new Map((agents.data ?? []).map((item) => [item.id, item.name])),
    project: new Map((projects.data ?? []).map((item) => [item.id, item.name])),
    application: new Map((applications.data?.applications ?? []).map((item) => [item.id, humanizeConnectionDisplayName(item.name)])),
    connection: new Map(connectionList.map((item) => [item.id, humanizeConnectionDisplayName(item)])),
  }), [agents.data, applications.data, connectionList, projects.data]);
  const appGroups = useMemo(
    () => groupCatalogByApp(catalog, maps.application, maps.connection),
    [catalog, maps.application, maps.connection],
  );
  const catalogByToolName = useMemo(
    () => new Map(catalog.map((tool) => [tool.toolName, tool])),
    [catalog],
  );

  const hitsByPolicy = useMemo(() => {
    const counts = new Map<string, number>();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const row of audit.data ?? []) {
      const ts = new Date(row.createdAt).getTime();
      if (Number.isFinite(ts) && ts < cutoff) continue;
      const matched = row.details?.matchedPolicyIds;
      if (Array.isArray(matched)) {
        for (const id of matched) {
          if (typeof id === "string") counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [audit.data]);

  const policyList = policies.data?.policies ?? [];
  const invalidatePolicies = () => qc.invalidateQueries({ queryKey: queryKeys.tools.policies(companyId) });
  const invalidateTrustRules = () => qc.invalidateQueries({ queryKey: queryKeys.tools.trustRules(companyId) });

  const createPolicy = useMutation({
    mutationFn: (input: ReturnType<typeof buildPolicyPayload>) => toolsApi.createPolicy(companyId, input),
    onSuccess: () => {
      invalidatePolicies();
      setForm(null);
      pushToast({ title: t("stableTools.copy33"), tone: "success" });
    },
    onError: (err) => pushToast({ title: t("stableTools.copy34"), body: err instanceof ApiError ? err.message : String(err), tone: "error" }),
  });
  const updatePolicy = useMutation({
    mutationFn: (input: { policyId: string; body: Partial<ReturnType<typeof buildPolicyPayload>> }) =>
      toolsApi.updatePolicy(companyId, input.policyId, input.body),
    onSuccess: () => {
      invalidatePolicies();
      setForm(null);
      pushToast({ title: t("stableTools.copy35"), tone: "success" });
    },
    onError: (err) => pushToast({ title: t("stableTools.copy34"), body: err instanceof ApiError ? err.message : String(err), tone: "error" }),
  });
  const reorder = useMutation({
    mutationFn: (policyIds: string[]) => toolsApi.reorderPolicies(companyId, { policyIds }),
    onSuccess: () => {
      invalidatePolicies();
      pushToast({ title: t("stableTools.copy36"), tone: "success" });
    },
    onError: (err) => pushToast({ title: t("stableTools.copy37"), body: err instanceof ApiError ? err.message : String(err), tone: "error" }),
  });
  const duplicate = useMutation({
    mutationFn: (policy: ToolPolicy) => toolsApi.duplicatePolicy(companyId, policy.id),
    onSuccess: () => {
      invalidatePolicies();
      pushToast({ title: t("stableTools.copy38"), body: t("stableTools.copy39"), tone: "success" });
    },
    onError: (err) => pushToast({ title: t("stableTools.copy40"), body: err instanceof ApiError ? err.message : String(err), tone: "error" }),
  });
  const deletePolicy = useMutation({
    mutationFn: (policyId: string) => toolsApi.deletePolicy(companyId, policyId),
    onSuccess: () => {
      invalidatePolicies();
      setConfirm(null);
      pushToast({ title: t("stableTools.copy41"), tone: "success" });
    },
    onError: (err) => pushToast({ title: t("pages.approvalDetail.deleteFailed"), body: err instanceof ApiError ? err.message : String(err), tone: "error" }),
  });
  const revoke = useMutation({
    mutationFn: (policyId: string) => toolsApi.revokeTrustRule(companyId, policyId),
    onSuccess: () => {
      invalidateTrustRules();
      setConfirm(null);
      pushToast({ title: t("stableTools.copy42"), tone: "success" });
    },
    onError: (err) => pushToast({ title: t("stableTools.copy43"), body: err instanceof ApiError ? err.message : String(err), tone: "error" }),
  });

  function submitPolicy() {
    if (!form) return;
    try {
      const body = buildPolicyPayload(form);
      if (!body.name) body.name = sentenceText(formSentence(form, maps, catalogByToolName));
      if (form.id) updatePolicy.mutate({ policyId: form.id, body });
      else createPolicy.mutate(body);
    } catch (err) {
      pushToast({ title: t("stableTools.copy44"), body: err instanceof Error ? err.message : String(err), tone: "error" });
    }
  }

  function reorderTo(targetPolicyId: string) {
    const draggedPolicyId = draggingPolicyIdRef.current ?? draggingPolicyId;
    if (!draggedPolicyId || draggedPolicyId === targetPolicyId) return;
    const ids = policyList.map((policy) => policy.id);
    const from = ids.indexOf(draggedPolicyId);
    const to = ids.indexOf(targetPolicyId);
    if (from < 0 || to < 0) return;
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    reorder.mutate(ids);
    draggingPolicyIdRef.current = null;
    setDraggingPolicyId(null);
  }

  const saving = createPolicy.isPending || updatePolicy.isPending;
  const agentsList = agents.data ?? [];
  const projectsList = (projects.data ?? []).filter((project) => !project.archivedAt);
  const applicationList = applications.data?.applications ?? [];

  if (form) {
    return (
      <RuleBuilder
        form={form}
        setForm={setForm}
        maps={maps}
        agents={agentsList}
        projects={projectsList}
        applications={applicationList}
        appGroups={appGroups}
        catalogByToolName={catalogByToolName}
        saving={saving}
        onCancel={() => setForm(null)}
        onSave={submitPolicy}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ToolsPageHeader
        title={t("stableApps.tools.rules")}
        description={t("stableTools.copy45")}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setTestOpen(true)}>
              <FlaskConical className="mr-1 h-4 w-4" />{t("stableTools.copy6")}</Button>
            <Button size="sm" onClick={() => setForm(emptyPolicyForm())}>
              <Plus className="mr-1 h-4 w-4" />{t("stableTools.copy11")}</Button>
          </>
        }
      />

      <div className="space-y-2">
        {policies.isLoading ? (
          <LoadingState />
        ) : policies.error ? (
          <ErrorState error={policies.error} onRetry={() => policies.refetch()} />
        ) : policyList.length === 0 ? (
          <div className="space-y-3">
            <EmptyState
              icon={Shield}
              message={t("stableTools.noRules")}
              description={t("stableTools.copy46")}
              action={t("stableTools.copy11")}
              onAction={() => setForm(emptyPolicyForm())}
            />
            <StarterCards onStart={setForm} />
          </div>
        ) : (
          <Card>
            <CardContent className="px-0 py-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-8 px-2 py-2.5 font-medium" />
                    <th className="px-2 py-2.5 font-medium">{t("stableTools.copy47")}</th>
                    <th className="px-2 py-2.5 font-medium">{t("stableTools.copy48")}</th>
                    <th className="px-2 py-2.5 text-right font-medium">{t("localizationRoutines.last24Hours")}</th>
                    <th className="px-2 py-2.5 text-center font-medium">{t("pages.instanceSettings.on")}</th>
                    <th className="w-10 px-2 py-2.5 text-right font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {policyList.map((policy) => {
                    const sentence = policySentence(policy, maps, catalogByToolName);
                    const hits = hitsByPolicy.get(policy.id) ?? 0;
                    return (
                      <tr
                        key={policy.id}
                        className="align-middle hover:bg-muted/30"
                        draggable
                        onDragStart={() => {
                          draggingPolicyIdRef.current = policy.id;
                          setDraggingPolicyId(policy.id);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => reorderTo(policy.id)}
                      >
                        <td className="px-2 py-2 text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className="block min-w-0 text-left font-medium text-foreground"
                            onClick={() => setForm(policyToForm(policy))}
                          >
                            <RuleSentence sentence={sentence} />
                          </button>
                          {policy.description ? (
                            <div className="truncate text-xs text-muted-foreground">{policy.description}</div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2"><OutcomeChip type={policy.policyType} config={policy.config} /></td>
                        <td className="px-2 py-2 text-right text-xs text-muted-foreground">{t("stableTools.hits", { count: hits })}</td>
                        <td className="px-2 py-2 text-center">
                          <ToggleSwitch
                            checked={policy.enabled}
                            disabled={updatePolicy.isPending}
                            onCheckedChange={(enabled) => updatePolicy.mutate({ policyId: policy.id, body: { enabled } })}
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" aria-label={t("stableTools.copy49")}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setForm(policyToForm(policy))}>
                                <Pencil className="mr-2 h-4 w-4" />{t("common.edit")}</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => duplicate.mutate(policy)}>
                                <Copy className="mr-2 h-4 w-4" />{t("localizationTools.duplicate79")}</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => updatePolicy.mutate({ policyId: policy.id, body: { enabled: false } })}>
                                <RotateCcw className="mr-2 h-4 w-4" />{t("stableTools.copy50")}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setConfirm({ kind: "delete-rule", policy, hits })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />{t("pages.agentDetail.delete")}</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t("stableTools.copy51")}</h3>
        <p className="text-sm text-muted-foreground">{t("stableTools.copy52")}</p>
        {trustRules.isLoading ? (
          <LoadingState />
        ) : trustRules.error ? (
          <ErrorState error={trustRules.error} onRetry={() => trustRules.refetch()} />
        ) : (trustRules.data?.trustRules ?? []).length === 0 ? (
          <div className="rounded-md border border-border px-4 py-6 text-sm text-muted-foreground">{t("stableTools.copy53")}</div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {(trustRules.data?.trustRules ?? []).map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">
                    <RuleSentence sentence={policySentence(rule, maps, catalogByToolName)} />
                  </div>
                  <div className="text-xs text-muted-foreground">{t("stableTools.copy54")} <RelativeTime value={rule.updatedAt} />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!rule.enabled || revoke.isPending}
                  onClick={() => setConfirm({ kind: "forget-approval", policy: rule })}
                >{t("stableTools.copy55")}</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <PolicySimulator
        companyId={companyId}
        agents={agentsList}
        policies={policyList}
        maps={maps}
        catalogByToolName={catalogByToolName}
        open={testOpen}
        onOpenChange={setTestOpen}
        onEditPolicy={(policy) => {
          setTestOpen(false);
          setForm(policyToForm(policy));
        }}
      />

      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        {confirm ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.kind === "delete-rule" ? t("stableTools.copy56") : t("stableTools.copy57")}</DialogTitle>
              <DialogDescription>
                {confirm.kind === "delete-rule"
                  ? t("stableTools.deleteRule", { count: confirm.hits })
                  : t("stableTools.copy58")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirm(null)}>{t("pages.apps.common.cancel")}</Button>
              <Button
                variant="destructive"
                disabled={deletePolicy.isPending || revoke.isPending}
                onClick={() => {
                  if (confirm.kind === "delete-rule") deletePolicy.mutate(confirm.policy.id);
                  else revoke.mutate(confirm.policy.id);
                }}
              >
                {confirm.kind === "delete-rule" ? t("pages.agentDetail.delete") : t("stableTools.copy55")}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
