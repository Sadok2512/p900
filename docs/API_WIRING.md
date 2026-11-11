# POLARIS UI — API wiring 0.9.0

## Deployment contract

Serve the UI and lab proxy from the **same origin**. Set `VITE_POLARIS_API_BASE=/api/v1` and `VITE_FEATURE_TRAFFIC=false` at build time. Absolute and protocol-relative bases are rejected. Requests send existing same-origin cookies; there is no browser API key or token. The proxy/backend must enforce permissions. No new server or database is provisioned by this UI change.

REST JSON uses `{ data, meta }`. Unknown fields are tolerated; missing fields remain `—`. Data shapes below are adapter assumptions, not verified lab schemas: no OpenAPI or live lab response was supplied. Collections accept arrays or named collection keys. Event order is preserved, never sorted by timestamp.

**Demo policy:** the brief both asks for automatic preview fallback and requires no data with Demo off. The stricter acceptance rule wins: Demo is explicit, off on each new page load, shared by screens, and never substitutes for failed requests without user activation. No demo role is invented. Forbidden identity fields are redacted before entering the Query cache.

## Screen mapping

All endpoint paths below are relative to `/api/v1`. “Branché” means code and simulated-response tests, not confirmed against the lab.

| Écran | Endpoint | Champs utilisés | État |
|---|---|---|---|
| En-tête / rôle | GET `/auth/me` | `role` viewer/operator/administrator | Branché, lecture seule, fail-closed |
| En-tête / état | GET `/health` | `status`, `capture_state`, `coordination_open` | Branché |
| Pied de page / Paramètres | GET `/version`, `/health` | `version`, `decoder_version` | Branché; UI version from package.json |
| Accueil | GET `/health`, `/metrics`, `/storage/safety` | `capture_state`, `pending_segments`, `segments_ingested`, `ingestion_failures`, `open_segments`, `zero_event_segments`, `free_percent` | Branché; recent activity empty outside demo (no endpoint) |
| Analyzer sessions | GET `/sessions` | `id`, `capture_id`, `seq`, `event_id`, `ue_id`/`pseudonym`, `technology`, `status`, `procedure`, `cause`, `cell`, `exact_links`, `completeness`, `duration_ms`; meta accepted | Partiel: first 100 rows, no server pagination UI; hook accepts all documented query parameters |
| Exécuter une requête | POST `/sessions/filter` | equality fields `message`, `cause`, `interface`, `pseudonym`, optional `dataset_id` | Partiel: AND/equality only; OR, inequality, duplicate fields, grouping and non-Parcourir templates rejected explicitly |
| Causes / portée | GET `/sessions/available_causes`, `/datasets` | cause strings or `cause`/`code`; dataset `id` | Branché in query editor; dataset labels currently IDs |
| Session | GET `/sessions/:id` | same session fields | Branché |
| Ladder / messages / procédures | GET `/sessions/:id/callflow`, `/events`, `/procedures` | callflow `nodes`, `events` or `messages`; event `event_id`/`id`, `seq`, `interface`, `message`/`name`, `source`, `destination`, `cause`; procedure `start_event_id`, `end_event_id`, `name` | Partiel: callflow preferred, events fallback, canonical order preserved; schemas need lab validation |
| Corrélations | GET `/sessions/:id/correlations` | `status` EXACT/OUVERT, `matched_rules`, `source_event_id`, `target_event_id`, `source_interface`, `target_interface`, `key` | Branché; unrecognized statuses omitted |
| Inspecteur | GET `/events/:id`, `/events/:id/provenance` | `decoded`, `capture_id`, `seq`, `packet_number`, `event_id` | Branché; identity-bearing decoding fields masked; no synthetic packet numbers |
| Preuves / paquets | GET `/packets?capture_id&packet_number`, `/correlation/rules` | packet collection, rule collection | Partiel: list/count/rule references; no packet-detail UI |
| Export ladder | GET `/exports/callflow/:id` | binary/download response | Branché as same-origin download; not exercised against lab |
| PCAP | GET `/captures/:id/download` | binary/download response | Partiel: operator-only + confirmation, entire capture endpoint; extraction range not defined by supplied contract |
| Nœuds / Probe Manager | GET `/probes`, `/probes/:id`, `/probes/:id/interfaces`, `/interfaces` | `id`, `name`, `role`, `status`, `version`, `cpu_percent`, `memory_used_gb`, `memory_total_gb`, `disk_percent`, `last_seen`, interface `name` | Branché; missing resource measurements stay — |
| Capture / modules | GET `/captures`, `/modules` | `id`, `name`, `status` | Partiel: resource lists; dedicated metrics/detail hooks available |
| Actions capture | POST `/captures/start`, `/captures/validate`, `/captures/:id/stop` | `target`, capture `id` | Partiel: operator-only, confirmation, disabled unless `/health.coordination_open === true`; actual coordination schema unverified |
| Santé sonde KPI | GET `/metrics`, `/storage/safety` | `dumpcap_active/expected`, `import_lag_seconds`, `segments_dropped`, `free_percent` or `free_bytes/total_bytes` | Partiel: values only when present; zero_event_segments is **not** treated as dropped segments; no invented historical series |
| KPI Builder / Dashboards / Anomalies | No current endpoint | existing demo-only local definitions | Non disponible outside Demo |
| Live / IMSI | No current endpoint | pseudonym-only demo generator | Non disponible; IMSI/GUTI search disabled even in Demo |
| Templates / saved queries | Local browser storage | names, template, conditions, scope | Local à ce navigateur; no backend publication or sharing claim |
| Traffic | No N6 source | existing demo implementation isolated in adapter | Hidden by default and gated by feature flag + Demo |
| UE / UE sessions | GET `/ues`, `/ues/:id`, `/ues/:id/sessions` | tolerant records | Partiel: resource hooks supplied, no dedicated UE view wired |
| Dataset / LTE run sessions | GET `/datasets/:id/sessions`, `/lte/evidence/:run_id/sessions` | session collection | Partiel: hooks supplied; editor currently uses dataset_id filter |
| Packet detail / capture metrics | GET `/packets/:id`, `/captures/:id/metrics` | packet record, metrics | Partiel: hooks supplied, no detail UI |
| Password / deployments / add node | No current endpoint | none | Non disponible; no fake successful password change |

## Verification

Vitest: typed client envelope, 403/network/invalid responses, relative-only base, identity redaction, demo separation, missing values, order, exact/open links, health calculations, capture permissions and supported filter scope; main-screen fetch mocks. Browser checks cover disconnected pages and simulated sessions/provenance, plus explicit Demo. The lab reverse proxy, real schemas, downloads and capture side effects remain unverified. Do not enable capture coordination until the proxy authorizes it.
