// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { FoldCurtain } from "./FoldCurtain";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("FoldCurtain localization", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1000);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
  });

  it("updates both labels while preserving expansion state and user content", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
      root.render(
        <FoldCurtain collapsedHeight={100}>
          <article><strong>Original user text</strong><a href="/issues/RAW-23">Source task</a></article>
        </FoldCurtain>,
      );
    });
    const button = container.querySelector("button")!;
    const content = container.querySelector("article")!;
    const originalContent = content.innerHTML;
    expect(button.textContent?.trim()).toBe("Show more");
    expect(button.getAttribute("aria-expanded")).toBe("false");

    await act(async () => { await i18n.changeLanguage("ru"); });
    expect(button.textContent?.trim()).toBe("Показать больше");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => button.click());
    expect(button.textContent?.trim()).toBe("Показать меньше");
    expect(button.getAttribute("aria-expanded")).toBe("true");

    await act(async () => { await i18n.changeLanguage("en"); });
    expect(button.textContent?.trim()).toBe("Show less");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    await act(async () => button.click());
    expect(button.textContent?.trim()).toBe("Show more");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("article")).toBe(content);
    expect(content.innerHTML).toBe(originalContent);
  });

  it("keeps explicitly supplied toggle labels unchanged", async () => {
    await act(async () => {
      await i18n.changeLanguage("ru");
      root.render(<FoldCurtain moreLabel="Custom expand" lessLabel="Custom collapse">Raw content</FoldCurtain>);
    });
    const button = container.querySelector("button")!;
    expect(button.textContent?.trim()).toBe("Custom expand");
    await act(async () => button.click());
    expect(button.textContent?.trim()).toBe("Custom collapse");
  });
});
