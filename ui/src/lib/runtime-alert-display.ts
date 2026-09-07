import { i18n, t } from "@/i18n";
import type { ToolRuntimeAlertRecommendation } from "@paperclipai/shared";

type DisplayField = "firstResponderAction" | "threshold" | "observed";
type AlertSource = Pick<ToolRuntimeAlertRecommendation, "name" | DisplayField>;

interface KnownAlertRule {
  key: string;
  firstResponderAction: string;
  threshold: string;
  observed: RegExp;
  fields: readonly string[];
}

// Exact producer vocabulary from stable server/services/tool-access.ts.
// The raw alert, matching keys, thresholds and runbook IDs never change.
// A known name alone is insufficient: changed/provider-authored text stays raw.
const RULES: Readonly<Record<string, KnownAlertRule>> = {
  mcp_runtime_stuck_starting_slot: {
    key: "stuckStarting",
    firstResponderAction: "Inspect the slot health/logs, stop the slot, restart it once, then disable the connection if the slot sticks again.",
    threshold: "Any starting slot older than 5 minutes.",
    observed: /^(\d+) stuck starting slot\(s\)\.$/,
    fields: ["count"],
  },
  mcp_runtime_stuck_running_slot: {
    key: "stuckRunning",
    firstResponderAction: "Inspect recent audit events and active tool calls; restart the slot only after confirming no healthy call is still in progress.",
    threshold: "Any running slot with no progress for 5 minutes.",
    observed: /^(\d+) stuck running slot\(s\)\.$/,
    fields: ["count"],
  },
  mcp_runtime_high_timeout_rate: {
    key: "timeouts",
    firstResponderAction: "Check upstream MCP health, Paperclip runtime capacity, and recent gateway audit failures before retrying workloads.",
    threshold: "Warning at >=3 timeouts and >=10% timeout rate in 1 hour; critical at >=10 timeouts or >=25%.",
    observed: /^(\d+) timeout\(s\), (\d+(?:\.\d+)?)% timeout rate\.$/,
    fields: ["count","rate"],
  },
  mcp_runtime_high_error_rate: {
    key: "failures",
    firstResponderAction: "Group audit failures by reasonCode, then fix credentials/config or disable the affected connection.",
    threshold: "Warning at >=5 failures and >=10% failure rate in 1 hour; critical at >=10 failures or >=25%.",
    observed: /^(\d+) failure\(s\), (\d+(?:\.\d+)?)% failure rate\.$/,
    fields: ["count","rate"],
  },
  mcp_runtime_capacity_deferrals_repeated: {
    key: "capacity",
    firstResponderAction: "Stop idle/stale slots, lower noisy workloads, or raise slot caps only after confirming host capacity.",
    threshold: "Warning at >=3 capacity deferrals in 1 hour; critical at >=10.",
    observed: /^(\d+) capacity deferral\(s\) in 1 hour\.$/,
    fields: ["count"],
  },
  mcp_runtime_restart_storm: {
    key: "restarts",
    firstResponderAction: "Stop the affected slot, inspect stderr/audit reason codes, and keep the connection disabled until the template/upstream is fixed.",
    threshold: "Warning at >=3 restarts in 1 hour; critical on any restart suppression.",
    observed: /^(\d+) restart attempt\(s\), (\d+) suppression\(s\)\.$/,
    fields: ["attempts","suppressed"],
  },
  mcp_runtime_connection_health_degraded: {
    key: "health",
    firstResponderAction: "Run a connection health check, refresh catalog after recovery, or keep the connection disabled and route agents to alternatives.",
    threshold: "Any active enabled connection with degraded/failed/missing-secret health, or any disabled enabled-path connection.",
    observed: /^(\d+) degraded connection\(s\), (\d+) disabled connection\(s\)\.$/,
    fields: ["degraded","disabled"],
  },
  mcp_runtime_missing_secret_failures: {
    key: "secrets",
    firstResponderAction: "Check secret bindings and provider health without printing secret values; rotate or rebind missing secrets.",
    threshold: "Warning on any missing-secret failure; critical at >=3 in 1 hour.",
    observed: /^(\d+) missing-secret failure\(s\) in 1 hour\.$/,
    fields: ["count"],
  },
  mcp_runtime_audit_write_failures: {
    key: "audit",
    firstResponderAction: "Treat as a control-plane incident: check database writes, activity log writes, and retry only after audit durability is restored.",
    threshold: "Any audit write failure.",
    observed: /^(\d+) audit write failure\(s\) in 1 hour\.$/,
    fields: ["count"],
  },
};

export function runtimeAlertFieldDisplay(alert: AlertSource, field: DisplayField): string {
  const raw = alert[field];
  if (!i18n.resolvedLanguage?.startsWith("ru")) return raw;
  const rule = Object.hasOwn(RULES, alert.name) ? RULES[alert.name] : undefined;
  if (!rule) return raw;
  if (field === "observed") {
    const match = rule.observed.exec(raw);
    if (!match) return raw;
    const values = Object.fromEntries(rule.fields.map((key, index) => [
      key, key === "rate" ? match[index + 1].replace(".", ",") : match[index + 1],
    ]));
    return t(`stableRuntimeAlerts.observed.${rule.key}`, values);
  }
  if (raw !== rule[field]) return raw;
  return t(`stableRuntimeAlerts.${field === "firstResponderAction" ? "action" : "threshold"}.${rule.key}`);
}

export function runtimeAlertSeverityDisplay(severity: string): string {
  if (!i18n.resolvedLanguage?.startsWith("ru")
    || !["info", "warning", "critical"].includes(severity)) return severity;
  return t(`stableRuntimeAlerts.severity.${severity}`);
}

/** The existing English plain-body presentation lowercases its interpolated
 * observation. Preserve that English behavior; unknown Russian text stays raw. */
export function runtimeAlertObservedBodyDisplay(alert: AlertSource): string {
  const display = runtimeAlertFieldDisplay(alert, "observed");
  return i18n.resolvedLanguage?.startsWith("ru") ? display : display.toLowerCase();
}
