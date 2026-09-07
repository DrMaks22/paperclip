import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { recoveryPreviewErrorDisplay, recoveryPreviewReasonDisplay, recoveryPreviewStateDisplay } from "./recovery-preview-display";

const issue = "PAP-21/raw.uuid";
const blocker = "BLOCK-99_raw";
const reasons = [
  { key: "reviewAgentStatus", text: `${issue} is in review, but current participant agent is paused.`, status: "paused" },
  { key: "reviewAgentMissing", text: `${issue} is in review, but current participant agent cannot be resolved.` },
  { key: "reviewParticipantMissing", text: `${issue} is in review, but its current participant cannot be resolved.` },
  { key: "reviewNoPath", text: `${issue} is in review with an agent assignee but no participant, interaction, approval, user owner, wake, active run, or recovery issue owning the next action.` },
  { key: "cancelledBlocker", text: `${issue} is still blocked by cancelled issue ${blocker}.`, blocker },
  { key: "backlogBlocker", text: `${issue} is blocked by assigned backlog issue ${blocker} with no wake, active run, human owner, interaction, approval, monitor, or recovery issue owning the next action.`, blocker },
  { key: "unassignedBlocker", text: `${issue} is blocked by unassigned issue ${blocker} with no user owner.`, blocker },
  { key: "missingAssignee", text: `${issue} is blocked by ${blocker}, but its assignee no longer exists.`, blocker },
  { key: "assigneeStatus", text: `${issue} is blocked by ${blocker}, but its assignee is terminated.`, blocker, status: "terminated" },
];

afterEach(async () => { await i18n.changeLanguage("en"); });

describe("stable recovery preview display", () => {
  it.each(reasons)("recognizes finite server reason $key without changing raw identifiers or English", async (reason) => {
    const before = JSON.stringify(reason);
    for (const language of ["ru", "en", "ru"]) {
      await i18n.changeLanguage(language);
      const display = recoveryPreviewReasonDisplay(reason.text);
      if (language === "en") expect(display).toBe(reason.text);
      else {
        expect(display).toBe(i18n.t(`stableRecovery.reason.${reason.key}`, {
          issue, blocker: reason.blocker,
          status: reason.status ? i18n.t(`status.${reason.status}`) : undefined,
        }));
        expect(display).toMatch(/[а-яё]/i);
        expect(display).not.toContain("stableRecovery");
      }
      expect(display).toContain(issue);
      if (reason.blocker) expect(display).toContain(blocker);
      expect(JSON.stringify(reason)).toBe(before);
    }
  });

  it.each(["in an invalid org chain", "vendor_status_raw"])("handles status %s only in display values", async (status) => {
    const reason = `${issue} is blocked by ${blocker}, but its assignee is ${status}.`;
    await i18n.changeLanguage("ru");
    const display = recoveryPreviewReasonDisplay(reason);
    expect(display).toContain(status === "in an invalid org chain" ? i18n.t("stableRecovery.invalidOrgChain") : status);
    expect(display).toContain(issue);
    expect(display).toContain(blocker);
    await i18n.changeLanguage("en");
    expect(recoveryPreviewReasonDisplay(reason)).toBe(reason);
  });

  it.each([
    "Keep provider diagnostic and raw_id unchanged.",
    `${issue} is still blocked by cancelled issue ${blocker}`,
    `${issue} is still blocked by cancelled issue ${blocker}.\nKeep provider text`,
    `${issue} is in review, but current participant agent might be paused.`,
  ])("passes unknown diagnostics through unchanged: %s", async (reason) => {
    for (const language of ["ru", "en", "ru"]) {
      await i18n.changeLanguage(language);
      expect(recoveryPreviewReasonDisplay(reason)).toBe(reason);
      expect(recoveryPreviewErrorDisplay(reason)).toBe(reason);
    }
  });

  it.each([
    "blocked_by_unassigned_issue", "blocked_by_assigned_backlog_issue", "blocked_by_uninvokable_assignee",
    "blocked_by_cancelled_issue", "invalid_review_participant", "in_review_without_action_path",
  ])("localizes known state %s and preserves stable English humanization", async (state) => {
    for (const language of ["ru", "en", "ru"]) {
      await i18n.changeLanguage(language);
      expect(recoveryPreviewStateDisplay(state)).toBe(language === "en" ? state.replace(/_/g, " ") : i18n.t(`localizationIssueLists.blocked_${state}`));
    }
  });

  it.each([
    ["Lookback hours must be a whole number from 1 to 720.", "invalidHours"],
    ["Failed to preview recovery tasks.", "previewFailed"],
    ["Failed to create recovery tasks.", "createFailed"],
  ])("localizes fixed error %s and restores its exact English text", async (error, key) => {
    for (const language of ["ru", "en", "ru"]) {
      await i18n.changeLanguage(language);
      expect(recoveryPreviewErrorDisplay(error)).toBe(language === "en" ? error : i18n.t(`stableRecovery.${key}`));
    }
  });
});
