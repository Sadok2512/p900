import { describe, expect, it } from "vitest";
import { decideLiveMessage, liveMessageKey, upsertLiveMessage } from "./live-message-dedup";

describe("live-message-dedup", () => {
  it("keeps NAS and NGAP events carried by the same capture packet", () => {
    const delivered = new Map<string, number>();
    const ngap = { stable_event_key: "ngap:cap:7", capture_id: "cap", packet_number: 7 };
    const nas = { stable_event_key: "nas:cap:7", capture_id: "cap", packet_number: 7 };
    expect(decideLiveMessage(delivered, ngap).action).toBe("append");
    expect(decideLiveMessage(delivered, nas).action).toBe("append");
    expect(delivered.size).toBe(2);
  });

  it("replaces a stable event in place only with a higher revision", () => {
    const delivered = new Map<string, number>();
    const first = decideLiveMessage(delivered, { stable_event_key: "rtp:1", revision: 0 });
    const initial = upsertLiveMessage([], { liveKey: first.key, name: "RTP rev0" }, "append", 20);
    const other = decideLiveMessage(delivered, { stable_event_key: "sip:2", revision: 0 });
    const ordered = upsertLiveMessage(initial, { liveKey: other.key, name: "SIP" }, "append", 20);
    const update = decideLiveMessage(delivered, { stable_event_key: "rtp:1", revision: 1 });
    const revised = upsertLiveMessage(
      ordered,
      { liveKey: update.key, name: "RTP rev1" },
      "replace",
      20,
    );
    expect(update.action).toBe("replace");
    expect(revised.map((row) => row.name)).toEqual(["RTP rev1", "SIP"]);
    expect(decideLiveMessage(delivered, { stable_event_key: "rtp:1", revision: 1 }).action).toBe(
      "ignore",
    );
    expect(decideLiveMessage(delivered, { stable_event_key: "rtp:1", revision: 0 }).action).toBe(
      "ignore",
    );
  });

  it("falls back to event_id and retains messages which have no contract key", () => {
    const delivered = new Map<string, number>();
    expect(liveMessageKey({ stable_event_key: " ", event_id: "event-3" })).toBe("event-3");
    expect(decideLiveMessage(delivered, { event_id: "event-3" }).action).toBe("append");
    expect(decideLiveMessage(delivered, { event_id: "event-3" }).action).toBe("ignore");
    expect(decideLiveMessage(delivered, { capture_id: "cap", packet_number: 7 }).action).toBe(
      "append",
    );
    expect(decideLiveMessage(delivered, { capture_id: "cap", packet_number: 7 }).action).toBe(
      "append",
    );
  });
});
