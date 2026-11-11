# POLARIS — Contrat d'API `/api/v1` (prompt pour l'agent backend)

> Version longue, destinée à être collée à un agent backend. Vue rapide par écran : `API_WIRING.md`.

## 1. Mission

Exposer au navigateur l'API REST du serveur POLARIS existant sous `/api/v1`, sur la **même origine** que l'interface, pour que l'app lise ses données réelles au lieu de l'état « POLARIS non connecté ».

Aucun nouveau serveur, aucune nouvelle base, aucune refonte de l'interface. Le backend existant doit seulement être atteignable derrière le proxy.

## 2. Contraintes non négociables

1. **Même origine** : l'UI est servie sur le même host que `/api/v1`. Base configurable par `VITE_POLARIS_API_BASE`, `/api/v1` par défaut. Bases absolues (`https://…`) et protocol-relatives (`//…`) rejetées par le client.
2. **Authentification par cookie de session** : `credentials: 'same-origin'`. Jamais d'en-tête `Authorization`, ni clé d'API, ni token en query. Le proxy résout le rôle depuis le cookie existant.
3. **Enveloppe obligatoire** : `{ "data": ..., "meta": ... }`. Une réponse JSON sans clé `data` est une panne, même en HTTP 200.
4. **Délai** : abandon client après **8 secondes**.
5. **Aucune valeur inventée** : champ absent → `—`.
6. **Identités interdites au navigateur** : `imsi`, `supi`, `suci`, `guti`, `tmsi`, `imei`, `msisdn`, `password`, `token`, `secret`, `k`, `opc`, et toute chaîne de 14 à 16 chiffres. Le client masque, mais ils ne doivent pas quitter le serveur.
7. **Ordre** : l'ordre des tableaux renvoyés est respecté tel quel.

## 3. Enveloppe et erreurs

Succès :

```json
{ "data": [ { "session_id": "s-4820" } ], "meta": { "total": 1, "page": 1, "page_size": 100 } }
```

Erreur — les deux formes sont lues :

```json
{ "error": { "code": "FORBIDDEN_ROLE", "message": "Rôle insuffisant" } }
{ "code": "FORBIDDEN_ROLE", "message": "Rôle insuffisant" }
```

| HTTP | Affiché par l'UI |
|---|---|
| 403 | « Accès refusé (rôle) » |
| 404, 406, 502, 503 | « POLARIS non connecté » |
| corps non JSON ou sans `data` | « POLARIS non connecté » |
| délai / réseau | « POLARIS non connecté » |
| autre 4xx/5xx avec `message` | le `message` |
| autre 4xx/5xx sans `message` | « Source POLARIS indisponible » |

Ne jamais renvoyer une page HTML (login, 404 serveur, passerelle) sur `/api/v1/*`.

## 4. Points d'entrée

### Session et diagnostics

| Méthode | Chemin | `data` | Champs lus |
|---|---|---|---|
| GET | `/auth/me` | objet | `role` : `viewer` \| `operator` \| `administrator` |
| GET | `/health` | objet | `status`, `capture_state`, `coordination_open` |
| GET | `/version` | objet | `backend_api`, `web_frontend`, `platform_core`, `session_engine`, `correlation_engine`, `event_schema`, `callflow_schema`, `decoders` |
| GET | `/metrics` | objet | `capture_state`, `pending_segments`, `segments_ingested`, `ingestion_failures`, `open_segments`, `zero_event_segments`, `dumpcap_active`, `dumpcap_expected`, `import_lag_seconds`, `segments_dropped` |
| GET | `/storage/safety` | objet | `free_percent` ou `free_bytes` + `total_bytes` |

`/metrics` est rappelé toutes les 10 s. `zero_event_segments` n'est pas un segment perdu.

### Sessions et requêtes

| Méthode | Chemin | `data` |
|---|---|---|
| GET | `/sessions` | tableau ou `{ sessions: [...] }` |
| POST | `/sessions/filter` | idem, corps d'égalité (§5) |
| GET | `/sessions/available_causes` | tableau de chaînes ou `[{cause}]` / `[{code}]` |
| GET | `/datasets` | tableau avec `id`, `name` |
| GET | `/sessions/{session_id}` | objet Session |
| GET | `/sessions/{session_id}/callflow` | `{ events \| messages, nodes?, summary? }` ou tableau |
| GET | `/sessions/{session_id}/events` | tableau (fallback) |
| GET | `/sessions/{session_id}/procedures` | tableau ou `{ procedures: [...] }` |
| GET | `/sessions/{session_id}/correlations` | tableau ou `{ edges: [...] }` / `{ correlations: [...] }` |

Champs Session : `session_id` (obligatoire), `anchor_capture_id`, `first_packet_number`, `ue_pseudonym`, `technology`, `procedure`, `state`, `cause`, `cell`, `interfaces[]`, `correlation_status`, `decode_completeness`, `message_count`, `decoded`, `partial`, `serving_node`, `start_timestamp`, `end_timestamp`, `observed_epoch_ms`, `dataset_id`, `unresolved_fields`. `ue_ip` jamais au rôle `viewer`.

Champs Event : `event_id`, `capture_id`, `seq`, `packet_number`, `packet_references[]`, `interface`, `protocol`, `message_name`, `source_participant`, `destination_participant`, `direction`, `decoding_status`, `semantic_status`, `procedure_group`, `decoded_ie_tree`, `errors[]`.

Champs Corrélation : `edge_id`, `source_event_id`, `target_event_id`, `source_interface`, `target_interface`, `matching_identifiers[]`, `rule_id`, `rule_version`, `matched_rules[]`, `evidence_type`, `confidence`, `scope`, `limitations[]`, `packet_references[]`. `confidence` / `evidence_type` = `EXACT` ou `OPEN`/`OUVERT` uniquement ; toute autre valeur supprime le lien.

### Événement, preuve, paquet

`GET /events/{id}`, `GET /events/{id}/provenance`, `GET /packets?capture_id=&packet_number=`, `GET /packets/{id}`, `GET /correlation/rules`.

### Sonde, captures, modules

| Méthode | Chemin | Champs lus |
|---|---|---|
| GET | `/probes`, `/probes/{id}` | `id`, `name`, `role`, `status`, `version`, `cpu_percent`, `memory_used_gb`, `memory_total_gb`, `disk_percent`, `last_seen` |
| GET | `/probes/{id}/interfaces`, `/interfaces` | `name` |
| GET | `/captures` | `id`, `status`, `target` |
| GET | `/captures/{id}/metrics` | champs de `/metrics` |
| GET | `/modules` | `id`, `name`, `status` |

### Actions de capture

`POST /captures/start` et `POST /captures/validate` avec `{ "target": "…" }`, `POST /captures/{id}/stop`.
Conditions : rôle exactement `operator`, `health.coordination_open === true`, confirmation utilisateur. Le serveur doit refuser lui aussi (403) : le contrôle d'interface n'est pas une autorisation.

### Téléchargements

`GET /exports/callflow/{session_id}` (binaire), `GET /captures/{capture_id}/download` (pcap, `operator`).
Ouverts par navigation directe : accepter le cookie, ne pas renvoyer de JSON avec un code 200.

### UE, jeux de données, LTE

`GET /ues`, `/ues/{id}`, `/ues/{id}/sessions`, `/datasets/{id}/sessions`, `/lte/evidence/{run_id}/sessions`.

## 5. Filtrage `POST /sessions/filter`

```json
{ "message": "…", "cause": "…", "interface": "…", "pseudonym": "…", "dataset_id": "482" }
```

Égalités en **ET** uniquement. L'UI n'envoie ni `OU`, ni `≠`, ni regroupement, ni gabarit, ni deux conditions sur un même champ (refusées avant envoi).

## 6. Rôles

| Rôle | Lecture | Écriture |
|---|---|---|
| `viewer` | tout sauf `ue_ip` et identités | rien |
| `operator` | tout | captures, pcap |
| `administrator` | tout | gestion nœuds ; captures seulement si aussi `operator` |

Le rôle vient uniquement de `GET /auth/me`.

## 7. Check-list d'acceptation

```bash
curl -s -H "Accept: application/json" --cookie "$SESSION" https://<hote>/api/v1/auth/me
curl -s --cookie "$SESSION" https://<hote>/api/v1/health
curl -s --cookie "$SESSION" https://<hote>/api/v1/version
curl -s --cookie "$SESSION" "https://<hote>/api/v1/sessions?page_size=100"
curl -s -X POST --cookie "$SESSION" -H "Content-Type: application/json" \
  -d '{"cause":"5GSM #27"}' https://<hote>/api/v1/sessions/filter
curl -s --cookie "$SESSION" https://<hote>/api/v1/sessions/<session_id>/correlations
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --cookie "$SESSION" \
  https://<hote>/api/v1/exports/callflow/<session_id>
```

Attendu : JSON (jamais de HTML), `data` présent, `session_id` sur chaque ligne, `confidence` ∈ {EXACT, OPEN}, téléchargement en binaire.

## 8. À confirmer côté backend

- Schéma réel de `coordination_open` (booléen strict attendu).
- Périmètre de l'extraction pcap (route actuelle = capture entière).
- Pagination serveur de `/sessions` (l'UI lit les 100 premières lignes).
- Activité récente de l'accueil et recherche Live par IMSI/GUTI : aucune route aujourd'hui.
- KPI / tableaux de bord / anomalies : aucune route d'agrégation ; l'UI reste en démo étiquetée.
- Traffic (N6) masqué par défaut (`VITE_FEATURE_TRAFFIC=false`).
