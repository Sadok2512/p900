# Changelog

## 2.8.8 — 2026-11-22 — Runtime de production et protection de l’Analyzer

- Ajoute une cible Nitro Node explicite (`npm run build:node`, puis `npm start`) afin que le lab ne serve plus l’application avec Vite en mode développement.
- Limite à deux les requêtes coûteuses de détail d’une session qui pouvaient auparavant saturer simultanément les quatre emplacements HTTP du navigateur.
- Borne les appels de détail à 30 secondes et conserve les erreurs endpoint par endpoint dans l’Analyzer.
- Traduit la dernière barrière d’erreur globale en français et permet une relance sans quitter la page.
- Ajoute au proxy les protections navigateur CSP anti-iframe/objet, `nosniff`, `DENY`, politique de référent et désactivation caméra/micro/géolocalisation.
- Conserve p900 2.8.7 comme rollback ; aucun changement Open5GS, OTV ou catalogue Control.

## 2.8.7 — 2026-11-21 — Déduplication fidèle du flux Live

- Déduplique les messages Live par `stable_event_key`, avec repli sur `event_id`, au lieu du couple `(capture_id, packet_number)` qui supprimait les événements NAS et NGAP partageant le même paquet.
- Remplace en place une ligne quand la même clé stable arrive avec une `revision` supérieure ; les révisions identiques ou obsolètes sont ignorées.
- Préserve l’ordre d’affichage par capture, numéro de paquet puis arrivée, y compris pendant une pause/reprise du flux.

## 2.8.6 — 2026-11-19 — Stock de capture, quarantaine et lookup privé

- Affiche le stock de capture `capture_owned_bytes_percent` sans plafond et utilise « — » quand la mesure est absente.
- Affiche le nombre de segments quarantinés et une liste repliable de leurs seuls noms de fichier, sans identité ni chemin complet.
- Migre la recherche d'identité vers `POST /identities/lookup` avec la valeur dans le corps JSON, avant la suppression du GET en oiran-api 2.21.76.
- Conserve les badges de provenance vTAP et le réessai automatique des `503 HEAVY_WORK_IN_PROGRESS` avec `Retry-After`.

## 2.8.5 — 2026-11-18 — Réessai automatique pendant une publication Analyzer (patch)

- Reconnaît le `503 HEAVY_WORK_IN_PROGRESS` de `/sessions/filter`, respecte l’en-tête `Retry-After` et réessaie automatiquement tant que la publication est en cours.
- Affiche « Publication en cours, nouvel essai dans N s » pendant l’attente, puis retire cet état après la réponse réussie ou l’annulation.
- Conserve la file de concurrence : le délai de réessai ne monopolise aucun des quatre emplacements de requêtes HTTP.
- La version 2.8.4 étant déjà utilisée par `fix/privacy-contract-psn-2.8.4`, ce correctif prend la version 2.8.5.

## 2.8.3 — 2026-11-18 — Callflow paginé complet (patch)

- Suit `pagination.next_cursor` jusqu’à la dernière page de `/sessions/:id/callflow`, en conservant strictement l’ordre canonique renvoyé par l’API.
- Affiche le nombre d’événements chargés sur le total annoncé afin qu’un résultat partiel ne soit jamais présenté comme complet.
- Rend la provenance `probe_type` sur chaque ligne de l’onglet Messages, notamment pour les événements SBI issus du vTAP.

## 2.8.2 — 2026-11-17 — Provenance vTAP visible dans l’Analyzer (patch)

- Affiche le `probe_type` réellement fourni par l’événement dans l’en-tête et les métadonnées techniques de l’inspecteur de session.
- Met en évidence `vtap` avec un badge discret, sans inventer de provenance quand le champ est absent.
- Conserve l’affichage existant des identités de session MSISDN/GPSI et IMEI(SV)/PEI ; aucune identité n’est journalisée par ce changement.

## 2.8.1 — 2026-11-16 — Design Accueil étendu à toute l'application (patch)

- Nouvelle classe partagée `.polaris-card` (fond blanc, bordure fine, ombre douce) appliquée aux cartes de KPI, Live, Administration, Requêtes, Traffic et aux fiches sonde.
- En-têtes de page harmonisés sur le style Accueil : titre 28 px, carte d'en-tête avec ombre, onglets et compteurs intégrés (KPI, Live, Administration, Requêtes, Traffic).
- Fond de page `surface-2` et largeur de contenu `polaris-content-shell` alignés partout ; l'onglet Administration actif suit la couleur d'accent choisie.

## 2.8.0 — 2026-11-16 — Explorateur et requêtes protocolaires (minor)

- Branche l’assistant « Requête de sessions » sur le contrat réel oiran-api 2.19.1 : `GET /sessions/catalog`, recherche et fiche de paramètre, arbre `protocol_tree` et éléments réseau observés.
- Exécute les critères Message/Paramètre en ET ou OU via `criteria` / `combinator`, affiche `matched_criteria` par ligne et ouvre la session au clic sur la preuve.
- Ajoute les colonnes protocolaires après affichage avec les modes dernière, première, toutes et nombre. Les valeurs et preuves viennent de `POST /sessions/columns`, sans nouveau `POST /sessions/filter`.
- La recherche IMSI utilise le champ `search` 2.19.1 ; un éventuel `IDENTITY_FILTER_OPERATOR_REQUIRED` reste un écart backend explicite.
- L’aperçu utilise `limit: 0` et son `meta.total` réel. Aucune donnée de la maquette n’est embarquée.

## 2.7.3 — 2026-11-16 — États Live et reprise SSE explicite (patch)

- Termine proprement la réponse SSE aval si l'upstream est interrompu pendant un redémarrage API ; `EventSource` peut ainsi afficher COUPÉE et se reconnecter, sans chunk tronqué.
- Réarme automatiquement la même trace en mémoire si un redémarrage API a perdu son `trace_id` volatil ; les coupures ordinaires conservent la reprise `Last-Event-ID` et l'ordre `(capture_id, seq)`.
- Calcule `ARMÉE`, `ACTIVE`, `ARRÊTÉE` et `COUPÉE` à partir du job et des événements de trafic réellement reçus par l'UI : `ACTIVE` pendant 30 s après le dernier message/throughput/procedure/marker, jamais sur un heartbeat ni sur les événements de contrôle `status`/`ue_info`.
- Affiche `COUPÉE` pendant toute reconnexion et réouvre explicitement `EventSource` avec le dernier id SSE, associé à la dernière clé `(capture_id, seq)` reçue ; déduplication par cette clé, jamais par timestamp.
- L'audit direct/proxy de 330 s tient des deux côtés avec heartbeat 15 s. Le test de redémarrage a ensuite prouvé que le proxy laissait la réponse aval ouverte sur `aborted`/`close`; il la termine désormais proprement pour permettre la reconnexion EventSource.

## 2.7.2 — 2026-11-16 — Live : plus de plantage au premier message réel (patch)

- Recette ANR2 (#10, run UE-201 simple-data-ul-dl-0b2696238220 : 61 messages reçus côté backend) : la page Live plantait avec `ReferenceError: IFC_C is not defined` — le ladder Live utilisait la palette d'interfaces du composant parent, hors de portée (`// @ts-nocheck` masquait l'erreur). Palette passée en prop.
- `source` / `destination` du flux SSE sont des objets endpoint `{address, network_function}` : affichés tels quels ils auraient fait planter React. Libellé = fonction réseau, sinon adresse (`endpointLabel`).
- Test `Live : un message réel (endpoints objets) s'affiche sans planter` (échoue sans le correctif avec l'erreur exacte d'ANR2).

## 2.7.1 — 2026-11-16 — Fidélité de l’étape Critères

- Aligne l’étape Critères sur la maquette fournie : C1/C2, onglets Message/Paramètre, ajout et suppression, recherche globale, sélecteur de message, arbre filtrable, commandes déplier/replier, résumé des critères et liaison ET/OU.
- Branche l’estimation sans exécution sur le `meta.total` réel de `POST /api/v1/sessions/filter` avec `limit: 0` ; aucun total fictif n’est embarqué.
- Conserve l’arbre et ses contrôles visibles mais sans données inventées tant que `GET /api/v1/query/catalog` n’est pas livré par oiran-api 2.19.0. Une requête Paramètre ou OU reste non exécutable avant ce contrat backend.

## 2.7.0 — 2026-11-16 — Nouvelle UI « Requête de sessions »

- Remplace l’éditeur historique par un assistant en six étapes inspiré de la maquette fournie : Périmètre réseau, Période, Interface & protocole, Critères, Colonnes, puis Aperçu & exécuter. La sortie reste la grille de sessions Analyzer existante.
- Ajoute le modèle de colonnes en trois couches : six colonnes BASE verrouillées, colonnes variables pré-cochées par interface, et ajout de paramètres protocole préparé mais désactivé jusqu’à oiran-api 2.19.0. Les choix de colonnes sont enregistrés avec la requête et restent modifiables après affichage sans relancer le filtre.
- Intègre par merge le rafraîchissement de fond 2.6.4 : intervalle de 15 s, arrêt quand l’onglet est masqué. La version de cette branche jamais publiée reste 2.7.0.
- Toutes les options observées (éléments réseau, interfaces et runs) viennent des réponses API. Les champs absents ne sont plus convertis en boutons « undefined ».
- Branche le contrat réel de `POST /api/v1/sessions/filter` : `messages[]`, `causes[]`, `identity`, `failures_only`, pagination par curseur. RAT, période et éléments observés affinent localement les seules sessions retournées par l’API.
- La recherche directe IMSI crée une condition identité sans afficher la valeur dans les récapitulatifs. Le nom de paramètre, l’arbre, les valeurs, `matched_criteria`, le catalogue et le compte `limit: 0` restent désactivés avec la mention « disponible avec oiran-api 2.19.0 ».
- Site / Cellule restent explicitement hors périmètre V2. Aucune donnée issue de la maquette n’est embarquée.

## 2.6.4 — 2026-11-16 — Audit perf : rafraîchissement de fond allégé (patch)

- 7 requêtes de fond (santé Analyzer et Control, métriques, interfaces runtime, sondes…) toutes les 5 s, y compris onglet masqué, occupaient les 4 requêtes simultanées du client et retardaient l'ouverture d'une session. Fond : 15 s (`BACKGROUND_POLL_MS`), version 60 s, stockage et interfaces 30 s ; arrêt quand l'onglet est masqué. Live (SSE) et détail de session inchangés.
- Test : aucune requête de fond < 15 s ni active onglet masqué.

## 2.6.3 — 2026-11-16 — Live : plus de plantage à l'armement d'une trace IMSI (patch)

- Constat Sadok (« This page didn't load » au clic sur Rechercher, IMSI UE-201) : en mode réel, la trace est ARMÉE avant le premier event `ue_info` ; `UeInfo` lisait `ue.tech` / `ue.proof` sur `ue = null` → exception → page entière tombée. Garde `ue?.` + technologie par défaut 5G.
- Le libellé figé « PDU #1 · 5QI 9 · QFI 1 · DNN internet » (ou « Bearer 5 · QCI 9 ») n'est plus affiché qu'en Démo : en réel, aucune valeur inventée.
- Saisie de 14-15 chiffres (ou `imsi-…`) en mode Pseudonyme → bascule automatique sur « IMSI / SUPI ».
- Test `Live : une trace IMSI armée sans aucun message ne fait pas planter la page` (échoue sans le correctif).

## 2.6.2 — 2026-11-16 — Ladder LTE : plus de plantage sur horodatage hors plage (patch)

- Écart ANR2 (déploiement 2.18.9/2.6.1, présent depuis 2.6.0) : le ladder LTE plantait sur une date. `toMs` accepte désormais s / ms / µs / ns et renvoie `null` pour toute valeur hors de la plage de `Date` ; `SessionAnalysis` n'appelle plus `toISOString()` sur une date invalide (« — »).
- Test `toMs : horodatages hors plage`.

## 2.6.1 — 2026-11-16 — Ladder : colonnes dans l'ordre réseau (patch)

- Constat Sadok : le ladder d'une session commençant par du PFCP affichait les colonnes SMF, UPF, gNB, AMF (ordre de première apparition).
- `orderLadderNodes` : ordre canonique UE → gNB/eNB → AMF/MME → SMF/SGW-C/PGW-C → UPF/SGW-U/PGW-U → AUSF/UDM/UDR/PCF/NRF/NSSF/BSF/HSS/PCRF → P/I/S-CSCF → DN ; un nœud inconnu garde son ordre d'apparition, après les connus.
- 3 tests (5G, LTE, nœud inconnu).

## 2.6.0 — 2026-11-15 — Vue « Chaîne E2E 5G » + mapping statuts complet (ANR1 #10 E2E-5G)

Lot 2 de la feuille de route « Trace E2E 5G » (audit #10 6896790347, feu vert #10 6896869321, livre oiran-api 2.17.0 côté back). Expose la chaîne de corrélation complète N2 → SBI → N4 → N3 (+ IMS → RTP si observé) en lecture directe du `correlation_status` produit par oiran-api 2.17.0. Hors périmètre : ni l'onglet Ladder ni les helpers identités partagés ne sont modifiés.

### Nouveau helper `src/lib/polaris-api/e2e-chain.ts`

Fonctions pures, aucun import React, testables isolément :

- `buildE2EChain(rawStatus)` — prend le champ `correlation_status` renvoyé par `/sessions/:id` ou `/sessions/:id/callflow` (string legacy, objet 2.17.0, `null`, `undefined`), retourne la chaîne `{ hops, overall, imsObserved }`. Dérive `overall` localement quand le back ne fournit pas `E2E` (fallback compat ≤ 2.16.0) selon la même règle que `callflow-schema::build_callflow` : `STRONG` si data-plane prouvé, `OPEN` si un hop observé mais pas prouvé, `UNKNOWN` sinon.
- `isObservedStatus(s)` / `isProvenStatus(s)` — invariants explicites : prouvé ⇔ `{EXACT, STRONG}` ; observé ⇔ non-`UNKNOWN` et non-null.
- `formatChainLabel(chain)` — rend la séquence de nœuds séparés par `→` pour affichage compact.

### Nouveau composant `src/components/polaris/analyzer/E2EChainBadge.tsx`

Badge compact. Rend 4 nœuds (N2, SBI, N4, N3) + 2 nœuds optionnels (IMS, RTP) si observés. Chaque flèche porte un badge statut coloré (vert EXACT/STRONG, orange OUVERT/OPEN/POSSIBLE, rouge WEAK/MISSING, gris UNKNOWN). Back-compat : si `correlation_status` est une string legacy, le composant tombe sur un badge simple ; si absent, le composant rend `null`.

### Nettoyage switch `Stat` (`PolarisApp.jsx:59-62`)

- Avant 2.6.0 : la map `{'EXACT':..., 'OUVERT':..., 'OUVERT':...}` avait un doublon, la 2e définition écrasait la 1re → l'orange n'était jamais appliqué.
- Après 2.6.0 : une map complète `STAT_CLASS` hoisted, un seul mapping par clé, couverture `EXACT/STRONG/OUVERT/OPEN/POSSIBLE/UNKNOWN/MISSING/WEAK` + fallback gris pour tout statut non-reconnu.

### Tests (11 unitaires `e2e-chain.test.ts`)

- 3 cas `buildE2EChain` structurels (data-plane complet, IMS observé = 5 hops, hop OPEN dérivé, IMS sans data-plane, chaîne vide).
- 2 cas respect du `E2E` fourni par le back (pas de ré-dérivation).
- 2 cas entrées invalides (null, string) → chaîne UNKNOWN sans throw.
- 2 cas `isObservedStatus` / `isProvenStatus`.
- 2 cas `formatChainLabel` (sequence + fallback).

Test de version `polaris-screens.test.tsx:240` mis à jour à `2.6.0` AVANT lancement des tests (règle user : bump AVANT).

### Preuves (runner devmat, 2026-11-15)

```
$ npx tsc --noEmit
# 0 erreur

$ npx vitest run src/lib/polaris-api/e2e-chain.test.ts
Test Files  1 passed (1)
Tests  11 passed (11)

$ npx vitest run
Test Files  21 passed (21)
Tests  193 passed (193)
# +12 vs 181 en 2.5.0 (+11 e2e-chain + 1 test de version intégré)
```

### Règle « écart déclaré OUVERT » honorée

- Un hop non-observé → statut UNKNOWN affiché explicitement (gris), jamais caché par défaut.
- Un hop observé mais non prouvé → statut OPEN (orange), jamais remonté en vert par hypothèse.
- Un hop prouvé → statut EXACT/STRONG (vert).

### Hors périmètre respecté

- Aucune modif Ladder, Sessions list, Live, KPI, helpers identités.

Bump minor : `p900 2.5.1 → 2.6.0`.

## 2.5.1

- Pagination de la liste des sessions : l'UI ne lisait que la première page
  de `POST /sessions/filter` (25 lignes par défaut). Sur 174 sessions,
  `5g-session-c330d205adafa233` était en page API 2/2 et introuvable
  (ANR1 #10). `fetchAllFilteredSessions` suit `meta.next_cursor` (limit
  100) jusqu'à la dernière page, borné à 50 pages, et garde les identités
  (`keepIdentities`).
## 2.5.0 — 2026-11-15 — Live par IMSI : validation, anti-doublon, lien session enrichi (ANR1 #10 Live-IMSI)

Lot A de la feuille de route « UI tape IMSI → suivre UE en direct » (audit #10 6895079284). Ferme les manques UX identifiés et respecte le hors-périmètre : aucune modif de l'Analyzer (Sessions/Ladder/KPI), aucune modif des helpers d'identité partagés.

### Nouveau module `src/components/polaris/live/live-validation.ts`

Fonctions pures, testables isolément, aucun import React. Expose :

- `LIVE_BUFFER_MAX = 2000` — borne explicite du buffer de pause (parité stricte avec `MAX_EVENTS = 2000` du back `live_trace.rs`).
- `validateLiveIdentity(key_type, raw)` — validation stricte par type avant POST `/live/traces`. Règles : IMSI 14 ou 15 chiffres (strip préfixe `imsi-` et espaces), IMEI 15 ou 16 chiffres, MSISDN E.164, M-TMSI/TMSI 8 hex ou décimal 32-bit, S-TMSI MMEC-M-TMSI, pseudonyme `ue-xxxx` (4 hex). Retourne `{ok, normalized}` ou `{ok:false, reason}`.
- `findExistingTrace(existing, key_type, expectedPseudonym)` — anti-doublon : retourne la trace active si un même `subscriber_pseudonym` est déjà suivi (évite la 2e création au-delà de `MAX_TRACES=10` côté back).
- `buildOpenSessionContext(selected, correlated)` — construit le contexte « ouvrir cette session dans l'Analyzer » à partir de (a) l'event sélectionné `{cap, seq}` dans le Live, (b) la liste des sessions corrélées renvoyée par `GET /live/traces/:id/sessions` (préfère `source="flows"` puis `"capture_manager"`).
- `persistOpenSessionContext(ctx)` / `readOpenSessionContext()` — sérialisation `sessionStorage` sous la clé `polaris-live-open-session-context`. L'Analyzer peut consommer à son mount (hors périmètre 2.5.0, à câbler côté POLARIS devmat dans un lot dédié).
- `encodeSessionHashContext(ctx)` — alternative hash URL (fallback). Non utilisée par le flow actuel mais exportée pour un consommateur ultérieur.

### Câblage dans `LiveModule.tsx`

- `find()` : validation front-first avant POST ; message d'erreur explicite si rejet (ex. « IMSI invalide — 14 ou 15 chiffres (MCC+MNC+MSIN) »). Normalisation (strip espaces, préfixe `imsi-`) avant envoi au back.
- `find()` : fetch préalable `GET /live/traces` pour anti-doublon ; `res.reusedTraceId` renseigné si la trace existe déjà.
- Buffer pause (`buf` state) : toutes les `.slice(-2000)` passent explicitement à `.slice(-LIVE_BUFFER_MAX)` — borne déclarée, parité back assurée.
- Nouvelle ref `lastEventId.current` : tracked à chaque event SSE reçu ; passé en query `?last_event_id=N` sur la prochaine ouverture d'`EventSource` (le browser gère nativement Last-Event-ID sur reconnexion mais pas sur close/reopen avec `withCredentials`). Nécessite oiran-api 2.16.0 qui honore la query.
- Nouveau state `correlatedSessions` : alimenté par `GET /live/traces/:id/sessions` (back 2.16.0), polling 10 s tant que la trace est active.
- Boutons « Décodage complet → », « Preuves → », « Session Explorer → » : passent désormais par `persistOpenSessionContext(buildOpenSessionContext(selM, correlatedSessions))` avant `setPage('sessions')`. Session cible = première session corrélée (préférence `flows`). Fallback comportemental identique à 2.4.4 si aucune corrélation (sessionId=null).

### Tests (26 unitaires, `live-validation.test.ts`)

- 13 cas `validateLiveIdentity` (IMSI valide/invalide, IMEI 15/16, MSISDN E.164, pseudonyme, M-TMSI hex/décimal).
- 4 cas `findExistingTrace` (match exact, match via key_type=pseudonym, miss, null guard).
- 3 cas `buildOpenSessionContext` (context plein, préférence flows, fallback nul).
- 2 cas `encodeSessionHashContext` (sérialisation, fallback).
- 3 cas `persistOpenSessionContext` / `readOpenSessionContext` (round-trip, miss, corruption).
- 1 cas `LIVE_BUFFER_MAX` (parité back = 2000).

Test de version `polaris-screens.test.tsx:240` mis à jour à `2.5.0` AVANT lancement des tests (règle user : bump AVANT).

### Preuves (runner devmat, 2026-11-15)

```
$ npx tsc --noEmit
# 0 erreur

$ npx vitest run src/components/polaris/live/live-validation.test.ts
Test Files  1 passed (1)
Tests  26 passed (26)

$ npx vitest run
Test Files  20 passed (20)
Tests  181 passed (181)
# +26 vs 155 en 2.4.4 ; aucune régression sur les 155 tests existants
```

### Règle Sadok (2026-11-14) respectée

- IMSI en clair uniquement dans l'UI auth (déjà le cas 2.4.4).
- Aucun IMSI logué ni sérialisé : les helpers de validation normalisent des strings mais ne les persistent pas en clair hors requête API ; `sessionStorage` ne contient que des pseudonymes et des session_id opaques.
- Aucun IMSI littéral dans les tests (fixtures : `001010123456789` issu de la PLMN de test 001-01, valeur d'EXEMPLE 3GPP).

Bump minor : `p900 2.4.4 → 2.5.0`.

## 2.4.4

- Corrige le FAIL ANR1 #10 6894872305 : la colonne IMSI/SUPI affichait
  « masqué » alors qu'oiran-api 2.15.3 servait l'IMSI. Le client
  redactait toute la réponse de la liste. Règle Sadok (IMSI en clair dans
  l'UI authentifiée) : `/sessions` et `/sessions/filter` passent par
  `redactKeepingIdentities`, qui garde le sous-objet `identities` intact
  et continue de masquer tout autre champ d'identité.

## 2.4.3

- Corrige le FAIL ANR1 de 2.4.2 (#10 6894043874) : pendant le chargement,
  le compteur de la barre d'outils affichait encore « 0 message » à côté de
  « Chargement du déroulé de la session… ». Il affiche « chargement… »
  tant qu'aucun message n'est reçu.

## 2.4.2

- Corrige le FAIL ANR1 de 2.4.1 (#10 6893957081) :
  - l'état de chargement du ladder ne s'affichait jamais :
    `useSessionBundle()` renvoie toujours un `detail` (avec `msgs: []`
    avant les données), donc `!bundle.detail` restait faux. Condition
    corrigée : requête en cours ET aucun message encore reçu ;
  - le test « Settings reads every lab component and UI package
    version » attendait encore 2.4.0 (tests lancés avant le bump).

## 2.4.1

- Ladder : pendant le chargement du déroulé (`/sessions/:id/callflow` ou
  `/events` en cours), le panneau affiche « Chargement du déroulé de la
  session… » au lieu de « 0 message · Aucun message visible ». Avant, la
  session sélectionnée semblait vide tant que la réponse n'était pas
  arrivée (capture Sadok 15/11 11:42).
- Liste des sessions : les cellules d'identité non encore chargées
  affichent « — » (infobulle « Identité chargée à l'ouverture de la
  session ») au lieu du texte « ouvrir la session » répété sur 6 colonnes.

## 2.4.0

- N1 : les 6 colonnes identity de « Toutes les sessions » (IMSI/SUPI, TMSI/GUTI, S-TMSI, M-TMSI, IMEI(SV)/PEI, MSISDN/GPSI) lisent désormais directement le champ `r.identities` fourni par `/api/v1/sessions` depuis `oiran-api 2.15.0`. Plus besoin d'ouvrir la session pour voir les identités. L'`identityMap` détaillée (chargée via `/sessions/:id/identities` avec `_proof`) reste prioritaire quand elle est présente, pour exposer les preuves `+N` sur la session ouverte.
- Cellule identity (`PolarisApp.jsx:244`) : distinction stricte entre `r.identities === undefined` (pas encore chargé → « ouvrir la session ») et `r.identities === null` ou `{imsi: null, …}` (observé mais vide → « non observé »). La règle Sadok « valeur absente → non observé » est encodée dans la cellule, pas dans l'adaptateur.
- N3 : correction du bug « Aucun message visible » dans le Ladder quand `/api/v1/sessions/:id/callflow` renvoie `nodes: []` (cas prod `5g-session-c330d205adafa233`, 21 events pourtant présents). `toLegacyCallflow` (`adapters.ts:11`) acceptait un array vide comme `nodes` explicites, laissant le Ladder sans colonnes. Le repli sur la dérivation depuis `source/destination_participant` des events est maintenant pris dès que `body['nodes']` est **absent OU vide**. 2 nouveaux tests unitaires dans `adapters.test.ts` reproduisent la payload réelle ANR1 pour verrouiller la régression.

## 2.3.2

- Colonne « Numéro » : correction du fallback quand `anchor_capture_id` et `first_packet_number` sont absents du payload /api/v1/sessions (cas prod mesuré sur `5g-session-c330d205adafa233`, ANR1 #10 6884587508). L'adaptateur `toLegacySession` passe `null`/`undefined` dans `available()` qui renvoie le tiret long `'—'` (U+2014) ; l'ancien test en 2.2.7 (`r.cap!=null && r.seq!=null`) acceptait donc la string `'—'` et produisait le rendu `c— · —`. Le fallback traite désormais `'—'`, `''` et `null` comme équivalents absents, puis se replie sur `session_id`, puis `#<id>`. Logique extraite en pure helper testable `sessionNumberLabel(row)` dans `analysis.ts`.
- 7 nouveaux tests unitaires `sessionNumberLabel` reproduisant le cas prod ANR1 : cap/seq réels, cap/seq = `'—'`, cap = réel mais seq = `'—'`, null, session_id manquant, id manquant, string vide.

## 2.3.1

- Colonne « Durée » de « Toutes les sessions » : largeur par défaut 76 → 112 px. L'ancienne largeur ne laissait pas la place à l'en-tête « Durée » ni aux valeurs typiques « 1 min 23 s » ; l'utilisateur voyait « …e » (en-tête) et « …min… » (valeurs). Le wrapper truncate CSS de 2.3.0 reste en place : la troncature, si elle survient, se fait désormais proprement à droite avec le texte complet en `title` au survol. Largeurs stockées dans localStorage non affectées (seule la valeur par défaut change).
- Audit N3 (ladder « 0 message »/« Aucun message visible ») : déclaré OUVERT dans le commentaire #10 associé. Cause probable identifiée côté UI (`PolarisApp.jsx:329` — filtre `hidden` + `inCollapsed`) mais le filtre est initialisé vide (`PolarisApp.jsx:431`, `useEffect:436`). Cause plus probable : `d.msgs` lui-même vide pour la session sélectionnée. Requête de preuve demandée à ANR1 : `curl /api/v1/sessions/<sid>/events` sans filtre d'interface + `curl /api/v1/sessions/<sid>/procedures`.

## 2.3.0

- Analyzer « Toutes les sessions » : libellé « Procédure » n'est plus coupé au milieu dans la grille — la cellule porte maintenant un `<span className="block truncate w-full">` qui active réellement `text-overflow: ellipsis` dans une `<td>`. Troncature uniquement à droite, texte complet exposé en `title` natif au survol (défaut D2, pas de troncature backend mesurée, confirmée par le payload ANR1 #10 6883006379).
- Décodage d'événement : `DecodeTree` normalise désormais le format array `[{name, value}, …]` renvoyé par l'API (notamment PFCP `decoded_ie_tree`) en objet `{name: value, …}` avant le rendu. Les IE PFCP affichent « Node ID: node_id_ipv4=10.77.23.13 », « F-SEID: f_seid=0x314, … » au lieu du rendu brut « 0 {6} … 11 {6} ». Les doublons de noms (plusieurs `Created PDR/PDR ID`) sont dédoublonnés en `name`, `name (2)`, `name (3)` (défaut D5).
- `src/lib/polaris-api/client.ts` : 3 erreurs TypeScript préexistantes sous `exactOptionalPropertyTypes: true` corrigées — `signal` n'est plus présent dans l'objet item quand il est `undefined`, et `fetcher.mock.calls[4]?.[0]` est typé pour supporter l'indexation sur tuple.
- Option B des 6 défauts du 14/11 18:32 côté UI. Les fixes backend `oiran-api 2.15.0` (D3 backend identités dans /sessions, D4 champ clear-text SUPI null-scheme + IMSI EPS sous auth UI, D6 corrélation PFCP Request type 50 par `pfcp_sequence`) sont dans le dépôt `Sadok2512/OIRAN-POLARIS` branche `feat/oiran-api-2.15.0-identities-pfcp`.

## 2.2.7

- Analyzer « Toutes les sessions » : correction de la colonne « Numéro » qui affichait `c– · –` quand les champs `cap`/`seq` n'étaient pas renseignés — repli désormais sur `session_id` puis `#<id>` (défaut D1 lot 14/11 18:32). Colonne « Abonné » : si `r.subscriber_imsi` est déjà présent sur la row (API /sessions), on l'affiche sans attendre que l'utilisateur ouvre la session — « ouvrir la session » reste seulement quand aucune valeur n'est connue (fix D3 UI partiel, D3 backend suivra via API 2.15.0). Défauts D2/D4/D5/D6 déclarés OUVERT en attente de payloads ANR1 (cf. commentaire #10).

## 2.2.6

- Ladder : libellé procédure de la colonne de gauche étendu de 7 à 14 caractères et exposé en entier via un `<title>` SVG (tooltip au survol). Même traitement pour le badge d'interface (title = valeur complète). « UE Regi » / « PFCP Se » restent lisibles au survol ; aucune refonte du gabarit.
- API 2.14.9 (lot analyzer) : patcher à la lecture étendu à NGAP / NAS-5GMM / NAS-5GSM — l'UI reçoit maintenant `InitialUEMessage · Registration Request` au lieu de `Registration Request` isolé. L'adaptateur `message_name` est agnostique (déjà `str(e.message_name)`), aucun changement UI nécessaire.

## 2.2.5

- La colonne et la fiche de session « AMF/MME » lisent désormais le nouveau champ `core_node` publié par l'API OIRAN 2.14.4 (ANR2 ladder écart 4) ; repli automatique sur `serving_node` pour les backends 2.14.3 et antérieurs.
- La colonne « gNB/eNB » lit `serving_ran_node` en priorité (même repli).
- Aucune autre modification visuelle : l'Analyzer et la fiche de session ne sont pas redessinés.

## 2.2.4

- L'Analyzer ne précharge plus le callflow de chaque session : seuls les cinq détails de la session ouverte sont prioritaires, et les identités sont chargées paresseusement pour cette session.
- Le client limite les lectures API à quatre requêtes simultanées, accorde 60 secondes aux détails et aux identités, et conserve le délai de 8 secondes uniquement pour les contrôles de santé.
- Une navigation annulée ne produit plus d'erreur ; les échecs visibles distinguent désormais un délai dépassé, une erreur réseau et le statut HTTP réel au lieu d'afficher « HTTP 0 ».
- Le bandeau de connexion consulte la santé de POLARIS Control via `/polaris-api/v1/health`, et non la santé de l'API OIRAN utilisée par l'Analyzer.

## 2.2.3

- L’interface ne consulte plus le rôle pour afficher, masquer ou désactiver une action : capture, téléchargement PCAP, identités, dissection et gestion des sondes sont directement disponibles.
- Le garde local `canCapture` et les permissions dérivées de `/auth/me` sont supprimés ; le serveur reste seul responsable d’accepter ou de refuser une requête.
- Une réponse HTTP 403 produit le message en ligne neutre « Action refusée par le serveur (HTTP 403) », sans alerte navigateur liée au rôle.

## 2.2.2

- Le proxy active `P900_OPEN_ACCESS=1` par défaut et injecte le jeton operator côté serveur pour toutes les requêtes HTTP, SSE et upgrade, sans demander d’authentification Basic au navigateur.
- Les identités observées, Live Trace, la dissection et les actions de capture sont directement accessibles ; l’interface ne présente plus de connexion, de rôle utilisateur ni de réglage de mot de passe.
- L’accès fermé optionnel ne produit plus de challenge Basic : une requête restreinte est refusée avec HTTP 403.
- « Dashboard » quitte le menu du haut : la page des requêtes (recherche, modèles, requêtes enregistrées) s'ouvre désormais dans l'onglet **Dashboard** de KPI, entre KPI Builder et Anomalies, y compris hors mode Démo.
- Le menu du haut affiche Accueil · Analyzer · KPI · Live ; l'ancienne bibliothèque de dashboards de démo et l'action « + Dashboard » du catalogue sont retirées, l'onglet affichant la page déplacée.
- Les liens `#templates` et l'action « Ouvrir un template » de l'accueil ouvrent KPI → Dashboard ; le module « templates » disparaît de la visibilité des modules.

## 2.2.1

- Le rôle operator authentifié affiche sans masque les identités observées IMSI/SUPI, TMSI/GUTI, S-TMSI, M-TMSI, IMEI(SV)/PEI et MSISDN/GPSI dans la liste des sessions, le Call Flow, le détail, le Parcours abonné et Live Trace ; une identité absente affiche « non observé ».
- La liste charge `/sessions/:id/identities` uniquement pour les sessions de la page visible, faute de route d'identités en lot. La recherche et le tri globaux par identité restent donc limités à cette page.
- Le viewer affiche « connexion requise » et ne déclenche aucune requête vers les routes operator. Les réponses claires restent acceptées uniquement avec l'enveloppe serveur `identity_access=operator` et après authentification Basic du proxy.
- Les arbres de décodage operator et la dissection complète conservent les valeurs claires sans masque ni troncature ; les alias 4G/5G sont normalisés dans un adaptateur commun.

## 2.2.0

- Le proxy n'injecte un jeton operator qu'après une authentification Basic réussie ; les lectures publiques restent viewer, les écritures publiques sont refusées et les routes d'identité, de dissection, de Live Trace et d'audit exigent Basic, y compris lors d'un upgrade.
- Le mode réel masque les contrôles sans route OIRAN (utilisateurs, rôles, cycle de vie et mise à jour des sondes, changement de mot de passe et regroupement) au lieu d'afficher des erreurs 404.
- Le catalogue KPI réel est limité aux mesures `kpi.probe.*`, Traffic et les fonctions KPI synthétiques restent en démo avec leur libellé, et la géolocalisation réelle n'invente aucune donnée.
- L'audit Administration indique sa source operator et présente proprement le statut 401 lorsque Basic manque.

- Version applicative POLARIS unifiée à `2.2.0` dans les métadonnées du paquet, l'écran À propos et le pied de page.
- L'en-tête et le pied de page affichent uniquement la version produit `POLARIS 2.2.0`; les versions techniques du backend restent consultables dans « À propos ».
- Synchronisation avec la branche `main` courante, en conservant le câblage operator des identités et Live Trace.
- Le proxy accepte désormais la désactivation explicite de l'authentification Basic avec `P900_BASIC_AUTH_ENABLED=0`; l'injection des jetons backend reste exclusivement côté serveur.

## 0.18.0

- Live Trace raccordé aux traces OIRAN 2.14.0 et au flux SSE reprenable : recherche armée, messages, débit, informations UE, pause avec tampon client et marqueurs.
- Analyzer operator raccordé au coffre OIRAN 2.12.0 : IMSI, TMSI, S-TMSI, M-TMSI, IMEI et MSISDN avec preuves paquet ; ces colonnes restent absentes pour viewer.
- Authentification Basic du proxy 8091, jeton operator injecté côté serveur, SSE sans compression ni mise en tampon et décodage complet `tshark -V` par paquet.
- Harmonisation des interfaces : chaque famille d'interface a une couleur unique (N2/S1-MME bleu, N3/S1-U vert, N4/S11/S5-C/S5 ambre, SBI/S6a/Sxab violet, IMS rose, N6 turquoise, autre gris) et apparaît en badge compact dans la liste des sondes, la fiche sonde, l'onglet Live Capture et les formulaires d'enregistrement / d'édition.
- La disponibilité (verte, rouge, grise ou orange) et l'état du processus dumpcap (actif, inactif, démarrage, arrêt, inconnu) restent indépendants de la couleur de l'interface ; le trafic réellement vu est affiché à part de l'état du processus.
- Les valeurs techniques (source de capture, filtre BPF, PID, débit, segment) passent en monospace avec infobulle ; une mesure manquante reste « — » et n'est jamais remplacée par zéro, la courbe 15 min n'affiche que des échantillons réellement mesurés.
- Règles et couleurs centralisées dans `src/lib/polaris-ui/interfaceColors.ts` et `src/components/polaris/ui/InterfaceBadge.tsx` ; le ladder de l'Analyzer et la démo live utilisent la même table.

## 0.17.1

- Retour arrière du thème bleu nuit : l'application retrouve son thème clair tel qu'il était avant la 0.17.0 (fond, cartes, tableaux, ladder, panneau JSON, pages d'erreur).
- Le raccordement du Parcours abonné (0.17.0) est conservé tel quel.

## 0.17.0

- Le Parcours abonné est raccordé aux routes OIRAN 2.13.0 : frise Abonné → Contextes UE → Sessions PDN/PDU → Procédures, liens `EXACT` ou `OUVERT`, et chaîne TMSI ordonnée par références paquet.
- La colonne Abonné affiche `subscriber_pseudonym` et le badge `subscriber_session_count`; le tableau peut grouper les sessions par abonné et la fiche expose les sessions précédente/suivante.
- La recherche d'identité et les valeurs en clair restent limitées au rôle operator via les routes `/identities` existantes. Le viewer ne reçoit et n'affiche que des pseudonymes.
- Les événements et sessions conservent l'ordre de l'API ; aucun lien n'est inféré depuis l'heure, la cellule, l'IMEI ou l'adresse IP.

## 0.16.0

- Formulaire de sonde unifié : la création et l'édition partagent le même composant `ProbeForm` (mêmes dimensions, même typographie, même aperçu de charge utile, mêmes boutons).
- Fenêtre élargie à 1040 px (95vw max, 90vh max) : en-tête et pied fixes, le contenu est la seule zone qui défile.
- Interfaces de capture : table compacte avec en-têtes de colonnes — Interface, Rôle de capture, Protocole, Filtre BPF, Retirer — au lieu de lignes de formulaire empilées.
- Correction mapping des rôles : un rôle renvoyé par le serveur hors de l'énumération `N2 / N3 / N4 / S1 / N6` (S6a, S1-MME, S11, S5-C…) n'est plus réécrit en `N2`. Il est conservé tel quel, renvoyé tel quel, et signalé dans la ligne.
- Aperçu de charge utile : panneau sombre type éditeur de code, toujours visible et déplié, coloration syntaxique JSON, bouton Copier JSON, hauteur 220–350 px avec défilement interne.
- Validation : message sous le champ concerné, bordure rouge, résumé compact quand plusieurs champs sont en cause, et explication de l'action verrouillée dans le pied.

## 0.15.1

- Fiche sonde (Administration → Node Manager) : « Interfaces et points de capture » n'est plus un onglet, la table s'affiche directement sous « Identité et état » et « Télémétrie de la sonde » dans l'onglet Général.
- Les onglets de la fiche deviennent Général, Live Capture, Stockage et ingestion, Actions.

## 0.15.0

- Node Manager : la colonne « Détails » devient un menu `⋯` avec Détails, Modifier, Mettre à jour le logiciel et Supprimer.
- Édition : formulaire complet de la sonde (type, nom, serveur/namespace, adresse de gestion, site) et gestion `+ / −` des interfaces, rôles et filtres BPF; sauvegarde via `PUT /probes/{id}`.
- Suppression : confirmation tapée obligatoire et conservation explicite des segments, via `DELETE /probes/{id}`.
- Mise à jour logicielle : version cible et confirmation tapée, via `POST /probes/{id}/software-update`, stratégie rolling et capture préservée.
- Les actions échouent fermées sans permissions `probes.update`, `probes.delete` ou `probes.software_update`; aucun succès ni changement local n'est inventé quand le backend ne publie pas encore ces contrats.

## 0.14.0

- Node Manager : ajout du dialogue « Register probe » réellement raccordé à `POST /api/v1/probes`; l'identifiant est normalisé automatiquement et le payload suit exactement le contrat OIRAN (casse, champs requis et rôles d'interface).
- Autorisation : l'envoi reste fermé tant que `/auth/me` ne confirme pas `operator` ou `administrator` avec la permission `probes.create`; une erreur HTTP est affichée sans faux succès.
- Proxy : le jeton OIRAN reste côté serveur et la preuve `x-csrf-token` est dérivée côté proxy pour les mutations; tout en-tête d'autorisation ou de preuve fourni par le navigateur est remplacé.
- Tests : génération/validation du payload, mutation UI et dérivation CSRF couvertes par Vitest.

## 0.13.0

- Probe Manager : la page principale n'affiche plus que la liste des sondes enregistrées; un clic sur une sonde ouvre une fiche dédiée.
- Fiche sonde : onglets Général (identité, état, cycle de vie, état de capture, CPU/RAM/disque), Live Capture, Interfaces et points de capture, Stockage et ingestion, Actions — plus un retour explicite vers la liste.
- Capture live : la table « Capture live · interfaces » quitte la page principale pour la fiche de la sonde sélectionnée; les interfaces de `/probes/{id}/interfaces` sont fusionnées avec `/interfaces` et la disponibilité vient de `/interfaces/runtime`, sans masquer de ligne.
- Modes : `/probes`, `/interfaces` et `/interfaces/runtime` sont servis en démo; la démo n'expose que la disponibilité des interfaces, aucun débit n'est inventé.

## 0.12.0

- Administration : Node Manager alimenté par les valeurs réelles de `/probes`, `/version`, `/metrics` et `/storage/safety`, avec états, ressources, seuils disque et dernier contact.
- Capture live : inventaire par interface rafraîchi toutes les 5 s, processus/segment/rotation/filtre/source lorsque le backend les expose, mini-courbes navigateur sur 15 minutes et même source `/metrics` que la pastille LIVE.
- Interfaces : formulaires operator pour ajouter, modifier, supprimer et restaurer une configuration; confirmation tapée avant redémarrage ciblé et erreurs backend rendues sans faux succès.
- Network Topology : copie du rendu Simulator 5G/LTE alimentée par `/polaris-api/v1/lab`, `/nodes` et `/ues`, avec zoom, sélection, détails et pastilles de capture issues d'OIRAN.
- Proxy : relais même origine distincts OIRAN/POLARIS et injection optionnelle de jetons uniquement côté serveur; aucun secret n'est envoyé au navigateur ni versionné.
- Audit Log : les mutations d'interface attendent une trace serveur avant de rapporter le succès; aucun événement n'est fabriqué côté UI.

## 0.11.0

- Parcours abonné (écrans prêts, données OIRAN 2.13.0 à venir) : colonne « Abonné » avec badge « N sessions », option « Grouper par abonné » (menu ⋯ du tableau), bloc « Autres sessions de cet abonné », onglet « Parcours abonné » (frise ordonnée (capture_id, seq), procédures en couleur, liens EXACT pleins / OUVERT pointillés avec raison, liste TMSI, identités via le coffre pour operator, recherche IMSI/TMSI/IMEI/MSISDN).
- Routes consommées : `/subscribers/{p}/journey`, `/subscribers/{p}/tmsi`, `/sessions/{id}/identities`, `/identities?q=`. Absentes → « Non disponible : backend à venir » avec l'appel et le statut. Aucun lien « probable » affiché.

## 0.10.1

- Résultat de session calculé depuis les procédures observées : FAILED si une a échoué, sinon PARTIAL si une est partielle, sinon SUCCESS ; UNKNOWN seulement sans procédure (`state` HISTORICAL_CONTEXT ne porte pas de résultat).
- Décodage : affiche l'appel qui échoue (`GET /api/v1/events/{id}` → HTTP 404 · EVENT_NOT_FOUND) et l'arbre `decoded_ie_tree` fourni par le callflow. Défaut OIRAN constaté : les event_id publiés par `/callflow` ne sont pas résolvables par `/events/{id}`.
- Durées (session et procédures) = fin − début uniquement si tous les événements partagent le même capture_id, sinon « multi-capture ».
- Arrière-plan (Background / Lifecycle) séparé de la chronologie et exclu du Début/Fin/durée.
- UE « UNKNOWN » affiché « — ».

## Unreleased
- Analyzer : le menu `⋯` des sessions permet de gérer les colonnes avec des cases persistantes regroupées par protocole, de tout réafficher et de réinitialiser largeur et visibilité.

## 0.10.0 — Analyzer refactor
- Sessions table: 12 key columns (Numéro, Début UTC, IMSI masqué, Session ID, Résultat, Cause, Interfaces, PDU Session, Durée, Cellule, AMF/MME, gNB/eNB) plus existing ones; resizable, sortable, frozen first column, search, tooltips; SUCCESS/FAILED/PARTIAL/UNKNOWN badges.
- Four-panel layout: Sessions (25 %), Ladder, Décodage, new Analyse sessions; all resizable, double-click restores, Décodage/Analyse hideable.
- Ladder: timestamp, interface and sequence per message, zoom/fit, optional timers.
- Décodage: real decoded tree with expand/collapse all, field search, copy; UE info; technical metadata folded.
- Analyse sessions: summary, chronology, proven failures (click to jump to message), session KPIs (N/A when not provided).

## 0.9.3
- Analyzer : action directe « Afficher toutes les sessions », alimentée par une requête API sans filtre et ouverte dans un onglet de résultats.
- `capture · seq` utilise `anchor_capture_id` et `first_packet_number` lorsqu'ils sont fournis, sinon le premier événement du callflow dans l'ordre API (`capture_id`, `packet_references[0].packet_number`).
- Les groupes de procédure du ladder utilisent une clé React unique composée de `procedure_group` et du premier `event_id`.
- Tests de contrat ajoutés pour le repli d'ancre et les groupes de procédure répétés.

## 0.9.2
- Accueil et pages de contenu élargis progressivement à 1400 px dès 1600 px de viewport, puis 1600 px dès 1920 px, sans modifier Analyzer, Live ni KPI.
- Taille de texte racine fluide de 16 à 17 px pour conserver une lecture confortable sur les grands écrans.
- Barre supérieure enrichie avec la version POLARIS/UI réelle et son détail de composants, sans valeur de version codée en dur.
- État LIVE issu de `/metrics` toutes les 10 secondes : LIVE, BLOQUÉ, RETARD, HORS LIGNE ou DÉMO, avec animation accessible et accès direct au module Live.

## 0.9.1
- Adaptateur sessions aligné sur les champs réels `session_id`, `ue_pseudonym`, `state`, `technology`, `procedure` et `decode_completeness`; aucun identifiant de remplacement n'est fabriqué.
- Ladder alimenté par `message_name`, les participants, statuts, groupes de procédure, références paquet et arbre IE réels, dans l'ordre exact renvoyé par l'API.
- Corrélations lues depuis `edges` avec `confidence`/`evidence_type`, `rule_id`, `matching_identifiers` et `matched_rules`; seuls EXACT et OUVERT sont affichés.
- Pied de page et Paramètres alignés sur le contrat détaillé de `/version`; champs absents rendus par `—`.
- Ancre de session affichée depuis `anchor_capture_id` et `first_packet_number`; l'ordre du ladder reste celui de l'API.
- Hors Démo, aucun onglet issu des données de démonstration ne subsiste; un détail en échec indique son endpoint et son statut HTTP.
- Tests Vitest de contrat construits sur les noms de champs observés par ANR1, sans identité abonné en clair.

## 0.9.0
- Couche REST POLARIS typée en même origine : enveloppes, erreurs, confidentialité et hooks TanStack Query par ressource.
- Accueil, rôle en lecture seule, versions, sessions, ladder, preuves et Probe Manager raccordés sans refonte visuelle.
- Données de démonstration isolées et signalées; Démo désactivée par défaut, aucune substitution automatique après une erreur réseau.
- Fonctions sans endpoint explicitement indisponibles; Trafic masqué par défaut, identités toujours masquées, actions de capture operator avec confirmation et coordination.
- Version UI depuis package.json, requêtes enregistrées locales à ce navigateur, documentation des raccordements partiels et tests client/adaptateur/écrans.

## 0.8.1
- Analyzer : « Annuler » sur une nouvelle requête (onglet vierge ou ouvert depuis un modèle) ferme cet onglet et ramène à la page Requêtes ; les autres onglets restent ouverts.
- « Annuler » sur une requête déjà exécutée revient aux résultats de l'onglet, sans le fermer.

## 0.8.0
- Analyzer : « + Nouvelle requête » ouvre un vrai onglet de travail (Gabarit, Portée, Conditions ET/OU/≠, Regrouper par, Actions) ; la page Requêtes devient un espace de consultation (recherche, filtres Toutes/Favoris/Partagées, modèles, requêtes enregistrées).
- Modèles et requêtes enregistrées s'ouvrent dans un nouvel onglet ; indicateur de modifications non enregistrées et confirmation avant fermeture.

## 0.7.0
- Onglets de travail réels : ils restent ouverts quand on lance une requête ou quand on revient à « Requêtes » ; seul le × de l'onglet le ferme.
- Chaque onglet conserve ses conditions, sa sélection et son filtre d'UE (Session / Comparaison / Trace).
- Lancer une requête ouvre un nouvel onglet ; si un onglet porte exactement les mêmes conditions, il est réactivé au lieu d'être dupliqué.
- « Modifier la requête » édite l'onglet actif sans en créer de doublon ; « + » et « Nouvelle analyse » ouvrent un onglet de requête vierge ; un onglet non modifié garde son nom.
- Barre d'onglets visible aussi sur l'écran Requêtes, défilement horizontal si beaucoup d'onglets, libellés traduits (EN).

## 0.6.0
- Live Trace refondu : recherche IMSI/SUPI (operator, saisie masquée, empreinte journalisée, jamais persistée), pseudonyme, GUTI/TMSI, cellule, run ; statuts Trouvé / Non trouvé / À prouver / Invalide.
- Signalisation en deux modes Flèches (ladder 5G/LTE) et Lignes (tableau), mêmes événements et filtres, sélection synchronisée, décodage + preuves, export CSV (operator).
- Panneau UE Info (identité, radio, cœur, état UE) remplace Identity Chain ; chaque valeur porte sa preuve (seq) ou « Non disponible ».
- UE Procedure Updates dérivées des messages observés.
- Throughput UL/DL agrandi : fenêtres 1/5/15/30 min, légende interactive, min/max/moy, tooltip, zoom par sélection, plein écran.
- Barre de compteurs compacte, panneaux redimensionnables/repliables, préférences conservées, pause sans perte.

## 0.5.0
- Refonte du module KPI : onglets Catalogue KPI, KPI Builder, Dashboards, Anomalies.
- Arbre SYSTEM / PUBLIC / PRIVATE repliable, recherche, filtres techno/propriétaire, favoris, duplication, ajout à un dashboard, panneau redimensionnable.
- KPI Builder en 5 étapes (règles ET/OU/NON, agrégation, dédup, invariants, dimensions, prévisualisation, publication SemVer + CHANGELOG).
- Dashboards : bibliothèque, 4 dashboards SYSTEM, éditeur grille 12 colonnes (déplacer/redimensionner), 13 types de widgets avec compatibilité, filtres globaux, export CSV/JSON.
- Anomalies : liste filtrable, détail, historique, fermeture avec justification + preuve.
- Interrupteur « Démo » désactivé par défaut : états vides explicites sans OIRAN.
- Persistance locale (navigateur) ; droits viewer/operator appliqués côté interface uniquement.

## 0.4.0
- Module KPI & Anomalies activé : carte Home sans « Bientôt », page dédiée (#kpi).
- Catalogue KPI (Annexe B) avec santé sonde en premier : dumpcap, segments ignorés, retard d'import, disque, puis procédures 5G/4G, N4, erreurs S6a/SBI, latence intra-capture, liens EXACT.
- Fiche KPI versionnée (SemVer) : formule, événements sources, dimensions, unité, dédup, invariant, requête générée toujours affichable.
- Dataviews Séries / Heatmap causes × temps / Top-N avec granularités 1 min / 15 min / 1 h / 1 j ; aucun chiffre sans OIRAN (« — », fraîcheur jamais verte).
- Anomalies N1 (règles et invariants) et N2 (nouveauté) avec statuts OUVERT / FERMÉ.

## 0.3.0
- Analyzer aligné sur l'accueil : couleur d'accent sur sélection, onglets et focus.
- Séparateur déplaçable tableau / ladder (double-clic pour réinitialiser), tableau masquable, ladder plein écran (F, Échap).
- Ladder : largeur adaptative, libellés tronqués avec détail au survol, filtre par interface, procédures repliables, navigation ↑/↓, causes d'échec affichées à part.
- Panneau droit redimensionnable et masquable ; onglet actif et disposition conservés.
- Lentille de clé (TEID, SEID, IDs…) distincte de la lentille de cause (NAS, NGAP, PFCP, HTTP, Diameter).
- Barre de filtres simplifiée : Colonnes et Exporter regroupés dans le menu « ⋯ ».
- Ordre canonique des messages inchangé ; aucune donnée modifiée.

## 0.2.0
- Page d'accueil refaite : en-tête, action principale « Nouvelle analyse », actions rapides, cinq cartes modules, activité récente, état de la plateforme.
- Aucune donnée fictive sur l'accueil : l'état plateforme affiche « — » tant que le service OIRAN n'est pas connecté.
- Onglet « Templates » dans la navigation, bouton Notifications.
- Paramètres : version, mot de passe, couleur d'accent (Bleu, Noir, Vert).

## 0.1.0
- Maquette initiale POLARIS Analyzer.
