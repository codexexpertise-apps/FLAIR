// =========================================================================
// FLAIR — CLASSIFICATION SECTORIELLE / EXTRACTION MÉCANIQUE LOT 3
// =========================================================================
// Rôle : isoler la taxonomie secteurs / sous-secteurs et son calcul historique.
// Mode : compatibilité stricte — aucun changement de résultat métier.
// Le correctif lexical générique sera appliqué dans un lot ultérieur.
// =========================================================================

(function () {
  "use strict";

  function normaliserTexteSecteurs(value) {
    const fn = window.FLAIR_GEO?.normaliserTexteSimple;
    if (typeof fn === 'function') return fn(value);
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function texteCompletSignalSecteurs(signal = {}) {
    return [
      signal.titre,
      signal.entreprise_nom,
      signal.resume_brut,
      signal.resume,
      signal.description,
      signal.contenu,
      signal.raison_score,
      signal.angle_commercial,
      signal.action_recommandee,
      signal.secteur_estime,
      signal.source_nom,
      signal.type_source,
      signal.region_nom,
      signal.departement_nom,
      signal.famille_projet,
      signal.projet_label
    ].filter(Boolean).join(' ');
  }

  function motCleSecteurPresent(texteNormalise = '', motCle = '', normaliser = normaliserTexteSecteurs) {
    const lexique = window.FLAIR_METIER_LEXIQUE || {};
    if (typeof lexique.motClePresentHistoriqueMetier === 'function') {
      return lexique.motClePresentHistoriqueMetier(texteNormalise, motCle, normaliser);
    }

    const mot = normaliser(motCle);
    if (!mot) return false;
    if (mot.length <= 4 || ['soin', 'lot', 'os', 'map'].includes(mot)) {
      const escaped = mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(texteNormalise);
    }
    return texteNormalise.includes(mot);
  }

    const FLAIR_REGLES_CLASSIFICATION_SECTORIELLE = [
    // =========================
    // Agroalimentaire — sous-secteurs métier
    // Marques volontairement exclues : classification par activité, pas par entreprise.
    // =========================
    { secteur: 'Agroalimentaire', sous: 'Viande / salaison', poids: 98, mots: ['viande', 'viandes', 'charcuterie', 'salaison', 'salaisons', 'abattoir', 'volaille', 'volailles', 'boucherie industrielle', 'découpe viande', 'decoupe viande', 'jambon', 'saucisson', 'terrine', 'pâté', 'pate'] },
    { secteur: 'Agroalimentaire', sous: 'Produits laitiers / fromages', poids: 98, mots: ['fromage', 'fromages', 'fromagerie', 'fromageries', 'laiterie', 'laiteries', 'produits laitiers', 'produit laitier', 'affinage', 'affineur', 'fruitière', 'fruitiere', 'yaourt', 'yaourts', 'dessert lacté', 'dessert lacte', 'beurre', 'crème', 'creme', 'découpe fromage', 'decoupe fromage', 'portionnage fromage', 'emballage fromage'] },
    { secteur: 'Agroalimentaire', sous: 'Produits de la mer / poisson', poids: 96, mots: ['poisson', 'poissons', 'produits de la mer', 'produit de la mer', 'surimi', 'pané de poisson', 'pane de poisson', 'panés de poisson', 'panes de poisson', 'filet de poisson', 'filets de poisson', 'saumon', 'thon', 'crustacé', 'crustace', 'crevette', 'moules', 'arête', 'arete'] },
    { secteur: 'Agroalimentaire', sous: 'Plats cuisinés / traiteur frais', poids: 95, mots: ['plat cuisiné', 'plats cuisinés', 'plat cuisine', 'plats cuisines', 'traiteur', 'traiteur frais', 'prêt à manger', 'pret a manger', 'barquette repas', 'barquettes alimentaires', 'cuisine centrale', 'salade préparée', 'salade preparee'] },
    { secteur: 'Agroalimentaire', sous: 'Snacking / sandwichs / salades', poids: 94, mots: ['sandwich', 'sandwichs', 'wrap', 'wraps', 'snacking', 'salade composée', 'salades composées', 'salade composee', 'salades composees', 'repas nomade', 'vente à emporter', 'vente a emporter'] },
    { secteur: 'Agroalimentaire', sous: 'Boulangerie / biscuiterie / viennoiserie', poids: 92, mots: ['boulangerie', 'biscuiterie', 'pâtisserie', 'patisserie', 'viennoiserie', 'pain', 'pain industriel', 'biscuit', 'biscuits', 'gâteau', 'gateau', 'gâteaux', 'gateaux', 'brioche', 'brioches'] },
    { secteur: 'Agroalimentaire', sous: 'Fruits transformés / compotes / confitures', poids: 92, mots: ['compote', 'compotes', 'confiture', 'confitures', 'dessert fruitier', 'desserts fruitiers', 'purée de fruits', 'puree de fruits', 'fruits transformés', 'fruits transformes', 'préparation fruitière', 'preparation fruitiere', 'site fruitier'] },
    { secteur: 'Agroalimentaire', sous: 'Fruits et légumes / stations de conditionnement', poids: 90, mots: ['fruits', 'légumes', 'legumes', 'station de conditionnement', 'calibrage', 'maraîcher', 'maraicher', 'conditionnement fruits', 'conditionnement légumes', 'conditionnement legumes'] },
    { secteur: 'Agroalimentaire', sous: 'Boissons / sirops / liquides alimentaires', poids: 90, mots: ['boisson', 'boissons', 'sirop', 'sirops', 'jus', 'eau minérale', 'eau minerale', 'soda', 'brasserie', 'embouteillage', 'ligne embouteillage', 'ligne d embouteillage', 'bouteille', 'flacon'] },
    { secteur: 'Agroalimentaire', sous: 'Produits végétaux / alternatives', poids: 88, mots: ['végétal', 'vegetal', 'protéines végétales', 'proteines vegetales', 'alternative végétale', 'alternative vegetale', 'tofu', 'légumineuses', 'legumineuses', 'steak végétal', 'steak vegetal'] },

    // =========================
    // Pharmaceutique
    // =========================
    { secteur: 'Pharmaceutique', sous: 'Formes sèches / comprimés', poids: 96, mots: ['forme sèche', 'forme seche', 'formes sèches', 'formes seches', 'comprimé', 'comprime', 'comprimés', 'comprimes', 'gélule', 'gelule', 'gélules', 'gelules', 'blister'] },
    { secteur: 'Pharmaceutique', sous: 'Formes liquides / injectables', poids: 95, mots: ['injectable', 'injectables', 'ampoule', 'ampoules', 'flacon pharma', 'solution injectable', 'formes liquides', 'forme liquide'] },
    { secteur: 'Pharmaceutique', sous: 'CDMO / sous-traitance pharma', poids: 94, mots: ['cdmo', 'sous-traitance pharma', 'sous traitance pharma', 'façonnier pharma', 'faconnier pharma', 'production pharmaceutique'] },
    { secteur: 'Pharmaceutique', sous: 'Dispositifs médicaux / conditionnement stérile', poids: 92, mots: ['dispositif médical', 'dispositif medical', 'dispositifs médicaux', 'dispositifs medicaux', 'salle blanche', 'stérile', 'sterile', 'conditionnement stérile', 'conditionnement sterile'] },
    { secteur: 'Pharmaceutique', sous: 'Conditionnement pharma', poids: 90, mots: ['pharma', 'pharmaceutique', 'médicament', 'medicament', 'laboratoire pharmaceutique', 'conditionnement pharma', 'traçabilité pharma', 'tracabilite pharma'] },

    // =========================
    // Cosmétique
    // =========================
    { secteur: 'Cosmétique', sous: 'Fabrication cosmétique', poids: 92, mots: ['fabrication cosmétique', 'fabrication cosmetique', 'crème cosmétique', 'creme cosmetique', 'cosmétique', 'cosmetique', 'soin visage', 'soins visage', 'maquillage'] },
    { secteur: 'Cosmétique', sous: 'Conditionnement cosmétique', poids: 90, mots: ['conditionnement cosmétique', 'conditionnement cosmetique', 'parfum', 'parfums', 'parfumerie', 'beauté', 'beaute', 'flacon', 'flacons', 'tube cosmétique', 'tube cosmetique'] },
    { secteur: 'Cosmétique', sous: 'Parfums / flacons / remplissage', poids: 88, mots: ['flaconnage', 'remplissage flacon', 'ligne de remplissage', 'cosmétique liquide', 'cosmetique liquide'] },
    { secteur: 'Cosmétique', sous: 'Crèmes / soins / maquillage', poids: 88, mots: ['crème', 'creme', 'crèmes', 'cremes', 'rouge à lèvres', 'rouge a levres', 'soins', 'maquillage'] },

    // =========================
    // Plasturgie
    // =========================
    { secteur: 'Plasturgie', sous: 'Extrusion / film plastique', poids: 96, mots: ['plasturgie', 'extrusion', 'ligne extrusion', 'ligne d extrusion', 'film plastique', 'compound', 'granules', 'granulés', 'granules plastique', 'granulés plastique'] },
    { secteur: 'Plasturgie', sous: 'Films techniques / extrusion', poids: 94, mots: ['film technique', 'films techniques', 'film barrière', 'film barriere', 'extrusion film', 'ligne cast', 'film multicouche', 'evoh'] },
    { secteur: 'Plasturgie', sous: 'Thermoformage / injection', poids: 92, mots: ['thermoformage', 'thermoformeuse', 'injection plastique', 'presse à injecter', 'presse a injecter', 'soufflage plastique'] },
    { secteur: 'Plasturgie', sous: 'Recyclage plastique / tri matière', poids: 90, mots: ['recyclage plastique', 'rpet', 'pet recyclé', 'pet recycle', 'broyage plastique', 'tri plastique', 'granulation'] },

    // =========================
    // Packaging
    // =========================
    { secteur: 'Packaging', sous: 'Film / flowpack / operculage', poids: 98, mots: ['flowpack', 'flow pack', 'operculage', 'opercule', 'barquette', 'skin pack', 'emballage flexible', 'film technique', 'film alimentaire'] },
    { secteur: 'Packaging', sous: 'Thermoformage / barquettes / skin pack', poids: 94, mots: ['thermoformage alimentaire', 'barquette thermoformée', 'barquette thermoformee', 'skin pack', 'barquettes', 'operculage barquette'] },
    { secteur: 'Packaging', sous: 'Carton / étuis / conditionnement secondaire', poids: 92, mots: ['carton', 'cartonnage', 'étui', 'etui', 'étuis', 'etuis', 'encartonnage', 'conditionnement secondaire', 'caisse carton', 'mise en carton'] },
    { secteur: 'Packaging', sous: 'Étiquettes / sleeves / traçabilité', poids: 90, mots: ['étiquette', 'etiquette', 'étiquettes', 'etiquettes', 'sleeve', 'sleeves', 'manchon', 'manchons', 'traçabilité', 'tracabilite', 'marquage', 'code barre', 'qr code'] },

    // =========================
    // Industrie transverse
    // =========================
    { secteur: 'Bois', sous: 'Scierie / panneaux / palettes', poids: 92, mots: ['scierie', 'bois', 'panneaux bois', 'palettes', 'sciage', 'rabotage', 'menuiserie industrielle'] },
    { secteur: 'Textile', sous: 'Textile technique / non-tissé', poids: 90, mots: ['textile', 'non tissé', 'non tisse', 'non-tissé', 'fibres', 'recyclage textile', 'textile technique'] },
    { secteur: 'Chimie', sous: 'Process chimique / conditionnement', poids: 90, mots: ['chimie', 'chimique', 'poudres chimiques', 'conditionnement chimique', 'process chimique'] },
    { secteur: 'Logistique', sous: 'Plateforme / flux internes', poids: 85, mots: ['plateforme logistique', 'logistique interne', 'entrepôt', 'entrepot', 'flux logistique'] }
  ];

  function detecterSecteurSousSecteur(signal = {}, options = {}) {
    const normaliser = typeof options.normaliserTexte === 'function'
      ? options.normaliserTexte
      : normaliserTexteSecteurs;
    const construireTexte = typeof options.texteCompletSignal === 'function'
      ? options.texteCompletSignal
      : texteCompletSignalSecteurs;
    const matcher = typeof options.motClePresent === 'function'
      ? options.motClePresent
      : (texte, mot) => motCleSecteurPresent(texte, mot, normaliser);

    const texte = normaliser(construireTexte(signal));
    const matches = FLAIR_REGLES_CLASSIFICATION_SECTORIELLE
      .map(rule => {
        const nb = rule.mots.filter(mot => matcher(texte, mot)).length;
        return { ...rule, nb, score: nb * (rule.poids || 80) };
      })
      .filter(rule => rule.nb > 0)
      .sort((a, b) => b.score - a.score || (b.poids || 0) - (a.poids || 0));

    if (matches.length) {
      return {
        secteur: matches[0].secteur,
        sous: matches[0].sous,
        confiance: Math.min(100, matches[0].score),
        indices: matches[0].mots.filter(mot => matcher(texte, mot)).slice(0, 4)
      };
    }

    if (signal.secteur_estime) return { secteur: signal.secteur_estime, sous: '', confiance: 40, indices: [] };
    return { secteur: '', sous: '', confiance: 0, indices: [] };
  }

  window.FLAIR_METIER_SECTEURS = {
    version: 'lot3-extraction-mecanique',
    mode: 'compatibilite_stricte',
    rules: FLAIR_REGLES_CLASSIFICATION_SECTORIELLE,
    normaliserTexteSecteurs,
    texteCompletSignalSecteurs,
    detecterSecteurSousSecteur
  };
})();
