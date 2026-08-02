# Tests de non-régression — moteur métier FLAIR

## Objectif

Ce dossier protège le comportement du moteur FLAIR pendant l’extraction et l’amélioration du lexique et de la classification sectorielle.

Il fonctionne indépendamment du canal d’arrivée du signal :

- import SQL actuel ;
- saisie manuelle ;
- article collé dans l’application ;
- future collecte automatique par IA.

Le principe reste le même : le collecteur fournit un objet signal structuré, puis le moteur FLAIR applique ses règles métier, sectorielles, de timing, de maturité, de crédibilité et de scoring.

## Emplacement

Déposer le dossier `tests-flair-metier` à la racine du dépôt GitHub FLAIR, au même niveau que :

- `flair-metier.js` ;
- `source-veille-rules.js` ;
- `app.js` ;
- `app.html`.

Ces tests ne sont jamais chargés par `app.html` et ne modifient pas l’application en ligne.

## Exécution

Depuis la racine du dépôt :

```bash
node tests-flair-metier/test-flair-metier.js
```

Aucune installation npm n’est nécessaire.

## Résultats

Le script affiche :

- les tests réussis ;
- les tests réellement échoués ;
- les défauts historiques encore présents.

Depuis le Lot 4, les faux positifs `soins` dans `besoins` et la classification cosmétique associée sont corrigés et doivent rester à zéro.

## Tests couverts

- disponibilité des API publiques `window.FLAIR_METIER` et `window.FLAIR_SOURCE_VEILLE` ;
- normalisation et détection de mots-clés ;
- faux positifs connus, dont `soins` dans `besoins` ;
- mots courts, expressions composées, accents, apostrophes et tirets ;
- classification secteur / sous-secteur ;
- règles source veille ;
- familles stratégiques ;
- exécution du timing et du scoring ;
- maintien d’une façade publique compatible.

## Compatibilité avec la future collecte automatique IA

Ces tests ne vérifient pas la provenance du signal. Ils vérifient son traitement par le moteur.

La future IA devra produire les champs attendus par FLAIR, par exemple :

```js
{
  titre: "Nouvelle ligne de production",
  entreprise_nom: "Entreprise exemple",
  description: "...",
  source: "...",
  date_signal: "2026-08-02",
  region: "grand_est",
  type_signal: "nouvelle_ligne"
}
```

Le moteur devra ensuite rester l’unique autorité pour :

- la classification ;
- l’affinité métier ;
- le timing ;
- la maturité ;
- la crédibilité ;
- le score final ;
- les explications du Copilote.

L’IA de collecte ne devra pas imposer elle-même ces décisions.

## État actuel du chantier

- Lot 1 : tests de non-régression — validé ;
- Lot 2 : extraction du lexique — validé ;
- Lot 3 : extraction de la classification sectorielle — validé ;
- Lot 4 : correction générique des correspondances lexicales — validé.

Résultat attendu :

```text
Tests réussis : 27
Tests échoués : 0
Défauts historiques documentés : 0
```
