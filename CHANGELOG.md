# Changelog

## 2.2.0

- Version applicative POLARIS unifiée à `2.2.0` dans les métadonnées du paquet, l'écran À propos et le pied de page.
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
