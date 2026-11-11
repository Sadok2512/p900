export type TopBarLiveState = "live" | "blocked" | "delayed" | "offline" | "demo";

export type TopBarLiveIndicator = {
  state: TopBarLiveState;
  label: "LIVE" | "BLOQUÉ" | "RETARD" | "HORS LIGNE" | "DÉMO";
  color: "#15803D" | "#B42318" | "#A15C07" | "#8F8F8F";
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
  color: "#8F8F8F",
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
  if (demo) return { state: "demo", label: "DÉMO", color: "#8F8F8F", pulse: false };
  if (!apiReachable) return OFFLINE;
  if (captureState === "BLOCKED")
    return { state: "blocked", label: "BLOQUÉ", color: "#B42318", pulse: false };
  if (pendingGrewForThreePolls(pendingHistory))
    return { state: "delayed", label: "RETARD", color: "#A15C07", pulse: false };
  if (captureState === "CAPTURING")
    return { state: "live", label: "LIVE", color: "#15803D", pulse: true };
  return OFFLINE;
}
