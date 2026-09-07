import { t, useTranslation } from "@/i18n";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ToolConnection } from "@paperclipai/shared";
import {
  connectionDisplaySecondaryHint,
  humanizeConnectionDisplayName,
  isToolConnectionAttentionHealth,
} from "@paperclipai/shared";
import { Navigate, useNavigate, useParams } from "@/lib/router";
import { useCompany } from "@/context/CompanyContext";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { timeAgo } from "@/lib/timeAgo";
import { toolsApi } from "@/api/tools";
import { agentsApi } from "@/api/agents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLogo } from "./AppLogo";
import {
  appApplicationSourceSlug,
  appDefinitionLogoUrl,
  appDefinitionName,
  appDefinitionSlug,
  type AppGalleryDisplayEntry,
} from "./app-definition-display";
import { isMcpDirectOAuthConnectSlug } from "./app-connect-policy";
import { connectionAddress, connectionTransportLabel, DangerZone } from "./AppDetail";
import { ActivityPanel } from "./app-detail/ActivityPanel";
import { ReviewPanel } from "./app-detail/ReviewPanel";
import { appApplicationTabHref, appTabHref, appTabLabel, isAppTabKey, type AppTabKey } from "./app-tabs";

export function AppNotConnected() {
  const { t } = useTranslation();
  const { applicationId = "", tab } = useParams<{ applicationId: string; tab?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const activeTab: AppTabKey | null = isAppTabKey(tab) ? tab : null;

  const applicationsQuery = useQuery({
    queryKey: queryKeys.tools.applications(selectedCompanyId ?? "__none__"),
    queryFn: () => toolsApi.listApplications(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!activeTab,
  });
  const connectionsQuery = useQuery({
    queryKey: queryKeys.tools.connections(selectedCompanyId ?? "__none__"),
    queryFn: () => toolsApi.listConnections(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!activeTab,
  });
  const galleryQuery = useQuery({
    queryKey: queryKeys.apps.gallery(selectedCompanyId ?? "__none__"),
    queryFn: () => toolsApi.listGallery(selectedCompanyId!),
    enabled: !!selectedCompanyId && !!activeTab,
  });

  const application = useMemo(
    () => (applicationsQuery.data?.applications ?? []).find((app) => app.id === applicationId),
    [applicationsQuery.data, applicationId],
  );
  const appSourceSlug = appApplicationSourceSlug(application);
  const relatedApplicationIds = useMemo(() => {
    if (!application) return new Set<string>();
    if (!appSourceSlug) return new Set([application.id]);
    return new Set(
      (applicationsQuery.data?.applications ?? [])
        .filter((candidate) => appApplicationSourceSlug(candidate) === appSourceSlug)
        .map((candidate) => candidate.id),
    );
  }, [application, applicationsQuery.data, appSourceSlug]);
  const appConnections = useMemo(
    () => (connectionsQuery.data?.connections ?? []).filter((c) => relatedApplicationIds.has(c.applicationId)),
    [connectionsQuery.data, relatedApplicationIds],
  );
  const activeConnections = useMemo(
    () => appConnections.filter((c) => c.status !== "archived" && c.status !== "draft"),
    [appConnections],
  );
  const activeConnection = activeConnections[0] ?? null;
  const previousConnection = useMemo(() => latestArchivedConnection(appConnections), [appConnections]);
  const activityQuery = useQuery({
    queryKey: queryKeys.tools.connectionActivity(previousConnection?.id ?? "__none__"),
    queryFn: () => toolsApi.listConnectionActivity(previousConnection!.id, 20),
    enabled: !!previousConnection && activeTab === "activity",
  });
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? "__none__"),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && activeTab === "activity",
  });

  const appName = application?.name ?? t("pages.apps.common.app");
  useEffect(() => {
    if (!activeTab) return;
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("nav.company"), href: "/dashboard" },
      { label: t("nav.apps"), href: "/apps" },
      { label: appName, href: appApplicationTabHref(applicationId, "setup") },
      { label: appTabLabel(activeTab) },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, selectedCompany?.name, appName, applicationId, activeTab, t]);

  const remove = useMutation({
    mutationFn: () => toolsApi.updateApplication(applicationId, { status: "archived" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tools.applications(selectedCompanyId ?? "__none__") });
      pushToast({
        title: t("pages.apps.notConnected.removedTitle"),
        body: t("pages.apps.notConnected.removedBody", { app: appName }),
        tone: "success",
      });
      navigate("/apps/connections");
    },
    onError: (error) => {
      pushToast({
        title: t("pages.apps.notConnected.removeErrorTitle"),
        body: error instanceof Error ? error.message : t("pages.apps.common.tryAgain"),
        tone: "error",
      });
    },
  });

  if (!selectedCompanyId) {
    return <div className="p-6 text-sm text-muted-foreground">{t("pages.apps.common.selectOrganization")}</div>;
  }
  if (!applicationId || !activeTab) {
    return <Navigate to={applicationId ? appApplicationTabHref(applicationId, "setup") : "/apps/connections"} replace />;
  }
  if (applicationsQuery.isLoading || connectionsQuery.isLoading) {
    return (
      <div className="max-w-3xl space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!application) {
    return (
      <div className="max-w-3xl space-y-3 p-6 text-sm text-muted-foreground">
        <p>{t("pages.apps.notConnected.missingApp")}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/apps/connections")}>{t("pages.apps.common.backToApps")}</Button>
      </div>
    );
  }
  if (activeConnection && activeTab !== "setup") {
    return <Navigate to={appTabHref(activeConnection.id, activeTab)} replace />;
  }

  const gallery = (galleryQuery.data?.apps ?? []) as AppGalleryDisplayEntry[];
  const logoUrl =
    (appSourceSlug
      ? appDefinitionLogoUrl(gallery.find((entry) => appDefinitionSlug(entry) === appSourceSlug))
      : undefined) ??
    appDefinitionLogoUrl(
      gallery.find((entry) => appDefinitionName(entry).toLowerCase() === application.name.toLowerCase()),
    );

  const previousAddress = previousConnection ? connectionAddress(previousConnection) : null;
  const connectHref = newConnectionHref({
    applicationId,
    appName: application.name,
    previousAddress,
    sourceSlug: appSourceSlug,
  });

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      <ApplicationHeader
        applicationName={application.name}
        description={application.description}
        logoUrl={logoUrl}
        connectedCount={activeConnections.length}
      />

      {activeTab === "setup" && (
        <SetupTab
          applicationName={application.name}
          activeConnections={activeConnections}
          previousConnection={previousConnection}
          previousAddress={previousAddress}
          onConnect={() => navigate(connectHref)}
          onEdit={(connectionId) => navigate(appTabHref(connectionId, "setup"))}
        />
      )}
      {activeTab === "review" && (
        previousConnection ? (
          <ReviewPanel connectionId={previousConnection.id} />
        ) : (
          <EmptyTab
            title={t("pages.apps.notConnected.reviewEmptyTitle")}
            body={t("pages.apps.notConnected.reviewEmptyBody")}
          />
        )
      )}
      {activeTab === "permissions" && (
        <PermissionsTab previousConnection={previousConnection} />
      )}
      {activeTab === "test" && (
        <EmptyTab
          title={t("pages.apps.notConnected.testTitle")}
          body="Testing becomes available after this app is connected again."
        />
      )}
      {activeTab === "activity" && (
        previousConnection ? (
          <ActivityPanel
            events={activityQuery.data?.events ?? []}
            lifecycleEvents={activityQuery.data?.lifecycleEvents ?? []}
            issues={activityQuery.data?.issues ?? {}}
            actionRequests={activityQuery.data?.actionRequests ?? {}}
            loading={activityQuery.isLoading}
            agents={agentsQuery.data ?? []}
            connectionId={previousConnection.id}
            appName={appName}
          />
        ) : (
          <ActivityPanel
            events={[]}
            lifecycleEvents={[]}
            issues={{}}
            actionRequests={{}}
            loading={false}
            agents={[]}
            connectionId=""
            appName={appName}
          />
        )
      )}
      {activeTab === "advanced" && (
        <AdvancedTab
          appName={application.name}
          previousConnection={previousConnection}
          previousAddress={previousAddress}
          removing={remove.isPending}
          onRemove={() => remove.mutate()}
        />
      )}
    </div>
  );
}

function ApplicationHeader({
  applicationName,
  description,
  logoUrl,
  connectedCount,
}: {
  applicationName: string;
  description: string | null;
  logoUrl: string | undefined;
  connectedCount: number;
}) {
  useTranslation();
  return (
    <header className="flex flex-wrap items-center gap-4">
      <AppLogo name={applicationName} logoUrl={logoUrl} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-2xl font-bold tracking-tight">{applicationName}</h1>
          <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {connectedCount > 0 ? t("localizationApps.connectedCount", { count: connectedCount }) : t("pages.apps.connections.statusNotConnected")}
          </span>
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </header>
  );
}

function SetupTab({
  applicationName,
  activeConnections,
  previousConnection,
  previousAddress,
  onConnect,
  onEdit,
}: {
  applicationName: string;
  activeConnections: ToolConnection[];
  previousConnection: ToolConnection | null;
  previousAddress: string | null;
  onConnect: () => void;
  onEdit: (connectionId: string) => void;
}) {
  useTranslation();
  if (activeConnections.length > 0) {
    return (
      <div className="space-y-6">
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("pages.apps.notConnected.alreadyConnected", { app: applicationName })}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("pages.apps.notConnected.openOrAdd")}</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            {activeConnections.map((connection) => {
              const secondary = connectionDisplaySecondaryHint(connection) ??
                (connection.lastUsedAt ? t("pages.apps.notConnected.lastUsedAt", { time: timeAgo(connection.lastUsedAt) }) : t("pages.apps.notConnected.notUsedYet"));
              const status = connection.enabled === false || connection.status === "disabled"
                ? t("pages.apps.connections.statusPaused")
                : isToolConnectionAttentionHealth(connection.healthStatus)
                  ? t("pages.apps.connections.statusNeedsAttention")
                  : t("pages.apps.notConnected.statusConnected");
              return (
                <button
                  key={connection.id}
                  type="button"
                  onClick={() => onEdit(connection.id)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {humanizeConnectionDisplayName(connection)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{secondary}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{status}</span>
                  <span className="text-xs font-semibold text-primary">{t("pages.apps.notConnected.editAction")}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">{t("pages.apps.notConnected.connectAnother")}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("pages.apps.notConnected.connectAnotherBody", { app: applicationName })}
              </p>
            </div>
            <Button onClick={onConnect}>{t("pages.apps.notConnected.connectAnother")}</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {previousConnection ? t("pages.apps.notConnected.reconnectThisApp") : t("pages.apps.notConnected.connectThisApp")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {previousConnection
                ? t("pages.apps.notConnected.previousSetupKept")
                : t("pages.apps.notConnected.notAvailableUntilConnected")}
            </p>
          </div>
          <Button onClick={onConnect}>
            {previousConnection ? t("pages.apps.connections.reconnect") : t("pages.apps.connections.connect")}
          </Button>
        </div>
      </section>

      {previousConnection && (
        <PreviousSetup connection={previousConnection} previousAddress={previousAddress} />
      )}
    </div>
  );
}

function PreviousSetup({
  connection,
  previousAddress,
}: {
  connection: ToolConnection;
  previousAddress: string | null;
}) {
  useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4">
      <h2 className="text-sm font-bold text-foreground">{t("pages.apps.notConnected.previousSetup")}</h2>
      {connection.healthMessage && (
        <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          {t("pages.apps.notConnected.lastError", { error: connection.healthMessage })}
        </p>
      )}
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-(--gtc-59)">
        <dt className="text-muted-foreground">{t("pages.apps.notConnected.address")}</dt>
        <dd className="break-all font-mono text-foreground">{previousAddress}</dd>
        <dt className="text-muted-foreground">{t("pages.apps.notConnected.connectionType")}</dt>
        <dd className="text-foreground">{connectionTransportLabel(connection.transport)}</dd>
        <dt className="text-muted-foreground">{t("pages.apps.connections.columnLastUsed")}</dt>
        <dd className="text-foreground">
          {connection.lastUsedAt ? timeAgo(connection.lastUsedAt) : t("pages.apps.notConnected.never")}
        </dd>
      </dl>
    </section>
  );
}

function PermissionsTab({ previousConnection }: { previousConnection: ToolConnection | null }) {
  useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4">
      <h2 className="text-sm font-bold text-foreground">{t("pages.apps.notConnected.permissionsPaused")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("pages.apps.notConnected.permissionsPausedBody")}</p>
      {previousConnection && (
        <p className="mt-3 text-xs text-muted-foreground">{t("pages.apps.notConnected.permissionsReadOnly")}</p>
      )}
    </section>
  );
}

function AdvancedTab({
  appName,
  previousConnection,
  previousAddress,
  removing,
  onRemove,
}: {
  appName: string;
  previousConnection: ToolConnection | null;
  previousAddress: string | null;
  removing: boolean;
  onRemove: () => void;
}) {
  useTranslation();
  return (
    <div className="space-y-6">
      {previousConnection ? (
        <PreviousSetup connection={previousConnection} previousAddress={previousAddress} />
      ) : (
        <EmptyTab
          title={t("pages.apps.notConnected.noPreviousDetails")}
          body="Technical details will appear here after this app is connected."
        />
      )}
      <DangerZone appName={appName} removing={removing} onRemove={onRemove} />
    </div>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </section>
  );
}

function latestArchivedConnection(connections: ToolConnection[]): ToolConnection | null {
  const archived = connections.filter((c) => c.status === "archived");
  if (archived.length === 0) return null;
  return archived.reduce((latest, connection) => {
    const latestTime = new Date(latest.updatedAt ?? latest.createdAt ?? 0).getTime();
    const connectionTime = new Date(connection.updatedAt ?? connection.createdAt ?? 0).getTime();
    return connectionTime > latestTime ? connection : latest;
  });
}

function newConnectionHref({
  applicationId,
  appName,
  previousAddress,
  sourceSlug,
}: {
  applicationId: string;
  appName: string;
  previousAddress: string | null;
  sourceSlug: string | null;
}): string {
  const params = new URLSearchParams({ applicationId, name: appName, new: "1" });
  if (sourceSlug) params.set("source", sourceSlug);
  if (!isMcpDirectOAuthConnectSlug(sourceSlug)) params.set("byo", "1");
  if (previousAddress && /^https?:\/\//i.test(previousAddress)) params.set("link", previousAddress);
  return `/apps/connect?${params.toString()}`;
}
