import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useCaptures,
  useInterfaceMutation,
  useInterfaceRuntime,
  useInterfaces,
  useLiveMetrics,
  useProbeInterfaces,
  records,
  available,
} from "@/lib/polaris-api";
import {
  ActivitySparkline,
  BpfFilterDisplay,
  CaptureStatus,
  InterfaceBadge,
  TechnicalValue,
  TrafficStatus,
} from "../ui/InterfaceBadge";
import { bytesPerSecond, hasMetric, packetsPerSecond } from "@/lib/polaris-ui/interfaceColors";

const bytes = (value) =>
  typeof value !== "number"
    ? "—"
    : value >= 1024 ** 3
      ? `${(value / 1024 ** 3).toFixed(1)} GiB`
      : value >= 1024 ** 2
        ? `${(value / 1024 ** 2).toFixed(1)} MiB`
        : value >= 1024
          ? `${(value / 1024).toFixed(1)} KiB`
          : `${value} B`;
const ago = (value) => {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "—";
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)} h`;
};
const ifaceName = (value) => String(value?.interface ?? value?.name ?? "—");
const isActive = (value) =>
  ["active", "running", "capturing", "ingesting"].includes(String(value ?? "").toLowerCase());

function InterfaceDialog({ mode, row, onClose }) {
  const mutation = useInterfaceMutation();
  const original = ifaceName(row);
  const [form, setForm] = useState({
    name: mode === "add" ? "" : original,
    device: String(row?.device ?? row?.bridge ?? ""),
    bpf_filter: String(row?.bpf_filter ?? row?.filter ?? ""),
    protocol: String(row?.protocol ?? ""),
  });
  const [confirm, setConfirm] = useState(""),
    [error, setError] = useState("");
  const set = (key) => (event) => setForm((x) => ({ ...x, [key]: event.target.value }));
  const typed = mode === "add" || confirm === original;
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await mutation.mutateAsync({
        action: mode === "add" ? "add" : "update",
        name: mode === "add" ? undefined : original,
        body: { ...form, confirmation: mode === "add" ? undefined : confirm },
      });
      onClose();
    } catch (e) {
      setError(`${e.message}${e.status ? ` · HTTP ${e.status}` : ""}`);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <form onSubmit={submit} className="bg-white rounded-xl border w-full max-w-lg p-5 space-y-3">
        <h2 className="font-semibold">
          {mode === "add" ? "Ajouter une interface" : `Modifier ${original}`}
        </h2>
        {mode !== "add" && (
          <p className="text-[12px] text-warning">
            Cette action redémarre uniquement le dumpcap <b>{original}</b>. Une sauvegarde est créée
            avant modification.
          </p>
        )}
        {[
          ["name", "Nom logique (N2, S1-MME, IMS…)"],
          ["device", "Bridge ou NIC"],
          ["bpf_filter", "Filtre BPF"],
          ["protocol", "Protocole attendu"],
        ].map(([key, label]) => (
          <label key={key} className="block text-[12px]">
            <span className="text-muted-foreground">{label}</span>
            <input
              required
              value={form[key]}
              onChange={set(key)}
              disabled={mode !== "add" && key === "name"}
              className="w-full h-9 border rounded-md px-3 mt-1"
            />
          </label>
        ))}
        {mode !== "add" && (
          <label className="block text-[12px]">
            <span className="text-muted-foreground">Tapez {original} pour confirmer</span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-9 border rounded-md px-3 mt-1 font-mono"
            />
          </label>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-md border border-border bg-surface-2 p-2 text-[12px] text-muted-foreground"
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 border rounded-md">
            Annuler
          </button>
          <button
            disabled={!typed || mutation.isPending}
            className="h-9 px-4 rounded-md bg-[var(--app-accent)] text-white disabled:opacity-50"
          >
            {mutation.isPending ? "Application…" : "Confirmer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteDialog({ row, onClose }) {
  const mutation = useInterfaceMutation(),
    name = ifaceName(row);
  const [confirm, setConfirm] = useState(""),
    [error, setError] = useState("");
  const remove = async () => {
    setError("");
    try {
      await mutation.mutateAsync({
        action: "delete",
        name,
        body: { confirmation: confirm, preserve_segments: true },
      });
      onClose();
    } catch (e) {
      setError(`${e.message}${e.status ? ` · HTTP ${e.status}` : ""}`);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl border w-full max-w-md p-5 space-y-3">
        <h2 className="font-semibold">Supprimer {name}</h2>
        <p className="text-[12px] text-muted-foreground">
          Le dumpcap dédié sera arrêté. Les segments déjà capturés ne seront pas supprimés.
        </p>
        <label className="block text-[12px]">
          Tapez {name}
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full h-9 border rounded-md px-3 mt-1 font-mono"
          />
        </label>
        {error && (
          <div role="alert" className="text-[12px] text-muted-foreground">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 border rounded-md">
            Annuler
          </button>
          <button
            onClick={remove}
            disabled={confirm !== name || mutation.isPending}
            className="h-9 px-4 rounded-md bg-danger text-white disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiveCapture({ probe }) {
  const probeId = probe?.id ?? (probe?.n ? String(probe.n) : null);
  const interfacesQ = useInterfaces(),
    probeIfacesQ = useProbeInterfaces(probeId ?? null),
    runtimeQ = useInterfaceRuntime(),
    capturesQ = useCaptures(),
    metricsQ = useLiveMetrics(),
    mutation = useInterfaceMutation();
  const [dialog, setDialog] = useState(null),
    [feedback, setFeedback] = useState("");
  const samples = useRef({});
  const [, render] = useState(0);
  const scoped = records(probeIfacesQ.data?.data, "interfaces");
  const globalIfaces = records(interfacesQ.data?.data, "interfaces");
  const configured = [
    ...new Map(
      [...globalIfaces, ...scoped].map((x) => [
        ifaceName(x),
        { ...(globalIfaces.find((g) => ifaceName(g) === ifaceName(x)) ?? {}), ...x },
      ]),
    ).values(),
  ];
  const runtimeAll = records(runtimeQ.data?.data, "interfaces");
  const runtime = runtimeAll;
  const captures = records(capturesQ.data?.data, "captures"),
    metrics = metricsQ.data?.data ?? {};
  const rows = useMemo(() => {
    const names = [...new Set([...configured, ...runtime].map(ifaceName))];
    return names.map((name) => {
      const base = configured.find((x) => ifaceName(x) === name) ?? {},
        run = runtime.find((x) => ifaceName(x) === name) ?? {},
        live =
          (metrics.interfaces ?? []).find((x) =>
            [x.interface, x.name, x.capture_interface].some(
              (value) => String(value ?? "").toUpperCase() === name.toUpperCase(),
            ),
          ) ?? {},
        capture =
          captures.find(
            (x) =>
              Array.isArray(x.interfaces) &&
              x.interfaces.includes(name) &&
              ["CAPTURING", "STARTING", "STOPPING"].includes(String(x.state)),
          ) ?? {};
      return {
        ...base,
        ...run,
        name,
        packet_rate_pps: run.packet_rate_pps ?? live.packet_rate_pps,
        bytes_per_second: run.bytes_per_second ?? live.bytes_per_second,
        pending_segments: run.pending_segments ?? live.pending_segments,
        segments_ingested: run.segments_ingested ?? live.segments_ingested,
        pid: run.pid ?? capture.process_ids?.[name] ?? capture.process_ids?.[0],
        state: run.state ?? capture.state ?? live.state ?? base.status ?? null,
        active: run.active ?? isActive(live.state ?? capture.state ?? base.status),
        started_at: run.started_at ?? capture.started_epoch_ms,
        current_segment: run.current_segment ?? live.current_segment,
        last_rotation: run.last_rotation ?? live.last_rotation,
        bpf_filter: run.bpf_filter ?? base.bpf_filter ?? base.filter,
        device: run.device ?? base.device ?? base.capture_point,
      };
    });
  }, [configured, runtime, captures, metrics]);
  // Only real readings feed the 15-min curve: a missing measure never becomes a zero.
  useEffect(() => {
    const stamp = metricsQ.dataUpdatedAt;
    if (!stamp) return;
    for (const row of rows) {
      if (!hasMetric(row.packet_rate_pps)) continue;
      const key = row.name;
      samples.current[key] = [...(samples.current[key] ?? []), Number(row.packet_rate_pps)].slice(
        -180,
      );
    }
    render((x) => x + 1);
  }, [metricsQ.dataUpdatedAt]);
  const rollback = async (row) => {
    setFeedback("");
    try {
      await mutation.mutateAsync({ action: "rollback", name: row.name, body: {} });
      setFeedback(`Configuration ${row.name} restaurée.`);
    } catch (e) {
      setFeedback(`${e.message}${e.status ? ` · HTTP ${e.status}` : ""}`);
    }
  };
  return (
    <section
      className="mt-5 rounded-lg border border-border bg-white overflow-hidden"
      data-testid="live-capture-admin"
    >
      <header className="px-4 py-3 border-b flex items-center gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">Capture live · interfaces</h2>
          <p className="text-[11.5px] text-subtle">
            Même source `/metrics` que la pastille LIVE · actualisation 5 s · courbes 15 min ·{" "}
            {scoped.length
              ? `interfaces de la sonde (${available(probeId)})`
              : "interfaces de la plateforme"}
          </p>
        </div>
        <button
          onClick={() => setDialog({ mode: "add" })}
          className="ml-auto h-8 px-3 rounded-md bg-[var(--app-accent)] text-white text-[12px]"
        >
          Ajouter une interface
        </button>
      </header>
      {runtimeQ.isError && (
        <div className="px-4 py-2 text-[11.5px] text-warning bg-warning-soft">
          Télémétrie dumpcap détaillée indisponible : GET /api/v1/interfaces/runtime →{" "}
          {runtimeQ.error.status ? `HTTP ${runtimeQ.error.status}` : "réseau"}. Les champs existants
          restent affichés.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr>
              {[
                "Interface",
                "dumpcap",
                "Débit",
                "Segment courant",
                "Rotation / attente",
                "BPF · source",
                "15 min",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="h-9 px-3 text-left bg-surface-2 border-b text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const pending = Number(row.pending_segments ?? 0);
              return (
                <tr key={row.name} className="hover:bg-surface-2">
                  <td className="px-3 py-3 border-b align-top">
                    <InterfaceBadge name={row.name} />
                    <div className="mt-1 text-[11px] text-subtle">{available(row.protocol)}</div>
                  </td>
                  <td className="px-3 border-b align-top">
                    <CaptureStatus row={row} />
                    <div className="mt-0.5 font-mono text-[11px] text-subtle">
                      PID {available(row.pid)} · uptime {ago(row.started_at)}
                    </div>
                    <TrafficStatus
                      packetRate={row.packet_rate_pps}
                      bytesPerSecond={row.bytes_per_second}
                    />
                  </td>
                  <td className="px-3 border-b align-top">
                    <div className="font-mono text-[11.5px] tabular-nums">
                      {packetsPerSecond(row.packet_rate_pps)}
                    </div>
                    <div className="font-mono text-[11.5px] tabular-nums text-muted-foreground">
                      {bytesPerSecond(row.bytes_per_second)}
                    </div>
                  </td>
                  <td className="px-3 border-b align-top">
                    {row.current_segment ? (
                      <>
                        <TechnicalValue
                          value={row.current_segment.name ?? row.current_segment.path}
                          width="max-w-[170px]"
                        />
                        <div className="text-[11px] text-subtle">
                          {bytes(row.current_segment.size_bytes)} · âge{" "}
                          {ago(row.current_segment.modified_at)}
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] text-faint">segment non disponible</span>
                    )}
                  </td>
                  <td className="px-3 border-b align-top">
                    <div className="text-[11.5px]">rotation {ago(row.last_rotation)}</div>
                    <div className={`text-[11px] ${pending > 0 ? "text-warning" : "text-subtle"}`}>
                      {available(row.pending_segments)} fermé(s) non ingéré(s)
                      {pending > 0 ? " · retard d’ingestion" : ""}
                    </div>
                  </td>
                  <td className="px-3 border-b align-top">
                    <BpfFilterDisplay filter={row.bpf_filter} width="max-w-[180px]" />
                    <div className="mt-1">
                      <TechnicalValue value={row.device} width="max-w-[180px]" />
                    </div>
                  </td>
                  <td className="px-3 border-b align-top">
                    <ActivitySparkline values={samples.current[row.name] ?? []} />
                  </td>
                  <td className="px-3 border-b align-top">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setDialog({ mode: "edit", row })}
                        className="h-7 px-2 border rounded"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDialog({ mode: "delete", row })}
                        className="h-7 px-2 border rounded text-danger"
                      >
                        Supprimer
                      </button>
                      <button onClick={() => rollback(row)} className="h-7 px-2 border rounded">
                        Rollback
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="p-4 text-[12px] text-subtle">
          Aucune interface renvoyée par `/interfaces`.
        </div>
      )}
      <div className="px-4 py-2 border-t text-[11px] text-subtle">
        « dumpcap » = état du processus de capture ; « trafic » = paquets réellement vus. Un
        processus actif ne prouve pas que du trafic est capturé, et un débit à « — » signifie
        métrique indisponible, pas zéro paquet.
      </div>
      {feedback && <div className="px-4 py-2 text-[12px] border-t">{feedback}</div>}
      {dialog?.mode === "add" && (
        <InterfaceDialog mode="add" onClose={() => setDialog(null)} />
      )}{" "}
      {dialog?.mode === "edit" && (
        <InterfaceDialog mode="edit" row={dialog.row} onClose={() => setDialog(null)} />
      )}{" "}
      {dialog?.mode === "delete" && (
        <DeleteDialog row={dialog.row} onClose={() => setDialog(null)} />
      )}{" "}
    </section>
  );
}
