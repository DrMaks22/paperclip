import { t, useTranslation } from "@/i18n";
import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  ToggleField,
  DraftInput,
  DraftNumberInput,
  help,
} from "../../components/agent-config-primitives";
import { ChoosePathButton } from "../../components/PathInstructionsModal";
import { LocalWorkspaceRuntimeFields } from "../local-workspace-runtime-fields";
import {
  CODEX_LOCAL_FAST_MODE_SUPPORTED_MODELS,
  isCodexLocalFastModeSupported,
  isCodexLocalManualModel,
} from "@paperclipai/adapter-codex-local";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";
const instructionsFileHint = () => t("localizationAgents.codexInstructionsHint");

export function CodexLocalConfigFields({
  mode,
  isCreate,
  adapterType,
  values,
  set,
  config,
  eff,
  mark,
  models,
  hideInstructionsFile,
  managedSandboxOnly,
}: AdapterConfigFieldsProps) {
  const { t } = useTranslation();
  const runnerManaged = adapterType === "paperclip_runner";
  // The execution engine picks which binary runs on the execution host, and the
  // ACP sub-fields below name host paths. The platform-managed environment owns
  // both, so the managed-sandbox-only policy hides them the same way
  // `runnerManaged` already does for the Paperclip Runner.
  const hideEngineChoice = runnerManaged || managedSandboxOnly === true;
  const rawEngine = runnerManaged ? "cli" : isCreate
    ? values!.codexEngine ?? "auto"
    : eff("adapterConfig", "engine", String(config.engine ?? "auto"));
  const engine = rawEngine === "acp" || rawEngine === "cli" ? rawEngine : "auto";
  const acpSelected = engine === "acp";
  const bypassEnabled =
    config.dangerouslyBypassApprovalsAndSandbox === true || config.dangerouslyBypassSandbox === true;
  const fastModeEnabled = isCreate
    ? Boolean(values!.fastMode)
    : eff("adapterConfig", "fastMode", Boolean(config.fastMode));
  const currentModel = isCreate
    ? String(values!.model ?? "")
    : eff("adapterConfig", "model", String(config.model ?? ""));
  const fastModeManualModel = isCodexLocalManualModel(currentModel);
  const fastModeSupported = isCodexLocalFastModeSupported(currentModel);
  const supportedModelsLabel = CODEX_LOCAL_FAST_MODE_SUPPORTED_MODELS.join(", ");
  const fastModeMessage = fastModeManualModel
    ? t("localizationAgents.fastModeManual")
    : fastModeSupported
      ? t("localizationAgents.fastModeCost")
      : t("localizationAgents.fastModeUnsupported", { models: supportedModelsLabel });

  return (
    <>
      {!hideEngineChoice && <Field label={t("localizationAgents.ui303_Execution_engine")} hint={t("localizationAgents.ui304_Auto_uses_ACP_when_prerequisites_pass_and_falls_back_to_Code")}>
        <select
          className={inputClass}
          value={engine}
          onChange={(e) => {
            const value = e.target.value === "acp" ? "acp" : e.target.value === "cli" ? "cli" : "auto";
            isCreate
              ? set!({ codexEngine: value })
              : mark("adapterConfig", "engine", value === "auto" ? undefined : value);
          }}
        >
          <option value="auto">{t("localizationAgents.ui305_Auto_ACP_preferred_")}</option>
          <option value="cli">Codex CLI</option>
          <option value="acp">ACP</option>
        </select>
      </Field>}
      {runnerManaged && (
        <Field label={t("pages.secrets.fields.provider")} hint={t("stableCore.runnerProviderHint")}>
          <select className={inputClass} value="codex" disabled>
            <option value="codex">Codex</option>
          </select>
        </Field>
      )}
      {acpSelected && (
        <>
          {!managedSandboxOnly && (
            <Field
              label={t("localizationAgents.ui350_ACP_server_command")}
              hint={t("localizationAgents.ui351_Optional_override_for_the_Codex_ACP_server_command_Defaults_")}
            >
              <DraftInput
                value={
                  isCreate
                    ? values!.codexAcpAgentCommand ?? ""
                    : eff("adapterConfig", "agentCommand", String(config.agentCommand ?? ""))
                }
                onCommit={(v) =>
                  isCreate
                    ? set!({ codexAcpAgentCommand: v })
                    : mark("adapterConfig", "agentCommand", v || undefined)
                }
                immediate
                className={inputClass}
                placeholder="codex-acp"
              />
            </Field>
          )}
          <Field label={t("localizationAgents.ui353_ACP_session_mode")} hint={t("localizationAgents.ui354_Persistent_keeps_ACP_session_state_between_runs_One_shot_sta")}>
            <select
              className={inputClass}
              value={
                isCreate
                  ? values!.codexAcpMode ?? "persistent"
                  : eff("adapterConfig", "mode", String(config.mode ?? "persistent"))
              }
              onChange={(e) => {
                const value = e.target.value === "oneshot" ? "oneshot" : "persistent";
                isCreate
                  ? set!({ codexAcpMode: value })
                  : mark("adapterConfig", "mode", value);
              }}
            >
              <option value="persistent">{t("localizationAgents.ui355_Persistent")}</option>
              <option value="oneshot">{t("localizationAgents.ui356_One_shot")}</option>
            </select>
          </Field>
          <Field
            label={t("localizationAgents.ui357_ACP_non_interactive_permissions")}
            hint={t("localizationAgents.ui358_Fallback_if_the_ACP_agent_asks_for_input_outside_an_interact")}
          >
            <select
              className={inputClass}
              value={
                isCreate
                  ? values!.codexAcpNonInteractivePermissions ?? "deny"
                  : eff("adapterConfig", "nonInteractivePermissions", String(config.nonInteractivePermissions ?? "deny"))
              }
              onChange={(e) => {
                const value = e.target.value === "fail" ? "fail" : "deny";
                isCreate
                  ? set!({ codexAcpNonInteractivePermissions: value })
                  : mark("adapterConfig", "nonInteractivePermissions", value);
              }}
            >
              <option value="deny">{t("localizationAgents.ui359_Deny")}</option>
              <option value="fail">{t("localizationAgents.ui360_Fail")}</option>
            </select>
          </Field>
          {!managedSandboxOnly && (
            <Field
              label={t("localizationAgents.ui361_ACP_state_directory")}
              hint={t("localizationAgents.ui362_Optional_ACP_session_state_directory_Defaults_to_Paperclip_m")}
            >
              <div className="flex items-center gap-2">
                <DraftInput
                  value={
                    isCreate
                      ? values!.codexAcpStateDir ?? ""
                      : eff("adapterConfig", "stateDir", String(config.stateDir ?? ""))
                  }
                  onCommit={(v) =>
                    isCreate
                      ? set!({ codexAcpStateDir: v })
                      : mark("adapterConfig", "stateDir", v || undefined)
                  }
                  immediate
                  className={inputClass}
                  placeholder="/path/to/acp-state"
                />
                <ChoosePathButton />
              </div>
            </Field>
          )}
          <Field
            label={t("localizationAgents.ui364_ACP_warm_process_idle_ms")}
            hint={t("localizationAgents.ui365_Defaults_to_0_which_closes_the_ACP_process_after_each_run_wh")}
          >
            {isCreate ? (
              <input
                type="number"
                className={inputClass}
                value={values!.codexAcpWarmHandleIdleMs ?? 0}
                onChange={(e) => set!({ codexAcpWarmHandleIdleMs: Number(e.target.value) })}
              />
            ) : (
              <DraftNumberInput
                value={eff(
                  "adapterConfig",
                  "warmHandleIdleMs",
                  Number(config.warmHandleIdleMs ?? 0),
                )}
                onCommit={(v) => mark("adapterConfig", "warmHandleIdleMs", v || 0)}
                immediate
                className={inputClass}
              />
            )}
          </Field>
        </>
      )}
      {!runnerManaged && !hideInstructionsFile && (
        <Field label={t("localizationAgents.ui270_Agent_instructions_file")} hint={instructionsFileHint()}>
          <div className="flex items-center gap-2">
            <DraftInput
              value={
                isCreate
                  ? values!.instructionsFilePath ?? ""
                  : eff(
                      "adapterConfig",
                      "instructionsFilePath",
                      String(config.instructionsFilePath ?? ""),
                    )
              }
              onCommit={(v) =>
                isCreate
                  ? set!({ instructionsFilePath: v })
                  : mark("adapterConfig", "instructionsFilePath", v || undefined)
              }
              immediate
              className={inputClass}
              placeholder="/absolute/path/to/AGENTS.md"
            />
            <ChoosePathButton />
          </div>
        </Field>
      )}
      {!runnerManaged && (
        <>
          <ToggleField
            label={t("localizationAgents.ui366_Bypass_sandbox")}
            hint={help.dangerouslyBypassSandbox}
            checked={
              isCreate
                ? values!.dangerouslyBypassSandbox
                : eff(
                    "adapterConfig",
                    "dangerouslyBypassApprovalsAndSandbox",
                    bypassEnabled,
                  )
            }
            onChange={(v) =>
              isCreate
                ? set!({ dangerouslyBypassSandbox: v })
                : mark("adapterConfig", "dangerouslyBypassApprovalsAndSandbox", v)
            }
          />
          <ToggleField
            label={t("localizationAgents.ui367_Enable_search")}
            hint={help.search}
            checked={
              isCreate
                ? values!.search
                : eff("adapterConfig", "search", !!config.search)
            }
            onChange={(v) =>
              isCreate
                ? set!({ search: v })
                : mark("adapterConfig", "search", v)
            }
          />
          <ToggleField
            label={t("localizationAgents.ui368_Fast_mode")}
            hint={help.fastMode}
            checked={fastModeEnabled}
            onChange={(v) =>
              isCreate
                ? set!({ fastMode: v })
                : mark("adapterConfig", "fastMode", v)
            }
          />
          {fastModeEnabled && (
            <div className="rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              {fastModeMessage}
            </div>
          )}
        </>
      )}
      <LocalWorkspaceRuntimeFields
        isCreate={isCreate}
        values={values}
        set={set}
        config={config}
        mark={mark}
        eff={eff}
        mode={mode}
        adapterType={adapterType}
        models={models}
      />
    </>
  );
}
