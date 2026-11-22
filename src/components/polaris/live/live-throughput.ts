export type LiveThroughputPayload = {
  second?: number;
  dl_bytes_s?: number;
  ul_bytes_s?: number;
};

export type LiveThroughputPoint = {
  ts: number;
  dl: number;
  ul: number;
};

const LIVE_THROUGHPUT_WINDOW_MS = 30 * 60 * 1_000;

export function liveThroughputPoint(data: LiveThroughputPayload): LiveThroughputPoint | null {
  const second = Number(data.second);
  if (!Number.isSafeInteger(second) || second < 0) return null;
  return {
    ts: second * 1_000,
    dl: (Number(data.dl_bytes_s || 0) * 8) / 1e6,
    ul: (Number(data.ul_bytes_s || 0) * 8) / 1e6,
  };
}

export function appendLiveThroughputPoint(
  points: LiveThroughputPoint[],
  point: LiveThroughputPoint,
): LiveThroughputPoint[] {
  const merged = [...points, point];
  const newestBucket = Math.max(...merged.map((candidate) => candidate.ts));
  return merged.filter((candidate) => newestBucket - candidate.ts < LIVE_THROUGHPUT_WINDOW_MS);
}
