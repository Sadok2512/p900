export type LiveMessageDedupAction = "append" | "replace" | "ignore";

export type LiveMessageDecision = {
  action: LiveMessageDedupAction;
  key: string | null;
  revision: number;
};

const nonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const liveMessageKey = (message: Record<string, unknown>): string | null =>
  nonEmptyString(message.stable_event_key) ?? nonEmptyString(message.event_id);

export const liveMessageRevision = (message: Record<string, unknown>): number => {
  const revision = Number(message.revision ?? 0);
  return Number.isFinite(revision) ? revision : 0;
};

export const decideLiveMessage = (
  deliveredRevisions: Map<string, number>,
  message: Record<string, unknown>,
): LiveMessageDecision => {
  const key = liveMessageKey(message);
  const revision = liveMessageRevision(message);
  if (key === null) return { action: "append", key, revision };

  const deliveredRevision = deliveredRevisions.get(key);
  if (deliveredRevision === undefined) {
    deliveredRevisions.set(key, revision);
    return { action: "append", key, revision };
  }
  if (revision > deliveredRevision) {
    // Refresh insertion order so pruning retains a just-revised old event.
    deliveredRevisions.delete(key);
    deliveredRevisions.set(key, revision);
    return { action: "replace", key, revision };
  }
  return { action: "ignore", key, revision };
};

export const upsertLiveMessage = <T extends { liveKey: string | null }>(
  rows: T[],
  message: T,
  action: Exclude<LiveMessageDedupAction, "ignore">,
  limit: number,
): T[] => {
  if (action === "replace" && message.liveKey !== null) {
    const index = rows.findIndex((row) => row.liveKey === message.liveKey);
    if (index >= 0) {
      const next = rows.slice();
      next[index] = message;
      return next;
    }
  }
  return [...rows, message].slice(-limit);
};
