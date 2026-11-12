export type TopBarLiveState = "live" | "blocked" | "delayed" | "offline" | "demo";

export type TopBarLiveIndicator = {
  state: TopBarLiveState;
  label: "LIVE" | "BLOQUÉ" | "RETARD" | "HORS LIGNE" | "DÉMO";
  color: "#4ADE80" | "#F87171" | "#E9B949" | "#A8BCCF";
  pulse: boolean;
};

type LiveIndicatorInput = {
  demo: boolean;
  apiReachable: boolean;
  captureState?: string;
  pendingHistory?: readonly number[];
};

const OFFLINE: TopBarLiveIndicator = {
  state: "offline",
  label: "HORS LIGNE",
  color: "#A8BCCF",
  pulse: false,
};

export function pendingGrewForThreePolls(history: readonly number[] = []): boolean {
  const recent = history.slice(-4);
  if (recent.length !== 4) return false;
  return recent.every((value, index) => index === 0 || value > (recent[index - 1] ?? value));
}

export function topBarLiveIndicator({
  demo,
  apiReachable,
  captureState,
  pendingHistory = [],
}: LiveIndicatorInput): TopBarLiveIndicator {
  if (demo) return { state: "demo", label: "DÉMO", color: "#A8BCCF", pulse: false };
  if (!apiReachable) return OFFLINE;
  if (captureState === "BLOCKED")
    return { state: "blocked", label: "BLOQUÉ", color: "#F87171", pulse: false };
  if (pendingGrewForThreePolls(pendingHistory))
    return { state: "delayed", label: "RETARD", color: "#E9B949", pulse: false };
  if (captureState === "CAPTURING")
    return { state: "live", label: "LIVE", color: "#4ADE80", pulse: true };
  return OFFLINE;
}
