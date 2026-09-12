import { Languages } from "lucide-react";
import { i18n, setLocale, supportedLocales, useTranslation } from "@/i18n";
import { localeAutonym } from "@/i18n/locales";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const { t } = useTranslation();
  const currentLocale = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
          <Languages className="size-4" />
        </span>
        <span className="text-sm font-medium text-foreground">{t("common.language")}</span>
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap gap-0.5 rounded-lg border border-border p-0.5" role="group" aria-label={t("common.language")}>
        {supportedLocales.map((locale) => {
          // Retain the established English/Russian labels for existing users.
          // Every future language needs only its reviewed JSON catalog.
          const label = locale === "en" ? t("common.english")
            : locale === "ru" ? t("common.russian") : localeAutonym(locale);
          return (
            <button
              key={locale}
              type="button"
              className={cn(
                "max-w-full break-words rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                currentLocale === locale ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={currentLocale === locale}
              aria-label={label}
              lang={locale}
              dir={i18n.dir(locale)}
              onClick={() => setLocale(locale)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
