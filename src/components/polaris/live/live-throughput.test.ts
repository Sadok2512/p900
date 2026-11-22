import { describe, expect, it } from "vitest";
import { appendLiveThroughputPoint, liveThroughputPoint } from "./live-throughput";

describe("2.8.11 — Live throughput replay timestamps", () => {
  it("uses the payload bucket second instead of the browser receipt time", () => {
    expect(
      liveThroughputPoint({ second: 1_795_213_714, dl_bytes_s: 1_000_000, ul_bytes_s: 250_000 }),
    ).toEqual({
      ts: 1_795_213_714_000,
      dl: 8,
      ul: 2,
    });
  });

  it("keeps replayed historical buckets relative to the newest payload bucket", () => {
    const first = liveThroughputPoint({ second: 1_000, dl_bytes_s: 10 });
    const second = liveThroughputPoint({ second: 1_001, dl_bytes_s: 20 });
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    const points = appendLiveThroughputPoint(appendLiveThroughputPoint([], first!), second!);

    expect(points.map((point) => point.ts)).toEqual([1_000_000, 1_001_000]);
  });

  it("does not invent a receipt timestamp when the bucket second is absent", () => {
    expect(liveThroughputPoint({ dl_bytes_s: 10, ul_bytes_s: 20 })).toBeNull();
  });

  it.each([
    ["null", null],
    ["empty string", ""],
    ["boolean", false],
    ["numeric string", "1795213714"],
    ["negative", -1],
    ["zero", 0],
    ["timestamp multiplication overflow", Math.floor(Number.MAX_SAFE_INTEGER / 1_000) + 1],
  ])("rejects an invalid second payload: %s", (_label, second) => {
    expect(liveThroughputPoint({ second })).toBeNull();
  });
});
