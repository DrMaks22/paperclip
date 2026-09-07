import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import type { ToolRuntimeAlertRecommendation } from "@paperclipai/shared";
import { runtimeAlertFieldDisplay, runtimeAlertObservedBodyDisplay, runtimeAlertSeverityDisplay } from "./runtime-alert-display";

const fixtures = [
  {
    "key": "stuckStarting",
    "alert": {
      "name": "mcp_runtime_stuck_starting_slot",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Inspect the slot health/logs, stop the slot, restart it once, then disable the connection if the slot sticks again.",
      "threshold": "Any starting slot older than 5 minutes.",
      "observed": "{{count}} stuck starting slot(s).",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_stuck_starting_slot"
    }
  },
  {
    "key": "stuckRunning",
    "alert": {
      "name": "mcp_runtime_stuck_running_slot",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Inspect recent audit events and active tool calls; restart the slot only after confirming no healthy call is still in progress.",
      "threshold": "Any running slot with no progress for 5 minutes.",
      "observed": "{{count}} stuck running slot(s).",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_stuck_running_slot"
    }
  },
  {
    "key": "timeouts",
    "alert": {
      "name": "mcp_runtime_high_timeout_rate",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Check upstream MCP health, Paperclip runtime capacity, and recent gateway audit failures before retrying workloads.",
      "threshold": "Warning at >=3 timeouts and >=10% timeout rate in 1 hour; critical at >=10 timeouts or >=25%.",
      "observed": "{{count}} timeout(s), {{rate}}% timeout rate.",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_high_timeout_rate"
    }
  },
  {
    "key": "failures",
    "alert": {
      "name": "mcp_runtime_high_error_rate",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Group audit failures by reasonCode, then fix credentials/config or disable the affected connection.",
      "threshold": "Warning at >=5 failures and >=10% failure rate in 1 hour; critical at >=10 failures or >=25%.",
      "observed": "{{count}} failure(s), {{rate}}% failure rate.",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_high_error_rate"
    }
  },
  {
    "key": "capacity",
    "alert": {
      "name": "mcp_runtime_capacity_deferrals_repeated",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Stop idle/stale slots, lower noisy workloads, or raise slot caps only after confirming host capacity.",
      "threshold": "Warning at >=3 capacity deferrals in 1 hour; critical at >=10.",
      "observed": "{{count}} capacity deferral(s) in 1 hour.",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_capacity_deferrals_repeated"
    }
  },
  {
    "key": "restarts",
    "alert": {
      "name": "mcp_runtime_restart_storm",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Stop the affected slot, inspect stderr/audit reason codes, and keep the connection disabled until the template/upstream is fixed.",
      "threshold": "Warning at >=3 restarts in 1 hour; critical on any restart suppression.",
      "observed": "{{attempts}} restart attempt(s), {{suppressed}} suppression(s).",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_restart_storm"
    }
  },
  {
    "key": "health",
    "alert": {
      "name": "mcp_runtime_connection_health_degraded",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Run a connection health check, refresh catalog after recovery, or keep the connection disabled and route agents to alternatives.",
      "threshold": "Any active enabled connection with degraded/failed/missing-secret health, or any disabled enabled-path connection.",
      "observed": "{{degraded}} degraded connection(s), {{disabled}} disabled connection(s).",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_connection_health_degraded"
    }
  },
  {
    "key": "secrets",
    "alert": {
      "name": "mcp_runtime_missing_secret_failures",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Check secret bindings and provider health without printing secret values; rotate or rebind missing secrets.",
      "threshold": "Warning on any missing-secret failure; critical at >=3 in 1 hour.",
      "observed": "{{count}} missing-secret failure(s) in 1 hour.",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_missing_secret_failures"
    }
  },
  {
    "key": "audit",
    "alert": {
      "name": "mcp_runtime_audit_write_failures",
      "severity": "critical",
      "status": "firing",
      "firstResponderAction": "Treat as a control-plane incident: check database writes, activity log writes, and retry only after audit durability is restored.",
      "threshold": "Any audit write failure.",
      "observed": "{{count}} audit write failure(s) in 1 hour.",
      "description": "Raw provider description",
      "runbookSection": "docs/runbook#mcp_runtime_audit_write_failures"
    }
  }
] as const;
const fields = ["firstResponderAction", "threshold", "observed"] as const;
const counts = [1, 2, 5, 21, 22, 25, 101];
function fixtureAlert(value: typeof fixtures[number], count = 1): ToolRuntimeAlertRecommendation {
  return {
    ...value.alert,
    observed: value.alert.observed.replace(/\{\{(\w+)\}\}/g, (_, field: string) => field === "rate" ? "17.5" : String(count)),
  };
}

afterEach(async () => { await i18n.changeLanguage("en"); });
describe("finite stable runtime alert display", () => {
  for (const fixture of fixtures) {
    it.each(counts)(fixture.key + " preserves canonical data while projecting count %i through RU→EN→RU", async (count) => {
      const alert = Object.freeze(fixtureAlert(fixture, count));
      const raw = JSON.stringify(alert);
      for (const language of ["ru", "en", "ru"]) {
        await i18n.changeLanguage(language);
        for (const field of fields) {
          const display = runtimeAlertFieldDisplay(alert, field);
          if (language === "en") expect(display).toBe(alert[field]);
          else {
            expect(display).toMatch(/[А-Яа-яЁё]/);
            expect(display).not.toBe(alert[field]);
            if (field === "observed") {
              expect(display).toContain(String(count));
              if (alert.observed.includes("17.5%")) expect(display).toContain("17,5%");
            }
          }
        }
        expect(runtimeAlertObservedBodyDisplay(alert)).toBe(language === "en"
          ? alert.observed.toLowerCase() : runtimeAlertFieldDisplay(alert, "observed"));
        expect(JSON.stringify(alert)).toBe(raw);
      }
    });
    it(fixture.key + " rejects changed prose and wrong alert identity", async () => {
      await i18n.changeLanguage("ru");
      const alert = fixtureAlert(fixture);
      for (const field of fields) {
        const changed = { ...alert, [field]: alert[field] + " Provider addition KEEP_ID" };
        expect(runtimeAlertFieldDisplay(changed, field)).toBe(changed[field]);
        const unknown = { ...alert, name: "provider_custom_alert" };
        expect(runtimeAlertFieldDisplay(unknown, field)).toBe(unknown[field]);
      }
    });
  }
  it("keeps unknown observations and codes raw, including prototype-like names", async () => {
    await i18n.changeLanguage("ru");
    const alert = { ...fixtureAlert(fixtures[0]), name: "constructor", observed: "Keep CASE and raw ID_123" };
    expect(runtimeAlertFieldDisplay(alert, "observed")).toBe(alert.observed);
    expect(runtimeAlertObservedBodyDisplay(alert)).toBe(alert.observed);
    expect(runtimeAlertSeverityDisplay("Provider_LEVEL")).toBe("Provider_LEVEL");
  });
  it.each(["info", "warning", "critical"])("localizes only the known severity %s", async (severity) => {
    await i18n.changeLanguage("ru");
    expect(runtimeAlertSeverityDisplay(severity)).toBe(i18n.t(`stableRuntimeAlerts.severity.${severity}`));
    expect(runtimeAlertSeverityDisplay(severity)).toMatch(/[А-Яа-яЁё]/);
    await i18n.changeLanguage("en");
    expect(runtimeAlertSeverityDisplay(severity)).toBe(severity);
  });
});
