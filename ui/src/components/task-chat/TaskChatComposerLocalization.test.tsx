// @vitest-environment jsdom
import { act, forwardRef, useImperativeHandle, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IssueAttachment } from "@paperclipai/shared";
import { i18n } from "@/i18n";
import { TaskChatComposer } from "./TaskChatComposer";

vi.mock("@/components/MarkdownEditor", () => ({
  MarkdownEditor: forwardRef(function MockEditor({ value, onChange, placeholder, readOnly }: {
    value: string; onChange: (value: string) => void; placeholder: string; readOnly?: boolean;
  }, ref) {
    useImperativeHandle(ref, () => ({ insertMarkdown: (text: string) => onChange(value + text), focus: () => {} }));
    return <textarea data-testid="editor" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} readOnly={readOnly} />;
  }),
}));

describe("stable TaskChatComposer live localization", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    localStorage.clear();
    await i18n.changeLanguage("en");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
    await i18n.changeLanguage("en");
  });
  async function render(props: ComponentProps<typeof TaskChatComposer>) {
    await act(async () => root.render(<TaskChatComposer {...props} />));
  }
  async function locale(language: string) {
    await act(async () => { await i18n.changeLanguage(language); });
  }
  async function type(editor: HTMLTextAreaElement, value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(editor, value);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function attach(file: File) {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
  }

  it("retains the edited draft and pending work mode through ru → en → ru and submits raw values", async () => {
    const draftKey = "stable-composer-draft";
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onWorkModeChange = vi.fn().mockResolvedValue(undefined);
    localStorage.setItem(draftKey, "Original saved draft");
    await render({ onAdd, onWorkModeChange, draftKey, workMode: "standard" });
    const editor = host.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(editor.value).toBe("Original saved draft");
    await type(editor, "Keep **edited draft** and /raw-command");
    await act(async () => {
      editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
      window.dispatchEvent(new Event("beforeunload"));
    });
    const mode = host.querySelector('[data-testid="task-chat-composer-mode"]')!;
    const send = host.querySelector<HTMLButtonElement>('[data-testid="task-chat-composer-send"]')!;
    expect(mode.getAttribute("data-pending-work-mode")).toBe("planning");
    for (const language of ["ru", "en", "ru"]) {
      await locale(language);
      expect(host.querySelector("textarea")).toBe(editor);
      expect(editor.value).toBe("Keep **edited draft** and /raw-command");
      expect(editor.placeholder).toBe(i18n.t("localizationTaskRuntime.composerPlanning", { agent: i18n.t("localizationTaskRuntime.ui_the_agent_12to8b1") }));
      expect(host.querySelector('[data-testid="task-chat-composer-mode"]')).toBe(mode);
      expect(mode.getAttribute("data-pending-work-mode")).toBe("planning");
      expect(mode.textContent).toBe(language === "ru" ? "Режим планирования" : "Plan mode");
      expect(localStorage.getItem(draftKey)).toBe(editor.value);
      expect(onAdd).not.toHaveBeenCalled();
      expect(onWorkModeChange).not.toHaveBeenCalled();
      expect(host.querySelector('[data-testid="task-chat-composer-send"]')).toBe(send);
      expect(send.disabled).toBe(false);
    }
    await act(async () => send.click());
    expect(onWorkModeChange).toHaveBeenCalledExactlyOnceWith("planning");
    expect(onAdd).toHaveBeenCalledExactlyOnceWith("Keep **edited draft** and /raw-command", undefined, undefined);
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it("localizes attachment kinds and byte sizes in place without changing the file or submit URL", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onAttachImage = vi.fn().mockResolvedValue({ originalFilename: "Keep original notes.txt", contentPath: "/api/raw/content" } satisfies Partial<IssueAttachment>);
    await render({ onAdd, onAttachImage, workMode: "standard" });
    const file = new File(["x".repeat(1536)], "Keep original notes.txt", { type: "text/plain" });
    await attach(file);
    const chip = host.querySelector('[data-slot="attachment"]')!;
    const remove = chip.querySelector<HTMLButtonElement>("button")!;
    for (const language of ["ru", "en", "ru"]) {
      await locale(language);
      expect(host.querySelector('[data-slot="attachment"]')).toBe(chip);
      expect(chip.getAttribute("data-state")).toBe("done");
      expect(chip.textContent).toContain(language === "ru" ? "Текст · 1,5 КБ" : "Text · 1.5 KB");
      expect(chip.textContent).toContain("Keep original notes.txt");
      expect(chip.querySelector("button")).toBe(remove);
      expect(remove.getAttribute("aria-label")).toBe(i18n.t("localizationTaskRuntime.removeAttachment", { name: file.name }));
      expect(onAttachImage).toHaveBeenCalledExactlyOnceWith(file);
      expect(onAdd).not.toHaveBeenCalled();
    }
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="task-chat-composer-send"]')!.click());
    expect(onAdd).toHaveBeenCalledExactlyOnceWith("[Keep original notes.txt](/api/raw/content)", undefined, undefined);
  });

  it.each([false, true])("keeps a failed attachment and draft while switching locales (raw error: %s)", async (rawError) => {
    const onAdd = vi.fn();
    const onAttachImage = vi.fn().mockRejectedValue(rawError ? new Error("Keep provider upload error") : null);
    await render({ onAdd, onAttachImage, workMode: "standard" });
    const editor = host.querySelector<HTMLTextAreaElement>("textarea")!;
    await type(editor, "Keep draft after upload failure");
    await attach(new File(["plain"], "raw.txt", { type: "text/plain" }));
    const chip = host.querySelector('[data-slot="attachment"]')!;
    const send = host.querySelector<HTMLButtonElement>('[data-testid="task-chat-composer-send"]')!;
    for (const language of ["ru", "en", "ru"]) {
      await locale(language);
      expect(host.querySelector('[data-slot="attachment"]')).toBe(chip);
      expect(chip.getAttribute("data-state")).toBe("error");
      expect(chip.textContent).toContain(rawError ? "Keep provider upload error" : i18n.t("localizationTaskRuntime.ui_Upload_failed_mxel7t"));
      expect(editor.value).toBe("Keep draft after upload failure");
      expect(host.querySelector("textarea")).toBe(editor);
      expect(send.disabled).toBe(true);
      expect(onAdd).not.toHaveBeenCalled();
    }
  });
});
