import { describe, expect, it } from "vitest";
import { topBarLiveIndicator } from "./live-status";

describe("top bar live indicator", () => {
  it.each([
    [
      "CAPTURING devient LIVE",
      { demo: false, apiReachable: true, captureState: "CAPTURING", pendingHistory: [4, 4, 3, 3] },
      "live",
      "LIVE",
      true,
    ],
    [
      "BLOCKED devient BLOQUÉ",
      { demo: false, apiReachable: true, captureState: "BLOCKED", pendingHistory: [4, 4, 4, 4] },
      "blocked",
      "BLOQUÉ",
      false,
    ],
    [
      "trois hausses deviennent RETARD",
      { demo: false, apiReachable: true, captureState: "CAPTURING", pendingHistory: [4, 5, 6, 7] },
      "delayed",
      "RETARD",
      false,
    ],
    [
      "API en échec devient HORS LIGNE",
      { demo: false, apiReachable: false, captureState: "CAPTURING", pendingHistory: [] },
      "offline",
      "HORS LIGNE",
      false,
    ],
    [
      "Démo reste grise et ne devient jamais LIVE",
      { demo: true, apiReachable: true, captureState: "CAPTURING", pendingHistory: [4, 4, 4, 4] },
      "demo",
      "DÉMO",
      false,
    ],
  ] as const)("%s", (_name, input, state, label, pulse) => {
    expect(topBarLiveIndicator(input)).toMatchObject({
      state,
      label,
      pulse,
      color:
        state === "live"
          ? "#4ADE80"
          : state === "blocked"
            ? "#F87171"
            : state === "delayed"
              ? "#E9B949"
              : "#A8BCCF",
    });
  });
});
