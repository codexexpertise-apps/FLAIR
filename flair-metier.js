// =========================================================================
// FLAIR — MOTEUR MÉTIER / AFFINITÉ COMMERCIALE V1.0
// =========================================================================
// Rôle actuel V1.3 : isoler la famille "affinité régionale" utilisée dans
// le scoring commercial, sans modifier la logique métier existante.
//
// Important : ce module ne remplace pas flair-geo.js.
// - flair-geo.js = normalisation / extraction régions-départements.
// - flair-metier.js = lecture commerciale de cette géographie pour le score.
// =========================================================================

(function () {
  "use strict";

  let profilProvider = function () { return null; };

  function getGeoApi() {
    return window.FLAIR_GEO || {};
  }

  function normaliserCleRegionFlair(value) {
    const geo = getGeoApi();
    const labelRegionCommerciale = geo.labelRegionCommerciale || (v => String(v || ''));
    const normaliserCleGeographie = geo.normaliserCleGeographie || (v => String(v || '').toLowerCase().trim());
    const label = labelRegionCommerciale(value || '');
    return normaliserCleGeographie(label).replace(/_/g, ' ').trim();
  }

  function regionsSecondairesProfilNormalisees(commercial = null) {
    const profil = commercial || profilProvider() || {};
    const regionsSecondaires = profil?.regions_secondaires || profil?.regionsSecondaires || [];
    const liste = Array.isArray(regionsSecondaires)
      ? regionsSecondaires
      : String(regionsSecondaires || '').split(/[,;|]/);

    return liste
      .map(region => normaliserCleRegionFlair(region))
      .filter(Boolean);
  }

  const GeoAffinityEngine = {
    calculate(commercial = {}, signal = {}) {
      const geo = getGeoApi();
      const signalRegion = geo.signalRegion || (s => s?.region_nom || s?.region || s?.region_signal || '');
      const estRegionNationaleFlair = geo.estRegionNationaleFlair || (() => false);

      const regionSignalBrute = signalRegion(signal) || signal.region_nom || signal.region || signal.region_signal || '';
      const regionCommercialeBrute = commercial?.region || '';
      const regionSignalCle = normaliserCleRegionFlair(regionSignalBrute);
      const regionCommercialeCle = normaliserCleRegionFlair(regionCommercialeBrute);

      if (!regionSignalCle || regionSignalCle === 'non determinee' || regionSignalCle === 'non renseignee') {
        return { coefficient: 1, niveau: 'geo_inconnue' };
      }

      if (estRegionNationaleFlair(regionSignalCle)) {
        return { coefficient: 1, niveau: 'national_signal' };
      }

      if (!regionCommercialeCle || estRegionNationaleFlair(regionCommercialeCle)) {
        return { coefficient: 1, niveau: regionCommercialeCle ? 'national_commercial' : 'commercial_non_renseigne' };
      }

      if (regionSignalCle === regionCommercialeCle) {
        return { coefficient: 1, niveau: 'principale' };
      }

      const regionsSecondaires = regionsSecondairesProfilNormalisees(commercial);
      if (regionsSecondaires.includes(regionSignalCle)) {
        return { coefficient: 0.9, niveau: 'secondaire' };
      }

      return { coefficient: 0.4, niveau: 'hors_secteur' };
    }
  };

  function coefficientGeographiqueSignal(signal = {}) {
    return GeoAffinityEngine.calculate(profilProvider() || {}, signal);
  }

  function construirePhraseGeographique(ajustement = {}) {
    if (!ajustement || ['non_renseigne', 'geo_inconnue', 'commercial_non_renseigne'].includes(ajustement.niveau)) return '';

    if (ajustement.niveau === 'national_signal') {
      return 'Zone commerciale : projet national ou multi-sites, compatible avec plusieurs territoires.';
    }

    if (ajustement.niveau === 'national_commercial') {
      return 'Zone commerciale : commercial positionné France entière.';
    }

    if (ajustement.niveau === 'principale') {
      return 'Zone commerciale : même région que le commercial.';
    }

    if (ajustement.niveau === 'secondaire') {
      return 'Zone commerciale : région secondaire du commercial, priorité légèrement réduite.';
    }

    if (ajustement.niveau === 'hors_secteur' || ajustement.niveau === 'eloignee') {
      return 'Zone commerciale : région clairement hors secteur du commercial, priorité réduite.';
    }

    return '';
  }



  function scoreGeographiqueDepuisAffinity(geo = {}) {
    const coefficient = Number(geo.coefficient);
    if (!Number.isFinite(coefficient)) return 60;
    return Math.max(0, Math.min(100, Math.round(coefficient * 100)));
  }

  function scoreMetierDepuisEnrichissement(enrichissement = null, profilCommercial = '') {
    const geoFallback = { score: 60, niveau: 'metier_non_determine' };

    const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
    if (!enrichissement || !profilCommercialNormalise) return geoFallback;

    const profilsDetectes = profilsMetiersDetectes(enrichissement).map(normaliserSlugProfilMetierFlair).filter(Boolean);
    const profilPrincipal = normaliserSlugProfilMetierFlair(enrichissement.profil_metier_principal || '');
    const compatibilite = Number(compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise)) || 0;

    if (!profilsDetectes.length) {
      return { score: 60, niveau: 'metier_transverse', compatibilite };
    }

    if (profilPrincipal && profilPrincipal === profilCommercialNormalise) {
      return { score: 95, niveau: 'metier_principal', compatibilite };
    }

    if (compatibilite >= 0.85) {
      return { score: 90, niveau: 'metier_secondaire_fort', compatibilite };
    }

    if (compatibilite >= 0.60) {
      return { score: 72, niveau: 'metier_compatible', compatibilite };
    }

    if (compatibilite > 0) {
      return { score: 58, niveau: 'metier_indirect', compatibilite };
    }

    return { score: 40, niveau: 'metier_hors_cible', compatibilite };
  }

  function plafonnerScoreFinalParMetier(scoreFinal, scoreMetier) {
    const score = Math.max(0, Math.min(100, Math.round(Number(scoreFinal) || 0)));
    const metier = Math.max(0, Math.min(100, Math.round(Number(scoreMetier) || 0)));

    // FLAIR V1.4 : le métier redevient un garde-fou.
    // Une excellente géographie ne doit pas transformer un signal hors métier en Top 3 brûlant.
    if (metier <= 40) return Math.min(score, 65);
    if (metier <= 58) return Math.min(score, 75);
    if (metier <= 72) return Math.min(score, 85);
    return Math.min(score, 95);
  }

  function calculerScoresSeparationFlair(options = {}) {
    const scoreIndustriel = Math.max(0, Math.min(95, Math.round(Number(options.score_industriel ?? options.scoreIntrinseque ?? 0) || 0)));
    const signal = options.signal || {};
    const timing = options.timing || {};
    const enrichissement = options.enrichissement || null;
    const commercial = options.commercial || profilProvider() || {};
    const profilCommercial = options.profil_commercial || commercial.profil_metier || commercial.profilMetier || '';
    const geo = options.geo || GeoAffinityEngine.calculate(commercial, signal);
    const metier = options.metier || scoreMetierDepuisEnrichissement(enrichissement, profilCommercial);

    const scoreGeographique = scoreGeographiqueDepuisAffinity(geo);
    const scoreMetier = Math.max(0, Math.min(100, Math.round(Number(metier.score) || 0)));
    const scoreTiming = Math.max(0, Math.min(100, Math.round(Number(timing.score ?? options.score_timing ?? 50) || 50)));

    // Pondération validée V1.4 : métier d'abord, puis potentiel industriel, timing et géographie.
    // La géographie confirme la priorité commerciale, mais ne doit plus dominer le métier.
    const brut =
      (scoreMetier * 0.40) +
      (scoreIndustriel * 0.25) +
      (scoreTiming * 0.20) +
      (scoreGeographique * 0.15);

    const scoreFinal = plafonnerScoreFinalParMetier(brut, scoreMetier);

    return {
      score_industriel: scoreIndustriel,
      score_metier: scoreMetier,
      score_geographique: scoreGeographique,
      score_timing: scoreTiming,
      score_final_distribue: scoreFinal,
      score: scoreFinal,
      geo,
      metier,
      coefficient_total: Number(((Number(geo.coefficient) || 1) * ((scoreMetier || 60) / 100)).toFixed(3))
    };
  }

  function formaterResumeScoresFlair(scores = {}) {
    if (!scores) return '';
    const industriel = scores.score_industriel;
    const metier = scores.score_metier;
    const geo = scores.score_geographique;
    const timing = scores.score_timing;
    const final = scores.score_final_distribue ?? scores.score;

    return [
      Number.isFinite(Number(industriel)) ? `Industriel ${industriel}/100` : '',
      Number.isFinite(Number(metier)) ? `Métier ${metier}/100` : '',
      Number.isFinite(Number(geo)) ? `Géographie ${geo}/100` : '',
      Number.isFinite(Number(timing)) ? `Timing ${timing}/100` : '',
      Number.isFinite(Number(final)) ? `Final ${final}/100` : ''
    ].filter(Boolean).join(' · ');
  }



  // =========================================================================
  // Dépendances locales du moteur métier (V1.7)
  // =========================================================================

  function normaliserTexteSimple(value) {
    const fn = getGeoApi().normaliserTexteSimple;
    if (typeof fn === 'function') return fn(value);
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function signalRegion(signal = {}) {
    const fn = getGeoApi().signalRegion;
    if (typeof fn === 'function') return fn(signal);
    return signal?.region_nom || signal?.region || signal?.region_signal || '';
  }

  function normaliserSlugProfilMetierFlair(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function labelProfilMetier(value) {
    const labels = {
      pesage: 'Pesage / étiquetage industriel',
      detection: 'Détection / contrôle qualité',
      vision: 'Vision industrielle / contrôle qualité',
      packaging: 'Packaging / films / étiquettes / impression',
      process: 'Process / convoyage / fin de ligne',
      chimie_logistique: 'Chimie / logistique industrielle',
      batiment_industriel: 'Bâtiment industriel',
      autre: 'Autre métier industriel'
    };
    return labels[value] || String(value || '').replaceAll('_', ' ');
  }

  function signalTitle(s = {}) {
    return s.titre || s.title || s.nom || 'Signal industriel';
  }

  function signalCompany(s = {}) {
    return s.entreprise_nom || s.entreprise || s.company || s.societe || '';
  }

  // =========================================================================
  // FLAIR V1.7 — timing, secteurs, copilote, scoring local et enrichissement
  // =========================================================================

function texteCompletSignalFlair(signal = {}) {
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

function calculerTimingCommercial(signal = {}, resultat = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));

  const contient = (mots) => mots.some(mot => motCleFlairPresent(texte, mot));
  const contientExpression = (expressions) => expressions.some(exp => texte.includes(normaliserTexteSimple(exp)));

  // Timing V2.1 — fenêtre commerciale fine.
  // Objectif : ne pas confondre "projet annoncé" avec "consultation en cours".
  // Le score timing mesure la qualité du moment commercial, pas l'intérêt métier du projet.
  let phase = 'a_qualifier';
  let score = 50;
  let impact_score = 0;
  let fenetre = 'À qualifier';
  let raison = 'Timing non explicite : qualifier la maturité du projet avant d’engager une action commerciale.';
  let prochaine_action = 'Qualifier le calendrier projet, les décideurs et les équipements encore ouverts.';

  // FLAIR V2.5 — timing plus orienté action commerciale.
  // Objectif cible : 50 % court terme, 40 % moyen terme, 10 % long terme
  // quand les indices présents dans l'article le justifient.
  const tropTard = [
    'fournisseur retenu', 'fournisseurs retenus',
    'attribution du marche', 'attribution du marché',
    'marche attribue', 'marché attribué', 'contrat attribue', 'contrat attribué',
    'equipements installes', 'équipements installés',
    'appel d offres cloture', 'appel d offres clôturé',
    'consultation terminee', 'consultation terminée',
    'choix fournisseur realise', 'choix fournisseur réalisé'
  ];

  const urgence03 = [
    'appel d offres en cours', 'appel d offre en cours', 'appel offres en cours',
    'appel d offres publie', 'appel d offre publié', 'appel offres publie',
    'consultation en cours', 'consultations en cours',
    'consultation fournisseurs lancee', 'consultation fournisseurs lancée',
    'consultations fournisseurs lancees', 'consultations fournisseurs lancées',
    'dce publie', 'dce publié', 'cahier des charges publie', 'cahier des charges publié',
    'demande de prix en cours', 'demande de devis en cours',
    'travaux demarres', 'travaux démarrés', 'chantier demarre', 'chantier démarré',
    'chantier lance', 'chantier lancé', 'installation en cours',
    'installation de la ligne', 'installation d une ligne', 'installation nouvelle ligne',
    'mise en service imminente', 'mise en service prochaine',
    'mise en service prevue dans les prochains mois', 'mise en service prévue dans les prochains mois',
    'demarrage imminent', 'démarrage imminent', 'lancement imminent',
    'demarre sa production', 'démarre sa production', 'demarrage de la production', 'démarrage de la production',
    'lancement de la production', 'lance sa production', 'production demarre', 'production démarré',
    'vient de lancer', 'vient de demarrer', 'vient de démarrer',
    'vient d inaugurer', 'vient d’inaugurer', 'a inaugure', 'a inauguré', 'inauguration',
    'a mis en service', 'vient de mettre en service', 'mise en service', 'mis en service',
    'nouvelle ligne operationnelle', 'nouvelle ligne opérationnelle',
    'ligne operationnelle', 'ligne opérationnelle',
    'nouvelle unite de production', 'nouvelle unité de production',
    'mise en conformite urgente', 'mise en conformité urgente',
    'rappel produit', 'rappel de lot', 'contamination', 'corps etranger', 'corps étrangers',
    'retrait de vente', 'incident qualite', 'incident qualité'
  ];

  const ideal36 = [
    'lancement prochain des consultations', 'consultations fournisseurs seraient en preparation',
    'consultations fournisseurs en preparation', 'consultations fournisseurs en préparation',
    'consultation fournisseurs en preparation', 'consultation fournisseurs en préparation',
    'consultations prevues', 'consultations prévues',
    'fournisseurs seront consultes', 'fournisseurs seront consultés',
    'plusieurs fournisseurs seront consultes', 'plusieurs fournisseurs seront consultés',
    'choix techniques dans les prochains mois',
    'choix techniques devraient etre arretes', 'choix techniques devraient être arrêtés',
    'choix des equipements', 'choix des équipements',
    'selection fournisseurs', 'sélection fournisseurs',
    'preparation consultation', 'préparation consultation',
    'budget valide', 'budget validé',
    'investissement valide', 'investissement validé',
    'permis accepte', 'permis accepté', 'permis obtenu', 'permis de construire obtenu',
    'travaux prevus', 'travaux prévus', 'lancement des travaux', 'debut des travaux', 'début des travaux',
    'installation prevue', 'installation prévue',
    'mise en service prevue', 'mise en service prévue',
    'mise en service attendue', 'mise en service attendue',
    'sera mis en service', 'sera mise en service',
    'doit etre mis en service', 'doit être mis en service', 'doit etre mise en service', 'doit être mise en service',
    'prevoit d installer', 'prévoit d installer', 'prévoit d’installer',
    'va installer', 'va se doter', 'doit se doter',
    'nouvelle ligne de production', 'ligne de production', 'ligne de conditionnement',
    'ligne automatisee', 'ligne automatisée',
    'prochains mois', 'dans les prochains mois'
  ];

  const amont612 = [
    'investissement annonce', 'investissement annoncé', 'annonce un investissement',
    'extension annoncee', 'extension annoncée', 'agrandissement annonce',
    'nouvelle ligne prevue', 'nouvelle ligne prévue', 'nouvelles lignes prevues',
    'nouveau site prevu', 'nouveau site prévu', 'nouvelle usine prevue',
    'nouvelle usine prévue', 'construction prevue', 'construction prévue',
    'augmentation capacite', 'augmentation capacité',
    'plan d investissement', 'plan investissement',
    'premier semestre 2027', 'second semestre 2027', 'fin 2027'
  ];

  const veille1224 = [
    'etude de faisabilite', 'étude de faisabilité', 'projet a l etude', 'projet à l’étude',
    'projet envisage', 'projet envisagé', 'reflexion strategique', 'réflexion stratégique',
    'plan industriel', 'feuille de route industrielle', 'horizon 2027', 'horizon 2028',
    'strategie industrielle', 'stratégie industrielle'
  ];

  const veilleLongue = [
    'horizon 2029', 'horizon 2030', 'horizon 2031', 'horizon 2032',
    'plan 2030', 'strategie 2030', 'stratégie 2030',
    'objectif 2030', 'ambition 2030'
  ];

  if (contient(tropTard)) {
    phase = 'probablement_trop_tard';
    score = 8;
    impact_score = -18;
    fenetre = 'Déjà trop tard';
    raison = 'Le projet semble déjà attribué, inauguré ou opérationnel : action commerciale probablement tardive.';
    prochaine_action = 'Ne pas ouvrir d’action prioritaire ; vérifier uniquement s’il existe un besoin complémentaire ou un nouveau site.';
  } else if (contientExpression(urgence03)) {
    phase = 'urgence_0_3_mois';
    score = 95;
    impact_score = 18;
    fenetre = '0-3 mois — agir vite';
    raison = 'Fenêtre courte : appel d’offres, consultation en cours, chantier lancé, mise en service imminente ou urgence qualité.';
    prochaine_action = 'Identifier immédiatement le bon interlocuteur et proposer un échange court sous 48 h.';
  } else if (contientExpression(ideal36)) {
    phase = 'contact_ideal_3_6_mois';
    score = 88;
    impact_score = 14;
    fenetre = '3-6 mois — prise de contact idéale';
    raison = 'Projet validé ou préparation de consultation : bon moment pour se positionner avant les choix finaux.';
    prochaine_action = 'Prendre contact maintenant pour comprendre le cahier des charges avant consultation ou figement technique.';
  } else if (contient(amont612)) {
    phase = 'amont_6_12_mois';
    score = 72;
    impact_score = 8;
    fenetre = '6-12 mois — se positionner en amont';
    raison = 'Projet industriel annoncé : fenêtre favorable pour qualifier le besoin et se faire identifier tôt.';
    prochaine_action = 'Qualifier le périmètre, le calendrier et les décideurs, puis programmer une relance structurée.';
  } else if (contient(veille1224)) {
    phase = 'veille_active_12_24_mois';
    score = 45;
    impact_score = -4;
    fenetre = '12-24 mois — veille active';
    raison = 'Projet encore amont : signal intéressant, mais à suivre avant une action commerciale directe.';
    prochaine_action = 'Mettre le projet sous surveillance et rechercher les prochains signaux de maturité.';
  } else if (contient(veilleLongue)) {
    phase = 'veille_longue_plus_24_mois';
    score = 20;
    impact_score = -10;
    fenetre = '>24 mois — veille lointaine';
    raison = 'Horizon long : signal stratégique à conserver, mais priorité commerciale faible à court terme.';
    prochaine_action = 'Conserver en veille et attendre un signal plus concret : budget, travaux, consultation ou recrutement.';
  }

  // Projet suivi : si FLAIR détecte plusieurs signaux reliés, le timing devient plus crédible.
  // On ne transforme pas automatiquement en urgence, mais on valorise la maturité du projet.
  if (signal.projet_detecte && phase === 'a_qualifier') {
    phase = 'veille_active_12_24_mois';
    score = Math.max(score, 45);
    impact_score = Math.max(impact_score, -2);
    fenetre = '12-24 mois — veille active';
    raison = 'Projet déjà observé dans FLAIR : suivre l’évolution et rechercher un signal de consultation, travaux ou choix techniques.';
    prochaine_action = 'Consulter l’historique du projet puis qualifier le prochain jalon commercial.';
  } else if (signal.projet_detecte && ['amont_6_12_mois', 'contact_ideal_3_6_mois'].includes(phase)) {
    score = Math.min(98, score + 4);
    impact_score = Math.min(18, impact_score + 2);
    raison += ' Le projet est déjà suivi dans FLAIR, ce qui renforce sa crédibilité commerciale.';
  }

  return { phase, score, impact_score, fenetre, raison, prochaine_action };
}

function motCleFlairPresent(texteNormalise = '', motCle = '') {
  const mot = normaliserTexteSimple(motCle);
  if (!mot) return false;

  // Les mots courts ou ambigus ne doivent pas matcher à l'intérieur d'un autre mot.
  // Exemple : "Lot" ne doit pas matcher dans "copilote", "soin" ne doit pas matcher dans "besoin".
  if (mot.length <= 4 || ['soin', 'lot', 'os', 'map'].includes(mot)) {
    const escaped = mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(texteNormalise);
  }

  return texteNormalise.includes(mot);
}

function detecterSecteurSousSecteur(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));

  const rules = [
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

  const matches = rules
    .map(rule => {
      const nb = rule.mots.filter(mot => motCleFlairPresent(texte, mot)).length;
      return { ...rule, nb, score: nb * (rule.poids || 80) };
    })
    .filter(rule => rule.nb > 0)
    .sort((a, b) => b.score - a.score || (b.poids || 0) - (a.poids || 0));

  if (matches.length) {
    return {
      secteur: matches[0].secteur,
      sous: matches[0].sous,
      confiance: Math.min(100, matches[0].score),
      indices: matches[0].mots.filter(mot => motCleFlairPresent(texte, mot)).slice(0, 4)
    };
  }

  if (signal.secteur_estime) return { secteur: signal.secteur_estime, sous: '', confiance: 40, indices: [] };
  return { secteur: '', sous: '', confiance: 0, indices: [] };
}

function dedoublonnerListeTexte(items = []) {
  const vus = new Set();
  return items
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter(item => {
      const cle = normaliserTexteSimple(item);
      if (!cle || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
}

function signalSemblePME(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return ['pme', 'eti', 'familial', 'familiale', 'independant', 'indépendant', 'artisan', 'petite entreprise', 'site regional', 'site régional']
    .some(mot => motCleFlairPresent(texte, mot));
}

function signalMentionneImpressionPackaging(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return [
    'impression packaging', 'imprimerie packaging', 'impression emballage',
    'impression helio', 'impression hélio', 'heliogravure', 'héliogravure', 'rotogravure',
    'impression flexo', 'flexographie', 'complexage', 'vernis', 'encres',
    'controle impression', 'contrôle impression', 'ligne impression', 'ligne d impression', 'ligne d’impression'
  ].some(mot => motCleFlairPresent(texte, mot));
}


function familleStrategiqueProjet(signal = {}) {
  if (window.FLAIR_SOURCE_VEILLE?.detecterFamilleStrategiqueProjet) {
    return window.FLAIR_SOURCE_VEILLE.detecterFamilleStrategiqueProjet(signal);
  }
  if (window.FLAIR_DETECTER_FAMILLE_STRATEGIQUE_PROJET) {
    return window.FLAIR_DETECTER_FAMILLE_STRATEGIQUE_PROJET(signal);
  }
  return null;
}

function idFamilleStrategiqueProjet(signal = {}) {
  return (familleStrategiqueProjet(signal)?.id || signal.famille_projet || '').toString();
}

function signalFamilleLogistique(signal = {}) {
  return idFamilleStrategiqueProjet(signal) === 'logistique';
}

function signalFamilleQualite(signal = {}) {
  return idFamilleStrategiqueProjet(signal) === 'qualite';
}

function signalFamilleProcess(signal = {}) {
  return idFamilleStrategiqueProjet(signal) === 'process';
}

function signalFamilleExtension(signal = {}) {
  return idFamilleStrategiqueProjet(signal) === 'extension';
}

function signalFamilleRH(signal = {}) {
  return idFamilleStrategiqueProjet(signal) === 'rh_recrutement';
}

function signalFamilleCapitalistique(signal = {}) {
  return idFamilleStrategiqueProjet(signal) === 'capitalistique';
}

function signalFamilleProductionProjet(signal = {}) {
  return signalFamilleProcess(signal) || signalFamilleExtension(signal);
}

function nettoyerTexteQualiteHorsContexte(texte = '', signal = {}) {
  // V2.0 : les blocs "contamination / CCP / rappel" ne doivent rester que
  // sur les vrais signaux Qualité. Ils polluaient encore Extension / Process /
  // Logistique avec une lecture trop agro-qualité.
  if (signalFamilleQualite(signal)) return texte;

  const morceaux = String(texte || '')
    .split(/\.\s+/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => {
      const n = normaliserTexteSimple(item);
      return !(n.includes('contamination') || n.includes('corps etranger') || n.includes('corps etrangers') || n.includes('rappel conso') || n.includes('rappel produit') || n.includes('securite alimentaire') || n.includes('ccp') || n.includes('risque contaminants') || n.includes('controle contaminants'));
    });

  return morceaux.join('. ');
}

function interlocuteursPourProfil(profil = '', signal = {}) {
  const type = signal.type_signal || '';
  const secteur = String(signal.secteur_detecte_label || signal.secteur || '').toLowerCase();
  const sous = String(signal.sous_secteur_detecte_label || signal.sous || '').toLowerCase();

  let interlocuteurs = [];

  if (signalFamilleLogistique(signal)) {
    return [
      'Responsable exploitation — flux, préparation et montée en charge',
      'Responsable automatisation — convoyage, tri, traçabilité',
      'Responsable maintenance — disponibilité équipements et intégration',
      'Chef de projet logistique — planning, lots techniques et fournisseurs',
      'Directeur de site — priorité opérationnelle',
      'Directeur logistique — arbitrage organisation et CAPEX'
    ].join('; ');
  }

  const ajouter = (role, angle) => {
    interlocuteurs.push(angle ? `${role} — ${angle}` : role);
  };

  if (type === 'appel_offre') {
    ajouter('Responsable achats', 'cadre de consultation et fournisseurs');
    ajouter('Acheteur industriel', 'conditions d’achat et planning');
    ajouter('Chef de projet industriel', 'coordination technique du projet');
  }

  if (signalFamilleCapitalistique(signal)) {
    ajouter('Direction générale', 'priorités post-rachat, stratégie et arbitrages');
    ajouter('Directeur industriel', 'harmonisation sites, équipements et CAPEX');
    ajouter('Responsable achats', 'référencement fournisseurs et contrats groupe');
  }

  // V2.0 : pour Extension / Process, ne pas utiliser le vieux bloc qualité
  // "risque contaminants / audit / CCP" sauf si la famille réelle est QUALITE.
  if (profil === 'detection') {
    if (signalFamilleQualite(signal)) {
      ajouter('Responsable qualité', 'rappel, contamination, audit ou CCP');
      ajouter('Responsable production', 'sécurisation de ligne et actions correctives');
      ajouter('Responsable maintenance', 'contrôles, essais et disponibilité équipements');
      ajouter('Directeur industriel', 'arbitrage CAPEX et prévention récidive');
      ajouter('Directeur de site', 'priorité opérationnelle qualité');
    } else if (signalFamilleProductionProjet(signal)) {
      if (signalFamilleExtension(signal)) {
        ajouter('Responsable travaux neufs', 'bâtiment, implantation et lots techniques');
        ajouter('Chef de projet industriel', 'planning, équipements et intégration');
      } else {
        ajouter('Responsable production', 'nouvelle ligne, cadence et intégration');
        ajouter('Chef de projet industrialisation', 'choix techniques et fournisseurs');
      }
      ajouter('Responsable maintenance', 'implantation, essais et disponibilité');
      ajouter('Directeur industriel', 'arbitrage projet et CAPEX');
      ajouter('Directeur de site', 'priorité opérationnelle du site');
      ajouter('Responsable qualité', 'points de contrôle en ligne et validation qualité');
    } else {
      ajouter('Responsable production', 'intégration sur ligne et cadence');
      ajouter('Responsable maintenance', 'implantation, essais et disponibilité');
      ajouter('Responsable qualité', 'points de contrôle et validation qualité');
      ajouter('Directeur industriel', 'arbitrage projet et CAPEX');
      ajouter('Directeur de site', 'priorité opérationnelle du site');
    }
  } else if (profil === 'packaging') {
    ajouter('Responsable conditionnement', 'formats, cadence et contraintes ligne');
    ajouter('Responsable packaging', 'matériaux, essais et spécifications');
    if (signalMentionneImpressionPackaging(signal)) {
      ajouter('Responsable impression', 'hélio, flexo, encres, vernis et qualité d’impression');
      ajouter('Responsable prépresse / méthode impression', 'fichiers, repérage, contraintes techniques et essais');
    }
    ajouter('Achats packaging', 'consultation fournisseurs et consommables');
    ajouter('Responsable production', 'faisabilité industrielle');
    ajouter('Responsable achats', 'budget et contractualisation');
    ajouter('Directeur industriel', 'arbitrage projet');
  } else if (profil === 'pesage') {
    ajouter('Responsable qualité', 'conformité poids et traçabilité');
    ajouter('Responsable production', 'cadence et contrôle en ligne');
    ajouter('Responsable méthodes', 'standardisation et intégration');
    ajouter('Responsable maintenance', 'fiabilité équipements');
    ajouter('Responsable amélioration continue', 'pertes, écarts et performance');
  } else if (profil === 'vision') {
    ajouter('Responsable qualité', 'défauts visibles et preuves de contrôle');
    ajouter('Responsable production', 'contrôle en ligne et cadence');
    ajouter('Responsable automatisme', 'intégration caméra, éclairage et communication');
    ajouter('Responsable maintenance', 'réglages et disponibilité');
    ajouter('Directeur industriel', 'arbitrage équipement');
  } else if (profil === 'process') {
    ajouter('Responsable production', 'flux, cadence et ergonomie ligne');
    ajouter('Responsable méthodes', 'implantation et standardisation');
    ajouter('Responsable maintenance', 'fiabilité et disponibilité');
    ajouter('Responsable automatisme', 'interfaces et supervision');
    ajouter('Directeur industriel', 'CAPEX et priorité projet');
  } else {
    ajouter('Directeur industriel', 'orientation projet');
    ajouter('Responsable production', 'besoin terrain');
    ajouter('Responsable maintenance', 'faisabilité technique');
    ajouter('Responsable achats', 'fournisseurs et budget');
  }

  if (secteur.includes('pharmaceutique')) {
    ajouter('Responsable assurance qualité', 'exigences qualité et validation');
    ajouter('Responsable validation', 'qualification équipements');
  }

  if (signalSemblePME(signal)) {
    ajouter('Dirigeant', 'décision directe PME');
    ajouter('Gérant', 'arbitrage opérationnel');
    ajouter('Président', 'vision stratégique');
    ajouter('Directeur général', 'budget et priorité');
  }

  return dedoublonnerListeTexte(interlocuteurs).slice(0, 6).join('; ');
}

function questionAnglePourProfil(profil = '', signal = {}) {
  const secteur = String(signal.secteur_detecte_label || signal.secteur || '').toLowerCase();
  const sous = String(signal.sous_secteur_detecte_label || signal.sous || '').toLowerCase();

  if (signalFamilleLogistique(signal)) {
    return 'Comment préparez-vous l’automatisation, la traçabilité et la montée en charge des flux du futur site ?';
  }

  if (profil === 'detection') {
    if (signalFamilleQualite(signal)) {
      if (secteur.includes('pharmaceutique')) return 'Quels points d’inspection produit ou de contrôle contaminants doivent être qualifiés après ce signal qualité ?';
      return 'Comment sécurisez-vous la détection des contaminants et la prévention des récidives sur vos lignes ?';
    }
    if (signalFamilleExtension(signal)) {
      return 'Quels équipements de contrôle qualité, détection ou inspection devront être prévus dans cette extension industrielle ?';
    }
    if (signalFamilleProcess(signal)) {
      return 'Comment prévoyez-vous d’intégrer les points de contrôle qualité, détection ou inspection sur cette nouvelle ligne ?';
    }
    if (secteur.includes('plasturgie')) return 'Quels points de contrôle matière, inspection ou sécurité produit sont critiques dans vos flux, recyclage ou extrusion ?';
    if (secteur.includes('pharmaceutique')) return 'Quels points d’inspection produit ou de contrôle qualité devront être qualifiés sur cette future ligne ?';
    return 'Quels points de contrôle qualité, détection ou inspection devront être intégrés dans ce projet ?';
  }
  if (profil === 'packaging') {
    if (signalFamilleCapitalistique(signal)) return 'Le rachat ou regroupement va-t-il entraîner une harmonisation des supports, impressions, fournisseurs packaging ou standards qualité ?';
    if (signalMentionneImpressionPackaging(signal)) return 'Quels besoins d’impression, hélio, flexo, encres, vernis ou contrôle impression sont liés à ce projet packaging ?';
    return 'Avez-vous déjà défini les matériaux, formats, impressions et contraintes de conditionnement pour ce projet ?';
  }
  if (profil === 'pesage') return 'Comment allez-vous maîtriser le contrôle poids, l’étiquetage ou la traçabilité sur cette ligne ?';
  if (profil === 'vision') return 'Quels contrôles visuels, marquages ou lectures codes devront être sécurisés sur la ligne ?';
  if (profil === 'process') return 'Quels sont les points sensibles de flux, convoyage et fin de ligne dans ce projet ?';

  if (secteur.includes('plasturgie') || sous.includes('extrusion')) return 'Quels points de contrôle, de flux ou de qualité sont critiques sur cette ligne plastique ?';
  if (secteur.includes('bois')) return 'Quels sont les points sensibles de flux, contrôle ou manutention sur votre ligne bois ?';

  return 'Où en est le projet et quels équipements de ligne sont encore à définir ?';
}

function prochaineActionCopilote(signal = {}, timing = {}, interlocuteurs = '') {
  const premierContact = String(interlocuteurs || '').split(';')[0]?.trim() || 'le bon interlocuteur';
  if (signalFamilleLogistique(signal)) {
    if (timing.phase === 'urgence_0_3_mois' || timing.phase === 'contact_ideal_3_6_mois') {
      return `Qualifier rapidement le projet avec ${premierContact} : flux, automatisation, maintenance et lots techniques encore ouverts.`;
    }
    return `Identifier ${premierContact}, puis qualifier les besoins flux, convoyage, traçabilité et montée en charge du futur site.`;
  }
  if (timing.phase === 'urgence_0_3_mois') {
    return `Agir vite : identifier ${premierContact} et proposer un échange court sous 48 h.`;
  }
  if (timing.phase === 'contact_ideal_3_6_mois') {
    return `Prendre contact maintenant avec ${premierContact} avant le figement des choix techniques.`;
  }
  if (timing.phase === 'amont_6_12_mois') {
    return `Qualifier le projet avec ${premierContact}, puis prévoir une relance structurée.`;
  }
  if (timing.phase === 'veille_active_12_24_mois') {
    return 'Mettre le projet sous surveillance et chercher un prochain signal de maturité.';
  }
  if (timing.phase === 'probablement_trop_tard') {
    return 'Ne pas prioriser sauf besoin complémentaire, extension ou nouveau site.';
  }
  return timing.prochaine_action || 'Qualifier le calendrier, les décideurs et le périmètre technique.';
}

function preparerCopiloteCommercial(signal = {}, resultat = {}, timing = {}) {
  const profil = profilCommercialActuel();
  const entreprise = signalCompany(signal) || signal.entreprise_nom || 'votre entreprise';
  const titre = signalTitle(signal);
  const contexteCopilote = { ...signal, ...resultat };
  const angle = questionAnglePourProfil(profil, contexteCopilote);
  const interlocuteurs = interlocuteursPourProfil(profil, contexteCopilote);
  const prochaineAction = prochaineActionCopilote(contexteCopilote, timing, interlocuteurs);
  const pourquoiMaintenant = timing.fenetre
    ? `${timing.fenetre} : ${timing.raison}`
    : 'Timing à qualifier : vérifier si les choix techniques sont encore ouverts.';

  const copiloteBase = {
    interlocuteurs_cibles: interlocuteurs,
    angle_conseille: angle,
    message_linkedin:
      `Bonjour, j’ai vu passer une information concernant ${entreprise} (${titre}). ` +
      `${angle} Je serais intéressé d’échanger brièvement avec la personne qui pilote ce sujet.`,
    email_prepare:
      `Bonjour,\n\nJ’ai identifié une information récente concernant ${entreprise} : ${titre}.\n\n` +
      `${pourquoiMaintenant}\n\n${angle}\n\n` +
      `L’objectif serait simplement de comprendre où vous en êtes et si un échange technique court peut être utile.\n\nCordialement,`,
    plan_appel:
      `1. Vérifier le bon interlocuteur : ${interlocuteurs}.\n` +
      `2. Confirmer le contexte : ${titre}.\n` +
      `3. Timing : ${timing.fenetre || 'à qualifier'}.\n` +
      `4. Question d’ouverture : ${angle}\n` +
      `5. Prochaine action : ${prochaineAction}\n` +
      `6. Si intérêt confirmé : créer l’opportunité dans le CRM externe.`,
    prochaine_action: prochaineAction,
    pourquoi_maintenant: pourquoiMaintenant
  };

  copiloteBase.copilote_commercial = construireCopiloteCommercialJson(
    contexteCopilote,
    resultat,
    timing,
    {
      secteur: contexteCopilote.secteur_detecte_label,
      sous: contexteCopilote.sous_secteur_detecte_label
    },
    copiloteBase
  );

  return copiloteBase;
}


function contextualiserResultatSelonFamille(resultat = {}, signal = {}) {
  const base = {
    ...resultat,
    raison_score: nettoyerTexteQualiteHorsContexte(resultat.raison_score, signal),
    angle_commercial: nettoyerTexteQualiteHorsContexte(resultat.angle_commercial, signal),
    action_recommandee: nettoyerTexteQualiteHorsContexte(resultat.action_recommandee, signal)
  };

  if (signalFamilleLogistique(signal)) {
    return {
      ...base,
      type_signal: base.type_signal === 'qualite_rappel_conso' ? 'investissement' : base.type_signal,
      raison_score: ajouterPhraseMetier(
        base.raison_score,
        'Projet logistique : priorité aux flux internes, à l’automatisation, à la traçabilité et à l’exploitation du futur site.'
      ),
      angle_commercial: 'Projet logistique / entrepôt : opportunité autour des flux, du convoyage, de l’automatisation et de la traçabilité.',
      action_recommandee: 'Identifier exploitation, automatisation, maintenance, chef de projet logistique et directeur de site.'
    };
  }

  if (signalFamilleProcess(signal)) {
    return {
      ...base,
      type_signal: base.type_signal === 'appel_offre' ? 'appel_offre' : 'nouvelle_ligne',
      raison_score: ajouterPhraseMetier(
        base.raison_score,
        'Projet process : nouvelle ligne, automatisation ou intégration d’équipements à qualifier avant figement technique.'
      ),
      angle_commercial: 'Projet process / nouvelle ligne : qualifier intégration, cadence, contrôle en ligne et interfaces équipements.',
      action_recommandee: 'Identifier production, industrialisation, maintenance et direction industrielle.'
    };
  }

  if (signalFamilleExtension(signal)) {
    return {
      ...base,
      type_signal: base.type_signal === 'appel_offre' ? 'appel_offre' : 'investissement',
      raison_score: ajouterPhraseMetier(
        base.raison_score,
        'Extension industrielle : signal fort de capacité, d’implantation d’équipements et de choix techniques encore à qualifier.'
      ),
      angle_commercial: 'Extension industrielle : qualifier les équipements prévus, les points de contrôle et l’intégration technique.',
      action_recommandee: 'Identifier travaux neufs, industrialisation, maintenance et direction industrielle.'
    };
  }

  if (signalFamilleQualite(signal)) {
    return {
      ...base,
      type_signal: 'qualite_rappel_conso'
    };
  }

  return base;
}

function calculerScoreDistributionIA(signal = {}) {
  const texteComplet = texteCompletSignalFlair(signal);
  const resultatInitial = scoringLocal(texteComplet, signal.entreprise_nom || '');

  let resultat = enrichirScoringAvecSourceVeille(signal, resultatInitial);
  const secteur = detecterSecteurSousSecteur(signal);
  const signalContexte = {
    ...signal,
    secteur_detecte_label: secteur.secteur,
    sous_secteur_detecte_label: secteur.sous
  };
  const timing = calculerTimingCommercial(signalContexte, resultat);
  const copilote = preparerCopiloteCommercial(signalContexte, {
    ...resultat,
    secteur_detecte_label: secteur.secteur,
    sous_secteur_detecte_label: secteur.sous
  }, timing);

  const scoreBase = Number(resultat.score_pertinence) || 0;
  const impactTiming = Number(timing.impact_score ?? 0) || 0;
  let scoreFinal = Math.max(0, Math.min(95, scoreBase + impactTiming));

  const enrichissementMetier = window.FLAIR_SOURCE_VEILLE?.analyserSignalAvecRegles
    ? window.FLAIR_SOURCE_VEILLE.analyserSignalAvecRegles(signalContexte)
    : null;

  if (enrichissementMetier) {
    const profilCommercial = profilCommercialActuel();
    const profilsDetectes = profilsMetiersDetectes(enrichissementMetier);
    const profilPrincipal = enrichissementMetier.profil_metier_principal || '';
    const compatibilite = compatibiliteMetierPourProfil(enrichissementMetier, profilCommercial);
    const capMetier = capScoreSelonCompatibilite(
      100,
      compatibilite,
      profilCommercial,
      profilPrincipal,
      profilsDetectes,
      enrichissementMetier,
      signalContexte
    );

    if (capMetier < 100) {
      scoreFinal = Math.min(scoreFinal, capMetier);
    }
  }

  scoreFinal = appliquerPlancherTimingStrategique(
    scoreFinal,
    signalContexte,
    resultat,
    timing,
    enrichissementMetier
  );

  const scoreIntrinseque = Math.max(0, Math.min(95, Math.round(scoreFinal)));
  const affinity = appliquerAffinityScoring(scoreIntrinseque, signalContexte, enrichissementMetier, timing);
  const scoreDistribution = affinity.score;
  const phraseGeographiqueDistribution = construirePhraseGeographique(affinity.geo);

  const familleStrategique = familleStrategiqueProjet(signalContexte);
  const resultatTexteContextualise = contextualiserResultatSelonFamille(resultat, signalContexte);

  resultat = normaliserResultatScoring({
    ...resultatTexteContextualise,
    score_intrinseque: scoreIntrinseque,
    score_industriel: affinity.score_industriel,
    score_metier: affinity.score_metier,
    score_geographique: affinity.score_geographique,
    score_timing: affinity.score_timing,
    score_final_distribue: affinity.score_final_distribue,
    scores_flair: {
      score_industriel: affinity.score_industriel,
      score_metier: affinity.score_metier,
      score_geographique: affinity.score_geographique,
      score_timing: affinity.score_timing,
      score_final_distribue: affinity.score_final_distribue
    },
    famille_strategique: familleStrategique?.id || signalContexte.famille_projet || '',
    famille_strategique_label: familleStrategique?.label || signalContexte.famille_projet_label || '',
    affinite_geographique: affinity.geo.coefficient,
    affinite_metier: affinity.metier.coefficient,
    score_pertinence: scoreDistribution,
    chaleur: chaleurDepuisScoreMetier(scoreDistribution),
    raison_score: ajouterPhraseMetier(
      ajouterPhraseMetier(
        resultatTexteContextualise.raison_score,
        `Timing : ${timing.fenetre}. ${timing.raison}`
      ),
      phraseGeographiqueDistribution
    ),
    action_recommandee: ajouterPhraseMetier(
      ajouterPhraseMetier(
        resultatTexteContextualise.action_recommandee,
        `Interlocuteurs à rechercher : ${copilote.interlocuteurs_cibles}.`
      ),
      `Prochaine action : ${String(copilote.prochaine_action || '').replace(/[.。]\s*$/, '')}.`
    )
  });

  return {
    resultat,
    timing,
    secteur,
    copilote
  };
}


function normaliserListeCopilote(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap(item => normaliserListeCopilote(item))
      .map(item => String(item || '').trim())
      .filter(Boolean);
  }

  const texte = String(value || '').trim();
  if (!texte) return [];

  // UX Copilote Premium V2 : les virgules font souvent partie du contexte métier.
  // Exemple : "Responsable qualité — risque contaminants, audit, CCP" doit rester un seul contact
  // puis être séparé ensuite entre PERSONA et THEMES métier.
  const separateurFort = texte.includes(';') || /\n/.test(texte);
  const pattern = separateurFort ? /;|\n/ : (texte.includes('—') ? /;|\n/ : /,/);

  return texte
    .split(pattern)
    .map(item => item.trim())
    .filter(Boolean);
}

function dedoublonnerListeCopilote(items = []) {
  const vus = new Set();
  return (items || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter(item => {
      const cle = normaliserTexteSimple(item);
      if (!cle || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
}

function estPersonaCopilote(value = '') {
  const texte = normaliserTexteSimple(value);
  if (!texte) return false;

  const debutsPersonas = /^(responsable|directeur|directrice|dirigeant|dirigeante|gerant|gerante|chef|cheffe|acheteur|acheteuse|achats|service|coordinateur|coordinatrice|ingenieur|ingenieure|manager)\b/;
  const fonctionsCourtes = /^(qualite|production|maintenance|achats|conditionnement|packaging|travaux neufs|methodes|process|hse|r&d|r d|industrialisation)$/;

  return debutsPersonas.test(texte) || fonctionsCourtes.test(texte);
}

function parserContactCopilote(item = '') {
  const texte = String(item || '').trim();
  if (!texte) return { role: '', themes: [] };

  const parts = texte.split(/\s+[—-]\s+/);
  const role = (parts[0] || '').trim();
  const details = parts.length >= 2 ? parts.slice(1).join(' — ').trim() : '';
  const themes = details
    ? details.split(/,|\||\//).map(item => item.trim()).filter(Boolean)
    : [];

  return { role, themes };
}

function extraireContactsEtThemesCopilote(value) {
  const contacts = [];
  const themes = [];

  normaliserListeCopilote(value).forEach(item => {
    const parsed = parserContactCopilote(item);
    if (!parsed.role) return;

    if (estPersonaCopilote(parsed.role)) {
      contacts.push(parsed.role);
      themes.push(...parsed.themes);
    } else {
      themes.push(parsed.role, ...parsed.themes);
    }
  });

  return {
    contacts: dedoublonnerListeCopilote(contacts).slice(0, 6),
    themes: dedoublonnerListeCopilote(themes).slice(0, 10)
  };
}

function renderListeContactsCopilote(contacts = []) {
  const extraction = extraireContactsEtThemesCopilote(contacts);
  const items = extraction.contacts.slice(0, 6);
  if (!items.length) return '<small>À qualifier.</small>';

  return `
    <div style="display:grid;gap:6px;margin:7px 0 8px 0;">
      ${items.map(role => `
        <div style="padding:7px 8px;border:1px solid rgba(148,163,184,0.22);border-radius:9px;background:rgba(15,23,42,0.12);">
          <div style="font-weight:700;font-size:12px;">• ${role}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTexteOuPucesCopilote(value = '') {
  const items = Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : String(value || '')
        .split(/\.\s+/)
        .map(item => item.trim())
        .filter(Boolean);

  const morceaux = items.slice(0, 8);
  if (!morceaux.length) return '';

  if (morceaux.length === 1) {
    return `<small>${morceaux[0]}</small>`;
  }

  return `<ul style="margin:6px 0 0 16px;padding:0;">${morceaux.map(item => `<li><small>${item}${item.endsWith('.') ? '' : '.'}</small></li>`).join('')}</ul>`;
}

function construirePourquoiCopilote(signal = {}, resultat = {}, timing = {}, secteur = {}, themes = []) {
  const phrases = [];

  if (signalFamilleLogistique(signal)) {
    phrases.push('Projet logistique ou entrepôt : enjeu de flux, automatisation, traçabilité et montée en charge.');
  }

  if (timing?.fenetre) {
    phrases.push(`${timing.fenetre} — ${timing.raison || ''}`.trim());
  }

  const raison = nettoyerTexteQualiteHorsContexte(resultat?.raison_score || signal?.raison_score || '', signal);
  if (raison) {
    phrases.push(...String(raison)
      .split(/\.\s+/)
      .map(item => item.trim())
      .filter(Boolean));
  }

  if (secteur?.secteur) {
    phrases.push(secteur.sous ? `${secteur.secteur} / ${secteur.sous}` : secteur.secteur);
  }

  phrases.push(...themes);

  return dedoublonnerListeCopilote(phrases).slice(0, 8);
}

function construireCopiloteCommercialJson(signal = {}, resultat = {}, timing = {}, secteur = {}, copilote = {}) {
  const extraction = extraireContactsEtThemesCopilote(copilote?.interlocuteurs_cibles || signal?.interlocuteurs_cibles);
  const pourquoi = construirePourquoiCopilote(signal, resultat, timing, secteur, extraction.themes);
  const vigilance = determinerVigilanceCopilote(signal, resultat, timing, secteur);

  const scoresFlair = resultat?.scores_flair || resultat?.scoresFlair || signal?.scores_flair || null;

  return {
    pourquoi: pourquoi.length ? pourquoi : ['Signal industriel à qualifier.'],
    qui_contacter: extraction.contacts,
    vigilance,
    timing: timing?.fenetre || signal?.fenetre_contact || 'Timing à qualifier',
    angle: copilote?.angle_conseille || signal?.angle_conseille || resultat?.angle_commercial || signal?.angle_commercial || '',
    prochaine_action: copilote?.prochaine_action || '',
    scores_flair: scoresFlair
  };
}

function determinerVigilanceCopilote(signal = {}, resultat = {}, timing = {}, secteur = {}) {
  const region = signalRegion(signal) || signal.region_nom || signal.region || '';
  const texte = normaliserTexteSimple([
    signal.titre,
    signal.resume_brut,
    signal.texte_original,
    resultat.raison_score,
    resultat.angle_commercial,
    signal.raison_score,
    signal.angle_commercial
  ].filter(Boolean).join(' '));

  if (!region || ['non determinee', 'non renseignee'].includes(normaliserTexteSimple(region))) {
    return 'Géographie non déterminée : vérifier le site concerné avant d’engager une action terrain.';
  }
  if (timing?.phase === 'veille_active_12_24_mois' || timing?.phase === 'veille_longue_plus_24_mois') {
    return 'Projet encore amont : surveiller les prochains jalons avant action commerciale forte.';
  }
  if (timing?.phase === 'probablement_trop_tard') {
    return 'Projet possiblement déjà attribué : chercher une extension, un lot complémentaire ou un besoin de remplacement.';
  }
  if (signalFamilleLogistique(signal)) {
    return 'Projet logistique : vérifier périmètre automatisation, flux internes, maintenance et lots techniques avant contact fournisseur.';
  }
  if (texte.includes('annonce') && !texte.includes('consultation') && !texte.includes('appel d offre') && !texte.includes('appel d offres')) {
    return 'Projet au stade annonce : vérifier budget, calendrier, décideurs et ouverture fournisseurs.';
  }
  if (!secteur?.secteur) {
    return 'Secteur à confirmer : qualifier le contexte métier avant de prioriser fortement.';
  }
  return 'Vérifier le calendrier réel, le périmètre technique et le bon interlocuteur avant contact.';
}

function lireCopiloteCommercialJson(signal = {}) {
  const brut = signal?.copilote_commercial;
  if (!brut) return null;
  if (typeof brut === 'object') return brut;
  try {
    return JSON.parse(brut);
  } catch (err) {
    console.warn('Copilote commercial JSON illisible :', err);
    return null;
  }
}


function normaliserResultatScoring(resultat) {
  const scorePlafonne = plafonnerScoreParChaleur(resultat.score_pertinence, resultat.chaleur);
  return {
    ...resultat,
    score_pertinence: scorePlafonne
  };
}

function scoringLocal(titre, entreprise) {
  const texte = `${titre || ''} ${entreprise || ''}`.toLowerCase();

  let score = 30;
  let type_signal = 'autre';
  let raison_score = "Signal peu qualifié.";
  let angle_commercial = "Approche découverte.";
  let action_recommandee = "Surveiller.";

  const hasAny = (mots) => mots.some(mot => texte.includes(mot));

  // =========================
  // 0. LISTES DE MOTS-CLÉS MÉTIER
  // =========================

  const intentionAchat = [
    "consultation",
    "appel d'offre",
    "appel d’offres",
    "appel offre",
    "marché public",
    "marche public",
    "boamp",
    "cahier des charges",
    "recherche fournisseur",
    "demande de prix",
    "demande de devis",
    "consultation fournisseurs",
    "benchmark équipement",
    "benchmark equipement",
    "mise en conformité",
    "mise en conformite",
    "remplacement",
    "renouvellement équipement",
    "renouvellement equipement"
  ];

  const projetInvestissement = [
    "investissement",
    "millions",
    "projet",
    "construction",
    "nouveau",
    "nouvelle usine",
    "nouveau projet",
    "usine",
    "ultramoderne",
    "modernisation",
    "extension",
    "agrandissement",
    "agrandit",
    "agrandir",
    "augmentation de capacité",
    "augmentation de capacite",
    "nouveau site",
    "augmentation capacité",
    "augmentation capacite",
    "augmentation production",
    "montée en cadence",
    "montee en cadence",
    "atelier",
    "site de production",
    "investissement industriel",
    "modernisation usine"
  ];

  const recrutementIndustriel = [
    "recrutement",
    "embauche",
    "directeur de production",
    "directeur production",
    "responsable production",
    "responsable maintenance",
    "responsable qualité",
    "responsable qualite",
    "technicien maintenance",
    "ingénieur process",
    "ingenieur process",
    "travaux neufs",
    "responsable industrialisation",
    "responsable amélioration continue",
    "responsable amelioration continue"
  ];

  const qualiteCorpsEtrangers = [
    "rappel produit",
    "rappel conso",
    "retrait rappel",
    "corps étranger",
    "corps etranger",
    "morceau de verre",
    "verre",
    "métal",
    "metal",
    "plastique dur",
    "détecteur de métaux",
    "detecteur de metaux",
    "rayon x",
    "xray",
    "contamination",
    "urgence",
    "non conformité",
    "non conformite",
    "incident qualité",
    "incident qualite",
  ];

  const qualiteCertification = [
    "certification ifs",
    "certification brc",
    "certification brcgs",
    "ifs food",
    "ifs",
    "brc",
    "brcgs",
    "haccp",
    "audit ifs",
    "audit brc",
    "audit brcgs",
    "sécurité alimentaire",
    "securite alimentaire",
    "contrôle qualité",
    "controle qualite",
    "plan de contrôle",
    "plan de controle"
  ];

  const pesageControle = [
    "pesage",
    "contrôle poids",
    "controle poids",
    "contrôle pondéral",
    "controle ponderal",
    "trieuse pondérale",
    "trieuse ponderale",
    "checkweigher",
    "peseuse",
    "pesage dynamique",
    "balance industrielle",
    "poids prix",
    "étiquetage",
    "etiquetage",
    "traçabilité",
    "tracabilite"
  ];

  const ligneConditionnement = [
    "ligne",
    "nouvelles lignes",
    "nouvelle ligne",
    "plusieurs lignes",
    "lignes de production",
    "ligne automatisée",
    "ligne automatisee",
    "ligne de conditionnement",
    "ligne de production",
    "fabrication",
    "conditionnement",
    "emballage",
    "découpe",
    "decoupe",
    "ensachage",
    "tranchage",
    "thermoformage",
    "mise en barquette",
    "fin de ligne",
    "palettisation"
  ];

  const secteurAgro = [
    "abattoir",
    "viande",
    "volaille",
    "salaison",
    "charcuterie",
    "fromage",
    "laiterie",
    "fruits",
    "légumes",
    "legumes",
    "traiteur",
    "plats cuisinés",
    "plats cuisines",
    "conserverie",
    "boulangerie",
    "pâtisserie",
    "patisserie"
  ];

  // =========================
  // 1. INTENTION D'ACHAT / APPEL D'OFFRE
  // =========================

  if (hasAny(intentionAchat)) {
    score += 25;
    type_signal = 'appel_offre';
    raison_score = "Intention d'achat détectée : consultation, appel d'offre, demande de prix ou recherche fournisseur.";
    angle_commercial = "Approche rapide avec proposition de solution adaptée.";
    action_recommandee = "Identifier le décideur et prendre contact rapidement.";
  }

  // =========================
  // 2. MOTS CLÉS FORTS — INVESTISSEMENT / PROJET
  // =========================

  if (hasAny(projetInvestissement)) {
    score += 25;
    type_signal = type_signal === 'autre' ? 'investissement' : type_signal;
    raison_score += " Projet industriel détecté : investissement, construction, modernisation, extension ou nouvelle usine.";
  }

  // =========================
  // 3. RECRUTEMENT INDUSTRIEL
  // =========================

  if (hasAny(recrutementIndustriel)) {
    score += 18;
    type_signal = type_signal === 'autre' ? 'recrutement' : type_signal;
    raison_score += " Recrutement industriel pouvant révéler une évolution d'organisation, une montée en charge ou un projet de ligne.";
  }

  if (
    texte.includes("directeur") ||
    texte.includes("responsable")
  ) {
    score += 5;
  }

  // =========================
  // 4. RAPPEL CONSO / QUALITÉ / CORPS ÉTRANGERS
  // =========================

  if (hasAny(qualiteCorpsEtrangers)) {
    score += 35;
    type_signal = 'qualite_rappel_conso';
    raison_score = "Contexte qualité sensible détecté : rappel conso, contamination, corps étranger ou sécurité alimentaire.";
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Identifier responsable qualité ou maintenance et proposer un échange rapide.";
  }

  // =========================
  // 4B. QUALITÉ / CERTIFICATION SANS INCIDENT
  // =========================

  if (hasAny(qualiteCertification) && !hasAny(qualiteCorpsEtrangers)) {
    score += 12;
    type_signal = type_signal === 'autre' ? 'qualite_rappel_conso' : type_signal;
    raison_score = "Contexte qualité ou certification détecté, sans incident produit explicite.";
    angle_commercial = "Approche conseil autour des contrôles, audits et preuves qualité.";
    action_recommandee = "Identifier le responsable qualité et qualifier les contrôles en place.";
  }

  // =========================
  // 5. PESAGE / CONTRÔLE POIDS / ÉTIQUETAGE
  // =========================

  if (hasAny(pesageControle)) {
    score += 25;
    type_signal = type_signal === 'autre' ? 'investissement' : type_signal;
    raison_score += " Besoin potentiel autour du pesage, contrôle poids, étiquetage ou traçabilité.";
    angle_commercial = "Positionnement pesage, contrôle poids, étiquetage et automatisation.";
    action_recommandee = "Préparer un angle pesage / contrôle poids / ligne.";
  }

  // =========================
  // 6. CAPACITÉ / PRODUCTION
  // =========================

  if (
    texte.includes("capacité") ||
    texte.includes("capacite") ||
    texte.includes("production") ||
    texte.includes("augmentation") ||
    texte.includes("cadence")
  ) {
    score += 15;
    raison_score += " Impact potentiel sur la capacité de production.";
  }

  // =========================
  // 7. LIGNE / CONDITIONNEMENT
  // =========================

  if (hasAny(ligneConditionnement)) {
    score += 20;
    type_signal = 'nouvelle_ligne';
    raison_score += " Présence de ligne, fabrication, conditionnement ou fin de ligne.";
    angle_commercial = "Projet ligne ou conditionnement : opportunité équipement.";
    action_recommandee = "Identifier production / maintenance / travaux neufs.";
  }

  // =========================
  // 8. SECTEUR AGROALIMENTAIRE
  // =========================

  if (hasAny(secteurAgro)) {
    score += 5;
    raison_score += " Secteur agroalimentaire identifié.";
  }

  // =========================
  // 9. BONUS COMBINÉS — SIGNAUX PLUS FIABLES
  // =========================

  if (hasAny(["consultation", "demande de prix", "demande de devis", "appel d'offre", "appel d’offres"]) && hasAny(pesageControle)) {
    score += 25;
    type_signal = 'appel_offre';
    raison_score += " Combinaison forte : intention d'achat + pesage / contrôle poids.";
    angle_commercial = "Opportunité directe : répondre rapidement avec une approche solution.";
    action_recommandee = "Contacter rapidement avec un message ciblé pesage / contrôle poids.";
  }

  if (
    hasAny(["rappel produit", "rappel conso", "contamination", "corps étranger", "corps etranger"]) &&
    hasAny(["métal", "metal", "verre", "plastique dur", "rayon x", "détecteur de métaux", "detecteur de metaux"])
  ) {
    score += 25;
    type_signal = 'qualite_rappel_conso';
    raison_score += " Combinaison critique : rappel ou contamination + corps étranger.";
    angle_commercial = "Approche conseil qualité, audit de ligne et sécurisation détection.";
    action_recommandee = "Priorité haute : contacter le responsable qualité.";
  }

  if (
    hasAny(["nouvelle usine", "nouveau site", "extension", "agrandissement", "usine"]) &&
    hasAny(ligneConditionnement)
  ) {
    score += 20;
    type_signal = 'nouvelle_ligne';
    raison_score += " Combinaison forte : site industriel ou extension + ligne / conditionnement.";
    angle_commercial = "Projet industriel structurant : opportunité équipement ligne.";
    action_recommandee = "Identifier travaux neufs, production ou maintenance.";
  }

  if (
    hasAny(["responsable maintenance", "technicien maintenance", "travaux neufs"]) &&
    hasAny(["ligne", "automatisée", "automatisee", "contrôle qualité", "controle qualite", "conditionnement"])
  ) {
    score += 12;
    raison_score += " Recrutement technique lié à ligne ou contrôle qualité.";
  }

  // =========================
  // 10. SUPER SIGNATURES — OPPORTUNITÉS TRÈS FORTES
  // =========================

  if (
    hasAny(["consultation", "appel d'offre", "appel d’offres", "demande de prix", "demande de devis"]) &&
    hasAny(["pesage", "contrôle poids", "controle poids", "trieuse pondérale", "trieuse ponderale", "pesage dynamique"])
  ) {
    score = Math.max(score, 88);
    type_signal = 'appel_offre';
    raison_score = "Signal très fort : consultation ou demande commerciale explicite autour du pesage / contrôle poids.";
    angle_commercial = "Approche commerciale directe et rapide.";
    action_recommandee = "Contacter en priorité avec une réponse ciblée.";
  }

  if (
    hasAny(["rappel produit", "rappel conso", "contamination", "corps étranger", "corps etranger"]) &&
    hasAny(["sécurité alimentaire", "securite alimentaire", "incident qualité", "incident qualite", "rayon x", "détecteur de métaux", "detecteur de metaux"])
  ) {
    score = Math.max(score, 90);
    type_signal = 'qualite_rappel_conso';
    raison_score = "Signal critique qualité : contexte de rappel, contamination ou sécurité alimentaire.";
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Priorité haute : prise de contact rapide avec qualité / maintenance.";
  }

  // =========================
  // 11. NORMALISATION
  // =========================

  if (type_signal === 'appel_offre') {
  score = Math.min(score, 95);
} else if (type_signal === 'qualite_rappel_conso') {
  score = Math.min(score, 95);
} else {
  score = Math.min(score, 92);
}

  let chaleur = 'froid';
  if (score >= 80) chaleur = 'chaud';
  else if (score >= 60) chaleur = 'tiede';

  // =========================
  // 12. ANGLE + ACTION PAR DÉFAUT
  // =========================

  if (type_signal === 'qualite_rappel_conso') {
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Identifier responsable qualité ou maintenance et proposer un échange rapide.";
    } else if (score >= 80) {
    if (angle_commercial === "Approche découverte.") {
      angle_commercial = "Projet en cours : positionnement rapide sur équipements.";
    }
    if (action_recommandee === "Surveiller.") {
      action_recommandee = "Identifier décideur production / maintenance et prendre contact rapidement.";
    }
  } else if (score >= 60) {
    if (angle_commercial === "Approche découverte.") {
      angle_commercial = "Opportunité probable à moyen terme.";
    }
    if (action_recommandee === "Surveiller.") {
      action_recommandee = "Surveiller + identifier contact.";
    }
  }

  // =========================
  // 13. RETOUR STANDARD FLAIR
  // =========================

return normaliserResultatScoring({
  score_pertinence: score,
  chaleur,
  type_signal,
  raison_score,
  angle_commercial,
  action_recommandee
});
}

 // =========================
 // ENRICHISSEMENT SOURCE-VEILLE
 // =========================
 // Objectif V2.5 :
 // exploiter réellement la taxonomie métier fournie par source-veille-rules.js :
 // profils_metiers_detectes, profil_metier_principal, sous_profils_metiers_detectes,
 // compatibilite_metier et matched_rules.
 // Important : aucune nouvelle colonne Supabase n'est nécessaire à ce stade.
 // L'information métier est intégrée dans les champs déjà affichés :
 // raison_score, angle_commercial et action_recommandee.

const FLAIR_LABELS_PROFILS_METIERS = {
  detection: "Détection",
  pesage: "Pesage",
  packaging: "Packaging",
  vision: "Vision",
  process: "Process"
};

const FLAIR_LABELS_SOUS_PROFILS_METIERS = {
  detecteur_metaux: "détecteur de métaux",
  rayon_x: "rayon X",

  balance: "balance",
  tri_ponderal: "tri pondéral",
  etiquetage: "étiquetage",
  poids_prix: "poids/prix",

  films: "films",
  thermoformage: "thermoformage",
  flowpack: "flowpack",
  operculage: "operculage",
  sachet: "sachet",
  boite: "boîte",
  etui: "étui",
  etiquettes: "étiquettes",
  sleeves: "sleeves",
  carton: "carton",
  conditionnement_secondaire: "conditionnement secondaire",
  impression_packaging: "impression packaging",
  helio: "hélio",
  flexo: "flexo",
  complexage: "complexage",
  finition: "finition",
  vernis: "vernis",
  encres: "encres",
  controle_impression: "contrôle impression",

  presence_absence: "présence/absence",
  controle_etiquette: "contrôle étiquette",
  ocr: "OCR",
  lecture_code: "lecture code",
  controle_aspect: "contrôle aspect",

  convoyage: "convoyage",
  manutention: "manutention",
  guidage_produit: "guidage produit",
  automatisme: "automatisme",
  encaissage: "encaissage",
  palettisation: "palettisation",
  robotique: "robotique",
  logistique_interne: "logistique interne"
};

function labelProfilMetierRadar(value) {
  return FLAIR_LABELS_PROFILS_METIERS[value] || labelProfilMetier(value || '');
}

function labelSousProfilMetierRadar(value) {
  return FLAIR_LABELS_SOUS_PROFILS_METIERS[value] || String(value || '').replaceAll('_', ' ');
}

function profilsMetiersDetectes(enrichissement = {}) {
  return Array.isArray(enrichissement.profils_metiers_detectes)
    ? enrichissement.profils_metiers_detectes.filter(Boolean)
    : [];
}

function profilCommercialActuel() {
  return normaliserSlugProfilMetierFlair((profilProvider() || {})?.profil_metier || window.FLairProfilMetier || '');
}

function compatibiliteMetierPourProfil(enrichissement = {}, profilCommercial = '') {
  const profilNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  if (!profilNormalise) return 0;

  const compatibilites = enrichissement.compatibilite_metier || {};
  const valeurDirecte = Number(compatibilites[profilNormalise] || 0);

  if (valeurDirecte > 0) return valeurDirecte;

  return profilsMetiersDetectes(enrichissement).map(normaliserSlugProfilMetierFlair).includes(profilNormalise) ? 0.5 : 0;
}

function facteurBonusSelonCompatibilite(compatibilite, profilsDetectes = [], profilCommercial = '', profilPrincipal = '', enrichissement = {}) {
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);
  const profilsDetectesNormalises = (profilsDetectes || []).map(normaliserSlugProfilMetierFlair);

  // Pas de profil détecté : comportement historique, sans pénalisation.
  if (!profilsDetectesNormalises.length) return 1;

  const regles = reglesMetierDetectees(enrichissement);
  const aRegleOffreDirecte = regles.some(rule =>
    rule?.couche === 'compatibilite_offre' &&
    Array.isArray(rule.profils_metiers) &&
    rule.profils_metiers.map(normaliserSlugProfilMetierFlair).includes(profilCommercialNormalise)
  );

  const aRegleBonusForte = regles.some(rule =>
    rule?.couche === 'bonus_metier' &&
    Number(rule?.intensite_metier?.[profilCommercialNormalise] || 0) >= 0.8
  );

  // Si une règle métier directe existe, on garde la force du signal.
  if (aRegleOffreDirecte || profilCommercialNormalise === profilPrincipalNormalise || compatibilite >= 0.85) return 1;

  // Bonus métier fort mais signal pas principal : utile, sans surclasser le métier principal.
  if (aRegleBonusForte) return 0.85;

  // Compatible mais pas forcément profil principal : signal utile, mais lecture métier à nuancer.
  if (compatibilite >= 0.6) return 0.72;

  // Compatibilité indirecte : on conserve l'information, sans la pousser aussi fort.
  if (compatibilite > 0) return 0.55;

  // Signal non compatible avec le profil du commercial connecté.
  // Il reste visible si le commercial l'importe, mais il ne doit pas dominer son radar.
  return 0.35;
}

function texteSignalPourAjustementMetier(signal = {}) {
  return normaliserTexteSimple([
    signal.titre,
    signal.entreprise_nom,
    signal.description,
    signal.contenu,
    signal.resume,
    signal.raison_score,
    signal.angle_commercial,
    signal.action_recommandee,
    signal.texte_original,
    signal.type_signal
  ].filter(Boolean).join(' '));
}

function signalDetectionMetallique(signal = {}, enrichissement = {}) {
  const texte = texteSignalPourAjustementMetier(signal);
  const motsDetectionMetal = [
    'metallique',
    'metal',
    'particule metallique',
    'particules metalliques',
    'particule de metal',
    'particules de metal',
    'corps etranger',
    'corps etrangers',
    'contaminant',
    'contamination',
    'detecteur de metaux',
    'detection de metaux',
    'rayon x',
    'rayons x',
    'rappel produit metallique'
  ];

  if (motsDetectionMetal.some(mot => texte.includes(mot))) return true;

  return hasRegleMetier(enrichissement, rule =>
    ['detection_metaux_corps_etrangers', 'inspection_rayons_x_qualite'].includes(rule?.id)
  );
}

function calculerAffiniteMetierCommerciale(enrichissement = null, profilCommercial = '') {
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  if (!enrichissement || !profilCommercialNormalise) return { coefficient: 1, niveau: 'metier_non_determine' };

  const profilsDetectes = profilsMetiersDetectes(enrichissement).map(normaliserSlugProfilMetierFlair);
  const profilPrincipal = normaliserSlugProfilMetierFlair(enrichissement.profil_metier_principal || '');
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise);

  if (!profilsDetectes.length) return { coefficient: 1, niveau: 'metier_transverse' };
  if (profilPrincipal === profilCommercialNormalise) return { coefficient: 1, niveau: 'metier_principal' };
  if (compatibilite >= 0.75) return { coefficient: 0.9, niveau: 'metier_secondaire_fort' };
  if (compatibilite >= 0.45) return { coefficient: 0.75, niveau: 'metier_compatible' };
  if (compatibilite > 0) return { coefficient: 0.6, niveau: 'metier_indirect' };

  return { coefficient: 0.35, niveau: 'metier_hors_cible' };
}

function appliquerAffinityScoring(scoreIntrinseque, signal = {}, enrichissement = null, timing = {}) {
  const scoreBase = Math.max(0, Math.min(95, Math.round(Number(scoreIntrinseque) || 0)));
  const commercial = profilProvider() || {};

  if (typeof calculerScoresSeparationFlair === 'function') {
    return calculerScoresSeparationFlair({
      score_industriel: scoreBase,
      signal,
      enrichissement,
      timing,
      commercial,
      profil_commercial: profilCommercialActuel()
    });
  }

  // Fallback historique si flair-metier.js n'est pas disponible.
  const geo = coefficientGeographiqueSignal(signal);
  const metier = calculerAffiniteMetierCommerciale(enrichissement, profilCommercialActuel());
  const scoreDistribution = Math.max(0, Math.min(95, Math.round(scoreBase * geo.coefficient * metier.coefficient)));

  return {
    score_intrinseque: scoreBase,
    score_industriel: scoreBase,
    score_metier: Math.round((Number(metier.coefficient) || 1) * 100),
    score_geographique: Math.round((Number(geo.coefficient) || 1) * 100),
    score_timing: Math.max(0, Math.min(100, Math.round(Number(timing.score) || 50))),
    score_final_distribue: scoreDistribution,
    score: scoreDistribution,
    geo,
    metier,
    coefficient_total: Number((geo.coefficient * metier.coefficient).toFixed(3))
  };
}

function appliquerCoefficientGeographique(score, signal = {}) {
  const affinity = appliquerAffinityScoring(score, signal, null);
  return {
    score: affinity.score,
    coefficient: affinity.geo.coefficient,
    niveau: affinity.geo.niveau
  };
}

function appliquerPlancherTimingStrategique(score, signal = {}, resultat = {}, timing = {}, enrichissement = null) {
  const phase = timing?.phase || '';
  if (!['urgence_0_3_mois', 'contact_ideal_3_6_mois'].includes(phase)) {
    return score;
  }

  const texte = texteSignalPourAjustementMetier(signal);
  const entrepriseIdentifiee = Boolean(signalCompany(signal) || signal.entreprise_nom);
  const projetIndustriel = [
    'consultation', 'appel d offre', 'appel d offres', 'fournisseur', 'fournisseurs',
    'travaux', 'mise en service', 'nouvelle ligne', 'ligne automatisee', 'ligne automatisée',
    'modernisation', 'extension', 'investissement', 'conditionnement', 'controle qualite',
    'contrôle qualité', 'inspection', 'detection', 'détection'
  ].some(mot => motCleFlairPresent(texte, mot));

  if (!entrepriseIdentifiee || !projetIndustriel) {
    return score;
  }

  const profil = profilCommercialActuel();
  const geo = coefficientGeographiqueSignal(signal);
  const qualiteInspection = signalAQualiteOuInspection(signal, enrichissement || {});

  let plancher = 0;

  if (phase === 'urgence_0_3_mois') {
    plancher = geo.niveau === 'principale' ? 85 : geo.niveau === 'secondaire' ? 78 : geo.niveau === 'hors_secteur' ? 68 : 82;
  } else if (phase === 'contact_ideal_3_6_mois') {
    plancher = geo.niveau === 'principale' ? 80 : geo.niveau === 'secondaire' ? 74 : geo.niveau === 'hors_secteur' ? 64 : 76;
  }

  // Pour un profil Détection, un projet de ligne avec contrôle qualité / inspection
  // reste commercialement exploitable même hors région, sans devenir prioritaire absolu.
  if (profil === 'detection' && qualiteInspection) {
    plancher += geo.niveau === 'hors_secteur' ? 4 : 2;
  }

  return Math.max(score, Math.min(plancher, 88));
}


function hasSousProfilMetier(enrichissement = {}, profil = '', sousProfil = '') {
  const sousProfils = enrichissement.sous_profils_metiers_detectes || {};
  return Array.isArray(sousProfils[profil]) && sousProfils[profil].includes(sousProfil);
}

function hasRegleMetier(enrichissement = {}, predicate) {
  return reglesMetierDetectees(enrichissement).some(predicate);
}

function signalAQualiteOuInspection(signal = {}, enrichissement = {}) {
  const texte = texteSignalPourAjustementMetier(signal);
  const motsQualite = [
    'controle qualite', 'qualite', 'inspection', 'haccp', 'ifs', 'brc', 'brcgs',
    'tracabilite', 'corps etranger', 'contamination', 'securite alimentaire',
    'detecteur', 'detection', 'rayon x', 'rayons x', 'x ray', 'xray'
  ];

  if (motsQualite.some(mot => texte.includes(mot))) return true;

  return hasRegleMetier(enrichissement, rule =>
    ['detection_metaux_corps_etrangers', 'inspection_rayons_x_qualite', 'agro_qualite_certification'].includes(rule?.id)
  );
}

function scorePlancherMetier(score, plancher) {
  return Math.max(Number(score) || 0, plancher);
}

function capScoreSelonCompatibilite(score, compatibilite, profilCommercial, profilPrincipal, profilsDetectes = [], enrichissement = {}, signal = {}) {
  if (!profilsDetectes.length || !profilCommercial) return score;

  // Sécurité FLAIR V3.2 : normalisation locale systématique des slugs métier.
  // Évite les ReferenceError et les écarts de casse / libellés lors du scoring personnalisé.
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);

  const regleOffreDirecte = hasRegleMetier(enrichissement, rule =>
    rule?.couche === 'compatibilite_offre' &&
    Array.isArray(rule.profils_metiers) &&
    rule.profils_metiers.map(normaliserSlugProfilMetierFlair).includes(profilCommercialNormalise)
  );

  const regleBonusForte = hasRegleMetier(enrichissement, rule =>
    rule?.couche === 'bonus_metier' &&
    Number(rule?.intensite_metier?.[profilCommercialNormalise] || 0) >= 0.8
  );

  // 1) Cas très alignés : pas de pénalisation, et plancher métier pour éviter les vrais signaux sous-notés.
  if (regleOffreDirecte || profilCommercialNormalise === profilPrincipalNormalise || compatibilite >= 0.85) {
    if (profilCommercialNormalise === 'detection' && hasSousProfilMetier(enrichissement, 'detection', 'rayon_x')) {
      return Math.min(scorePlancherMetier(score, 88), 95);
    }
    if (profilCommercialNormalise === 'detection' && hasSousProfilMetier(enrichissement, 'detection', 'detecteur_metaux')) {
      return Math.min(scorePlancherMetier(score, 85), 95);
    }
    return Math.min(score, 95);
  }

  // 2) Cas semi-directs : le signal intéresse le commercial, mais n'est pas son métier principal.
  // Exemple : nouvelle ligne pharma avec contrôle qualité -> Détection utile, mais besoin pas encore explicite.
  if (regleBonusForte) {
    return Math.min(score, 88);
  }

  // 3) Compatibilités secondaires contrôlées par matrice métier.
  const capsSecondaires = {
    // Scoring métier fin V3 :
    // le métier principal conserve la priorité haute ;
    // les métiers compatibles restent visibles, mais ne doivent pas dépasser le profil naturellement concerné.
    detection: { process: 78, packaging: 76, pesage: 50, vision: 70 },
    pesage: { process: 72, packaging: 68, detection: 48, vision: 58 },
    packaging: { process: 78, pesage: 64, detection: 48, vision: 62 },
    vision: { process: 70, packaging: 70, detection: 62, pesage: 58 },
    process: { packaging: 76, detection: 64, pesage: 66, vision: 64 }
  };

  let cap = capsSecondaires[profilCommercialNormalise]?.[profilPrincipalNormalise];

  // Réglage fin FLAIR 4.1 : un rappel métallique / corps étranger est un vrai sujet Détection,
  // mais doit rester froid pour un profil Process si aucun besoin convoyage / flux / fin de ligne n'est explicite.
  if (profilCommercialNormalise === 'process' && profilPrincipalNormalise === 'detection' && signalDetectionMetallique(signal, enrichissement)) {
    cap = 49;
  }

  // Nuance importante : Process + indice qualité / inspection reste plus fort pour un commercial Détection.
  // Exemple : extension pharma avec nouvelles lignes + contrôle qualité.
  if (profilCommercialNormalise === 'detection' && profilPrincipalNormalise === 'process' && signalAQualiteOuInspection(signal, enrichissement)) {
    cap = 85;
  }

  if (typeof cap === 'number') {
    return Math.min(score, cap);
  }

  // 4) Compatibilité chiffrée mais sans règle de matrice explicite.
  if (compatibilite >= 0.6) return Math.min(score, 75);
  if (compatibilite > 0) return Math.min(score, 55);

  // 5) Non compatible.
  return Math.min(score, 45);
}

function chaleurDepuisScoreMetier(score) {
  if (score >= 80) return 'chaud';
  if (score >= 60) return 'tiede';
  return 'froid';
}

function reglesMetierDetectees(enrichissement = {}) {
  return Array.isArray(enrichissement.matched_rules)
    ? enrichissement.matched_rules.filter(Boolean)
    : [];
}

function construireResumeReglesMetier(enrichissement = {}) {
  const regles = reglesMetierDetectees(enrichissement)
    .map(rule => rule.label)
    .filter(Boolean);

  return Array.from(new Set(regles)).slice(0, 3).join(', ');
}

function construireResumeSousProfils(enrichissement = {}, limite = 5) {
  const sousProfils = enrichissement.sous_profils_metiers_detectes || {};
  const valeurs = [];

  Object.entries(sousProfils).forEach(([profil, liste]) => {
    (liste || []).forEach(sousProfil => {
      valeurs.push(`${labelProfilMetierRadar(profil)} / ${labelSousProfilMetierRadar(sousProfil)}`);
    });
  });

  return Array.from(new Set(valeurs)).slice(0, limite).join(', ');
}

function construireSousProfilsPourProfil(enrichissement = {}, profil = '', limite = 3) {
  const sousProfils = enrichissement.sous_profils_metiers_detectes || {};
  const liste = sousProfils[profil] || [];

  return Array.from(new Set(liste))
    .slice(0, limite)
    .map(labelSousProfilMetierRadar)
    .join(', ');
}

function construireResumeMetierCourt(enrichissement = {}, profilCommercial = '') {
  const profils = profilsMetiersDetectes(enrichissement);
  const profilPrincipal = enrichissement.profil_metier_principal || profils[0] || '';
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise);

  if (!profils.length) return '';

  const principalLabel = profilPrincipal ? labelProfilMetierRadar(profilPrincipal) : 'industrielle';
  const commercialLabel = profilCommercial ? labelProfilMetierRadar(profilCommercial) : '';
  const sousProfilsPrincipal = construireSousProfilsPourProfil(enrichissement, profilPrincipal, 3);
  const sousProfilsCommercial = profilCommercial
    ? construireSousProfilsPourProfil(enrichissement, profilCommercial, 3)
    : '';

  if (!profilCommercial) {
    return sousProfilsPrincipal
      ? `Lecture principale ${principalLabel} : ${sousProfilsPrincipal}.`
      : `Lecture principale ${principalLabel}.`;
  }

  if (profilCommercialNormalise === profilPrincipalNormalise || compatibilite >= 0.85) {
    return sousProfilsCommercial
      ? `Signal fortement aligné avec ton profil ${commercialLabel} : ${sousProfilsCommercial}.`
      : `Signal fortement aligné avec ton profil ${commercialLabel}.`;
  }

  if (compatibilite >= 0.6) {
    return sousProfilsCommercial
      ? `Projet principalement ${principalLabel}, mais compatible avec ton profil ${commercialLabel} : ${sousProfilsCommercial}.`
      : `Projet principalement ${principalLabel}, mais compatible avec ton profil ${commercialLabel}.`;
  }

  if (compatibilite > 0) {
    return `Projet principalement ${principalLabel}. Intérêt indirect pour ton profil ${commercialLabel}.`;
  }

  return `Projet principalement ${principalLabel}. Compatibilité faible avec ton profil ${commercialLabel}.`;
}

function construireLectureMetier(enrichissement = {}, profilCommercial = '') {
  return construireResumeMetierCourt(enrichissement, profilCommercial);
}

function nettoyerPhraseMetierBase(texte = '') {
  return String(texte || '')
    .replace(/Lecture métier\s*:[^.]+\.?\s*/gi, '')
    .replace(/Profils concernés\s*:[^.]+\.?\s*/gi, '')
    .replace(/Sous-profils\s*:[^.]+\.?\s*/gi, '')
    .replace(/Règles détectées\s*:[^.]+\.?\s*/gi, '')
    .replace(/Angle métier\s*:[^.]+\.?\s*/gi, '')
    .replace(/Technologies repérées\s*:[^.]+\.?\s*/gi, '')
    .replace(/Priorité métier\s*:[^.]+\.?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ajouterPhraseMetier(texte, lectureMetier) {
  const resume = String(lectureMetier || '').trim();
  const base = nettoyerPhraseMetierBase(texte);

  if (!resume) return base;
  if (!base) return resume;

  return `${resume} ${base}`;
}

function construireAngleMetier(enrichissement = {}, profilCommercial = '') {
  const profilPrincipal = enrichissement.profil_metier_principal || '';
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise);
  const principalLabel = profilPrincipalNormalise ? labelProfilMetierRadar(profilPrincipalNormalise) : 'industrielle';
  const commercialLabel = profilCommercialNormalise ? labelProfilMetierRadar(profilCommercialNormalise) : '';

  if (!profilCommercialNormalise) {
    return `Qualifier les besoins liés au projet ${principalLabel}.`;
  }

  if (profilCommercialNormalise === 'detection') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins de détection de métaux, rayons X ou contrôle corps étrangers.";
    }
    if (compatibilite > 0) {
      return "Vérifier si la nouvelle ligne intègre un point de contrôle qualité, détecteur de métaux ou inspection rayons X.";
    }
  }

  if (profilCommercialNormalise === 'pesage') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins de balance, trieuse pondérale, contrôle poids ou étiquetage poids/prix.";
    }
    if (compatibilite > 0) {
      return "Vérifier si la ligne prévoit un contrôle poids, une trieuse pondérale ou un étiquetage automatique.";
    }
  }

  if (profilCommercialNormalise === 'packaging') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins d'emballage, films, carton, étiquettes, impression hélio/flexo, complexage, vernis, encres ou conditionnement secondaire.";
    }
    if (compatibilite > 0) {
      return "Vérifier les besoins packaging associés : carton, étuis, étiquettes, impression, marquage, finition ou traçabilité.";
    }
  }

  if (profilCommercialNormalise === 'vision') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins de contrôle caméra, présence/absence, lecture code, OCR ou contrôle étiquette.";
    }
    if (compatibilite > 0) {
      return "Vérifier si le projet prévoit un contrôle visuel, une lecture code ou un contrôle étiquette.";
    }
  }

  if (profilCommercialNormalise === 'process') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins de convoyage, manutention, automatisme, encaisseuse ou palettisation.";
    }
    if (compatibilite > 0) {
      return "Vérifier les besoins process associés à la ligne : flux produit, convoyage ou fin de ligne.";
    }
  }

  if (compatibilite > 0) {
    return `Qualifier l'opportunité sous l'angle ${commercialLabel}, même si la lecture principale reste ${principalLabel}.`;
  }

  return `Signal plutôt orienté ${principalLabel} ; à conserver en veille si l'entreprise est stratégique.`;
}

function construirePrioriteMetier(enrichissement = {}, profilCommercial = '') {
  const profilPrincipal = enrichissement.profil_metier_principal || '';
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise);
  const commercialLabel = profilCommercialNormalise ? labelProfilMetierRadar(profilCommercialNormalise) : '';
  const principalLabel = profilPrincipalNormalise ? labelProfilMetierRadar(profilPrincipalNormalise) : 'industrielle';

  if (!profilCommercialNormalise) return '';

  if (profilCommercialNormalise === profilPrincipalNormalise || compatibilite >= 0.85) {
    return `Priorité haute pour ${commercialLabel}. Identifier rapidement le bon interlocuteur production, qualité, maintenance ou travaux neufs.`;
  }

  if (compatibilite >= 0.6) {
    return `Priorité utile mais secondaire pour ${commercialLabel}. Qualifier avant contact direct.`;
  }

  if (compatibilite > 0) {
    return `Signal indirect pour ${commercialLabel}. À surveiller ou à traiter si l'entreprise est dans la cible.`;
  }

  return `Faible priorité pour ${commercialLabel}. Lecture principale ${principalLabel}.`;
}


function enrichirScoringAvecSourceVeille(signal, resultatInitial) {

  if (
    !window.FLAIR_SOURCE_VEILLE ||
    typeof window.FLAIR_SOURCE_VEILLE.analyserSignalAvecRegles !== 'function'
  ) {
    return resultatInitial;
  }

  const enrichissement = window.FLAIR_SOURCE_VEILLE
    .analyserSignalAvecRegles(signal);

  if (!enrichissement) {
    return resultatInitial;
  }

  const profilCommercial = profilCommercialActuel();
  const profilsDetectes = profilsMetiersDetectes(enrichissement);
  const profilPrincipal = enrichissement.profil_metier_principal || '';
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercial);
  const facteurBonus = facteurBonusSelonCompatibilite(
    compatibilite,
    profilsDetectes,
    profilCommercial,
    profilPrincipal,
    enrichissement
  );
  const bonusMetier = Math.round((Number(enrichissement.score_bonus) || 0) * facteurBonus);

  let scoreFinal = Math.min(
    (resultatInitial.score_pertinence || 0) + bonusMetier,
    95
  );

  scoreFinal = capScoreSelonCompatibilite(
    scoreFinal,
    compatibilite,
    profilCommercial,
    profilPrincipal,
    profilsDetectes,
    enrichissement,
    signal
  );

  // Le score calculé ici reste le score intrinsèque / métier du signal.
  // L'affinité géographique est appliquée plus tard, lors de la distribution personnalisée
  // dans signaux_commerciaux, afin d'éviter qu'une géographie inconnue casse la valeur du signal.

  const chaleurRank = { froid: 1, tiede: 2, chaud: 3 };

  function garderChaleurLaPlusForte(...valeurs) {
    return valeurs
      .filter(Boolean)
      .sort((a, b) => (chaleurRank[b] || 0) - (chaleurRank[a] || 0))[0] || 'froid';
  }

  const chaleurScore = chaleurDepuisScoreMetier(scoreFinal);
  const chaleurSource = enrichissement.chaleur || resultatInitial.chaleur;

  // La chaleur finale reste cohérente avec le score personnalisé.
  // On évite qu'un signal métier indirect reste "chaud" uniquement parce qu'une règle générique l'a détecté.
  const chaleurFinale = profilsDetectes.length && profilCommercial
    ? chaleurScore
    : garderChaleurLaPlusForte(resultatInitial.chaleur, chaleurSource, chaleurScore);

  const lectureMetier = construireLectureMetier(enrichissement, profilCommercial);

  const phraseGeographique = '';

  const raisonMetier = ajouterPhraseMetier(
    ajouterPhraseMetier(enrichissement.raison || resultatInitial.raison_score, lectureMetier),
    phraseGeographique
  );

  const angleMetier = ajouterPhraseMetier(
    enrichissement.opportunite || resultatInitial.angle_commercial,
    construireAngleMetier(enrichissement, profilCommercial)
  );

  const actionMetier = ajouterPhraseMetier(
    enrichissement.action || resultatInitial.action_recommandee,
    construirePrioriteMetier(enrichissement, profilCommercial)
  );

  return normaliserResultatScoring({
    ...resultatInitial,

    score_pertinence: scoreFinal,

    chaleur: chaleurFinale,

    type_signal:
      enrichissement.type_signal ||
      resultatInitial.type_signal,

    raison_score: raisonMetier,

    angle_commercial: angleMetier,

    action_recommandee: actionMetier,

    profils_metiers_detectes: profilsDetectes,
    profil_metier_principal: profilPrincipal,
    sous_profils_metiers_detectes: enrichissement.sous_profils_metiers_detectes || {},
    compatibilite_metier: enrichissement.compatibilite_metier || {},
    matched_rules: reglesMetierDetectees(enrichissement)
  });
}

  window.FLAIR_METIER = {
    setProfilProvider(fn) {
      if (typeof fn === 'function') profilProvider = fn;
    },
    GeoAffinityEngine,
    coefficientGeographiqueSignal,
    construirePhraseGeographique,
    scoreGeographiqueDepuisAffinity,
    scoreMetierDepuisEnrichissement,
    calculerScoresSeparationFlair,
    formaterResumeScoresFlair,
    normaliserTexteSimple,
    signalRegion,
    normaliserSlugProfilMetierFlair,
    labelProfilMetier,
    signalTitle,
    signalCompany,
    texteCompletSignalFlair,
    calculerTimingCommercial,
    motCleFlairPresent,
    detecterSecteurSousSecteur,
    dedoublonnerListeTexte,
    signalSemblePME,
    interlocuteursPourProfil,
    questionAnglePourProfil,
    prochaineActionCopilote,
    preparerCopiloteCommercial,
    calculerScoreDistributionIA,
    normaliserListeCopilote,
    dedoublonnerListeCopilote,
    estPersonaCopilote,
    parserContactCopilote,
    extraireContactsEtThemesCopilote,
    renderListeContactsCopilote,
    renderTexteOuPucesCopilote,
    construirePourquoiCopilote,
    construireCopiloteCommercialJson,
    determinerVigilanceCopilote,
    lireCopiloteCommercialJson,
    normaliserResultatScoring,
    scoringLocal,
    labelProfilMetierRadar,
    labelSousProfilMetierRadar,
    profilsMetiersDetectes,
    profilCommercialActuel,
    compatibiliteMetierPourProfil,
    facteurBonusSelonCompatibilite,
    texteSignalPourAjustementMetier,
    signalDetectionMetallique,
    calculerAffiniteMetierCommerciale,
    appliquerAffinityScoring,
    appliquerCoefficientGeographique,
    appliquerPlancherTimingStrategique,
    hasSousProfilMetier,
    hasRegleMetier,
    signalAQualiteOuInspection,
    chaleurDepuisScoreMetier,
    reglesMetierDetectees,
    construireResumeReglesMetier,
    construireResumeSousProfils,
    construireSousProfilsPourProfil,
    construireResumeMetierCourt,
    construireLectureMetier,
    nettoyerPhraseMetierBase,
    ajouterPhraseMetier,
    construireAngleMetier,
    construirePrioriteMetier,
    familleStrategiqueProjet,
    idFamilleStrategiqueProjet,
    signalFamilleLogistique,
    nettoyerTexteQualiteHorsContexte,
    enrichirScoringAvecSourceVeille
  };
})();
