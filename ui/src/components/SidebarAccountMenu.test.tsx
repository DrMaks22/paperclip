// @vitest-environment jsdom

import { i18n, LOCALE_STORAGE_KEY } from "@/i18n";
import { act as reactAct } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../lib/queryKeys";
import { SidebarAccountMenu } from "./SidebarAccountMenu";

const mockAuthApi = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
}));
const mockInstanceSettingsApi = vi.hoisted(() => ({
  getExperimental: vi.fn(),
}));
const mockToggleTheme = vi.hoisted(() => vi.fn());
const mockSetSidebarOpen = vi.hoisted(() => vi.fn());
const mockNavigateTopLevel = vi.hoisted(() => vi.fn());

vi.mock("@/api/auth", () => ({
  authApi: mockAuthApi,
}));

vi.mock("@/lib/browserNavigation", () => ({
  navigateTopLevel: mockNavigateTopLevel,
}));

vi.mock("@/api/instanceSettings", () => ({
  instanceSettingsApi: mockInstanceSettingsApi,
}));

vi.mock("../api/instanceSettings", () => ({
  instanceSettingsApi: mockInstanceSettingsApi,
}));

vi.mock("@/lib/router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

vi.mock("../context/SidebarContext", () => ({
  useSidebar: () => ({
    isMobile: false,
    setSidebarOpen: mockSetSidebarOpen,
  }),
}));

vi.mock("../context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    toggleTheme: mockToggleTheme,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  await callback();
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("SidebarAccountMenu", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockAuthApi.getSession.mockResolvedValue({
      session: { id: "session-1", userId: "user-1" },
      user: {
        id: "user-1",
        name: "Jane Example",
        email: "jane@example.com",
        image: "https://example.com/jane.png",
      },
    });
    mockInstanceSettingsApi.getExperimental.mockResolvedValue({
      enableIsolatedWorkspaces: false,
    });
    mockAuthApi.signOut.mockResolvedValue({ success: true, redirectTo: "/cloud/logout" });
  });

  afterEach(async () => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
  });

  it("switches languages through the account menu and keeps the saved preference and account actions on remount", async () => {
    const previousPreference = localStorage.getItem(LOCALE_STORAGE_KEY);
    let root: ReturnType<typeof createRoot> | undefined;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.health, {
      status: "ok",
      deploymentMode: "authenticated",
    });

    const menu = () => {
      const content = document.body.querySelector<HTMLElement>('[data-slot="popover-content"]');
      expect(content).not.toBeNull();
      return content!;
    };
    const languageButton = (locale: "en" | "ru") => {
      const button = menu().querySelector<HTMLButtonElement>(`button[lang="${locale}"]`);
      expect(button).not.toBeNull();
      return button!;
    };
    const expectLanguage = (locale: "en" | "ru") => {
      expect(languageButton("en").textContent).toBe(locale === "en" ? "English" : "Английский");
      expect(languageButton("ru").textContent).toBe(locale === "en" ? "Russian" : "Русский");
      expect(languageButton("en").getAttribute("aria-pressed")).toBe(String(locale === "en"));
      expect(languageButton("ru").getAttribute("aria-pressed")).toBe(String(locale === "ru"));
      expect(i18n.resolvedLanguage).toBe(locale);
      expect(document.documentElement.lang).toBe(locale);
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(locale);
    };
    const openMenu = async () => {
      expect(document.body.querySelector('[data-slot="popover-content"]')).toBeNull();
      const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
      expect(trigger).not.toBeNull();
      await reactAct(async () => trigger!.click());
      expect(trigger!.getAttribute("aria-expanded")).toBe("true");
    };
    const mountAndOpen = async () => {
      root = createRoot(container);
      await reactAct(async () => {
        root!.render(
          <QueryClientProvider client={queryClient}>
            <SidebarAccountMenu deploymentMode="authenticated" version="1.2.3" />
          </QueryClientProvider>,
        );
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      });
      await openMenu();
    };

    try {
      await i18n.changeLanguage("en");
      localStorage.setItem(LOCALE_STORAGE_KEY, "en");
      await mountAndOpen();
      expectLanguage("en");
      const originalLinks = [...menu().querySelectorAll("a")].map(link => ({
        href: link.getAttribute("href"), target: link.getAttribute("target"),
      }));
      const expectAccountActions = () => {
        expect(menu().textContent).toContain("Jane Example");
        expect(menu().textContent).toContain("jane@example.com");
        expect(menu().textContent).toContain("Paperclip v1.2.3");
        expect([...menu().querySelectorAll("a")].map(link => ({
          href: link.getAttribute("href"), target: link.getAttribute("target"),
        }))).toEqual(originalLinks);
        expect(menu().querySelector('a[href="/company/settings/instance/profile"]')).not.toBeNull();
        expect(menu().querySelector('a[href="https://paperclip.ing/feedback"]')?.getAttribute("target")).toBe("_blank");
        expect(mockAuthApi.signOut).not.toHaveBeenCalled();
        expect(mockNavigateTopLevel).not.toHaveBeenCalled();
      };

      await reactAct(async () => languageButton("ru").click());
      expectLanguage("ru");
      expectAccountActions();

      await reactAct(async () => root!.unmount());
      root = undefined;
      expect(document.body.querySelector('[data-slot="popover-content"]')).toBeNull();
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ru");
      await mountAndOpen();
      expectLanguage("ru");
      expectAccountActions();

      await reactAct(async () => languageButton("en").click());
      expectLanguage("en");
      expectAccountActions();
      expect(menu().textContent).toContain("Edit profile");
      expect(menu().textContent).toContain("Documentation");
      expect(menu().textContent).toContain("Feedback");
      const theme = [...menu().querySelectorAll("button")].find(button => button.textContent?.includes("Switch to"));
      expect(theme).toBeDefined();
      await reactAct(async () => theme!.click());
      expect(mockToggleTheme).toHaveBeenCalledOnce();
      await openMenu();
      expectLanguage("en");
      const signOut = [...menu().querySelectorAll("button")].find(button => button.textContent?.includes("Sign out"));
      expect(signOut).toBeDefined();
      await reactAct(async () => signOut!.click());
      expect(mockAuthApi.signOut).toHaveBeenCalledOnce();
      expect(mockNavigateTopLevel).not.toHaveBeenCalled();
      expect(queryClient.getQueryState(queryKeys.health)?.isInvalidated).toBe(true);
    } finally {
      await reactAct(async () => root?.unmount());
      queryClient.clear();
      if (previousPreference === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
      else localStorage.setItem(LOCALE_STORAGE_KEY, previousPreference);
    }
  });

  it("keeps authenticated self-hosted sign-out on the local auth flow", async () => {
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.health, {
      status: "ok",
      deploymentMode: "authenticated",
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SidebarAccountMenu
            deploymentMode="authenticated"
            version="1.2.3"
          />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Jane Example");
    expect(container.textContent).not.toContain("jane@example.com");

    const trigger = container.querySelector('button[aria-label="Open account menu"]');
    expect(trigger).not.toBeNull();

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(document.body.textContent).toContain("Edit profile");
    expect(document.body.textContent).not.toContain("Instance settings");
    expect(document.body.textContent).toContain("Documentation");
    expect(document.body.textContent).toContain("Feedback");

    // Feedback link opens in a new tab pointing at the feedback URL
    const feedbackAnchor = document.body.querySelector('a[href="https://paperclip.ing/feedback"]') as HTMLAnchorElement | null;
    expect(feedbackAnchor).not.toBeNull();
    expect(feedbackAnchor?.getAttribute("target")).toBe("_blank");

    // Feedback appears after Documentation and before the theme toggle
    const menuText = document.body.querySelector('[data-slot="popover-content"]')?.textContent ?? "";
    const docsPos = menuText.indexOf("Documentation");
    const feedbackPos = menuText.indexOf("Feedback");
    const themePos = menuText.indexOf("Switch to");
    expect(docsPos).toBeLessThan(feedbackPos);
    expect(feedbackPos).toBeLessThan(themePos);

    expect(document.body.textContent).toContain("Paperclip v1.2.3");
    expect(document.body.textContent).toContain("jane@example.com");
    expect(document.body.querySelector('[data-slot="popover-content"]')?.className)
      .toContain("w-(--sz-277px)");
    expect(document.body.querySelector('a[href="/company/settings/instance/profile"]')).not.toBeNull();

    const signOutButton = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Sign out"),
    );
    await act(async () => {
      signOutButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(mockAuthApi.signOut).toHaveBeenCalledOnce();
    expect(mockNavigateTopLevel).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(queryKeys.health)?.isInvalidated).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("navigates cloud-managed sign-out through the harness without calling local auth", async () => {
    const root = createRoot(container);
    const onOpenChange = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(queryKeys.health, {
      status: "ok",
      deploymentMode: "authenticated",
      cloud: {
        managed: true,
        managedBy: "paperclip-cloud",
        stackSlug: "acme-labs",
        cloudBaseUrl: "https://cloud.example.test",
      },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SidebarAccountMenu
            deploymentMode="authenticated"
            open
            onOpenChange={onOpenChange}
          />
        </QueryClientProvider>,
      );
    });
    await flushReact();

    const signOutButton = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Sign out"),
    );
    await act(async () => {
      signOutButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(mockAuthApi.signOut).not.toHaveBeenCalled();
    expect(mockNavigateTopLevel).toHaveBeenCalledOnce();
    expect(mockNavigateTopLevel).toHaveBeenCalledWith("/cloud/logout");
    expect(onOpenChange).toHaveBeenCalledWith(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps sign-out hidden outside authenticated deployment mode", async () => {
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SidebarAccountMenu deploymentMode="local_trusted" open />
        </QueryClientProvider>,
      );
    });
    await flushReact();

    expect(document.body.textContent).not.toContain("Sign out");

    await act(async () => {
      root.unmount();
    });
  });

  it("shows the short commit sha instead of a version for source builds", async () => {
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SidebarAccountMenu
            deploymentMode="authenticated"
            version="2026.626.0+58.git.518fc71ce"
            serverGit={{
              available: true,
              fullSha: "518fc71ce1234567890abcdef1234567890abcde",
              shortSha: "518fc71",
              branchName: "feature/source-build-label",
              subject: "Show source build label",
              committedAt: "2026-06-26T00:00:00.000Z",
              localChanges: {
                available: true,
                hasLocalChanges: false,
                stagedFileCount: 0,
                unstagedFileCount: 0,
                untrackedFileCount: 0,
              },
            }}
            open
          />
        </QueryClientProvider>,
      );
    });
    await flushReact();

    expect(document.body.textContent).toContain("feature/source-build-labelPaperclip 518fc71");
    expect(document.body.textContent).not.toContain("2026.626.0+58.git.518fc71ce");
    expect(document.body.querySelector('a[href="https://github.com/paperclipai/paperclip/tree/feature%2Fsource-build-label"]')?.textContent).toBe(
      "feature/source-build-label",
    );
    expect(document.body.querySelector('a[href="https://github.com/paperclipai/paperclip/commit/518fc71ce1234567890abcdef1234567890abcde"]')?.textContent).toBe(
      "518fc71",
    );

    await act(async () => {
      root.unmount();
    });
  });
});
