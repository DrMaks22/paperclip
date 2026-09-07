// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { AdvancedToolsLink, ByoConnectCard } from "./store-cards";
import { AppsSubNav } from "./gateways/AppsSubNav";

vi.mock("@/lib/router", () => ({ Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));

describe("stable apps store and navigation localization", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    await i18n.changeLanguage("en");
  });
  it("switches all copy and aria labels without changing links, active state or callback identity", async () => {
    const connect = vi.fn();
    await act(async () => { root.render(<><ByoConnectCard onConnect={connect} /><AdvancedToolsLink /><AppsSubNav active="gateways" /></>); });
    const button = host.querySelector("button")!;
    const links = Array.from(host.querySelectorAll("a"));
    const hrefs = links.map(link => link.getAttribute("href"));
    for (const language of ["ru", "en", "ru"]) {
      await act(async () => { await i18n.changeLanguage(language); });
      expect(host.querySelector("button")).toBe(button);
      expect(Array.from(host.querySelectorAll("a"))).toEqual(links);
      expect(links.map(link => link.getAttribute("href"))).toEqual(hrefs);
      expect(host.textContent).toContain(i18n.t("localizationConnections.connectYourOwnTool18"));
      expect(host.textContent).toContain(i18n.t("stableApps.store.byoDescription"));
      expect(host.textContent).toContain(i18n.t("pages.apps.browse.connectAction"));
      expect(host.textContent).toContain(i18n.t("stableApps.store.advanced"));
      expect(host.querySelector("nav")!.getAttribute("aria-label")).toBe(i18n.t("pages.apps.subNav.ariaLabel"));
      expect(host.querySelector('a[href="/apps/gateways"]')!.getAttribute("aria-current")).toBe("page");
      expect(host.querySelector('a[href="/apps/connections"]')!.textContent).toBe(i18n.t("pages.apps.subNav.connected"));
      expect(host.querySelector('a[href="/activity"]')!.textContent).toBe(i18n.t("nav.activity"));
      expect(connect).not.toHaveBeenCalled();
    }
    await act(async () => { button.click(); });
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
