import { t } from "@/i18n";
import { APP_DEFINITION_COPY } from "./app-definition-copy";
import type { AppDefinition, ToolApplication } from "@paperclipai/shared";

export type AppGalleryDisplayEntry = AppDefinition & {
  key?: string;
  logoUrl?: string;
  tagline?: string;
  branding?: AppDefinition["branding"];
};

export function appDefinitionSlug(entry: AppGalleryDisplayEntry | null | undefined): string {
  return entry?.slug ?? entry?.key ?? "";
}

export function appDefinitionName(entry: AppGalleryDisplayEntry | null | undefined): string {
  return entry?.name ?? appDefinitionSlug(entry) ?? t("pages.apps.common.app");
}

/** Translate known built-in display text without changing custom metadata or API objects. */
export function appDefinitionText(entry: AppGalleryDisplayEntry | string | null | undefined, source: string): string {
  const slug = typeof entry === "string" ? entry : appDefinitionSlug(entry);
  const key = APP_DEFINITION_COPY[slug]?.[source];
  return key ? t(key) : source;
}

export function appDefinitionDescription(entry: AppGalleryDisplayEntry | null | undefined): string {
  return appDefinitionText(entry, entry?.description ?? entry?.tagline ?? "");
}

export function appDefinitionLogoUrl(entry: AppGalleryDisplayEntry | null | undefined): string | undefined {
  return entry?.branding?.logoUrl ?? entry?.logoUrl;
}

export function appApplicationSourceSlug(application: ToolApplication | null | undefined): string | null {
  if (!application) return null;
  const metadata = application.metadata;
  const source = metadata?.sourceTemplateKey ?? metadata?.galleryKey;
  if (typeof source === "string" && source.trim()) return source.trim();
  const key = application.applicationKey?.trim();
  if (!key) return null;
  const galleryPrefix = "app-gallery:";
  if (key.startsWith(galleryPrefix)) return key.slice(galleryPrefix.length).split(":")[0] || null;
  return key;
}
