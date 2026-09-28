import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { PAPERCLIP_RUNNER_PERMISSION_CAPABILITIES } from "@paperclipai/adapter-utils";
import { i18n } from "@/i18n";

import { CodexLocalConfigFields } from "./config-fields";

function renderRunner(config: Record<string, unknown>): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      <CodexLocalConfigFields
        mode="edit"
        isCreate={false}
        adapterType="paperclip_runner"
        values={null}
        set={null}
        config={config}
        eff={(_group, _field, original) => original}
        mark={() => undefined}
        models={[]}
        hideInstructionsFile
      />
    </TooltipProvider>,
  );
}

describe("Paperclip Runner Codex configuration", () => {
  it("keeps translated English permission metadata aligned with the qualified runner catalog", () => {
    const english = i18n.getFixedT("en");
    for (const [provider, capability] of Object.entries(PAPERCLIP_RUNNER_PERMISSION_CAPABILITIES)) {
      const descriptionKey = `localizationAgents.runnerDescription_${provider}`;
      expect(english(descriptionKey)).toBe(capability.description);
      expect(i18n.getResource("ru", "translation", descriptionKey)).toBeTypeOf("string");
      for (const option of capability.options) {
        const labelKey = `localizationAgents.runnerPermission_${option.value}`;
        expect(english(labelKey)).toBe(option.label);
        expect(i18n.getResource("ru", "translation", labelKey)).toBeTypeOf("string");
      }
    }
  });

  it("exposes all qualified provider choices", () => {
    const html = renderRunner({ provider: "codex" });

    expect(html).toContain('<option value="codex" selected="">Codex</option>');
    expect(html).toContain("OpenCode 1.18.32");
    expect(html).toContain("ACPX");
    expect(html).not.toContain("Permission mode");
    expect(html).not.toContain("Ask when requested");
    expect(html).not.toContain("Ask for untrusted operations");
    expect(html).toContain("Claude Managed");
    expect(html).toContain("AWS AgentCore");
    expect(html).not.toContain("Bypass sandbox");
  });

  it("renders OpenCode's bounded permission modes", () => {
    const html = renderRunner({
      provider: "opencode",
      opencodePermissionMode: "allow",
    });

    expect(html).toContain(
      '<option value="opencode" selected="">OpenCode 1.18.32</option>',
    );
    expect(html).toContain("Full auto (allow)");
    expect(html).toContain('aria-label="Permission mode"');
    expect(html).toContain("font-sans");
    expect(html).not.toContain("Ask for untrusted operations");
  });

  it("offers ACPX Claude without a redundant agent selector", () => {
    const html = renderRunner({
      provider: "acpx",
      acpxAgent: "claude",
      acpxPermissionMode: "approve-reads",
    });

    expect(html).toContain('<option value="acpx" selected="">ACPX Claude</option>');
    expect(html).not.toContain("ACP agent");
    expect(html).not.toContain("Codex via ACPX");
    expect(html).not.toContain("ACPX Codex");
    expect(html).not.toContain("Pi via ACPX");
    expect(html).toContain("Allow Paperclip reads");
  });

  it("falls back to the fail-closed Codex permission mode", () => {
    const html = renderRunner({ codexPermissionMode: "unrestricted" });

    expect(html).toContain("Unsupported saved mode — select a qualified mode");
    expect(html).toContain("cannot start or recover a Paperclip Runner run");
    expect(html).toContain("Select Automatic (isolated) to remediate it");
    expect(html).not.toContain("Full auto (never ask)");
  });

  it("shows a bounded idle timeout only for warm sessions", () => {
    const warmHtml = renderRunner({
      lifecycleMode: "warm",
      idleTimeoutMs: 45_000,
    });
    const turnHtml = renderRunner({
      lifecycleMode: "per_turn",
      idleTimeoutMs: 45_000,
    });

    expect(warmHtml).toContain("Warm idle timeout (ms)");
    expect(warmHtml).toContain('value="45000"');
    expect(warmHtml).toContain('max="86400000"');
    expect(turnHtml).not.toContain("Warm idle timeout (ms)");
  });
});
