import { useTranslation, i18n } from "@/i18n";
import { recoveryPreviewStateDisplay, recoveryPreviewReasonDisplay, recoveryPreviewErrorDisplay } from "@/lib/recovery-preview-display";
import { Trans } from "react-i18next";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, FlaskConical, Lock, Play, Search } from "lucide-react";
import type {
  InstanceExperimentalSettings,
  InstanceExperimentalSettingsWithManaged,
  InstanceFeatureKey,
  IssueGraphLivenessAutoRecoveryPreview,
  ManagedSettingMetadata,
  PatchInstanceExperimentalSettings,
} from "@paperclipai/shared";
import { experimentalSettingKey } from "@paperclipai/shared";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useHiddenSettings } from "@/hooks/useHiddenSettings";
import { getWorktreeInstanceId, isWorktreeRuntime } from "../lib/worktree-branding";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function issueHref(identifier: string | null, issueId: string) {
  if (!identifier) return `/issues/${issueId}`;
  const prefix = identifier.split("-")[0] || "PAP";
  return `/${prefix}/issues/${identifier}`;
}

type WorktreeRunExecutionDisplayState =
  | { kind: "off" }
  | { kind: "armed"; activatedAt: string }
  | { kind: "fail_closed"; reason: "missing_cutoff" | "missing_instance_id" | "instance_mismatch" };

/**
 * Mirror of the server's `resolveWorktreeRunExecutionActivation` fail-closed
 * ladder (server/src/services/instance-settings.ts) so the card never claims a
 * copied/legacy row is arming execution. The derived fields are display-only —
 * the PATCH the toggle sends still writes just the boolean.
 */
function resolveWorktreeRunExecutionDisplayState(
  settings:
    | Pick<
        InstanceExperimentalSettings,
        | "enableWorktreeRunExecution"
        | "worktreeRunExecutionActivatedAt"
        | "worktreeRunExecutionActivationInstanceId"
      >
    | undefined,
  currentInstanceId: string | null,
): WorktreeRunExecutionDisplayState {
  if (settings?.enableWorktreeRunExecution !== true) return { kind: "off" };
  if (!settings.worktreeRunExecutionActivatedAt) return { kind: "fail_closed", reason: "missing_cutoff" };
  if (!currentInstanceId) return { kind: "fail_closed", reason: "missing_instance_id" };
  if (settings.worktreeRunExecutionActivationInstanceId !== currentInstanceId) {
    return { kind: "fail_closed", reason: "instance_mismatch" };
  }
  return { kind: "armed", activatedAt: settings.worktreeRunExecutionActivatedAt };
}

function formatActivationTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(i18n.resolvedLanguage, { dateStyle: "medium", timeStyle: "short" });
}

// PAP-11233: keep Conference Room code intact, but hide the user-facing opt-in for now.
const SHOW_CONFERENCE_ROOM_EXPERIMENTAL_SETTING = false;

function ManagedByCloudBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Lock aria-hidden="true" />{t("localizationExperimental.managedByCloud")}</Badge>
  );
}

function ExperimentalToggleCard({
  title,
  description,
  footnote,
  checked,
  onCheckedChange,
  disabled,
  settingKey,
  managed,
  ariaLabel,
}: {
  title: string;
  description: string;
  footnote?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  /** Flag key backing this card; operator-hidden keys render nothing. */
  settingKey: InstanceFeatureKey;
  managed?: ManagedSettingMetadata;
  ariaLabel: string;
}) {
  useTranslation();
  const { hidden: hiddenSettings } = useHiddenSettings();
  const isManaged = managed?.managed === true;
  if (hiddenSettings.has(experimentalSettingKey(settingKey))) return null;
  return (
    <Card className="block p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{title}</h2>
            {isManaged ? <ManagedByCloudBadge /> : null}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          {footnote ? <p className="max-w-2xl text-xs text-muted-foreground">{footnote}</p> : null}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={(next) => {
            if (isManaged) return;
            onCheckedChange(next);
          }}
          disabled={disabled || isManaged}
          aria-label={ariaLabel}
        />
      </div>
    </Card>
  );
}

function RecoveryPreviewDialog({
  preview,
  open,
  onOpenChange,
  onEnableOnly,
  onEnableAndRun,
  isPending,
}: {
  preview: IssueGraphLivenessAutoRecoveryPreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnableOnly: () => void;
  onEnableAndRun: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const count = preview?.recoverableFindings ?? 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("stableRecovery.confirm")}</DialogTitle>
          <DialogDescription>
            {preview
              ? t("stableRecovery.matches", { tasks: t("stableRecovery.tasks", { count }), period: t("stableRecovery.period", { count: preview.lookbackHours }) })
              : t("stableRecovery.checking")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-(--sz-calc-36) space-y-3 overflow-y-auto pr-1">
          {preview && preview.items.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
              {t("stableRecovery.empty")}
            </div>
          ) : null}

          {preview?.items.map((item) => (
            <Card key={item.incidentKey} className="block px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={issueHref(item.identifier, item.issueId)}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  {item.identifier ?? item.issueId}
                </a>
                <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {recoveryPreviewStateDisplay(item.state)}
                </span>
              </div>
              <p className="mt-1 text-sm text-foreground">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{recoveryPreviewReasonDisplay(item.reason)}</p>
              <div className="mt-2 text-xs text-muted-foreground">
                {t("stableRecovery.target")}{" "}
                <a
                  href={issueHref(item.recoveryIdentifier, item.recoveryIssueId)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {item.recoveryIdentifier ?? item.recoveryIssueId}
                </a>
              </div>
            </Card>
          ))}
        </div>

        {preview && preview.skippedOutsideLookback > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("stableRecovery.skipped", { count: preview.skippedOutsideLookback })}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>{t("pages.cliAuth.cancel")}</Button>
          <Button variant="outline" onClick={onEnableOnly} disabled={isPending || !preview}>
            {t("stableRecovery.enableOnly")}
          </Button>
          <Button onClick={onEnableAndRun} disabled={isPending || !preview}>
            {count > 0 ? t("stableRecovery.enableCreate", { count }) : t("localizationRoutines.enable")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InstanceExperimentalSettings() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [lookbackHoursDraft, setLookbackHoursDraft] = useState("24");
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<IssueGraphLivenessAutoRecoveryPreview | null>(null);

  function closeRecoveryPreview() {
    setPreviewDialogOpen(false);
    setPendingPreview(null);
  }

  useEffect(() => {
    setBreadcrumbs([
      { label: t("localizationExperimental.settings"), href: "/company/settings" },
      { label: t("localizationExperimental.experimental") },
    ]);
  }, [setBreadcrumbs, t]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const toggleMutation = useMutation<
    InstanceExperimentalSettingsWithManaged,
    Error,
    PatchInstanceExperimentalSettings,
    { previousSettings?: InstanceExperimentalSettingsWithManaged }
  >({
    mutationFn: async (patch: PatchInstanceExperimentalSettings) =>
      instanceSettingsApi.updateExperimental(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.instance.experimentalSettings });
      const previousSettings = queryClient.getQueryData<InstanceExperimentalSettingsWithManaged>(
        queryKeys.instance.experimentalSettings,
      );
      if (previousSettings) {
        queryClient.setQueryData<InstanceExperimentalSettingsWithManaged>(
          queryKeys.instance.experimentalSettings,
          { ...previousSettings, ...patch },
        );
      }
      return { previousSettings };
    },
    onSuccess: async (updatedSettings) => {
      setActionError(null);
      queryClient.setQueryData(queryKeys.instance.experimentalSettings, updatedSettings);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings }),
        queryClient.invalidateQueries({ queryKey: ["built-in-agents"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.health }),
      ]);
    },
    onError: (error, _patch, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.instance.experimentalSettings, context.previousSettings);
      }
      setActionError(error instanceof Error ? error.message : t("localizationExperimental.updateFailed"));
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (lookbackHours: number) =>
      instanceSettingsApi.previewIssueGraphLivenessAutoRecovery({ lookbackHours }),
    onSuccess: (preview) => {
      setActionError(null);
      setPendingPreview(preview);
      setPreviewDialogOpen(true);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to preview recovery tasks.");
    },
  });

  const runRecoveryMutation = useMutation({
    mutationFn: async (lookbackHours: number) =>
      instanceSettingsApi.runIssueGraphLivenessAutoRecovery({ lookbackHours }),
    onSuccess: async () => {
      setActionError(null);
      closeRecoveryPreview();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.health }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Failed to create recovery tasks.");
    },
  });

  useEffect(() => {
    const next = experimentalQuery.data?.issueGraphLivenessAutoRecoveryLookbackHours;
    if (typeof next === "number") {
      setLookbackHoursDraft(String(next));
    }
  }, [experimentalQuery.data?.issueGraphLivenessAutoRecoveryLookbackHours]);

  const autoRecoveryManaged =
    experimentalQuery.data?.managedKeys?.enableIssueGraphLivenessAutoRecovery?.managed === true;

  // If refreshed settings mark auto-recovery as managed while the preview
  // dialog is open, close it so its confirmation actions cannot emit a PATCH.
  useEffect(() => {
    if (autoRecoveryManaged) {
      closeRecoveryPreview();
    }
  }, [autoRecoveryManaged]);

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("localizationExperimental.loading")}</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {experimentalQuery.error instanceof Error
          ? experimentalQuery.error.message
          : t("localizationExperimental.loadFailed")}
      </div>
    );
  }

  const inWorktree = isWorktreeRuntime();
  // Present only on cloud-managed instances: keys the managed overlay controls
  // render locked with the "Managed by Paperclip Cloud" badge. Self-hosted
  // responses carry no `managedKeys`, so every card stays editable.
  const managedKeys = experimentalQuery.data?.managedKeys ?? {};
  const enableWorktreeRunExecution = experimentalQuery.data?.enableWorktreeRunExecution === true;
  const worktreeRunExecutionManaged = managedKeys.enableWorktreeRunExecution?.managed === true;
  const worktreeRunExecutionState = resolveWorktreeRunExecutionDisplayState(
    experimentalQuery.data,
    getWorktreeInstanceId(),
  );
  const enableEnvironments = experimentalQuery.data?.enableEnvironments === true;
  const enableManagedSandboxOnly = experimentalQuery.data?.enableManagedSandboxOnly === true;
  const enableIsolatedWorkspaces = experimentalQuery.data?.enableIsolatedWorkspaces === true;
  const enableApps = experimentalQuery.data?.enableApps === true;
  // Streamlined left navigation is now the standard sidebar (PAP-12472); the
  // experimental opt-out was retired, so it no longer surfaces a toggle here.
  const enableConferenceRoomChat = experimentalQuery.data?.enableConferenceRoomChat === true;
  const enableClassicTaskInterface = experimentalQuery.data?.enableClassicTaskInterface === true;
  const enableIssuePlanDecompositions =
    experimentalQuery.data?.enableIssuePlanDecompositions === true;
  const enableExperimentalFileViewer =
    experimentalQuery.data?.enableExperimentalFileViewer === true;
  const enableTaskWatchdogs = experimentalQuery.data?.enableTaskWatchdogs === true;
  const enableExternalObjects = experimentalQuery.data?.enableExternalObjects === true;
  const enableBuiltInAgents = experimentalQuery.data?.enableBuiltInAgents === true;
  const enableBetaSkills = experimentalQuery.data?.enableBetaSkills === true;
  const enableSummaries = experimentalQuery.data?.enableSummaries === true;
  const enableStatusCards = experimentalQuery.data?.enableStatusCards === true;
  const summariesManaged = managedKeys.enableSummaries?.managed === true;
  const statusCardsManaged = managedKeys.enableStatusCards?.managed === true;
  const statusCardsBlockedByManagedSummaries = summariesManaged && !enableSummaries;
  const summariesRequiredByManagedStatusCards = statusCardsManaged && enableStatusCards;
  const enableDecisions = experimentalQuery.data?.enableDecisions === true;
  const enableGoalsSidebarLink = experimentalQuery.data?.enableGoalsSidebarLink === true;
  const enableCases = experimentalQuery.data?.enableCases === true;
  const enableServerInfoDebugView = experimentalQuery.data?.enableServerInfoDebugView === true;
  const enableSimplifiedEnglishInteractions =
    experimentalQuery.data?.enableSimplifiedEnglishInteractions === true;
  const enableSmokeLab = experimentalQuery.data?.enableSmokeLab === true;
  const autoRestartDevServerWhenIdle = experimentalQuery.data?.autoRestartDevServerWhenIdle === true;
  const enableIssueGraphLivenessAutoRecovery =
    experimentalQuery.data?.enableIssueGraphLivenessAutoRecovery === true;
  const lookbackHours =
    experimentalQuery.data?.issueGraphLivenessAutoRecoveryLookbackHours ?? 24;
  const parsedLookbackHours = Number.parseInt(lookbackHoursDraft, 10);
  const lookbackHoursIsValid =
    Number.isInteger(parsedLookbackHours) && parsedLookbackHours >= 1 && parsedLookbackHours <= 720;
  const recoveryActionPending =
    toggleMutation.isPending || previewMutation.isPending || runRecoveryMutation.isPending;

  function previewForEnable() {
    if (autoRecoveryManaged) return;
    if (!lookbackHoursIsValid) {
      setActionError("Lookback hours must be a whole number from 1 to 720.");
      return;
    }
    closeRecoveryPreview();
    previewMutation.mutate(parsedLookbackHours);
  }

  function enableOnly() {
    if (autoRecoveryManaged) return;
    if (!lookbackHoursIsValid) return;
    closeRecoveryPreview();
    toggleMutation.mutate({
      enableIssueGraphLivenessAutoRecovery: true,
      issueGraphLivenessAutoRecoveryLookbackHours: parsedLookbackHours,
    });
  }

  function enableAndRun() {
    if (autoRecoveryManaged) return;
    if (!lookbackHoursIsValid) return;
    closeRecoveryPreview();
    toggleMutation.mutate({
      enableIssueGraphLivenessAutoRecovery: true,
      issueGraphLivenessAutoRecoveryLookbackHours: parsedLookbackHours,
    }, {
      onSuccess: () => runRecoveryMutation.mutate(parsedLookbackHours),
    });
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("localizationExperimental.experimental")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("localizationExperimental.intro")}</p>
      </div>

      <div
        role="alert"
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{t("localizationExperimental.warningTitle")}</p>
            <p className="text-muted-foreground">{t("localizationExperimental.warning")}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {recoveryPreviewErrorDisplay(actionError)}
        </div>
      )}

      <ExperimentalToggleCard
        title={t("nav.apps")}
        description={t("stableRecovery.appsDescription")}
        checked={enableApps}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableApps: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableApps"
        managed={managedKeys.enableApps}
        ariaLabel={t("stableRecovery.appsToggle")}
      />

      <Card className="block p-5">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{t("stableRecovery.title")}</h2>
                {autoRecoveryManaged ? <ManagedByCloudBadge /> : null}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("stableRecovery.description")}
              </p>
            </div>
            <ToggleSwitch
              checked={enableIssueGraphLivenessAutoRecovery}
              onCheckedChange={() => {
                if (autoRecoveryManaged) return;
                if (enableIssueGraphLivenessAutoRecovery) {
                  toggleMutation.mutate({ enableIssueGraphLivenessAutoRecovery: false });
                  return;
                }
                previewForEnable();
              }}
              disabled={recoveryActionPending || autoRecoveryManaged}
              aria-label={t("stableRecovery.toggle")}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-(--gtc-35) sm:items-end">
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t("stableRecovery.hours")}
              </span>
              <Input
                type="number"
                min={1}
                max={720}
                step={1}
                value={lookbackHoursDraft}
                onChange={(event) => setLookbackHoursDraft(event.target.value)}
                aria-invalid={!lookbackHoursIsValid}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (!lookbackHoursIsValid) {
                    setActionError("Lookback hours must be a whole number from 1 to 720.");
                    return;
                  }
                  toggleMutation.mutate({
                    issueGraphLivenessAutoRecoveryLookbackHours: parsedLookbackHours,
                  });
                }}
                disabled={recoveryActionPending || parsedLookbackHours === lookbackHours}
              >
                {t("stableRecovery.saveHours")}
              </Button>
              <Button
                variant="outline"
                onClick={previewForEnable}
                disabled={recoveryActionPending}
              >
                <Search className="h-4 w-4" />{t("pages.pipelines.preview")}</Button>
              <Button
                onClick={() => {
                  if (!lookbackHoursIsValid) {
                    setActionError("Lookback hours must be a whole number from 1 to 720.");
                    return;
                  }
                  runRecoveryMutation.mutate(parsedLookbackHours);
                }}
                disabled={recoveryActionPending || !enableIssueGraphLivenessAutoRecovery}
              >
                <Play className="h-4 w-4" />{t("workspaces.routines.runNow")}</Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("stableRecovery.window", { period: t("stableRecovery.period", { count: lookbackHours }) })}
          </p>
        </div>
      </Card>

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.autoRestartDevServerWhenIdle.title")}
        description={t("localizationExperimental.features.autoRestartDevServerWhenIdle.description")}
        checked={autoRestartDevServerWhenIdle}
        onCheckedChange={(checked) => toggleMutation.mutate({ autoRestartDevServerWhenIdle: checked })}
        disabled={toggleMutation.isPending}
        settingKey="autoRestartDevServerWhenIdle"
        managed={managedKeys.autoRestartDevServerWhenIdle}
        ariaLabel={t("localizationExperimental.features.autoRestartDevServerWhenIdle.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableBetaSkills.title")}
        description={t("localizationExperimental.features.enableBetaSkills.description")}
        checked={enableBetaSkills}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableBetaSkills: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableBetaSkills"
        managed={managedKeys.enableBetaSkills}
        ariaLabel={t("localizationExperimental.features.enableBetaSkills.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableBuiltInAgents.title")}
        description={t("localizationExperimental.features.enableBuiltInAgents.description")}
        checked={enableBuiltInAgents}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableBuiltInAgents: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableBuiltInAgents"
        managed={managedKeys.enableBuiltInAgents}
        ariaLabel={t("localizationExperimental.features.enableBuiltInAgents.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableCases.title")}
        description={t("localizationExperimental.features.enableCases.description")}
        footnote={t("localizationExperimental.features.enableCases.footnote")}
        checked={enableCases}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableCases: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableCases"
        managed={managedKeys.enableCases}
        ariaLabel={t("localizationExperimental.features.enableCases.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableClassicTaskInterface.title")}
        description={t("localizationExperimental.features.enableClassicTaskInterface.description")}
        footnote={t("localizationExperimental.features.enableClassicTaskInterface.footnote")}
        checked={enableClassicTaskInterface}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableClassicTaskInterface: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableClassicTaskInterface"
        managed={managedKeys.enableClassicTaskInterface}
        ariaLabel={t("localizationExperimental.features.enableClassicTaskInterface.ariaLabel")}
      />

      {SHOW_CONFERENCE_ROOM_EXPERIMENTAL_SETTING ? (
        <ExperimentalToggleCard
          title={t("localizationExperimental.features.enableConferenceRoomChat.title")}
          description={t("localizationExperimental.features.enableConferenceRoomChat.description")}
          checked={enableConferenceRoomChat}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableConferenceRoomChat: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableConferenceRoomChat"
          managed={managedKeys.enableConferenceRoomChat}
          ariaLabel={t("localizationExperimental.features.enableConferenceRoomChat.ariaLabel")}
        />
      ) : null}

      <ExperimentalToggleCard
        title={t("nav.decisions")}
        description={t("localizationExperimental.features.enableDecisions.description")}
        checked={enableDecisions}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableDecisions: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableDecisions"
        managed={managedKeys.enableDecisions}
        ariaLabel={t("localizationExperimental.features.enableDecisions.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableEnvironments.title")}
        description={t("localizationExperimental.features.enableEnvironments.description")}
        checked={enableEnvironments}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableEnvironments: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableEnvironments"
        managed={managedKeys.enableEnvironments}
        ariaLabel={t("localizationExperimental.features.enableEnvironments.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableExternalObjects.title")}
        description={t("localizationExperimental.features.enableExternalObjects.description")}
        checked={enableExternalObjects}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableExternalObjects: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableExternalObjects"
        managed={managedKeys.enableExternalObjects}
        ariaLabel={t("localizationExperimental.features.enableExternalObjects.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableIsolatedWorkspaces.title")}
        description={t("localizationExperimental.features.enableIsolatedWorkspaces.description")}
        checked={enableIsolatedWorkspaces}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableIsolatedWorkspaces: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableIsolatedWorkspaces"
        managed={managedKeys.enableIsolatedWorkspaces}
        ariaLabel={t("localizationExperimental.features.enableIsolatedWorkspaces.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableExperimentalFileViewer.title")}
        description={t("localizationExperimental.features.enableExperimentalFileViewer.description")}
        checked={enableExperimentalFileViewer}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableExperimentalFileViewer: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableExperimentalFileViewer"
        managed={managedKeys.enableExperimentalFileViewer}
        ariaLabel={t("localizationExperimental.features.enableExperimentalFileViewer.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableGoalsSidebarLink.title")}
        description={t("localizationExperimental.features.enableGoalsSidebarLink.description")}
        checked={enableGoalsSidebarLink}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableGoalsSidebarLink: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableGoalsSidebarLink"
        managed={managedKeys.enableGoalsSidebarLink}
        ariaLabel={t("localizationExperimental.features.enableGoalsSidebarLink.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableManagedSandboxOnly.title")}
        description={t("localizationExperimental.features.enableManagedSandboxOnly.description")}
        checked={enableManagedSandboxOnly}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableManagedSandboxOnly: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableManagedSandboxOnly"
        managed={managedKeys.enableManagedSandboxOnly}
        ariaLabel={t("localizationExperimental.features.enableManagedSandboxOnly.ariaLabel")}
      />

      {inWorktree ? (
        <Card className="block p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{t("localizationExperimental.worktreeTitle")}</h2>
                  {worktreeRunExecutionManaged ? <ManagedByCloudBadge /> : null}
                </div>
                <p className="max-w-2xl text-sm text-muted-foreground">{t("localizationExperimental.worktreeDescription")}</p>
              </div>
              <ToggleSwitch
                checked={enableWorktreeRunExecution}
                onCheckedChange={(checked) => {
                  if (worktreeRunExecutionManaged) return;
                  toggleMutation.mutate({ enableWorktreeRunExecution: checked });
                }}
                disabled={toggleMutation.isPending || worktreeRunExecutionManaged}
                aria-label={t("localizationExperimental.worktreeToggle")}
              />
            </div>

            {worktreeRunExecutionState.kind === "armed" ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-foreground">
                <Play className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <Trans i18nKey="localizationExperimental.runningAfter" values={{ time: formatActivationTimestamp(worktreeRunExecutionState.activatedAt) }} components={{ time: <span className="font-medium" /> }} />
                </span>
              </div>
            ) : null}

            {worktreeRunExecutionState.kind === "fail_closed" ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">{t("localizationExperimental.executionSuppressed")}</p>
                  <p className="text-muted-foreground">
                    {t(worktreeRunExecutionState.reason === "instance_mismatch"
                      ? "localizationExperimental.instanceMismatch"
                      : "localizationExperimental.missingCutoff")}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableServerInfoDebugView.title")}
        description={t("localizationExperimental.features.enableServerInfoDebugView.description")}
        checked={enableServerInfoDebugView}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableServerInfoDebugView: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableServerInfoDebugView"
        managed={managedKeys.enableServerInfoDebugView}
        ariaLabel={t("localizationExperimental.features.enableServerInfoDebugView.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableSimplifiedEnglishInteractions.title")}
        description={t("localizationExperimental.features.enableSimplifiedEnglishInteractions.description")}
        checked={enableSimplifiedEnglishInteractions}
        onCheckedChange={(checked) =>
          toggleMutation.mutate({ enableSimplifiedEnglishInteractions: checked })
        }
        disabled={toggleMutation.isPending}
        settingKey="enableSimplifiedEnglishInteractions"
        managed={managedKeys.enableSimplifiedEnglishInteractions}
        ariaLabel={t("localizationExperimental.features.enableSimplifiedEnglishInteractions.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableSmokeLab.title")}
        description={t("localizationExperimental.features.enableSmokeLab.description")}
        checked={enableSmokeLab}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableSmokeLab: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableSmokeLab"
        managed={managedKeys.enableSmokeLab}
        ariaLabel={t("localizationExperimental.features.enableSmokeLab.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableStatusCards.title")}
        description={t("localizationExperimental.features.enableStatusCards.description")}
        footnote={t("localizationExperimental.features.enableStatusCards.footnote")}
        checked={enableStatusCards}
        onCheckedChange={(checked) =>
          toggleMutation.mutate(
            checked
              ? { enableSummaries: true, enableStatusCards: true }
              : { enableStatusCards: false },
          )
        }
        disabled={toggleMutation.isPending || statusCardsBlockedByManagedSummaries}
        settingKey="enableStatusCards"
        managed={managedKeys.enableStatusCards}
        ariaLabel={t("localizationExperimental.features.enableStatusCards.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("localizationExperimental.features.enableSummaries.title")}
        description={t("localizationExperimental.features.enableSummaries.description")}
        footnote={t("localizationExperimental.features.enableSummaries.footnote")}
        checked={enableSummaries}
        onCheckedChange={(checked) =>
          toggleMutation.mutate(
            checked || !enableStatusCards
              ? { enableSummaries: checked }
              : { enableSummaries: false, enableStatusCards: false },
          )
        }
        disabled={toggleMutation.isPending || summariesRequiredByManagedStatusCards}
        settingKey="enableSummaries"
        managed={managedKeys.enableSummaries}
        ariaLabel={t("localizationExperimental.features.enableSummaries.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("stableRecovery.decompositionPanel")}
        description={t("localizationExperimental.features.enableIssuePlanDecompositions.description")}
        checked={enableIssuePlanDecompositions}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableIssuePlanDecompositions: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableIssuePlanDecompositions"
        managed={managedKeys.enableIssuePlanDecompositions}
        ariaLabel={t("localizationExperimental.features.enableIssuePlanDecompositions.ariaLabel")}
      />

      <ExperimentalToggleCard
        title={t("stableRecovery.watchdogs")}
        description={t("stableRecovery.watchdogsDescription")}
        checked={enableTaskWatchdogs}
        onCheckedChange={(checked) => toggleMutation.mutate({ enableTaskWatchdogs: checked })}
        disabled={toggleMutation.isPending}
        settingKey="enableTaskWatchdogs"
        managed={managedKeys.enableTaskWatchdogs}
        ariaLabel={t("stableRecovery.watchdogsToggle")}
      />

      {previewDialogOpen && !autoRecoveryManaged ? (
        <RecoveryPreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeRecoveryPreview();
            }
          }}
          preview={pendingPreview}
          onEnableOnly={enableOnly}
          onEnableAndRun={enableAndRun}
          isPending={recoveryActionPending}
        />
      ) : null}
    </div>
  );
}
