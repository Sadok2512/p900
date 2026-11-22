# Relève p900 2.8.8

## Objet

Correction de la lenteur et des erreurs globales observées à l’ouverture d’une session sur le lab.

## Base et version

- Base : `b54245242a3c39e5bbd9c0bd4624dada292a7312` (`fix/p900-2.8.7-live-dedup`).
- Branche : `fix/p900-2.8.8-production-runtime`.
- Version candidate : `2.8.8`.
- Rollback : paquet p900 2.8.7 conservé sur le lab.

## Changements

- Runtime lab : build Nitro `node-server`, sans serveur Vite de développement.
- Ordonnanceur HTTP : quatre requêtes au total, dont deux détails de session au maximum.
- Timeout d’un détail : 30 secondes ; l’échec reste local au panneau concerné.
- Barrière d’erreur globale traduite en français.

## Validation attendue

```text
npm test
npm run build:node
curl / puis /api/v1/health via le proxy 8091
ouvrir plusieurs sessions et vérifier Ladder/Messages sans erreur globale
```

## Limite backend observée avant correction

oiran-api était soumis à une limite d’un CPU et son cgroup a rencontré sa limite mémoire à plusieurs reprises. La correction UI réduit la pression mais ne remplace pas une correction de capacité ou de concurrence côté Analyzer.

Le `package-lock.json` hérité de 2.8.7 référençait encore `@lovable.dev/vite-tanstack-config` 2.26.5 alors que `package.json` exigeait 2.27.1. Il a été resynchronisé avec npm sous Node 22 avant le build 2.8.8.

## Interdits respectés

Aucun geste Open5GS, OTV, catalogue Control, suppression ou réécriture Git.
