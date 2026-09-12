// @vitest-environment jsdom
// Generated from the community distribution. Additional languages are tested
// only when explicitly enabled from catalogs; third-language fixtures are temporary.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { i18n, LOCALE_STORAGE_KEY, resolveInitialLocale, setLocale, useTranslation } from "@/i18n";
import { DEFAULT_LOCALE, localeAutonym, localeMessages, supportedLocales } from "./locales";
import { taskChatDurationLabel, taskChatTimestampDisplay, taskChatTokenLabel } from "@/components/task-chat/task-chat-display";
import { taskChatPhaseSummaryDisplay } from "@/components/task-chat/task-chat-phase-summary-display";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Independently generated from the validated input catalog list. Keep this
// assertion separate from the runtime registry to catch scaffold auto-enabling.
const PREPARED_CATALOG_LOCALES = ["en","ru"] as const;

describe("community locale registration", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    localStorage.clear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("registers only the explicit catalogs and supplies English fallback", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect([...supportedLocales]).toEqual([...PREPARED_CATALOG_LOCALES]);
    expect(Object.keys(localeMessages)).toEqual([...supportedLocales]);
    expect(Object.keys(i18n.options.resources ?? {})).toEqual([...supportedLocales]);
    expect(i18n.options.fallbackLng).toEqual(["en"]);
    expect(i18n.t("communityMissingKey", { defaultValue: "Fallback" })).toBe("Fallback");
    expect(i18n.t("communityMissingKey")).toBe("communityMissingKey");
    setLocale("not-a-registered-locale");
    expect(i18n.resolvedLanguage).toBe("en");
  });

  it("restores each language and falls back from unknown saved/browser values", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["zz-ZZ"]);
    vi.spyOn(navigator, "language", "get").mockReturnValue("zz-ZZ");
    localStorage.setItem(LOCALE_STORAGE_KEY, "zz-ZZ");
    expect(resolveInitialLocale()).toBe("en");
    for (const locale of supportedLocales) {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale.toUpperCase().replace("-", "_"));
      expect(resolveInitialLocale()).toBe(locale);
    }
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.spyOn(navigator, "languages", "get").mockReturnValue([supportedLocales.at(-1)!]);
    expect(resolveInitialLocale()).toBe(supportedLocales.at(-1));
  });

  it("switches every language without remounting, submitting, or resetting a draft", async () => {
    const submitted = vi.fn();
    function DraftForm() {
      const { t } = useTranslation();
      const [draft, updateDraft] = useState("");
      return <form onSubmit={(event) => { event.preventDefault(); submitted(); }}>
        <LocaleSwitcher />
        <label>{t("common.language")}<textarea value={draft} onInput={(event) => updateDraft(event.currentTarget.value)} /></label>
      </form>;
    }
    await act(async () => root.render(<DraftForm />));
    const textarea = host.querySelector("textarea")!;
    await act(async () => {
      textarea.value = "Unsent draft — keep it exactly";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const form = host.querySelector("form");
    for (const locale of supportedLocales) {
      const button = host.querySelector<HTMLButtonElement>(`button[lang="${locale}"]`)!;
      expect(button).not.toBeNull();
      expect(button.type).toBe("button");
      expect(button.dir).toBe(i18n.dir(locale));
      const expectedLabel = locale === "en" ? i18n.t("common.english")
        : locale === "ru" ? i18n.t("common.russian") : localeAutonym(locale);
      expect(button.textContent).toBe(expectedLabel);
      await act(async () => button.click());
      expect(i18n.resolvedLanguage).toBe(locale);
      expect(document.documentElement.lang).toBe(locale);
      expect(document.documentElement.dir).toBe(i18n.dir(locale));
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(locale);
      expect(host.querySelector("textarea")).toBe(textarea);
      expect(textarea.value).toBe("Unsent draft — keep it exactly");
      expect(host.querySelector("form")).toBe(form);
      expect(button.getAttribute("aria-pressed")).toBe("true");
    }
    expect(submitted).not.toHaveBeenCalled();
    expect(host.querySelectorAll("button")).toHaveLength(supportedLocales.length);
  });

  it("formats generated chat labels in every non-English language while preserving opaque source text", async () => {
    const timestamp = "2026-09-12T14:34:00Z";
    for (const locale of supportedLocales) {
      await act(async () => { await i18n.changeLanguage(locale); });
      if (locale.split("-")[0] === "en") {
        expect(taskChatTimestampDisplay(timestamp, "upstream time")).toBe("upstream time");
        expect(taskChatTokenLabel("1200 tokens")).toBe("1200 tokens");
        expect(taskChatDurationLabel("12 minutes")).toBe("12 minutes");
        expect(taskChatPhaseSummaryDisplay("Reasoning")).toBe("Reasoning");
      } else {
        expect(taskChatTimestampDisplay(timestamp, "upstream time")).toBe(new Date(timestamp).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }));
        expect(taskChatTokenLabel("1200 tokens")).toBe(i18n.t("localizationTaskRuntime.tokenCount", {
          count: 1200, value: new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(1200),
        }));
        expect(taskChatDurationLabel("12 minutes")).toBe(i18n.t("localizationTaskRuntime.durationShort_m", { value: new Intl.NumberFormat(locale).format(12) }));
        expect(taskChatPhaseSummaryDisplay("Reasoning")).toBe(i18n.t("localizationTaskRuntime.ui_Reasoning_13g72ef"));
      }
      expect(taskChatTimestampDisplay(undefined, "provider-authored time")).toBe("provider-authored time");
      expect(taskChatTimestampDisplay("invalid-date", "provider-authored time")).toBe("provider-authored time");
      expect(taskChatTokenLabel("provider token summary")).toBe("provider token summary");
      expect(taskChatPhaseSummaryDisplay("Custom user/provider summary")).toBe("Custom user/provider summary");
    }
  });
});
