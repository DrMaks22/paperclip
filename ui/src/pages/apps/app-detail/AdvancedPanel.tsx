import { t, useTranslation } from "@/i18n";
import { appDefinitionText } from "../app-definition-display";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Lock } from "lucide-react";
import type { AppDefinition, ToolConnection } from "@paperclipai/shared";
import { credentialConfigPath, getAvailableConnectionMethod, humanizeConnectionDisplayName } from "@paperclipai/shared";
import { toolsApi } from "@/api/tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context/ToastContext";
import { redactUrlSecrets } from "@/lib/redact-url-secrets";
import { navigateTopLevel } from "@/lib/browserNavigation";
import type { AppDetailSectionProps } from "./types";

export function AdvancedPanel({
  connection,
  appName,
  galleryEntry,
  removing,
  onRemove,
  onReplaced,
}: Pick<AppDetailSectionProps, "connection" | "appName" | "galleryEntry"> & {
  removing: boolean;
  onRemove: () => void;
  onReplaced: () => void;
}) {
  useTranslation();
  return (
    <div className="space-y-6">
      <KeySection connection={connection} galleryEntry={galleryEntry} onReplaced={onReplaced} />
      <TechnicalDetails connection={connection} />
      <DangerZone appName={appName} removing={removing} onRemove={onRemove} />
    </div>
  );
}

function KeySection({
  connection,
  galleryEntry,
  onReplaced,
}: {
  connection: ToolConnection;
  galleryEntry: AppDefinition | null;
  onReplaced: () => void;
}) {
  useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-bold text-foreground">{t("pages.caseDetail.key")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("stableApps.key.replaceHint")}</p>
          </div>
        </div>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>{t("stableApps.key.replace")}</Button>
        )}
      </div>
      {open && (
        <div className="border-t border-border px-5 py-4">
          <ReconnectForm
            connection={connection}
            galleryEntry={galleryEntry}
            onCancel={() => setOpen(false)}
            onReconnected={() => {
              setOpen(false);
              onReplaced();
            }}
          />
        </div>
      )}
    </section>
  );
}

export function ReconnectCard({
  connection,
  galleryEntry,
  onReconnected,
}: {
  connection: ToolConnection;
  galleryEntry: AppDefinition | null;
  onReconnected: () => void;
}) {
  useTranslation();
  const { pushToast } = useToast();
  const reconnectOAuth = useMutation({
    mutationFn: () => toolsApi.startOAuth(connection.id),
    onSuccess: ({ authorizationUrl }) => navigateTopLevel(authorizationUrl),
    onError: (error) =>
      pushToast({
        title: t("pages.apps.detail.signInErrorTitle"),
        body: error instanceof Error ? error.message : t("pages.apps.common.tryAgain"),
        tone: "error",
      }),
  });
  const oauth = connection.authKind === "oauth";

  return (
    <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-5">
      <h2 className="text-sm font-bold text-amber-900 dark:text-amber-100">
        {oauth ? t("localizationApps.reconnectRequired337") : t("localizationApps.thisAppNeedsReconnecting338")}
      </h2>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
        {connection.healthMessage?.trim() || (oauth
          ? t("localizationApps.authorizationExpiredOrWasRevokedSignInAgainTo339")
          : t("localizationApps.theKeyStoppedWorkingPasteANewOneToGetItBackOn340"))}
      </p>
      <div className="mt-3">
        {oauth ? (
          <Button
            type="button"
            size="sm"
            disabled={reconnectOAuth.isPending}
            onClick={() => reconnectOAuth.mutate()}
          >
            {reconnectOAuth.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {reconnectOAuth.isPending ? t("localizationApps.openingSignIn343") : t("pages.apps.connections.reconnect")}
          </Button>
        ) : (
          <ReconnectForm connection={connection} galleryEntry={galleryEntry} onReconnected={onReconnected} />
        )}
      </div>
    </div>
  );
}

function ReconnectForm({
  connection,
  galleryEntry,
  onCancel,
  onReconnected,
}: {
  connection: ToolConnection;
  galleryEntry: AppDefinition | null;
  onCancel?: () => void;
  onReconnected: () => void;
}) {
  useTranslation();
  const { pushToast } = useToast();
  const method = galleryEntry && Array.isArray(galleryEntry.methods)
    ? getAvailableConnectionMethod(galleryEntry)
    : null;
  const fields = (method?.credentialFields ?? []).map((field) => ({
    ...field,
    configPath: credentialConfigPath(field),
    helpUrl: method?.consoleLinks?.keys ?? method?.consoleLinks?.docs ?? "",
  }));
  const [values, setValues] = useState<Record<string, string>>({});
  const [single, setSingle] = useState("");
  const usesGallery = fields.length > 0 && !!galleryEntry;

  const reconnect = useMutation({
    mutationFn: () => {
      const credentialValues = usesGallery
        ? values
        : { "credentials.authorization": single.trim() };
      return toolsApi.reconnectConnection(connection.id, credentialValues);
    },
    onSuccess: (result) => {
      const healthy =
        result.connection.healthStatus === "healthy" || result.connection.healthStatus === "unknown";
      if (healthy) {
        pushToast({
          title: t("localizationApps.reconnected344"),
          body: t("localizationApps.connectionBackOnline", { name: humanizeConnectionDisplayName(connection) }),
          tone: "success",
        });
        onReconnected();
      } else {
        pushToast({
          title: t("localizationApps.stillNotWorking345"),
          body: result.connection.healthMessage?.trim() || t("localizationApps.thatKeyDidnTCheckOutTryAnother346"),
          tone: "error",
        });
      }
    },
    onError: (error) =>
      pushToast({
        title: t("localizationApps.thatKeyDidnTWork347"),
        body: error instanceof Error ? error.message : t("localizationApps.checkTheKeyAndTryAgain348"),
        tone: "error",
      }),
  });

  const filled = usesGallery
    ? fields.every((f) => f.required === false || (values[f.configPath]?.trim().length ?? 0) > 0)
    : single.trim().length > 0;

  return (
    <div className="space-y-3">
      {usesGallery ? (
        fields.map((field) => (
          <div key={field.configPath}>
            <label className="text-xs font-medium text-foreground">{appDefinitionText(galleryEntry, field.label)}</label>
            <Input
              type="password"
              autoComplete="off"
              value={values[field.configPath] ?? ""}
              onChange={(e) => setValues({ ...values, [field.configPath]: e.target.value })}
              placeholder="****************"
              className="mt-1 h-10 font-mono"
            />
            {field.helpUrl && (
              <a
                href={field.helpUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-foreground underline underline-offset-2"
              >{t("pages.apps.connect.whereFindKey")}<ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        ))
      ) : (
        <Input
          type="password"
          autoComplete="off"
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          placeholder={t("localizationApps.pasteYourNewKey350")}
          className="h-10 font-mono"
        />
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!filled || reconnect.isPending} onClick={() => reconnect.mutate()}>
          {reconnect.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          {reconnect.isPending ? t("localizationApps.checking351") : t("localizationApps.checkReconnect352")}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={reconnect.isPending}>{t("pages.apps.common.cancel")}</Button>
        )}
      </div>
    </div>
  );
}

function TechnicalDetails({ connection }: { connection: ToolConnection }) {
  useTranslation();
  return (
    <section className="rounded-xl border border-border bg-card px-5 py-4">
      <h2 className="text-sm font-bold text-foreground">{t("localizationIssueDetail.ui_Technical_details")}</h2>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-(--gtc-59)">
        <dt className="text-muted-foreground">{t("pages.apps.notConnected.address")}</dt>
        <dd className="break-all font-mono text-foreground">{connectionAddress(connection)}</dd>
        <dt className="text-muted-foreground">{t("pages.apps.notConnected.connectionType")}</dt>
        <dd className="text-foreground">{connectionTransportLabel(connection.transport)}</dd>
      </dl>
    </section>
  );
}

export function DangerZone({
  appName,
  removing,
  onRemove,
}: {
  appName: string;
  removing: boolean;
  onRemove: () => void;
}) {
  useTranslation();
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="rounded-xl border border-destructive/40 bg-card">
      <div className="border-b border-destructive/40 px-5 py-3 text-sm font-bold text-destructive">{t("localizationSkills.dangerZone274")}</div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t("localizationApps.removeThisApp361")}</p>
          <p className="text-xs text-muted-foreground">
            {t("stableApps.removeHint", { app: appName })}
          </p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={removing}>{t("pages.apps.common.cancel")}</Button>
            <Button variant="destructive" size="sm" onClick={onRemove} disabled={removing}>
              {removing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{t("localizationApps.yesRemoveIt364")}</Button>
          </div>
        ) : (
          <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>{t("localizationApps.removeApp365")}</Button>
        )}
      </div>
    </section>
  );
}

export function connectionAddress(connection: ToolConnection): string {
  const config = connection.config ?? connection.transportConfig ?? {};
  const value = config.url ?? config.endpoint ?? config.remoteUrl;
  if (typeof value === "string" && value.trim().length > 0) return redactUrlSecrets(value);
  if (connection.transport === "local_stdio") return t("localizationApps.localCommand366");
  return t("pages.secrets.coverage.missingLabel");
}

export function connectionTransportLabel(transport: ToolConnection["transport"]): string {
  if (transport === "mcp_remote") return t("localizationApps.remoteHTTP368");
  if (transport === "local_stdio") return t("localizationApps.localCommand366");
  return t("common.unknown");
}
