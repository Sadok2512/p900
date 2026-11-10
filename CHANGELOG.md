# Changelog

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
