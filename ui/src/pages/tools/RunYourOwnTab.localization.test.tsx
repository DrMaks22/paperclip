// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { RunYourOwnTab } from "./RunYourOwnTab";

const api = vi.hoisted(() => ({
  listStdioTemplates: vi.fn(),
  createStdioTemplate: vi.fn(),
  disableStdioTemplate: vi.fn(),
}));
vi.mock("@/api/tools", () => ({ toolsApi: api }));
vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  await i18n.changeLanguage("en");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  api.listStdioTemplates.mockResolvedValue({ templates: [] });
  api.createStdioTemplate.mockResolvedValue({});
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  await i18n.changeLanguage("en");
  vi.clearAllMocks();
});

function setValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

it("preserves command and environment-key drafts and submits the stable contract after locale changes", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => root.render(<QueryClientProvider client={client}><RunYourOwnTab companyId="company-1" /></QueryClientProvider>));
  const name = host.querySelector<HTMLInputElement>("#ryo-name")!;
  const command = host.querySelector<HTMLInputElement>("#ryo-command")!;
  await act(async () => {
    setValue(name, "Custom MCP");
    setValue(command, "npx -y @acme/mcp-tool --flag");
    [...host.querySelectorAll("button")].find(button => button.textContent === "Add a key")!.click();
  });
  const env = host.querySelector<HTMLInputElement>('input[placeholder="API_KEY"]')!;
  await act(async () => setValue(env, "MY_API_KEY"));
  for (const locale of ["ru", "en"]) {
    await act(async () => { await i18n.changeLanguage(locale); });
    expect(host.querySelector("#ryo-name")).toBe(name);
    expect(host.querySelector("#ryo-command")).toBe(command);
    expect(host.contains(env)).toBe(true);
    expect([name.value, command.value, env.value]).toEqual(["Custom MCP", "npx -y @acme/mcp-tool --flag", "MY_API_KEY"]);
    expect(host.textContent).toContain(i18n.t("stableTools.copy106"));
    expect(api.createStdioTemplate).not.toHaveBeenCalled();
  }
  await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Check & continue")!.click());
  expect(api.createStdioTemplate).toHaveBeenCalledWith("company-1", {
    templateId: "custom-mcp", name: "Custom MCP", command: "npx",
    args: ["-y", "@acme/mcp-tool", "--flag"], envKeys: ["MY_API_KEY"],
  });
});
