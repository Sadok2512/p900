# Refonte du module KPI & Anomalies — Audit et proposition

## 1. Audit de l'existant (v0.4.0)

What already exists on the KPI page and can be reused:
- **Catalogue**: a flat list of ~20 KPIs in 8 groups (probe health, 5G, 4G, N4, errors, latency, TCP/Traffic, correlation). Each one has a versioned sheet: formula, sources, dimensions, dedup, invariant and the generated query.
- **Dataviews**: Séries, Heatmap and Top-N, with granularity from 1 min to 1 day.
- **Anomalies N1/N2**: rule lists with OPEN/CLOSED status.
- **Demo data**: added at your request. This contradicts the brief ("pas de données fictives").
- **Not present**: no tree view, no SYSTEM/PUBLIC/PRIVATE libraries, no builder, no dashboards, no favourites, no saving.
- **Not available (no backend)**: the OIRAN service, user accounts/roles enforced on the server, saving KPIs and dashboards on the server, and drill-down down to the PCAP. These are flagged, not faked.

## 2. Proposed structure

```text
KPI & Anomalies
[ Catalogue ] [ KPI Builder ] [ Dashboards ] [ Anomalies ]      ← secondary tabs
```

**Catalogue**
```text
| Arbre (repliable, redimensionnable) | Visualisation (graphe + résultats) | Fiche KPI (masquable) |
| SYSTEM ▸ 5G SA ▸ Accessibility …    | courbe · dimensions · requête      | version, formule,     |
| PUBLIC ▸ Shared / Team              | drill-down: KPI→Sessions→Messages  | ★ favori, dupliquer,  |
| PRIVATE ▸ My KPI / Drafts / ★       | →Preuves→PCAP (liens)              | + dashboard           |
```
Search, plus filters by technology, category and owner, with a counter per folder. SYSTEM is read-only and offers only "Duplicate to PRIVATE".

**KPI Builder**: a 5-step editor on the left with a live preview on the right.
1. General: name, id, description, 4G/5G/Both, category, folder, visibility, unit, version.
2. Formula: numerator and denominator built from rules (protocol › message › parameter › value/cause/result), AND/OR/NOT, aggregation (COUNT…percentile), dedup, invariants.
3. Dimensions: chips (RAT, site, gNB/eNB, cell, TAC, AMF/MME, SMF/UPF, DNN, S-NSSAI, scenario, run, interface).
4. Preview: data scope, Run, result, generated query, invariant check, errors.
5. Publish: workflow Brouillon → Testé → Validé → Publié, requiring SemVer, CHANGELOG entry, author and date. Only operator/admin can publish.

**Dashboards**
- A library (SYSTEM / PUBLIC / PRIVATE) shown as cards, with actions: new, open, duplicate, rename, share, export, delete (with confirmation and an audit entry).
- A full-screen editor: a 12-column grid with widgets you can drag and resize, and a configuration panel on the right (series, colours, line, axes and secondary axis, min/max, thresholds, legend, grid, histogram bins + CDF + percentiles).
- Global filters (period, run, RAT, site, cell, interface, DNN, S-NSSAI); each widget either follows them or has its own.
- 13 widget types. Types that don't fit the data are greyed out, with a reason.
- 4 SYSTEM dashboards defined: 5G SA Overview, LTE Overview, User Plane Performance, Probe Health.

**Anomalies**: a list that can be filtered by KPI, severity, period and status, with search. The detail panel shows the event history, links to sessions and evidence, and a close button that requires a justification and evidence. N3 is shown as "lot non disponible".

**Roles**: viewer can only look; operator can create and publish; admin also gets the audit view. In the interface these are visual only, until a server enforces them.

## 3. Decisions for you

1. **Demo data**: the brief forbids it, but you asked me for it earlier. My proposal: keep a "Démo" switch, off by default; when it's off, the page shows a clear empty state.
2. **Saving**: KPIs and dashboards would be saved in the browser for now. Real sharing between users (PUBLIC) needs Lovable Cloud.

## Technical details
- New `src/components/polaris/kpi/` folder (Catalogue, Builder, Dashboards, Anomalies, shared tree and chart components), in TypeScript per the brief. PolarisApp.jsx keeps only the routing.
- Grid drag/resize done by hand with pointer events (no new library); charts in SVG; PNG/CSV export from the browser.
- Version 0.5.0 + CHANGELOG.
