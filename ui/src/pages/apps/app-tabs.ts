import { t } from "@/i18n";
import { Activity, Beaker, Inbox, Settings2, ShieldCheck, Wrench } from "lucide-react";

export const APP_TABS = [
  { key: "setup", get label() { return t("pages.apps.tabs.setup"); }, icon: Settings2 },
  { key: "review", get label() { return t("pages.apps.tabs.review"); }, icon: Inbox },
  { key: "permissions", get label() { return t("pages.apps.tabs.permissions"); }, icon: ShieldCheck },
  { key: "activity", get label() { return t("pages.apps.tabs.activity"); }, icon: Activity },
  { key: "test", get label() { return t("pages.apps.tabs.test"); }, icon: Beaker },
  { key: "advanced", get label() { return t("pages.apps.tabs.advanced"); }, icon: Wrench },
] as const;

export type AppTabKey = (typeof APP_TABS)[number]["key"];

/**
 * Tabs hidden for an application that has no live connection (the
 * `AppNotConnected` shell). The Test tab runs real calls against a connected
 * app, so it only appears once the app is connected.
 */
export const CONNECTED_ONLY_APP_TABS: ReadonlySet<AppTabKey> = new Set<AppTabKey>(["test"]);

export function appTabHref(connectionId: string, tab: AppTabKey): string {
  return `/apps/${connectionId}/${tab}`;
}

export function appApplicationTabHref(applicationId: string, tab: AppTabKey): string {
  return `/apps/app/${applicationId}/${tab}`;
}

export function isAppTabKey(value: string | undefined): value is AppTabKey {
  return APP_TABS.some((tab) => tab.key === value);
}

export function appTabLabel(tabKey: AppTabKey): string {
  return APP_TABS.find((tab) => tab.key === tabKey)?.label ?? t("pages.apps.tabs.setup");
}
