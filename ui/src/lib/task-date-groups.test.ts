import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { taskDateGroup, taskDateGroupSeparator } from "./task-date-groups";

afterEach(async () => { await i18n.changeLanguage("en"); });

describe("task date groups", () => {
  const now = new Date(2026, 7, 31, 9, 30);

  it("uses local calendar boundaries instead of rolling 24-hour windows", () => {
    expect(taskDateGroup(new Date(2026, 7, 31, 0, 1), now)).toBe("today");
    expect(taskDateGroup(new Date(2026, 7, 30, 23, 59), now)).toBe("yesterday");
    expect(taskDateGroup(new Date(2026, 7, 29, 23, 59), now)).toBe("earlier");
  });

  it("localizes separators without changing group keys or duplicate and leading Earlier suppression", async () => {
    for (const language of ["en", "ru", "en"]) {
      await i18n.changeLanguage(language);
      const labels = language === "ru" ? ["Сегодня", "Вчера", "Ранее"] : ["Today", "Yesterday", "Earlier"];
      expect(taskDateGroup(new Date(2026, 7, 31, 0, 1), now)).toBe("today");
      expect(taskDateGroup(new Date(2026, 7, 30, 23, 59), now)).toBe("yesterday");
      expect(taskDateGroup(new Date(2026, 7, 29, 23, 59), now)).toBe("earlier");
      expect(taskDateGroupSeparator(null, "earlier")).toBeNull();
      expect(taskDateGroupSeparator(null, "today")).toBe(labels[0]);
      expect(taskDateGroupSeparator("today", "today")).toBeNull();
      expect(taskDateGroupSeparator("today", "yesterday")).toBe(labels[1]);
      expect(taskDateGroupSeparator("yesterday", "earlier")).toBe(labels[2]);
    }
  });
});
