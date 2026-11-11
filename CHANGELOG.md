# Changelog

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
