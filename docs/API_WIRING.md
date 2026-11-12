# POLARIS UI — API wiring 0.9.1

## Deployment contract

Serve the UI and lab proxy from the **same origin**. Set `VITE_POLARIS_API_BASE=/api/v1` and `VITE_FEATURE_TRAFFIC=false` at build time. Absolute and protocol-relative bases are rejected. Requests send existing same-origin cookies; there is no browser API key or token. The proxy/backend must enforce permissions. No new server or database is provisioned by this UI change.

REST JSON uses `{ data, meta }`. Unknown fields are tolerated; missing fields remain `—`. The session, event, correlation and version names below match the API response observed by ANR1. Collections accept arrays or named collection keys. Event order is preserved exactly as returned and is never sorted by timestamp.

**Demo policy:** the brief both asks for automatic preview fallback and requires no data with Demo off. The stricter acceptance rule wins: Demo is explicit, off on each new page load, shared by screens, and never substitutes for failed requests without user activation. No demo role is invented. Forbidden identity fields are redacted before entering the Query cache.

## Screen mapping

All endpoint paths below are relative to `/api/v1`. “Branché” means code and simulated-response tests, not confirmed against the lab.

| Écran | Endpoint | Champs utilisés | État |
|---|---|---|---|
| En-tête / rôle | GET `/auth/me` | `role` viewer/operator/administrator | Branché, lecture seule, fail-closed |
| En-tête / état | GET `/health` | `status`, `capture_state`, `coordination_open` | Branché |
| Pied de page / Paramètres | GET `/version` | `backend_api`, `web_frontend`, `platform_core`, `session_engine`, `correlation_engine`, `event_schema`, `callflow_schema`, `decoders` | Branché; UI version from package.json |
| Accueil | GET `/health`, `/metrics`, `/storage/safety` | `capture_state`, `pending_segments`, `segments_ingested`, `ingestion_failures`, `open_segments`, `zero_event_segments`, `free_percent` | Branché; recent activity empty outside demo (no endpoint) |
| Analyzer sessions | GET `/sessions` | `session_id`, `anchor_capture_id`, `first_packet_number`, `ue_pseudonym`, `technology`, `state`, `procedure`, `decode_completeness`, `interfaces`, `correlation_status`; autres champs conservés | Partiel: first 100 rows, no server pagination UI; capture·seq = `anchor_capture_id`·`first_packet_number`, avec repli temporaire sur le premier événement du callflow dans l'ordre API; une ligne sans `session_id` affiche « identifiant absent » et ne déclenche aucune requête détail |
| Exécuter une requête | POST `/sessions/filter` | equality fields `message`, `cause`, `interface`, `pseudonym`, optional `dataset_id` | Partiel: AND/equality only; OR, inequality, duplicate fields, grouping and non-Parcourir templates rejected explicitly |
| Causes / portée | GET `/sessions/available_causes`, `/datasets` | cause strings or `cause`/`code`; dataset `id` | Branché in query editor; dataset labels currently IDs |
| Session | GET `/sessions/:id` | mêmes champs, identifiant exclusivement `session_id` | Branché; un échec détail affiche l'endpoint et son statut HTTP |
| Ladder / messages / procédures | GET `/sessions/:id/callflow`, `/events`, `/procedures` | `event_id`, `interface`, `protocol`, `message_name`, `source_participant`, `destination_participant`, `direction`, `decoding_status`, `semantic_status`, `procedure_group`, `capture_id`, `packet_references[].packet_number`, `decoded_ie_tree`, `errors[]` | Branché; callflow preferred, events fallback, ordre API strictement préservé |
| Corrélations | GET `/sessions/:id/correlations` | `edges[]`: `edge_id`, événements/interfaces source et cible, `matching_identifiers`, `rule_id`, `rule_version`, `matched_rules`, description/type de preuve, `confidence`, `scope`, `limitations`, références paquet | Branché; `confidence`/`evidence_type` deviennent EXACT ou OUVERT, les autres valeurs sont omises |
| Inspecteur | GET `/events/:id`, `/events/:id/provenance` | `decoded`, `capture_id`, `seq`, `packet_number`, `event_id` | Branché; identity-bearing decoding fields masked; no synthetic packet numbers |
| Preuves / paquets | GET `/packets?capture_id&packet_number`, `/correlation/rules` | packet collection, rule collection | Partiel: list/count/rule references; no packet-detail UI |
| Export ladder | GET `/exports/callflow/:id` | binary/download response | Branché as same-origin download; not exercised against lab |
| PCAP | GET `/captures/:id/download` | binary/download response | Partiel: operator-only + confirmation, entire capture endpoint; extraction range not defined by supplied contract |
| Nœuds / Probe Manager | GET `/probes`, `/probes/:id`, `/probes/:id/interfaces`, `/interfaces` | `id`, `name`, `role`, `status`, `version`, `cpu_percent`, `memory_used_gb`, `memory_total_gb`, `disk_percent`, `last_seen`, interface `name` | Branché; missing resource measurements stay — |
| Capture / modules | GET `/captures`, `/modules` | `id`, `name`, `status` | Partiel: resource lists; dedicated metrics/detail hooks available |
| Actions capture | POST `/captures/start`, `/captures/validate`, `/captures/:id/stop` | `target`, capture `id` | Partiel: operator-only, confirmation, disabled unless `/health.coordination_open === true`; actual coordination schema unverified |
| Santé sonde KPI | GET `/metrics`, `/storage/safety` | `dumpcap_active/expected`, `import_lag_seconds`, `segments_dropped`, `free_percent` or `free_bytes/total_bytes` | Partiel: values only when present; zero_event_segments is **not** treated as dropped segments; no invented historical series |
| KPI Builder / Dashboards / Anomalies | No current endpoint | existing demo-only local definitions | Non disponible outside Demo |
| Identités operator | GET `/sessions/:id/identities`, GET `/identities?q=…` | IMSI, TMSI, S-TMSI, M-TMSI, IMEI/IMEISV, MSISDN et preuves paquet | Branché; champs absents du cache viewer, enveloppe `identity_access=operator` requise pour accepter le clair |
| Dissection complète | GET `/packets/:capture_id/:packet_number/dissect` | sortie `tshark -V` du paquet référencé | Branché, operator uniquement |
| Live / IMSI | No current endpoint | pseudonym-only demo generator | Non disponible; attendu par p900 0.16.0 via SSE |
| Templates / saved queries | Local browser storage | names, template, conditions, scope | Local à ce navigateur; no backend publication or sharing claim |
| Traffic | No N6 source | existing demo implementation isolated in adapter | Hidden by default and gated by feature flag + Demo |
| UE / UE sessions | GET `/ues`, `/ues/:id`, `/ues/:id/sessions` | tolerant records | Partiel: resource hooks supplied, no dedicated UE view wired |
| Dataset / LTE run sessions | GET `/datasets/:id/sessions`, `/lte/evidence/:run_id/sessions` | session collection | Partiel: hooks supplied; editor currently uses dataset_id filter |
| Packet detail / capture metrics | GET `/packets/:id`, `/captures/:id/metrics` | packet record, metrics | Partiel: hooks supplied, no detail UI |
| Password / deployments / add node | No current endpoint | none | Non disponible; no fake successful password change |

## Verification

Vitest: typed client envelope, 403/network/invalid responses, relative-only base, identity redaction, demo separation, missing values, order, exact/open links, health calculations, capture permissions and supported filter scope; main-screen fetch mocks. Browser checks cover disconnected pages and simulated sessions/provenance, plus explicit Demo. The lab reverse proxy, real schemas, downloads and capture side effects remain unverified. Do not enable capture coordination until the proxy authorizes it.

## Champ API → colonne UI

| Champ API session | Colonne / usage UI |
|---|---|
| `session_id` | Identifiant de navigation et requêtes `/sessions/:id/*`; aucune valeur de remplacement |
| `ue_pseudonym` | UE |
| `technology` | RAT |
| `procedure` | Procédure |
| `state` | Résultat |
| `decode_completeness` | Complétude |
| `interfaces[]` | Interfaces |
| `correlation_status` | Liens EXACT |
| `ue_ip` | Jamais affiché au rôle viewer |

Le détail conserve les autres champs réels (`ue_context_id`, `pdu_session_id`, compteurs de messages/événements, `decoded`, `partial`, directions, TEID, nœud servant, bornes temporelles, `observed_epoch_ms`, dataset, provenance, preuve runtime et champs non résolus), avec `—` lorsque la valeur attendue est absente.

Le pied de page affiche exactement `POLARIS <platform_core> · API <backend_api> · UI <package.json>`. Paramètres expose en plus `web_frontend`, les moteurs de session/corrélation, les schémas et chaque entrée de `decoders`.
