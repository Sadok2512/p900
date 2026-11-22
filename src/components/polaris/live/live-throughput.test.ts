import { describe, expect, it } from "vitest";
import { appendLiveThroughputPoint, liveThroughputPoint } from "./live-throughput";

describe("Live throughput replay timestamps", () => {
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
});
