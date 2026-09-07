import { i18n, t } from "@/i18n";

// Exactly the finite grammar emitted by stable transcript-adapter:phaseSummary.
// This display adapter must never receive user messages or provider output.
const RULES = [
  { pattern: /^Read ([1-9]\d*) (file|files)$/, singular: "file", key: "localizationPhaseSummary.readFiles" },
  { pattern: /^Edited ([1-9]\d*) (file|files)$/, singular: "file", key: "localizationPhaseSummary.editedFiles" },
  { pattern: /^Ran ([1-9]\d*) (command|commands)$/, singular: "command", key: "localizationPhaseSummary.commands" },
  { pattern: /^Searched ([1-9]\d*) (time|times)$/, singular: "time", key: "localizationPhaseSummary.searches" },
  { pattern: /^Called ([1-9]\d*) (tool|tools)$/, singular: "tool", key: "stableTaskChat.calledTools" },
] as const;

/** Keep canonical model strings intact; recompute only their visible labels. */
export function taskChatPhaseSummaryDisplay(value: string): string {
  if (!i18n.resolvedLanguage?.startsWith("ru")) return value;
  if (value === "No tool activity") return t("localizationPhaseSummary.noToolActivity");
  const parts = value.split(", ");
  if (parts.length > RULES.length) return value;
  const labels: string[] = [];
  let previousRule = -1;
  for (const part of parts) {
    const ruleIndex = RULES.findIndex(rule => rule.pattern.test(part));
    if (ruleIndex <= previousRule) return value;
    const rule = RULES[ruleIndex];
    if (!rule) return value;
    const match = rule.pattern.exec(part)!;
    const count = Number(match[1]);
    if (!Number.isSafeInteger(count) || (count === 1) !== (match[2] === rule.singular)) return value;
    const label = t(rule.key, { count });
    labels.push(labels.length ? label.replace(/^[А-ЯЁ]/, letter => letter.toLowerCase()) : label);
    previousRule = ruleIndex;
  }
  return labels.join(", ");
}
