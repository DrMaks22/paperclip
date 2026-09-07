import { t, useTranslation } from "@/i18n";
import { appDefinitionText } from "./app-definition-display";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  ClipboardPaste,
  Link2,
  Loader2,
  Lock,
  Search,
  TerminalSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  Agent,
  AppDefinition,
  ConnectToolAppResult,
  ToolApplication,
  ToolConnection,
  ToolAppConnectionActionSummary,
} from "@paperclipai/shared";
import { credentialConfigPath, getAppDefinitionForUrl, getAvailableConnectionMethod } from "@paperclipai/shared";
import { useNavigate, useParams, useSearchParams } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { ApiError } from "@/api/client";
import { toolsApi } from "@/api/tools";
import { agentsApi } from "@/api/agents";
import { appCopyFor, credentialFieldLabel } from "@/lib/app-gallery-copy";
import { advancedTabHref } from "@/pages/tools/tool-tabs";
import { AgentIcon } from "@/components/AgentIconPicker";
import { AgentMultiSelect } from "@/components/AgentMultiSelect";
import { InlineBanner } from "@/components/InlineBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import { navigateTopLevel } from "@/lib/browserNavigation";
import { AppLogo } from "./AppLogo";
import { appSourceConnectHref, isMcpDirectOAuthConnectSlug } from "./app-connect-policy";
import { parseGoogleSheetIds } from "./google-sheets";
import { autoExtendNotice, INSTALL_ALL_WARNING, installInfoNotice, installPayload } from "@/lib/tool-installs";

type Step = "gallery" | "key" | "actions" | "who" | "install" | "success";
export type OAuthConnectPhase = "entry" | "starting" | "redirecting" | "error";

const ROUTE_STAGE_BY_STEP: Partial<Record<Step, string>> = {
  key: "setup",
  actions: "actions",
  who: "access",
  install: "install",
  success: "complete",
};

function appConnectHref(appKey: string, step: Step): string {
  const stage = ROUTE_STAGE_BY_STEP[step] ?? "setup";
  const params = new URLSearchParams({ byo: "1", appKey, stage });
  return `/apps/connect?${params.toString()}`;
}
type AppAccessSelection = "all_agents" | { agentIds: string[] };
type InstallMode = "none" | "specific" | "all";
const LINK_CREDENTIAL_CONFIG_PATH = "credentials.authorization";

const stepLabels = () => ["pickApp", "addKey", "chooseActions", "chooseAccess", "installTools"].map((key) => t(`pages.apps.connect.steps.${key}`));
const STEP_INDEX: Record<Exclude<Step, "success">, number> = {
  gallery: 0,
  key: 1,
  actions: 2,
  who: 3,
  install: 4,
};
const ZAPIER_STEP_INDEX: Record<Exclude<Step, "gallery" | "success">, number> = {
  key: 0,
  actions: 1,
  who: 2,
  install: 3,
};
const zapierStepLabels = () => ["addMcpUrl", "chooseActions", "chooseAccess", "installTools"].map((key) => t(`pages.apps.connect.steps.${key}`));

function askFirstLevelsFrom(result: ConnectToolAppResult): string[] {
  const raw = (result.suggestedDefaults as { askFirstRiskLevels?: unknown })?.askFirstRiskLevels;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : ["write", "destructive"];
}

function isGoogleSheetsEntry(entry: AppDefinition | null): boolean {
  return entry?.slug === "google-sheets";
}

function appSourceSlug(application: ToolApplication): string | null {
  const metadata = application.metadata;
  if (!metadata) return null;
  const source = metadata.sourceTemplateKey ?? metadata.galleryKey;
  return typeof source === "string" ? source : null;
}

function connectionSourceSlug(connection: ToolConnection): string | null {
  const source = connection.config?.sourceTemplateKey ?? connection.transportConfig.sourceTemplateKey;
  return typeof source === "string" ? source : null;
}

function reusableOAuthConnection(
  sourceSlug: string | null,
  applications: ToolApplication[],
  connections: ToolConnection[],
  options: { applicationId?: string; draftOnly?: boolean } = {},
): ToolConnection | null {
  if (!sourceSlug) return null;
  const matchingApplicationIds = new Set(
    applications
      .filter((application) =>
        application.status !== "archived" &&
        appSourceSlug(application) === sourceSlug &&
        (!options.applicationId || application.id === options.applicationId)
      )
      .map((application) => application.id),
  );
  return connections.find((connection) => {
    const matchesApplication = options.applicationId
      ? connection.applicationId === options.applicationId
      : matchingApplicationIds.has(connection.applicationId) || connectionSourceSlug(connection) === sourceSlug;
    return connection.status !== "archived" &&
      (!options.draftOnly || connection.status === "draft") &&
      connection.authKind === "oauth" &&
      matchesApplication;
  }) ?? null;
}

export function AppsConnect() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routeParams = useParams<{ appKey?: string }>();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const [searchParams] = useSearchParams();
  const appKey = routeParams.appKey ?? searchParams.get("appKey") ?? undefined;
  const sourceSlug = searchParams.get("source")?.trim() || null;
  const createNewConnection = searchParams.get("new") === "1";
  const directOAuthSource = isMcpDirectOAuthConnectSlug(sourceSlug) ? sourceSlug : null;
  const requestedAppKey = appKey ?? directOAuthSource ?? undefined;
  const zapierSource = sourceSlug === "zapier";

  // Prefill arrives from the app page for reconnects; read once so later
  // wizard navigation doesn't fight the URL.
  const [prefill] = useState(() => {
    const rawLink = searchParams.get("link")?.trim() ?? "";
    return {
      link: /^https?:\/\//i.test(rawLink) ? rawLink : "",
      name: searchParams.get("name")?.trim() ?? "",
      applicationId: searchParams.get("applicationId")?.trim() || undefined,
    };
  });

  const [step, setStep] = useState<Step>(requestedAppKey || prefill.link || zapierSource ? "key" : "gallery");
  const [entry, setEntry] = useState<AppDefinition | null>(null);
  const [galleryName, setGalleryName] = useState("");
  const [linkUrl, setLinkUrl] = useState(prefill.link);
  const [linkName, setLinkName] = useState(prefill.name || (zapierSource ? "Zapier" : ""));
  const [linkNeedsKey, setLinkNeedsKey] = useState(false);
  const [linkKey, setLinkKey] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [googleSheetsLinks, setGoogleSheetsLinks] = useState("");
  const [googleSheetsError, setGoogleSheetsError] = useState<string | null>(null);
  const [connectResult, setConnectResult] = useState<ConnectToolAppResult | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [access, setAccess] = useState<"all" | "specific">("all");
  const [agentIds, setAgentIds] = useState<Set<string>>(new Set());
  const [installMode, setInstallMode] = useState<InstallMode>("none");
  const [installAgentIds, setInstallAgentIds] = useState<Set<string>>(new Set());
  const [oauthPhase, setOAuthPhase] = useState<OAuthConnectPhase>("entry");
  const [oauthError, setOAuthError] = useState<string | null>(null);
  const directOAuthStartedRef = useRef(false);
  const directOAuthRetryingRef = useRef(false);

  const openGallery = () => {
    setEntry(null);
    setGalleryName("");
    setLinkUrl("");
    setLinkName("");
    setLinkNeedsKey(false);
    setLinkKey("");
    setCredentials({});
    setGoogleSheetsLinks("");
    setGoogleSheetsError(null);
    setConnectResult(null);
    setInstallMode("none");
    setInstallAgentIds(new Set());
    setStep("gallery");
    navigate("/apps/connect?byo=1");
  };

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("nav.company"), href: "/dashboard" },
      { label: t("nav.apps"), href: "/apps" },
      { label: t("pages.apps.connections.connectApp") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, selectedCompany?.name, t]);

  const galleryQuery = useQuery({
    queryKey: queryKeys.apps.gallery(selectedCompanyId ?? "__none__"),
    queryFn: () => toolsApi.listGallery(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const applicationsQuery = useQuery({
    queryKey: queryKeys.tools.applications(selectedCompanyId ?? "__none__"),
    queryFn: () => toolsApi.listApplications(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!directOAuthSource,
    refetchOnMount: "always",
  });
  const connectionsQuery = useQuery({
    queryKey: queryKeys.tools.connections(selectedCompanyId ?? "__none__"),
    queryFn: () => toolsApi.listConnections(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!directOAuthSource,
    refetchOnMount: "always",
  });
  const existingOAuthConnection = useMemo(
    () => reusableOAuthConnection(
      directOAuthSource,
      applicationsQuery.data?.applications ?? [],
      connectionsQuery.data?.connections ?? [],
      createNewConnection
        ? { applicationId: prefill.applicationId, draftOnly: true }
        : {},
    ),
    [applicationsQuery.data, connectionsQuery.data, createNewConnection, directOAuthSource, prefill.applicationId],
  );

  const directOAuthEntry = entry &&
    getAvailableConnectionMethod(entry)?.auth === "oauth" &&
    isMcpDirectOAuthConnectSlug(entry.slug)
    ? entry
    : null;

  const setAppStep = (nextStep: Step) => {
    setStep(nextStep);
    if (entry) navigate(appConnectHref(entry.slug, nextStep));
  };

  const oauthStartMutation = useMutation({
    mutationFn: (connectionId: string) => toolsApi.startOAuth(connectionId),
    onSuccess: ({ authorizationUrl }) => {
      setOAuthPhase("redirecting");
      navigateTopLevel(authorizationUrl);
    },
    onError: (error) => {
      const details = error instanceof ApiError && error.body && typeof error.body === "object"
        ? (error.body as { details?: { code?: unknown } }).details
        : null;
      setOAuthPhase("error");
      setOAuthError(
        details?.code === "invalid_grant"
          ? t("pages.apps.connect.authorizationExpired")
          : error instanceof Error
            ? error.message
            : t("pages.apps.connect.secureSignInError"),
      );
    },
  });
  const startOAuth = oauthStartMutation.mutate;

  const connectMutation = useMutation({
    mutationFn: (entryOverride?: AppDefinition) => {
      const connectEntry = entryOverride ?? entry;
      if (connectEntry) {
        const sheetIds = isGoogleSheetsEntry(connectEntry) ? parseGoogleSheetIds(googleSheetsLinks).ids : [];
        const trimmedGalleryName = galleryName.trim();
        return toolsApi.connectApp(selectedCompanyId!, {
          galleryKey: connectEntry.slug,
          name: trimmedGalleryName || connectEntry.name,
          credentialValues: credentials,
          configValues: isGoogleSheetsEntry(connectEntry) ? { allowedSpreadsheetIds: sheetIds } : undefined,
          applicationId: prefill.applicationId,
        });
      }
      const trimmedKey = linkNeedsKey ? linkKey.trim() : "";
      const trimmedName = linkName.trim();
      return toolsApi.connectApp(selectedCompanyId!, {
        link: linkUrl,
        name: trimmedName || undefined,
        credentialValues: trimmedKey ? { [LINK_CREDENTIAL_CONFIG_PATH]: trimmedKey } : undefined,
        applicationId: prefill.applicationId,
      });
    },
    onSuccess: (result) => {
      if (result.auth?.kind === "oauth") {
        setConnectResult(result);
        const startUrl = result.auth.startUrl?.trim();
        if (!startUrl) {
          setOAuthPhase("starting");
          startOAuth(result.connectionId);
          return;
        }
        setOAuthPhase("redirecting");
        navigateTopLevel(startUrl);
        return;
      }
      setConnectResult(result);
      const defaults: Record<string, boolean> = {};
      for (const a of result.actions.readOnly) defaults[a.catalogEntryId] = true;
      for (const a of result.actions.canMakeChanges) defaults[a.catalogEntryId] = false;
      setEnabled(defaults);
      setInstallMode("none");
      setInstallAgentIds(new Set());
      setAppStep("actions");
    },
    onError: (error) => {
      const details = error instanceof ApiError && error.body && typeof error.body === "object"
        ? (error.body as { details?: { code?: unknown } }).details
        : null;
      if (isMcpDirectOAuthConnectSlug(requestedAppKey)) {
        setOAuthPhase("error");
        setOAuthError(
          details?.code === "invalid_grant"
            ? t("pages.apps.connect.authorizationExpired")
            : error instanceof Error
              ? error.message
              : t("pages.apps.connect.secureSignInError"),
        );
        return;
      }
      const oauthRequired = details?.code === "oauth_challenge";
      pushToast({
        title: oauthRequired ? t("pages.apps.connect.signInRequiredTitle") : t("pages.apps.connect.connectErrorTitle"),
        body: oauthRequired
          ? t("pages.apps.connect.signInComingSoonBody")
          : error instanceof Error
            ? error.message
            : t("pages.apps.connect.checkKeyError"),
        tone: "error",
      });
    },
  });
  const connectApp = connectMutation.mutate;

  useEffect(() => {
    if (!requestedAppKey || galleryQuery.isLoading || !galleryQuery.data) return;

    const requestedEntry = galleryQuery.data.apps.find((candidate) => candidate.slug === requestedAppKey);
    const method = requestedEntry ? getAvailableConnectionMethod(requestedEntry) : null;
    const directOAuth = method?.auth === "oauth" && isMcpDirectOAuthConnectSlug(requestedEntry?.slug);
    const unsupportedOAuth = method?.auth === "oauth" && !directOAuth;
    if (!requestedEntry || unsupportedOAuth || requestedEntry.availability?.available === false) {
      setEntry(null);
      setStep("gallery");
      navigate("/apps/connect", { replace: true });
      return;
    }

    if (entry?.slug !== requestedEntry.slug) {
      setEntry(requestedEntry);
      setGalleryName(requestedEntry.name);
      setLinkUrl("");
      setLinkName("");
      setLinkNeedsKey(false);
      setLinkKey("");
      setCredentials({});
      setGoogleSheetsLinks("");
      setGoogleSheetsError(null);
      setConnectResult(null);
    }
    setInstallMode("none");
    setInstallAgentIds(new Set());
    setStep("key");

    if (directOAuth && (
      !applicationsQuery.isFetchedAfterMount ||
      !connectionsQuery.isFetchedAfterMount
    )) return;
    if (directOAuth && directOAuthRetryingRef.current) return;
    if (directOAuth && (applicationsQuery.isError || connectionsQuery.isError)) {
      setOAuthPhase("error");
      setOAuthError(t("pages.apps.connect.existingConnectionError"));
      return;
    }

    if (directOAuth && !directOAuthStartedRef.current) {
      directOAuthStartedRef.current = true;
      setOAuthError(null);
      setOAuthPhase("starting");
      if (existingOAuthConnection) {
        startOAuth(existingOAuthConnection.id);
      } else {
        connectApp(requestedEntry);
      }
    }
  }, [
    applicationsQuery.isError,
    applicationsQuery.isFetchedAfterMount,
    connectApp,
    connectionsQuery.isError,
    connectionsQuery.isFetchedAfterMount,
    entry?.slug,
    existingOAuthConnection,
    galleryQuery.data,
    galleryQuery.isLoading,
    navigate,
    requestedAppKey,
    startOAuth,
  ]);

  const finishMutation = useMutation({
    mutationFn: async () => {
      const askFirstLevels = connectResult ? askFirstLevelsFrom(connectResult) : [];
      const changeActions = connectResult?.actions.canMakeChanges ?? [];
      const enabledIds = Object.entries(enabled)
        .filter(([, on]) => on)
        .map(([id]) => id);
      const askFirstIds = changeActions
        .filter((a) => enabled[a.catalogEntryId] && askFirstLevels.includes(a.riskLevel))
        .map((a) => a.catalogEntryId);
      const selection: AppAccessSelection =
        access === "all" ? "all_agents" : { agentIds: Array.from(agentIds) };
      const result = await toolsApi.finishApp(selectedCompanyId!, connectResult!.connectionId, {
        enabledCatalogEntryIds: enabledIds,
        askFirstCatalogEntryIds: askFirstIds,
        access: selection,
      });
      const installState = installMode === "all"
        ? { onAll: true, agentIds: new Set<string>() }
        : { onAll: false, agentIds: installMode === "specific" ? installAgentIds : new Set<string>() };
      await toolsApi.putConnectionInstalls(
        connectResult!.connectionId,
        installPayload(selectedCompanyId!, installState),
      );
      return result;
    },
    onSuccess: () => setAppStep("success"),
    onError: (error) => {
      pushToast({
        title: t("pages.apps.connect.finishErrorTitle"),
        body: error instanceof Error ? error.message : t("pages.apps.common.tryAgain"),
        tone: "error",
      });
    },
  });

  if (!selectedCompanyId) {
    return <div className="p-6 text-sm text-muted-foreground">{t("pages.apps.connect.selectOrganization")}</div>;
  }

  if (directOAuthEntry && step === "key") {
    return (
      <OAuthConnectStateScreen
        entry={directOAuthEntry}
        phase={oauthPhase}
        error={oauthError}
        onRetry={async () => {
          setOAuthError(null);
          setOAuthPhase("starting");
          const connectionId = connectResult?.connectionId ?? existingOAuthConnection?.id;
          if (connectionId) {
            startOAuth(connectionId);
            return;
          }

          // The create request may have reached the server even when its
          // response did not reach the browser. Re-read both resources before
          // creating again so Retry resumes that durable draft instead of
          // duplicating it.
          directOAuthRetryingRef.current = true;
          try {
            const [applicationsResult, connectionsResult] = await Promise.all([
              applicationsQuery.refetch(),
              connectionsQuery.refetch(),
            ]);
            if (applicationsResult.isError || connectionsResult.isError) {
              setOAuthPhase("error");
              setOAuthError(t("pages.apps.connect.existingConnectionError"));
              return;
            }
            const refreshedConnection = reusableOAuthConnection(
              directOAuthSource,
              applicationsResult.data?.applications ?? [],
              connectionsResult.data?.connections ?? [],
              createNewConnection
                ? { applicationId: prefill.applicationId, draftOnly: true }
                : {},
            );
            if (refreshedConnection) {
              startOAuth(refreshedConnection.id);
            } else {
              connectMutation.mutate(directOAuthEntry);
            }
          } finally {
            directOAuthRetryingRef.current = false;
          }
        }}
        onCancel={() => navigate("/apps/browse")}
      />
    );
  }

  const appName =
    connectResult?.application.name ??
    entry?.name ??
    (linkName.trim() || defaultLinkName(linkUrl) || t("pages.apps.connect.thisApp"));
  const zapierEntry = zapierSource
    ? galleryQuery.data?.apps.find((app) => app.slug === "zapier") ?? null
    : null;
  const labels = zapierSource
    ? zapierStepLabels()
    : isGoogleSheetsEntry(entry)
      ? ["pickApp", "shareSheet", "chooseActions", "chooseAccess", "installTools"].map((key) => t(`pages.apps.connect.steps.${key}`))
      : stepLabels();
  const stepIndex = zapierSource && step !== "gallery" && step !== "success"
    ? ZAPIER_STEP_INDEX[step]
    : step === "success"
      ? labels.length
      : STEP_INDEX[step];

  return (
    <div className="max-w-5xl">
      {step !== "success" && (
        <StepHeader
          subtitle={
            step === "gallery"
              ? t("pages.apps.connect.pickAppSubtitle")
              : t("pages.apps.connect.stepProgress", { current: stepIndex + 1, total: labels.length })
          }
          step={step}
          activeIndex={stepIndex}
          labels={labels}
          appIdentity={
            zapierSource
              ? { name: "Zapier", logoUrl: zapierEntry?.branding.logoUrl ?? null }
              : undefined
          }
          onCancel={() => navigate("/apps")}
        />
      )}

      {step === "gallery" && (
        <GalleryStep
          loading={galleryQuery.isLoading}
          apps={galleryQuery.data?.apps ?? []}
          byo={searchParams.get("byo") === "1"}
          source={searchParams.get("source")}
          onPick={(picked) => {
            if (
              getAvailableConnectionMethod(picked)?.auth === "oauth" &&
              isMcpDirectOAuthConnectSlug(picked.slug)
            ) {
              navigate(appSourceConnectHref(picked.slug));
              return;
            }
            setEntry(picked);
            setGalleryName(picked.name);
            setLinkUrl("");
            setLinkName("");
            setLinkNeedsKey(false);
            setLinkKey("");
            setCredentials({});
            setGoogleSheetsLinks("");
            setGoogleSheetsError(null);
            setConnectResult(null);
            setInstallMode("none");
            setInstallAgentIds(new Set());
            setStep("key");
            navigate(appConnectHref(picked.slug, "key"));
          }}
          onUseLink={(url) => {
            const matchedEntry = getAppDefinitionForUrl(url, galleryQuery.data?.apps ?? []);
            setEntry(null);
            setGalleryName("");
            setLinkUrl(url);
            setLinkName(matchedEntry?.name ?? defaultLinkName(url) ?? "");
            setLinkNeedsKey(false);
            setLinkKey("");
            setCredentials({});
            setGoogleSheetsLinks("");
            setGoogleSheetsError(null);
            setInstallMode("none");
            setInstallAgentIds(new Set());
            setStep("key");
          }}
          onRunYourOwn={() => navigate(advancedTabHref("run-your-own"))}
          onPasteConfig={() => navigate(advancedTabHref("paste-config"))}
        />
      )}

      {step === "key" && entry && (
        <KeyStep
          entry={entry}
          name={galleryName}
          onNameChange={setGalleryName}
          values={credentials}
          onChange={setCredentials}
          googleSheetsLinks={googleSheetsLinks}
          googleSheetsError={googleSheetsError}
          onGoogleSheetsLinksChange={(next) => {
            setGoogleSheetsLinks(next);
            setGoogleSheetsError(null);
          }}
          submitting={connectMutation.isPending}
          onBack={openGallery}
          onConnect={() => {
            if (isGoogleSheetsEntry(entry)) {
              const parsed = parseGoogleSheetIds(googleSheetsLinks);
              if (parsed.invalidCount > 0) {
                setGoogleSheetsError(t("pages.apps.connect.googleSheets.invalidLink"));
                return;
              }
              if (parsed.ids.length === 0) {
                setGoogleSheetsError(t("pages.apps.connect.googleSheets.atLeastOneLink"));
                return;
              }
            }
            connectMutation.mutate(undefined);
          }}
        />
      )}

      {step === "key" && !entry && linkUrl && !zapierSource && (
        <LinkConnectStep
          link={linkUrl}
          name={linkName}
          onNameChange={setLinkName}
          needsKey={linkNeedsKey}
          onNeedsKeyChange={(next) => {
            setLinkNeedsKey(next);
            if (!next) setLinkKey("");
          }}
          keyValue={linkKey}
          onKeyChange={setLinkKey}
          submitting={connectMutation.isPending}
          onBack={() => setStep("gallery")}
          onConnect={() => connectMutation.mutate(undefined)}
        />
      )}

      {step === "key" && !entry && zapierSource && (
        <ZapierConnectStep
          link={linkUrl}
          onLinkChange={setLinkUrl}
          submitting={connectMutation.isPending}
          onBack={() => navigate("/apps")}
          onConnect={() => connectMutation.mutate(undefined)}
        />
      )}

      {step === "actions" && connectResult && (
        <ActionsStep
          appName={appName}
          result={connectResult}
          enabled={enabled}
          onToggle={(id, on) => setEnabled((prev) => ({ ...prev, [id]: on }))}
          onBulk={(ids, on) =>
            setEnabled((prev) => {
              const next = { ...prev };
              for (const id of ids) next[id] = on;
              return next;
            })
          }
          onBack={() => setAppStep("key")}
          onContinue={() => setAppStep("who")}
        />
      )}

      {step === "who" && connectResult && (
        <WhoStep
          appName={appName}
          companyId={selectedCompanyId}
          access={access}
          setAccess={setAccess}
          agentIds={agentIds}
          setAgentIds={setAgentIds}
          onBack={() => setAppStep("actions")}
          onContinue={() => setAppStep("install")}
        />
      )}

      {step === "install" && connectResult && (
        <InstallStep
          appName={appName}
          companyId={selectedCompanyId}
          access={access}
          accessAgentIds={agentIds}
          installMode={installMode}
          setInstallMode={setInstallMode}
          installAgentIds={installAgentIds}
          setInstallAgentIds={setInstallAgentIds}
          submitting={finishMutation.isPending}
          onBack={() => setAppStep("who")}
          onFinish={() => finishMutation.mutate()}
        />
      )}

      {step === "success" && (
        <SuccessStep
          appName={appName}
          logoUrl={entry?.branding.logoUrl}
          enabledCount={Object.values(enabled).filter(Boolean).length}
          access={access}
          installMode={installMode}
          installCount={installAgentIds.size}
          onDone={() => navigate("/apps/connections")}
        />
      )}
    </div>
  );
}

function StepHeader({
  subtitle,
  step,
  activeIndex,
  labels,
  appIdentity,
  onCancel,
}: {
  subtitle: string;
  step: Step;
  activeIndex: number;
  labels: string[];
  appIdentity?: { name: string; logoUrl: string | null };
  onCancel: () => void;
}) {
  useTranslation();
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {appIdentity ? (
            <AppLogo name={appIdentity.name} logoUrl={appIdentity.logoUrl} size={44} />
          ) : null}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {appIdentity ? t("pages.apps.connect.connectNamedApp", { app: appIdentity.name }) : t("pages.apps.connections.connectApp")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>{t("pages.apps.common.cancel")}</Button>
      </div>
      {step !== "gallery" && (
        <div className="mt-4">
          <div className="flex gap-2">
            {labels.map((label, i) => (
              <div
                key={label}
                className={cn("h-1 w-20 rounded-full", i <= activeIndex ? "bg-foreground" : "bg-border")}
              />
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{labels.join("   ·   ")}</div>
        </div>
      )}
    </div>
  );
}

export function OAuthConnectStateScreen({
  entry,
  phase,
  error,
  onRetry,
  onCancel,
}: {
  entry: AppDefinition;
  phase: OAuthConnectPhase;
  error?: string | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  useTranslation();
  const status = phase === "entry"
    ? {
        title: t("pages.apps.connect.oauth.entryTitle", { app: entry.name }),
        body: t("pages.apps.connect.oauth.entryBody", { app: entry.name }),
      }
    : phase === "starting"
      ? {
          title: t("pages.apps.connect.oauth.startingTitle"),
          body: t("pages.apps.connect.oauth.startingBody", { app: entry.name }),
        }
      : phase === "redirecting"
        ? {
            title: t("pages.apps.connect.oauth.redirectingTitle", { app: entry.name }),
            body: t("pages.apps.connect.oauth.redirectingBody", { app: entry.name }),
          }
        : {
            title: t("pages.apps.connect.oauth.errorTitle", { app: entry.name }),
            body: error ?? t("pages.apps.connect.secureSignInError"),
          };

  return (
    <div className="max-w-5xl">
      <StepHeader
        subtitle={t("pages.apps.connect.oauth.subtitle")}
        step="key"
        activeIndex={0}
        labels={["connect", "reviewActions", "chooseAccess", "installTools"].map((key) => t(`pages.apps.connect.steps.${key}`))}
        appIdentity={{ name: entry.name, logoUrl: entry.branding.logoUrl }}
        onCancel={onCancel}
      />
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
            {phase === "error" ? (
              <Link2 className="h-5 w-5 text-destructive" />
            ) : phase === "entry" ? (
              <Lock className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">{status.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{status.body}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {phase === "error" ? (
            <Button type="button" onClick={onRetry}>{t("pages.apps.common.retry")}</Button>
          ) : (
            <Button type="button" disabled>
              {phase === "redirecting" ? t("pages.apps.connect.oauth.opening", { app: entry.name }) : t("pages.apps.connect.oauth.preparing")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onCancel}>{t("pages.apps.common.backToApps")}</Button>
        </div>
        <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />{t("pages.apps.connect.oauth.securityNote")}</p>
      </div>
    </div>
  );
}

function ZapierConnectStep({
  link,
  onLinkChange,
  submitting,
  onBack,
  onConnect,
}: {
  link: string;
  onLinkChange: (next: string) => void;
  submitting: boolean;
  onBack: () => void;
  onConnect: () => void;
}) {
  useTranslation();
  const normalizedLink = normalizeAppLink(link);
  const zapierHostname = normalizedLink ? new URL(normalizedLink).hostname : "";
  const isZapierLink = zapierHostname === "zapier.com" || zapierHostname.endsWith(".zapier.com");

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          <Link2 className="h-5 w-5 text-muted-foreground" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">{t("pages.apps.connect.zapier.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("pages.apps.connect.zapier.instructions")}</p>
        </div>
      </div>

      <div className="mt-8">
        <label className="text-sm font-medium text-foreground">{t("pages.apps.connect.zapier.urlLabel")}</label>
        <Input
          value={link}
          onChange={(event) => onLinkChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && isZapierLink && !submitting) onConnect();
          }}
          placeholder="https://mcp.zapier.com/api/v1/connect?token=…"
          className="mt-2 h-11"
          autoFocus
        />
        <p className="mt-2 text-xs text-muted-foreground">{t("pages.apps.connect.zapier.securityNote")}</p>
        {link.trim() && !isZapierLink && (
          <p className="mt-2 text-xs text-destructive">{t("pages.apps.connect.zapier.invalidUrl")}</p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>{t("pages.apps.common.back")}</Button>
        <Button onClick={onConnect} disabled={submitting || !isZapierLink}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? t("pages.apps.connect.checking") : t("pages.apps.connect.checkLink")}
        </Button>
      </div>
    </div>
  );
}

function GalleryStep({
  loading,
  apps,
  byo = false,
  source = null,
  onPick,
  onUseLink,
  onRunYourOwn,
  onPasteConfig,
}: {
  loading: boolean;
  apps: AppDefinition[];
  /** Entered via the "Connect your own MCP server" card (PAP-12371, Finding C): focus the link path. */
  byo?: boolean;
  source?: string | null;
  onPick: (entry: AppDefinition) => void;
  onUseLink: (link: string) => void;
  onRunYourOwn: () => void;
  onPasteConfig: () => void;
}) {
  useTranslation();
  const [search, setSearch] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkSectionRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Arriving from the BYO card: scroll the "Connect with a link" section into
  // view and focus its input so the paste-URL path is the obvious next step.
  useEffect(() => {
    if (!byo || loading) return;
    linkSectionRef.current?.scrollIntoView({ block: "center" });
    linkInputRef.current?.focus();
  }, [byo, loading]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => a.name.toLowerCase().includes(q));
  }, [apps, search]);
  const normalizedLink = normalizeAppLink(linkInput);
  const matchedEntry = normalizedLink ? getAppDefinitionForUrl(normalizedLink, apps) : null;
  const zapierSource = source === "zapier";

  const continueWithLink = () => {
    const next = normalizeAppLink(linkInput);
    if (!next) {
      setLinkError(t("pages.apps.connect.gallery.fullHttpLinkError"));
      return;
    }
    setLinkError(null);
    onUseLink(next);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("pages.apps.browse.searchPlaceholder")}
          className="h-11 pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((app) => {
          const copy = appCopyFor(app.slug, app.description);
          const oauth = getAvailableConnectionMethod(app)?.auth === "oauth";
          const oauthBlocked = oauth && !isMcpDirectOAuthConnectSlug(app.slug);
          const unavailable = app.availability?.available === false;
          return (
            <button
              key={app.slug}
              type="button"
              disabled={oauthBlocked || unavailable}
              title={
                unavailable
                  ? t("pages.apps.connect.gallery.notConfiguredTitle", { app: app.name })
                  : undefined
              }
              onClick={() => onPick(app)}
              className={cn(
                "flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors",
                oauthBlocked || unavailable ? "cursor-not-allowed opacity-60" : "hover:border-foreground/30 hover:bg-accent/40",
              )}
            >
              <AppLogo name={app.name} logoUrl={app.branding.logoUrl} size={36} />
              <div className="mt-3 text-sm font-bold text-foreground">{app.name}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{copy.tagline}</div>
              <div className="mt-3 text-xs font-semibold text-foreground">
                {unavailable ? (
                  <span className="text-muted-foreground">{t("pages.apps.connect.gallery.notAvailableBody")}</span>
                ) : oauthBlocked ? (
                  <span className="text-muted-foreground">{t("pages.apps.connect.gallery.signInComingSoon")}</span>
                ) : (
                  <span>{t("pages.apps.browse.connectAction")}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">{t("pages.apps.connect.gallery.noMatches", { query: search })}</div>
      )}

      <div
        ref={linkSectionRef}
        className={cn(
          "grid gap-4 border-t border-border pt-5 md:grid-cols-(--gtc-13)",
          byo && "-mx-3 rounded-xl border border-primary/40 bg-primary/[0.04] px-3 pb-4 md:mx-0",
        )}
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            {zapierSource ? t("pages.apps.connect.zapier.title") : byo ? t("pages.apps.connect.gallery.connectOwnServer") : t("pages.apps.connect.gallery.connectWithLink")}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {zapierSource
              ? t("pages.apps.connect.zapier.instructions")
              : byo
              ? t("pages.apps.connect.gallery.ownServerInstructions")
              : t("pages.apps.connect.gallery.linkInstructions")}
          </p>
          {!zapierSource && (
            <p className="mt-1 text-xs text-muted-foreground">{t("pages.apps.connect.gallery.remoteUrlPrefix")}{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">http://127.0.0.1:8848/mcp</code>.
            </p>
          )}
          {matchedEntry && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <AppLogo name={matchedEntry.name} logoUrl={matchedEntry.branding.logoUrl} size={24} />
                <span className="truncate">{t("pages.apps.connect.gallery.detectedApp", { app: matchedEntry.name })}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={matchedEntry.availability?.available === false}
                onClick={() => {
                  setLinkError(null);
                  if (matchedEntry.slug === "zapier") {
                    continueWithLink();
                    return;
                  }
                  onPick(matchedEntry);
                }}
              >
                {matchedEntry.availability?.available === false
                  ? t("pages.apps.connect.gallery.notAvailable")
                  : matchedEntry.slug === "zapier"
                    ? t("pages.apps.common.continue")
                    : t("pages.apps.connect.gallery.useApp", { app: matchedEntry.name })}
              </Button>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:min-w-(--sz-360px)">
          <div className="flex gap-2">
            <Input
              ref={linkInputRef}
              value={linkInput}
              onChange={(e) => {
                setLinkInput(e.target.value);
                setLinkError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") continueWithLink();
              }}
              placeholder={zapierSource ? "https://mcp.zapier.com/api/v1/connect?token=…" : "https://example.com/actions"}
              className="h-10"
            />
            <Button type="button" variant="outline" onClick={continueWithLink}>{t("pages.apps.common.continue")}</Button>
          </div>
          {linkError && <div className="text-xs text-destructive">{linkError}</div>}
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <div className="text-sm font-semibold text-foreground">{t("pages.apps.connect.gallery.moreWays")}</div>
        <p className="mt-1 text-xs text-muted-foreground">{t("pages.apps.connect.gallery.moreWaysBody")}</p>
        <div className="mt-3 flex flex-col gap-2">
          <ConnectMethodRow
            icon={TerminalSquare}
            title={t("pages.apps.connect.gallery.runYourOwn")}
            description={t("pages.apps.connect.gallery.runYourOwnBody")}
            onClick={onRunYourOwn}
          />
          <ConnectMethodRow
            icon={ClipboardPaste}
            title={t("pages.apps.connect.gallery.pasteConfig")}
            description={t("pages.apps.connect.gallery.pasteConfigBody")}
            onClick={onPasteConfig}
          />
        </div>
      </div>
    </div>
  );
}

function ConnectMethodRow({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/30 hover:bg-accent/40"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function normalizeAppLink(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function defaultLinkName(link: string): string | null {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function LinkConnectStep({
  link,
  name,
  onNameChange,
  needsKey,
  onNeedsKeyChange,
  keyValue,
  onKeyChange,
  submitting,
  onBack,
  onConnect,
}: {
  link: string;
  name: string;
  onNameChange: (next: string) => void;
  needsKey: boolean;
  onNeedsKeyChange: (next: boolean) => void;
  keyValue: string;
  onKeyChange: (next: string) => void;
  submitting: boolean;
  onBack: () => void;
  onConnect: () => void;
}) {
  useTranslation();
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
          <Link2 className="h-5 w-5 text-muted-foreground" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">{t("pages.apps.connect.gallery.connectWithLink")}</h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">{link}</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <label className="text-sm font-medium text-foreground">{t("pages.apps.connect.nameLabel")}</label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("pages.apps.connect.namePlaceholder")}
            className="mt-2 h-11"
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("pages.apps.connect.nameFromLinkHint")}</p>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">{t("pages.apps.connect.needsKeyLabel")}</label>
          <div className="mt-2 inline-flex rounded-lg border border-border bg-muted/50 p-1">
            <SegmentedOption
              label={t("pages.apps.common.no")}
              selected={!needsKey}
              onClick={() => onNeedsKeyChange(false)}
            />
            <SegmentedOption
              label={t("pages.apps.common.yes")}
              selected={needsKey}
              onClick={() => onNeedsKeyChange(true)}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {needsKey
              ? t("pages.apps.connect.pasteKeyHint")
              : t("pages.apps.connect.noKeyHint")}
          </p>
        </div>

        {needsKey && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">{t("pages.apps.connect.appKeyLabel")}</label>
              <Input
                type="password"
                autoComplete="off"
                value={keyValue}
                onChange={(e) => onKeyChange(e.target.value)}
                placeholder="••••••••••••••••"
                className="mt-2 h-11 font-mono"
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">{t("pages.apps.connect.keyStored")}</div>
                <div className="text-xs text-muted-foreground">{t("pages.apps.connect.keyReplaceHint")}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>{t("pages.apps.common.back")}</Button>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">{t("pages.apps.connect.checkLinkHint")}</span>
          <Button onClick={onConnect} disabled={submitting || (needsKey && keyValue.trim().length === 0)}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? t("pages.apps.connect.checking") : t("pages.apps.connect.checkLink")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SegmentedOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-w-(--sz-64px) rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
        selected
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ConnectionNameField({
  name,
  onNameChange,
}: {
  name: string;
  onNameChange: (next: string) => void;
}) {
  useTranslation();
  return (
    <div>
      <label className="text-sm font-medium text-foreground">{t("pages.apps.connect.nameLabel")}</label>
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("pages.apps.connect.namePlaceholder")}
        className="mt-2 h-11"
      />
      <p className="mt-2 text-xs text-muted-foreground">{t("pages.apps.connect.nameFromAppHint")}</p>
    </div>
  );
}

function KeyStep({
  entry,
  name,
  onNameChange,
  values,
  onChange,
  googleSheetsLinks,
  googleSheetsError,
  onGoogleSheetsLinksChange,
  submitting,
  onBack,
  onConnect,
}: {
  entry: AppDefinition;
  name: string;
  onNameChange: (next: string) => void;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  googleSheetsLinks: string;
  googleSheetsError: string | null;
  onGoogleSheetsLinksChange: (next: string) => void;
  submitting: boolean;
  onBack: () => void;
  onConnect: () => void;
}) {
  useTranslation();
  const copy = appCopyFor(entry.slug, entry.description);
  const method = getAvailableConnectionMethod(entry);
  const fields = (method?.credentialFields ?? []).map((field) => ({
    ...field,
    configPath: credentialConfigPath(field),
    helpUrl: method?.consoleLinks?.keys ?? method?.consoleLinks?.docs ?? "",
  }));
  const allFilled = fields.every(
    (f) => f.required === false || (values[f.configPath]?.trim().length ?? 0) > 0,
  );
  const robotEmail = entry.availability?.robotEmail ?? null;
  const unavailable = entry.availability?.available === false;

  if (isGoogleSheetsEntry(entry)) {
    const parsed = parseGoogleSheetIds(googleSheetsLinks);
    const canConnect = !unavailable && Boolean(robotEmail) && googleSheetsLinks.trim().length > 0;
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-3">
          <AppLogo name={entry.name} logoUrl={entry.branding.logoUrl} size={48} />
          <div>
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">{t("pages.apps.connect.connectNamedApp", { app: "Google Sheets" })}</h2>
            <p className="text-sm text-muted-foreground">{copy.short}</p>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <ConnectionNameField name={name} onNameChange={onNameChange} />

          {robotEmail ? (
            <div>
              <label className="text-sm font-medium text-foreground">{t("pages.apps.connect.googleSheets.shareEmail")}</label>
              <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
                <div
                  title={robotEmail}
                  className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-3 py-2.5 font-mono text-xs leading-tight text-foreground break-all"
                >
                  {robotEmail}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void copyTextToClipboard(robotEmail).catch(() => {})}
                >
                  <Copy className="mr-2 h-4 w-4" />{t("pages.apps.common.copy")}</Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("pages.apps.connect.googleSheets.shareInstructions")}</p>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">{t("pages.apps.connect.googleSheets.unavailable")}</div>
          )}

          <div>
            <label className="text-sm font-medium text-foreground">{t("pages.apps.connect.googleSheets.linksLabel")}</label>
            <Textarea
              value={googleSheetsLinks}
              onChange={(e) => onGoogleSheetsLinksChange(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="mt-2 min-h-28"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              {parsed.ids.length > 0
                ? t("pages.apps.connect.googleSheets.ready", { count: parsed.ids.length })
                : t("pages.apps.connect.googleSheets.linksHint")}
            </div>
            {googleSheetsError && <div className="mt-2 text-xs text-destructive">{googleSheetsError}</div>}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} disabled={submitting}>{t("pages.apps.common.back")}</Button>
          <Button onClick={onConnect} disabled={submitting || !canConnect}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? t("pages.apps.connect.checking") : t("pages.apps.connections.connect")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8">
      <div className="flex items-center gap-3">
        <AppLogo name={entry.name} logoUrl={entry.branding.logoUrl} size={48} />
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t("pages.apps.connect.connectNamedApp", { app: entry.name })}</h2>
          <p className="text-sm text-muted-foreground">{copy.short}</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <ConnectionNameField name={name} onNameChange={onNameChange} />

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pages.apps.connect.keyNotRequired")}</p>
        ) : (
          fields.map((field) => (
            <div key={field.configPath}>
              <label className="text-sm font-medium text-foreground">
                {credentialFieldLabel(entry.name, appDefinitionText(entry, field.label), fields.length)}
              </label>
              <Input
                type="password"
                autoComplete="off"
                value={values[field.configPath] ?? ""}
                onChange={(e) => onChange({ ...values, [field.configPath]: e.target.value })}
                placeholder="••••••••••••••••"
                className="mt-2 h-11 font-mono"
              />
              {field.helpUrl && (
                <a
                  href={field.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-2"
                >{t("pages.apps.connect.whereFindKey")}<ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>
          ))
        )}

        <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">{t("pages.apps.connect.keyStored")}</div>
            <div className="text-xs text-muted-foreground">{t("pages.apps.connect.keyReplaceHint")}</div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>{t("pages.apps.common.back")}</Button>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">{t("pages.apps.connect.checkKeyHint")}</span>
          <Button onClick={onConnect} disabled={submitting || !allFilled}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? t("pages.apps.connect.checking") : t("pages.apps.connections.connect")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionGroup({
  title,
  hint,
  actions,
  enabled,
  onToggle,
  bulkLabel,
  onBulk,
  askFirstLevels,
}: {
  title: string;
  hint: string;
  actions: ToolAppConnectionActionSummary[];
  enabled: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
  bulkLabel: string;
  onBulk: () => void;
  askFirstLevels: string[];
}) {
  useTranslation();
  if (actions.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="text-sm">
          <span className="font-bold text-foreground">{title}</span>
          <span className="ml-2 text-muted-foreground">· {hint}</span>
        </div>
        <button
          type="button"
          onClick={onBulk}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {bulkLabel}
        </button>
      </div>
      <div className="divide-y divide-border">
        {actions.map((action) => {
          const on = enabled[action.catalogEntryId] ?? false;
          const showAskFirst = on && askFirstLevels.includes(action.riskLevel);
          return (
            <div key={action.catalogEntryId} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {action.title ?? action.toolName}
                </div>
                {action.description && (
                  <div className="truncate text-xs text-muted-foreground">{action.description}</div>
                )}
              </div>
              {showAskFirst && (
                <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">{t("pages.apps.connect.actions.askFirst")}</span>
              )}
              <ToggleSwitch checked={on} onCheckedChange={(next) => onToggle(action.catalogEntryId, next)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionsStep({
  appName,
  result,
  enabled,
  onToggle,
  onBulk,
  onBack,
  onContinue,
}: {
  appName: string;
  result: ConnectToolAppResult;
  enabled: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
  onBulk: (ids: string[], on: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  useTranslation();
  const askFirstLevels = askFirstLevelsFrom(result);
  const { readOnly, canMakeChanges } = result.actions;
  const total = readOnly.length + canMakeChanges.length;
  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
        </span>
        <div>
          <div className="text-lg font-bold text-foreground">
            {t("pages.apps.connect.actions.connected", { app: appName, count: total })}
          </div>
          <div className="text-sm text-muted-foreground">{t("pages.apps.connect.actions.explanation")}</div>
        </div>
      </div>

      <ActionGroup
        title={t("pages.apps.connect.actions.readOnly")}
        hint={t("pages.apps.connect.actions.readOnlyHint")}
        actions={readOnly}
        enabled={enabled}
        onToggle={onToggle}
        bulkLabel={t("pages.apps.connect.actions.turnAllOff")}
        onBulk={() => onBulk(readOnly.map((a) => a.catalogEntryId), false)}
        askFirstLevels={askFirstLevels}
      />

      <ActionGroup
        title={t("pages.apps.connect.actions.canChange")}
        hint={t("pages.apps.connect.actions.canChangeHint")}
        actions={canMakeChanges}
        enabled={enabled}
        onToggle={onToggle}
        bulkLabel={t("pages.apps.connect.actions.turnAllOn")}
        onBulk={() => onBulk(canMakeChanges.map((a) => a.catalogEntryId), true)}
        askFirstLevels={askFirstLevels}
      />

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack}>{t("pages.apps.common.back")}</Button>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {t("pages.apps.connect.actions.futureActions", { app: appName })}
          </span>
          <Button onClick={onContinue} disabled={enabledCount === 0}>
            {t("pages.apps.connect.actions.continue", { count: enabledCount })}</Button>
        </div>
      </div>
    </div>
  );
}

function WhoStep({
  appName,
  companyId,
  access,
  setAccess,
  agentIds,
  setAgentIds,
  onBack,
  onContinue,
}: {
  appName: string;
  companyId: string;
  access: "all" | "specific";
  setAccess: (a: "all" | "specific") => void;
  agentIds: Set<string>;
  setAgentIds: (s: Set<string>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  useTranslation();
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: access === "specific",
  });
  const agents: Agent[] = (agentsQuery.data ?? []).filter((a) => a.status !== "terminated");
  const canFinish = access === "all" || agentIds.size > 0;

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="text-xl font-bold tracking-tight">{t("pages.apps.connect.access.title", { app: appName })}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("pages.apps.connect.access.changeLater")}</p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => setAccess("all")}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
              access === "all" ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30",
            )}
          >
            <Radio selected={access === "all"} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{t("pages.apps.connect.access.allAgents")}</span>
                <span className="rounded-full bg-foreground px-2 py-0.5 text-(length:--text-nano) font-bold text-background">{t("pages.apps.connect.access.recommended")}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("pages.apps.connect.access.allAgentsBody", { app: appName })}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAccess("specific")}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
              access === "specific" ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30",
            )}
          >
            <Radio selected={access === "specific"} />
            <div className="flex-1">
              <span className="font-semibold text-foreground">{t("pages.apps.connect.access.specificAgents")}</span>
              <p className="mt-1 text-xs text-muted-foreground">{t("pages.apps.connect.access.specificAgentsBody", { app: appName })}</p>
            </div>
          </button>

          {access === "specific" && (
            <AgentMultiSelect
              agents={agents}
              selectedAgentIds={agentIds}
              onChange={setAgentIds}
              loading={agentsQuery.isLoading}
              showSelectionPreview={false}
            />
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>{t("pages.apps.common.back")}</Button>
        <Button onClick={onContinue} disabled={!canFinish}>{t("pages.apps.connect.access.continueToInstall")}</Button>
      </div>
    </div>
  );
}

export function InstallStep({
  appName,
  companyId,
  access,
  accessAgentIds,
  installMode,
  setInstallMode,
  installAgentIds,
  setInstallAgentIds,
  submitting,
  onBack,
  onFinish,
}: {
  appName: string;
  companyId: string;
  access: "all" | "specific";
  accessAgentIds: Set<string>;
  installMode: InstallMode;
  setInstallMode: (mode: InstallMode) => void;
  installAgentIds: Set<string>;
  setInstallAgentIds: (ids: Set<string>) => void;
  submitting: boolean;
  onBack: () => void;
  onFinish: () => void;
}) {
  useTranslation();
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });
  const agents: Agent[] = (agentsQuery.data ?? []).filter((a) => a.status !== "terminated");
  const installSpecific = () => {
    setInstallMode("specific");
    if (installAgentIds.size === 0 && access === "specific") setInstallAgentIds(new Set(accessAgentIds));
  };
  const extendingAgentIds = access === "all"
    ? []
    : installMode === "all"
      ? agents.filter((agent) => !accessAgentIds.has(agent.id)).map((agent) => agent.id)
      : [...installAgentIds].filter((id) => !accessAgentIds.has(id));
  const canFinish = installMode !== "specific" || installAgentIds.size > 0;
  const extendingLabel = extendingAgentIds.length === 1
    ? agents.find((agent) => agent.id === extendingAgentIds[0])?.name ?? t("pages.apps.connect.install.agentCount", { count: 1 })
    : t("pages.apps.connect.install.agentCount", { count: extendingAgentIds.length });

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="text-xl font-bold tracking-tight">{t("pages.apps.connect.install.title", { app: appName })}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("pages.apps.connect.install.explanation")}</p>

        <div className="mt-5">
          <InlineBanner tone="info" compact>
            {installInfoNotice(appName)}
          </InlineBanner>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => setInstallMode("none")}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
              installMode === "none" ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30",
            )}
          >
            <Radio selected={installMode === "none"} />
            <div>
              <span className="font-semibold text-foreground">{t("pages.apps.connect.install.notYet")}</span>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("pages.apps.connect.install.notYetBody", { app: appName })}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={installSpecific}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
              installMode === "specific" ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30",
            )}
          >
            <Radio selected={installMode === "specific"} />
            <div className="flex-1">
              <span className="font-semibold text-foreground">{t("pages.apps.connect.install.specificAgents")}</span>
              <p className="mt-1 text-xs text-muted-foreground">{t("pages.apps.connect.install.specificAgentsBody", { app: appName })}</p>
            </div>
          </button>

          {installMode === "specific" ? (
            <div className="ml-7 border-l border-border pl-4">
              <AgentMultiSelect
                agents={agents}
                selectedAgentIds={installAgentIds}
                onChange={setInstallAgentIds}
                loading={agentsQuery.isLoading}
                showSelectionPreview={false}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setInstallMode("all")}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
              installMode === "all" ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30",
            )}
          >
            <Radio selected={installMode === "all"} />
            <div>
              <span className="font-semibold text-foreground">{t("pages.apps.connect.access.allAgents")}</span>
              <p className="mt-1 text-xs text-muted-foreground">{INSTALL_ALL_WARNING}</p>
            </div>
          </button>

          {extendingAgentIds.length > 0 ? (
            <InlineBanner tone="warning" compact>
              {autoExtendNotice(extendingLabel)}
            </InlineBanner>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>{t("pages.apps.common.back")}</Button>
        <Button onClick={onFinish} disabled={submitting || !canFinish}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? t("pages.apps.connect.install.finishing") : t("pages.apps.connect.install.finish")}
        </Button>
      </div>
    </div>
  );
}

function Radio({ selected }: { selected: boolean }) {
  useTranslation();
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
        selected ? "border-foreground" : "border-muted-foreground/40",
      )}
    >
      {selected && <span className="h-2 w-2 rounded-full bg-foreground" />}
    </span>
  );
}

function SuccessStep({
  appName,
  logoUrl,
  enabledCount,
  access,
  installMode,
  installCount,
  onDone,
}: {
  appName: string;
  logoUrl?: string | null;
  enabledCount: number;
  access: "all" | "specific";
  installMode: InstallMode;
  installCount: number;
  onDone: () => void;
}) {
  useTranslation();
  const installSummary = installMode === "all"
    ? t("pages.apps.connect.success.installedAll")
    : installMode === "specific"
      ? t("pages.apps.connect.success.installedCount", { count: installCount })
      : t("pages.apps.connect.success.permittedOnly");
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-500/10">
        <Check className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="mt-6 flex items-center justify-center gap-2">
        <AppLogo name={appName} logoUrl={logoUrl} size={28} />
        <h2 className="text-2xl font-bold tracking-tight">{t("pages.apps.connect.success.ready", { app: appName })}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {installMode === "none"
          ? t("pages.apps.connect.success.installLater")
          : t("pages.apps.connect.success.installedNextRun")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("pages.apps.connect.success.actionsOn", { count: enabledCount })} ·{" "}
        {access === "all" ? t("pages.apps.connect.success.allAgentsCanUse") : t("pages.apps.connect.success.specificAgentsCanUse")} · {installSummary}
      </p>
      <div className="mt-8">
        <Button size="lg" className="px-10" onClick={onDone}>{t("pages.apps.common.done")}</Button>
      </div>
    </div>
  );
}
