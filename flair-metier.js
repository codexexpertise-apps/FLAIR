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

  // =========================================================================
  // FLAIR V2026.1 — RÈGLE DE CRÉDIBILITÉ
  // =========================================================================
  // La confiance commerciale est le premier actif de FLAIR.
  // Un score supérieur à 90 doit être mérité par des preuves fortes et
  // convergentes : consultation, appel d'offres, nouvelle usine, plusieurs
  // lignes, investissement majeur, chantier lancé, mise en service proche,
  // incident qualité documenté ou projet déjà suivi.
  // En cas de doute, FLAIR sous-évalue plutôt qu'il ne surévalue.
  // =========================================================================

  function texteCredibiliteFlair(signal = {}, timing = {}) {
    return normaliserTexteSimple([
      texteCompletSignalFlair(signal),
      signal.type_signal,
      signal.famille_projet,
      signal.famille_strategique,
      signal.famille_strategique_label,
      timing.phase,
      timing.fenetre,
      timing.raison
    ].filter(Boolean).join(' '));
  }

  function contientIndiceCredibiliteFlair(texte = '', expressions = []) {
    return expressions.some(expression => motCleFlairPresent(texte, expression));
  }


  // =========================================================================
  // FLAIR V2026.1 — GUARDRAIL SÉMANTIQUE
  // =========================================================================
  // Objectif : ne jamais transformer une négation commerciale en preuve positive.
  // Exemple : "aucune consultation" ou "aucun appel d'offres" ne doit pas
  // déclencher une fenêtre 0-3 mois ni autoriser un score exceptionnel.
  // =========================================================================

  function decouperPhrasesFlair(texte = '') {
    return String(texte || '')
      .split(/(?<=[\.\!\?;。])\s+|\n+/)
      .map(item => normaliserTexteSimple(item))
      .filter(Boolean);
  }

  function phraseContientUnIndiceFlair(phrase = '', indices = []) {
    return (indices || []).some(indice => phrase.includes(normaliserTexteSimple(indice)));
  }

  function phraseNegationCommercialeFlair(phrase = '') {
    return phraseContientUnIndiceFlair(phrase, [
      'aucun', 'aucune', 'pas de', 'pas d ', 'pas d\'', 'sans', 'n est pas', 'n est encore',
      'ne sont pas', 'ne sera pas', 'non annonce', 'non annoncé', 'non lance', 'non lancé',
      'n est lance', 'n est lancé', 'n est pas encore', 'pas encore', 'reste a definir',
      'reste à définir', 'seront definis ulterieurement', 'seront définis ultérieurement',
      'devront etre definis ulterieurement', 'devront être définis ultérieurement',
      'a definir ulterieurement', 'à définir ultérieurement'
    ]);
  }

  function texteContientNegationAutourCibleFlair(texte = '', cibles = []) {
    return decouperPhrasesFlair(texte).some(phrase =>
      phraseNegationCommercialeFlair(phrase) && phraseContientUnIndiceFlair(phrase, cibles)
    );
  }

  function detecterGuardrailSemantiqueFlair(signal = {}, timing = {}) {
    const texte = texteCredibiliteFlair(signal, timing);
    const phrases = decouperPhrasesFlair(texte);

    const appelOffresNie = texteContientNegationAutourCibleFlair(texte, [
      'appel d offres', 'appel d offre', 'appel offres', 'dce', 'marche public', 'marché public'
    ]);

    const consultationNiee = texteContientNegationAutourCibleFlair(texte, [
      'consultation', 'consultations', 'fournisseur', 'fournisseurs', 'demande de prix',
      'demande de devis', 'selection fournisseurs', 'sélection fournisseurs'
    ]);

    const chantierNie = texteContientNegationAutourCibleFlair(texte, [
      'chantier', 'travaux', 'installation', 'mise en service', 'demarrage', 'démarrage'
    ]);

    const phaseAmontForte = phrases.some(phrase =>
      phraseContientUnIndiceFlair(phrase, [
        'phase amont', 'encore en phase amont', 'projet encore amont', 'encore amont',
        'suivi avant une action commerciale forte', 'necessite encore un suivi',
        'nécessite encore un suivi', 'futurs equipements', 'futurs équipements',
        'equipements devront etre definis ulterieurement', 'équipements devront être définis ultérieurement',
        'a qualifier avant action commerciale', 'à qualifier avant action commerciale'
      ])
    );

    const consultationProspective = phrases.some(phrase => {
      const cibleCommerciale = phraseContientUnIndiceFlair(phrase, [
        'consultation', 'consultations', 'fournisseur', 'fournisseurs',
        'demande de prix', 'demande de devis', 'choix techniques',
        'choix des equipements', 'choix des équipements'
      ]);

      const futurOuProbable = phraseContientUnIndiceFlair(phrase, [
        'susceptible d intervenir', 'susceptibles d intervenir',
        'pourrait intervenir', 'pourraient intervenir',
        'devrait intervenir', 'devraient intervenir',
        'serait en preparation', 'seraient en preparation',
        'en preparation', 'en préparation',
        'prevu', 'prévu', 'prevue', 'prévue', 'prevues', 'prévues',
        'a venir', 'à venir',
        'dans les prochains mois', 'prochains mois',
        'ultérieurement', 'ulterieurement',
        'avant consultation', 'avant le figement', 'avant figement'
      ]);

      return cibleCommerciale && futurOuProbable;
    });

    const consultationEtAppelOffresNies = appelOffresNie && consultationNiee;
    // Une consultation prospective est intéressante, mais ce n'est pas une preuve
    // de fenêtre 0-3 mois. Elle doit orienter vers 3-6 mois, pas "agir vite".
    const interditUrgence = consultationEtAppelOffresNies || chantierNie || phaseAmontForte || consultationProspective;

    return {
      appel_offres_nie: appelOffresNie,
      consultation_niee: consultationNiee,
      chantier_nie: chantierNie,
      phase_amont_forte: phaseAmontForte,
      consultation_prospective: consultationProspective,
      consultation_et_appel_offres_nies: consultationEtAppelOffresNies,
      interdit_urgence: interditUrgence
    };
  }

  function montantInvestissementMaxMEuroDepuisTexte(texte = '') {
    const brut = String(texte || '').replace(/,/g, '.');
    let max = 0;

    const millions = brut.matchAll(/(\d+(?:\.\d+)?)\s*(?:m€|meur|m eur|millions?\s+d[’']?euros?|millions?\s+€)/gi);
    for (const match of millions) {
      max = Math.max(max, Number(match[1]) || 0);
    }

    const euros = brut.matchAll(/(\d+(?:[\s.]\d{3})+)\s*(?:€|euros?)/gi);
    for (const match of euros) {
      const valeur = Number(String(match[1] || '').replace(/[\s.]/g, '')) || 0;
      if (valeur >= 1000000) max = Math.max(max, valeur / 1000000);
    }

    return max;
  }

  function detecterPreuvesCredibiliteFlair(signal = {}, timing = {}) {
    const texte = texteCredibiliteFlair(signal, timing);
    const gardeFou = detecterGuardrailSemantiqueFlair(signal, timing);
    const preuves = [];

    const ajouter = (id, label) => {
      if (!preuves.some(preuve => preuve.id === id)) {
        preuves.push({ id, label });
      }
    };

    // FLAIR V2026.2 — doctrine maturité :
    // Le type_signal stocké ne suffit plus à prouver un appel d'offres.
    // La preuve doit être présente dans le texte ou la source, sans négation.
    if (
      !gardeFou.appel_offres_nie &&
      contientIndiceCredibiliteFlair(texte, [
        'appel d offres en cours', 'appel d offre en cours', 'appel offres en cours',
        'appel d offres publie', 'appel d offre publié', 'appel offres publie',
        'dce publie', 'dce publié',
        'marche public publie', 'marché public publié',
        'boamp', 'cahier des charges publie', 'cahier des charges publié'
      ])
    ) {
      ajouter('appel_offres', 'Appel d’offres ou marché identifié');
    }

    if (
      !gardeFou.consultation_niee &&
      !gardeFou.consultation_prospective &&
      contientIndiceCredibiliteFlair(texte, [
        'consultation en cours', 'consultations en cours',
        'consultation fournisseurs lancee', 'consultation fournisseurs lancée',
        'consultations fournisseurs lancees', 'consultations fournisseurs lancées',
        'demande de prix en cours', 'demande de devis en cours',
        'dce publie', 'dce publié',
        'cahier des charges publie', 'cahier des charges publié'
      ])
    ) {
      ajouter('consultation', 'Consultation fournisseurs ou demande de prix réellement lancée');
    }

    if (
      contientIndiceCredibiliteFlair(texte, [
        'nouvelle usine', 'nouveau site', 'nouveau bâtiment', 'nouveau batiment',
        'nouvelle plateforme', 'nouvelle plate-forme', 'nouvelle unité',
        'nouvelle unite', 'nouveau site industriel'
      ])
    ) {
      ajouter('nouvelle_usine', 'Nouvelle usine, nouveau site ou nouvelle unité');
    }

    const plusieursLignes =
      contientIndiceCredibiliteFlair(texte, [
        'plusieurs lignes', 'deux nouvelles lignes', 'trois nouvelles lignes',
        'nouvelles lignes', '2 nouvelles lignes', '3 nouvelles lignes',
        '4 nouvelles lignes', '5 nouvelles lignes'
      ]) ||
      /\b[2-9]\s+(?:nouvelles?\s+)?lignes?\b/i.test(texte);

    if (plusieursLignes) {
      ajouter('plusieurs_lignes', 'Plusieurs lignes industrielles');
    }

    const nouvelleLigne =
      signal.type_signal === 'nouvelle_ligne' ||
      contientIndiceCredibiliteFlair(texte, [
        'nouvelle ligne', 'ligne de production', 'ligne de conditionnement',
        'ligne automatisee', 'ligne automatisée', 'nouvelle ligne de fabrication'
      ]);

    if (nouvelleLigne) {
      ajouter('nouvelle_ligne', 'Nouvelle ligne identifiée');
    }

    const montantMEuro = montantInvestissementMaxMEuroDepuisTexte([
      texteCompletSignalFlair(signal),
      signal.resume_brut,
      signal.raison_score,
      signal.titre
    ].filter(Boolean).join(' '));

    if (
      montantMEuro >= 5 ||
      contientIndiceCredibiliteFlair(texte, [
        'investissement majeur', 'investissement important', 'investissement significatif',
        'capex', 'budget valide', 'budget validé', 'investissement valide',
        'investissement validé'
      ])
    ) {
      ajouter('investissement_majeur', 'Investissement majeur ou budget identifié');
    }

    if (
      !gardeFou.chantier_nie &&
      contientIndiceCredibiliteFlair(texte, [
        'travaux demarres', 'travaux démarrés', 'chantier demarre',
        'chantier démarré', 'chantier lance', 'chantier lancé',
        'installation en cours', 'lancement des travaux', 'début des travaux',
        'debut des travaux'
      ])
    ) {
      ajouter('chantier_lance', 'Chantier lancé ou travaux démarrés');
    }

    if (
      !gardeFou.interdit_urgence &&
      (['urgence_0_3_mois'].includes(timing?.phase) ||
      contientIndiceCredibiliteFlair(texte, [
        'mise en service imminente', 'mise en service prochaine',
        'mise en service prévue', 'mise en service prevue',
        'mise en service attendue', 'sera mis en service',
        'sera mise en service', 'démarrage imminent', 'demarrage imminent',
        'lancement imminent'
      ]))
    ) {
      ajouter('mise_service_proche', 'Mise en service ou démarrage proche');
    }

    if (
      signalFamilleQualite(signal) ||
      contientIndiceCredibiliteFlair(texte, [
        'rappel produit', 'rappel de lot', 'contamination', 'corps etranger',
        'corps étranger', 'corps étrangers', 'incident qualite',
        'incident qualité', 'retrait de vente', 'particules metalliques',
        'particules métalliques'
      ])
    ) {
      ajouter('qualite_critique', 'Incident qualité ou risque corps étranger documenté');
    }

    if (signal.projet_detecte === true || signal.projet_detecte === 'true') {
      ajouter('projet_suivi', 'Projet déjà suivi dans FLAIR');
    }

    return preuves;
  }

  function plafondCredibiliteDepuisPreuvesFlair(preuves = [], signal = {}, timing = {}) {
    const ids = new Set((preuves || []).map(preuve => preuve.id));
    // "Projet suivi" renforce la confiance dans l'historique, mais ne doit pas
    // à lui seul faire franchir un palier >90. Les scores exceptionnels restent
    // réservés aux preuves de maturité commerciale réelles.
    const preuvesFortes = (preuves || []).filter(preuve => preuve?.id !== 'projet_suivi');
    const nb = Array.isArray(preuvesFortes) ? preuvesFortes.length : 0;
    let plafond = 84;

    if (nb >= 5) plafond = 95;
    else if (nb === 4) plafond = 94;
    else if (nb === 3) plafond = 92;
    else if (nb === 2) plafond = 90;
    else if (nb === 1) plafond = 88;

    // Cas métier assumé : une nouvelle ligne seule est un excellent signal,
    // mais elle ne doit pas dépasser 90 sans preuve complémentaire.
    if (ids.has('nouvelle_ligne')) {
      plafond = Math.max(plafond, 90);
    }

    // Une preuve très forte peut autoriser un passage au-dessus de 90, même
    // avec peu d'autres indices. Elle reste plafonnée pour éviter l'emballement.
    if (ids.has('appel_offres') || ids.has('consultation')) {
      plafond = Math.max(plafond, 94);
    }

    if (ids.has('qualite_critique')) {
      plafond = Math.max(plafond, 94);
    }

    if (ids.has('nouvelle_usine') && ids.has('investissement_majeur')) {
      plafond = Math.max(plafond, 94);
    }

    if (ids.has('plusieurs_lignes') && ids.has('investissement_majeur')) {
      plafond = Math.max(plafond, 93);
    }

    if (ids.has('chantier_lance') || ids.has('mise_service_proche')) {
      plafond = Math.max(plafond, 92);
    }

    if (!['urgence_0_3_mois', 'contact_ideal_3_6_mois', 'amont_6_12_mois'].includes(timing?.phase || '')) {
      plafond = Math.min(plafond, 86);
    }

    if (timing?.phase === 'probablement_trop_tard') {
      plafond = Math.min(plafond, 70);
    }

    return Math.max(0, Math.min(95, plafond));
  }

  function appliquerRegleCredibiliteFlair(signal = {}, scores = {}) {
    const scoreBrut = Math.max(0, Math.min(95, Math.round(Number(scores.score ?? scores.score_final_distribue ?? 0) || 0)));
    const timing = scores.timing || {};
    const preuves = detecterPreuvesCredibiliteFlair(signal, timing);
    const plafondCredibilite = plafondCredibiliteDepuisPreuvesFlair(preuves, signal, timing);
    const maturite = detecterMaturiteProjetFlair(signal, timing, scores);
    const plafond = Math.min(plafondCredibilite, maturite.plafond_score || 84);
    const scoreCredible = Math.min(scoreBrut, plafond);

    return {
      score: scoreCredible,
      score_final_distribue: scoreCredible,
      plafond_credibilite: plafond,
      plafond_credibilite_initial: plafondCredibilite,
      plafond_maturite: maturite.plafond_score,
      maturite_projet: maturite.niveau,
      maturite_projet_label: maturite.label,
      preuves_credibilite: preuves,
      nb_preuves_credibilite: preuves.length,
      regle_credibilite_appliquee: scoreCredible < scoreBrut
    };
  }


  // =========================================================================
  // FLAIR V2026.1 — PRIORITÉ TIMING
  // =========================================================================
  // La crédibilité protège le score maximum. Le timing départage ensuite les
  // projets de qualité comparable : une opportunité à qualifier maintenant doit
  // remonter devant un projet encore en veille, même si ce dernier est solide.
  // Cette règle ne peut jamais dépasser le plafond de crédibilité.
  // =========================================================================

  function ajusterScoreSelonPrioriteTimingFlair(score, timing = {}, plafondCredibilite = 95) {
    const scoreInitial = Math.max(0, Math.min(95, Math.round(Number(score) || 0)));
    const plafond = Math.max(0, Math.min(95, Math.round(Number(plafondCredibilite) || 95)));
    const phase = timing?.phase || '';

    let ajustement = 0;
    let niveau = 'timing_neutre';

    if (phase === 'urgence_0_3_mois') {
      ajustement = 2;
      niveau = 'priorite_immediate';
    } else if (phase === 'contact_ideal_3_6_mois') {
      ajustement = 3;
      niveau = 'contact_ideal';
    } else if (phase === 'amont_6_12_mois') {
      ajustement = -1;
      niveau = 'amont_a_qualifier';
    } else if (phase === 'veille_active_12_24_mois') {
      ajustement = -4;
      niveau = 'veille_active';
    } else if (phase === 'veille_longue_plus_24_mois') {
      ajustement = -8;
      niveau = 'veille_longue';
    } else if (phase === 'probablement_trop_tard') {
      ajustement = -18;
      niveau = 'probablement_trop_tard';
    }

    const scoreAjuste = Math.max(0, Math.min(plafond, scoreInitial + ajustement));

    return {
      score: scoreAjuste,
      score_final_distribue: scoreAjuste,
      ajustement_timing_priorite: ajustement,
      niveau_timing_priorite: niveau,
      regle_timing_priorite_appliquee: scoreAjuste !== scoreInitial
    };
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

    const scoreFinalMetier = plafonnerScoreFinalParMetier(brut, scoreMetier);
    const prioriteTiming = ajusterScoreSelonPrioriteTimingFlair(
      scoreFinalMetier,
      timing,
      95
    );

    // FLAIR V2026.1 — AUTORITÉ FINALE DU SCORE
    // La priorité timing aide à départager les signaux, mais la crédibilité
    // reste le dernier arbitre. Aucun bonus ne peut faire franchir un palier
    // supérieur à 90 sans preuve forte et actuelle.
    const credibilite = appliquerRegleCredibiliteFlair(signal, {
      score: prioriteTiming.score,
      score_final_distribue: prioriteTiming.score,
      timing
    });
    const scoreFinal = credibilite.score;

    return {
      score_industriel: scoreIndustriel,
      score_metier: scoreMetier,
      score_geographique: scoreGeographique,
      score_timing: scoreTiming,
      score_final_distribue: scoreFinal,
      score: scoreFinal,
      plafond_credibilite: credibilite.plafond_credibilite,
      preuves_credibilite: credibilite.preuves_credibilite,
      nb_preuves_credibilite: credibilite.nb_preuves_credibilite,
      regle_credibilite_appliquee: credibilite.regle_credibilite_appliquee,
      ajustement_timing_priorite: prioriteTiming.ajustement_timing_priorite,
      niveau_timing_priorite: prioriteTiming.niveau_timing_priorite,
      regle_timing_priorite_appliquee: prioriteTiming.regle_timing_priorite_appliquee,
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
      pesage: 'Pesage / contrôle poids / étiquetage industriel',
      detection: 'Détection / contrôle qualité',
      vision: 'Vision industrielle / contrôle qualité',
      packaging: 'Packaging / films / étiquettes / impression',
      process: 'Process / convoyage / conditionnement / fin de ligne',
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

  function getCopilotePhraseEngine() {
    return window.FLAIR_COPILOTE || null;
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


// =========================================================================
// FLAIR V2026.2 — MOTEUR DE MATURITÉ PROJET
// =========================================================================
// Objectif : rendre type_signal, timing et score cohérents avec les preuves
// réellement présentes. Le contact terrain enrichit le Copilote, mais ne
// modifie jamais la maturité, le score, la chaleur ou le timing.
// =========================================================================

function texteMaturiteProjetFlair(signal = {}, resultat = {}) {
  return normaliserTexteSimple([
    texteCompletSignalFlair(signal),
    resultat.raison_score,
    resultat.angle_commercial,
    resultat.action_recommandee,
    resultat.resume,
    resultat.description
  ].filter(Boolean).join(' '));
}

function phrasePositiveContientFlair(phrase = '', expressions = []) {
  if (!phrase || phraseNegationCommercialeFlair(phrase)) return false;
  return (expressions || []).some(expression => phrase.includes(normaliserTexteSimple(expression)));
}

function texteContientExpressionPositiveFlair(texte = '', expressions = []) {
  return decouperPhrasesFlair(texte).some(phrase => phrasePositiveContientFlair(phrase, expressions));
}

function detecterMaturiteProjetFlair(signal = {}, timingInitial = {}, resultat = {}) {
  const texte = texteMaturiteProjetFlair(signal, resultat);
  const gardeFou = detecterGuardrailSemantiqueFlair(signal, timingInitial || {});
  const contient = (expressions) => texteContientExpressionPositiveFlair(texte, expressions);
  const contientBrut = (expressions) => expressions.some(exp => texte.includes(normaliserTexteSimple(exp)));

  const preuveAppelOffre = contient([
    'appel d offres en cours', 'appel d offre en cours', 'appel offres en cours',
    'appel d offres publie', 'appel d offre publié', 'appel offres publie',
    'dce publie', 'dce publié',
    'marche public publie', 'marché public publié',
    'cahier des charges publie', 'cahier des charges publié',
    'boamp'
  ]);

  const preuveConsultationEnCours = contient([
    'consultation en cours', 'consultations en cours',
    'consultation fournisseurs lancee', 'consultation fournisseurs lancée',
    'consultations fournisseurs lancees', 'consultations fournisseurs lancées',
    'demande de prix en cours', 'demande de devis en cours',
    'demande de prix lancee', 'demande de prix lancée',
    'demande de devis lancee', 'demande de devis lancée'
  ]);

  const consultationPreparee = !preuveConsultationEnCours && contient([
    'consultations fournisseurs en preparation', 'consultations fournisseurs en préparation',
    'consultation fournisseurs en preparation', 'consultation fournisseurs en préparation',
    'consultations prevues', 'consultations prévues',
    'fournisseurs seront consultes', 'fournisseurs seront consultés',
    'selection fournisseurs a venir', 'sélection fournisseurs à venir',
    'choix techniques dans les prochains mois',
    'choix des equipements a venir', 'choix des équipements à venir'
  ]);

  const chantierLance = contient([
    'travaux demarres', 'travaux démarrés',
    'chantier demarre', 'chantier démarré',
    'chantier lance', 'chantier lancé',
    'installation en cours',
    'ligne en cours d installation', 'ligne en cours d’installation'
  ]);

  const miseServiceProche = contient([
    'mise en service imminente',
    'mise en service prochaine',
    'demarrage imminent', 'démarrage imminent',
    'lancement imminent'
  ]);

  const projetValide = contient([
    'budget valide', 'budget validé',
    'investissement valide', 'investissement validé',
    'a investi', 'investit',
    'nouvel atelier', 'nouveau atelier',
    'extension achevee', 'extension achevée',
    'installer une nouvelle ligne', 'installation d une nouvelle ligne',
    'nouvelle ligne de production',
    'nouvelle ligne de conditionnement',
    'mise en service prevue', 'mise en service prévue',
    'operationnel en 2026', 'opérationnel en 2026',
    'lancement produit annonce', 'lancement produit annoncé'
  ]);

  const projetAnnonce = contient([
    'prevoit', 'prévoit',
    'annonce un investissement',
    'investissement annonce', 'investissement annoncé',
    'extension annoncee', 'extension annoncée',
    'agrandissement annonce', 'agrandissement annoncé',
    'agrandir son site',
    'nouveau site prevu', 'nouveau site prévu',
    'nouvelle usine prevue', 'nouvelle usine prévue',
    'construction prevue', 'construction prévue',
    'augmentation de capacite', 'augmentation de capacité',
    'doubler sa capacite', 'doubler sa capacité',
    'plan d investissement', 'plan investissement'
  ]);

  const phaseAmont = gardeFou.phase_amont_forte ||
    gardeFou.consultation_et_appel_offres_nies ||
    contientBrut([
      'aucune consultation', 'aucun appel d offres', 'aucun appel d offre',
      'projet en reflexion', 'projet en réflexion',
      'etude prealable', 'étude préalable',
      'phase amont', 'equipements non encore definis', 'équipements non encore définis'
    ]);

  const probablementTropTard = contient([
    'fournisseur retenu', 'fournisseurs retenus',
    'marche attribue', 'marché attribué',
    'contrat attribue', 'contrat attribué',
    'choix fournisseur realise', 'choix fournisseur réalisé',
    'equipements installes', 'équipements installés',
    'ligne deja operationnelle', 'ligne déjà opérationnelle',
    'deja operationnel', 'déjà opérationnel'
  ]);

  let niveau = 'M0';
  let label = 'À qualifier';
  let plafond_score = 84;
  let type_signal = '';
  let timing = {
    phase: 'a_qualifier',
    score: 50,
    impact_score: 0,
    fenetre: 'À qualifier',
    raison: 'Maturité projet insuffisamment démontrée : qualifier les preuves avant de prioriser fortement.',
    prochaine_action: 'Qualifier le calendrier, les décideurs et les équipements encore ouverts.'
  };

  if (probablementTropTard) {
    niveau = 'M0';
    label = 'Projet probablement déjà attribué ou opérationnel';
    plafond_score = 70;
    type_signal = signalFamilleQualite(signal) ? 'qualite_rappel_conso' : 'investissement';
    timing = {
      phase: 'probablement_trop_tard',
      score: 8,
      impact_score: -18,
      fenetre: 'Déjà trop tard',
      raison: 'Le texte indique un projet probablement déjà attribué, installé ou opérationnel.',
      prochaine_action: 'Vérifier uniquement l’existence d’un besoin complémentaire ou d’une prochaine phase.'
    };
  } else if ((preuveAppelOffre || preuveConsultationEnCours) && !gardeFou.appel_offres_nie && !gardeFou.consultation_niee) {
    niveau = preuveAppelOffre ? 'M5' : 'M4';
    label = preuveAppelOffre ? 'Appel d’offres ou DCE réellement identifié' : 'Consultation fournisseurs réellement lancée';
    plafond_score = preuveAppelOffre ? 95 : 92;
    type_signal = 'appel_offre';
    timing = {
      phase: 'urgence_0_3_mois',
      score: 95,
      impact_score: 18,
      fenetre: '0-3 mois — agir vite',
      raison: label + ' : fenêtre commerciale courte et preuve actuelle.',
      prochaine_action: 'Identifier immédiatement le bon interlocuteur et vérifier si les choix équipements sont encore ouverts.'
    };
  } else if (chantierLance || miseServiceProche) {
    niveau = 'M4';
    label = chantierLance ? 'Chantier ou installation lancé' : 'Mise en service proche';
    plafond_score = 90;
    type_signal = signalFamilleQualite(signal) ? 'qualite_rappel_conso' : (signal.type_signal === 'nouvelle_ligne' ? 'nouvelle_ligne' : 'investissement');
    timing = {
      phase: 'contact_ideal_3_6_mois',
      score: 88,
      impact_score: 14,
      fenetre: '3-6 mois — prise de contact idéale',
      raison: label + ' : action utile, sans preuve de consultation ouverte.',
      prochaine_action: 'Qualifier rapidement les équipements encore ouverts, l’intégrateur et le calendrier de mise en service.'
    };
  } else if (consultationPreparee || gardeFou.consultation_prospective || projetValide) {
    niveau = 'M3';
    label = consultationPreparee || gardeFou.consultation_prospective
      ? 'Consultation ou choix techniques à venir'
      : 'Projet validé ou investissement réalisé';
    plafond_score = consultationPreparee || gardeFou.consultation_prospective ? 90 : 88;
    type_signal = signalFamilleQualite(signal) ? 'qualite_rappel_conso' : (contientBrut(['ligne', 'nouvelle ligne', 'atelier', 'conditionnement']) ? 'nouvelle_ligne' : 'investissement');
    timing = {
      phase: 'contact_ideal_3_6_mois',
      score: 88,
      impact_score: 14,
      fenetre: '3-6 mois — prise de contact idéale',
      raison: label + ' : bon moment pour se positionner, sans considérer la consultation comme déjà lancée.',
      prochaine_action: 'Prendre contact pour qualifier planning, lots ouverts, intégrateur et contraintes qualité.'
    };
  } else if (projetAnnonce) {
    niveau = phaseAmont ? 'M1' : 'M2';
    label = phaseAmont ? 'Projet annoncé mais encore amont' : 'Investissement ou extension annoncé';
    plafond_score = phaseAmont ? 78 : 82;
    type_signal = signalFamilleQualite(signal) ? 'qualite_rappel_conso' : (contientBrut(['ligne', 'conditionnement', 'production']) ? 'nouvelle_ligne' : 'investissement');
    timing = phaseAmont ? {
      phase: 'veille_active_12_24_mois',
      score: 45,
      impact_score: -6,
      fenetre: '12-24 mois — veille active',
      raison: 'Le texte indique une phase amont ou l’absence de consultation/appel d’offres : signal à suivre avant action commerciale forte.',
      prochaine_action: 'Surveiller les prochains jalons publics : consultation, travaux, choix techniques ou mise en service.'
    } : {
      phase: 'amont_6_12_mois',
      score: 72,
      impact_score: 8,
      fenetre: '6-12 mois — se positionner en amont',
      raison: 'Investissement ou projet industriel annoncé : fenêtre favorable pour qualifier le besoin sans surestimer l’urgence.',
      prochaine_action: 'Qualifier le périmètre, le calendrier et les décideurs, puis programmer une relance structurée.'
    };
  } else if (phaseAmont) {
    niveau = 'M1';
    label = 'Phase amont ou absence de consultation';
    plafond_score = 72;
    type_signal = signalFamilleQualite(signal) ? 'qualite_rappel_conso' : (signal.type_signal === 'nouvelle_ligne' ? 'nouvelle_ligne' : 'investissement');
    timing = {
      phase: 'veille_active_12_24_mois',
      score: 45,
      impact_score: -6,
      fenetre: '12-24 mois — veille active',
      raison: 'Phase amont ou absence de consultation : priorité au suivi, pas à l’action commerciale forte.',
      prochaine_action: 'Mettre le projet sous surveillance et rechercher un jalon de maturité.'
    };
  }

  return {
    niveau,
    label,
    plafond_score,
    type_signal,
    timing,
    preuves: {
      preuve_appel_offre: preuveAppelOffre,
      preuve_consultation_en_cours: preuveConsultationEnCours,
      consultation_preparee: consultationPreparee,
      chantier_lance: chantierLance,
      mise_service_proche: miseServiceProche,
      projet_valide: projetValide,
      projet_annonce: projetAnnonce,
      phase_amont: phaseAmont,
      probablement_trop_tard: probablementTropTard
    }
  };
}

function appliquerMaturiteAuTimingFlair(signal = {}, timing = {}, resultat = {}) {
  const maturite = detecterMaturiteProjetFlair(signal, timing, resultat);
  if (maturite.niveau === 'M0' && maturite.label === 'À qualifier') {
    return { ...timing, maturite_projet: maturite };
  }

  return {
    ...timing,
    ...maturite.timing,
    maturite_projet: maturite
  };
}

function appliquerMaturiteAuResultatFlair(resultat = {}, signal = {}, timing = {}) {
  const maturite = detecterMaturiteProjetFlair(signal, timing, resultat);
  const scoreInitial = Math.max(0, Math.min(95, Math.round(Number(resultat.score_pertinence ?? resultat.score ?? 0) || 0)));
  const scoreCorrige = Math.min(scoreInitial, maturite.plafond_score || 84);
  const typeCorrige = maturite.type_signal || resultat.type_signal || signal.type_signal || 'autre';

  const raisonMaturite = maturite.label && maturite.label !== 'À qualifier'
    ? `Maturité projet ${maturite.niveau} : ${maturite.label}.`
    : '';

  return {
    ...resultat,
    score_pertinence: scoreCorrige,
    score_final_distribue: Number.isFinite(Number(resultat.score_final_distribue))
      ? Math.min(Number(resultat.score_final_distribue), scoreCorrige)
      : resultat.score_final_distribue,
    type_signal: typeCorrige,
    chaleur: chaleurDepuisScoreMetier(scoreCorrige),
    maturite_projet: maturite.niveau,
    maturite_projet_label: maturite.label,
    plafond_maturite: maturite.plafond_score,
    raison_score: raisonMaturite ? ajouterPhraseMetier(resultat.raison_score, raisonMaturite) : resultat.raison_score
  };
}


function calculerTimingCommercial(signal = {}, resultat = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  const gardeFouSemantique = detecterGuardrailSemantiqueFlair(signal, {});

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
    'mise en service imminente', 'mise en service prochaine',
    'mise en service prevue dans les prochains mois', 'mise en service prévue dans les prochains mois',
    'demarrage imminent', 'démarrage imminent', 'lancement imminent',
    'demarre sa production', 'démarre sa production', 'demarrage de la production', 'démarrage de la production',
    'lancement de la production', 'lance sa production', 'production demarre', 'production démarré',
    'vient de lancer', 'vient de demarrer', 'vient de démarrer',
    'vient d inaugurer', 'vient d’inaugurer', 'a inaugure', 'a inauguré', 'inauguration',
    'a mis en service', 'vient de mettre en service',
    'nouvelle ligne operationnelle', 'nouvelle ligne opérationnelle',
    'ligne operationnelle', 'ligne opérationnelle',
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

  if (gardeFouSemantique.phase_amont_forte || gardeFouSemantique.consultation_et_appel_offres_nies) {
    phase = 'veille_active_12_24_mois';
    score = 45;
    impact_score = -6;
    fenetre = '12-24 mois — veille active';
    raison = 'Le texte indique une phase amont ou l’absence de consultation/appel d’offres : signal à suivre avant action commerciale forte.';
    prochaine_action = 'Mettre le projet sous surveillance et rechercher un prochain jalon : consultation, travaux, choix techniques ou mise en service.';
  } else if (contient(tropTard)) {
    phase = 'probablement_trop_tard';
    score = 8;
    impact_score = -18;
    fenetre = 'Déjà trop tard';
    raison = 'Le projet semble déjà attribué, inauguré ou opérationnel : action commerciale probablement tardive.';
    prochaine_action = 'Ne pas ouvrir d’action prioritaire ; vérifier uniquement s’il existe un besoin complémentaire ou un nouveau site.';
  } else if (gardeFouSemantique.consultation_prospective) {
    phase = 'contact_ideal_3_6_mois';
    score = 88;
    impact_score = 14;
    fenetre = '3-6 mois — prise de contact idéale';
    raison = 'Le texte évoque une consultation, des choix techniques ou des équipements à venir : bon moment pour se positionner, sans considérer la consultation comme déjà lancée.';
    prochaine_action = 'Prendre contact maintenant pour qualifier le calendrier, les choix techniques et les équipements encore ouverts.';
  } else if (!gardeFouSemantique.interdit_urgence && contientExpression(urgence03)) {
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

  return appliquerMaturiteAuTimingFlair(
    signal,
    { phase, score, impact_score, fenetre, raison, prochaine_action },
    resultat
  );
}

function motCleFlairPresent(texteNormalise = '', motCle = '') {
  const lexique = window.FLAIR_METIER_LEXIQUE || {};
  if (typeof lexique.motClePresentHistoriqueMetier === 'function') {
    return lexique.motClePresentHistoriqueMetier(texteNormalise, motCle, normaliserTexteSimple);
  }

  const mot = normaliserTexteSimple(motCle);
  if (!mot) return false;

  // Fallback de compatibilité si le module lexical n'est pas chargé.
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
    'impression packaging', 'imprimerie packaging', 'impression emballage', 'impression d emballages',
    'impression helio', 'impression hélio', 'heliogravure', 'héliogravure', 'rotogravure', 'impression rotogravure',
    'impression flexo', 'flexographie', 'flexo', 'impression bobine', 'bobine imprimee', 'bobine imprimée',
    'emballage souple', 'packaging souple', 'film imprime', 'film imprimé', 'film complexe', 'complexe souple',
    'complexage', 'contre collage', 'contre-collage', 'lamination', 'pelliculage', 'faconnage', 'façonnage',
    'finition', 'vernis', 'vernis technique', 'encres', 'encres alimentaires', 'encres uv', 'dorure',
    'pre presse', 'pre-presse', 'prépresse', 'cliche flexo', 'cliché flexo', 'cylindre helio', 'cylindre hélio',
    'controle impression', 'contrôle impression', 'controle qualite impression', 'contrôle qualité impression',
    'ligne impression', 'ligne d impression', 'ligne d’impression', 'machine impression', 'machine d impression', 'machine d’impression',
    'defaut impression', 'défaut impression', 'defaut d impression', 'défaut d’impression', 'reperage couleur', 'repérage couleur'
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


function signalMentionneProcessConvoyage(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return [
    'convoyage', 'convoyeur', 'convoyeurs', 'ligne de convoyage', 'tapis convoyeur', 'tapis roulant',
    'bande transporteuse', 'transport interne', 'manutention continue', 'accumulation',
    'table accumulation', 'transfert produit', 'transfert produits', 'guidage produit',
    'flux de transfert', 'flux internes', 'sequencage', 'séquençage'
  ].some(mot => texte.includes(normaliserTexteSimple(mot)));
}

function signalMentionneProcessConditionnement(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return [
    'conditionnement', 'ligne de conditionnement', 'ensachage', 'ensacheuse',
    'remplissage', 'remplisseuse', 'doseuse', 'dosage', 'mise en carton',
    'mise en caisse', 'etuyage', 'étuyage', 'encaisseuse', 'encaissage',
    'formeuse de cartons', 'fermeuse de cartons', 'doypack', 'mise en pot',
    'mise en barquette'
  ].some(mot => texte.includes(normaliserTexteSimple(mot)));
}

function signalMentionneFinLigne(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return [
    'fin de ligne', 'palettisation', 'palettiseur', 'depalettisation', 'dépalettisation',
    'depalettiseur', 'dépalettiseur', 'banderolage', 'banderoleuse',
    'filmage palette', 'filmeuse palette', 'houssage', 'preparation expedition',
    'préparation expédition', 'ilot de fin de ligne', 'îlot de fin de ligne'
  ].some(mot => texte.includes(normaliserTexteSimple(mot)));
}

function signalMentionneRobotisation(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return [
    'robot', 'robots', 'robotisation', 'robotise', 'robotisé', 'robotisee', 'robotisée',
    'cobot', 'cobots', 'bras robotise', 'bras robotisé', 'cellule robotisee',
    'cellule robotisée', 'picking robotise', 'picking robotisé',
    'manutention robotisee', 'manutention robotisée', 'automatisation industrielle',
    'ilot automatise', 'îlot automatisé'
  ].some(mot => texte.includes(normaliserTexteSimple(mot)));
}

function signalMentionnePesageControlePoids(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return [
    'controle poids', 'contrôle poids', 'controle ponderal', 'contrôle pondéral',
    'trieuse ponderale', 'trieuse pondérale', 'tri ponderal', 'tri pondéral',
    'checkweigher', 'poids moyen', 'preemballes', 'préemballés', 'tu1', 'tu2',
    'tne', 'conformite poids', 'conformité poids', 'pesage dynamique',
    'pesage en ligne'
  ].some(mot => texte.includes(normaliserTexteSimple(mot)));
}

function signalMentionnePesageEtiquetage(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return [
    'pesage industriel', 'balance industrielle', 'balances industrielles',
    'plateforme de pesage', 'pesage statique', 'etiquetage', 'étiquetage',
    'impression pose', 'print and apply', 'poids prix', 'poids-prix',
    'prix poids', 'dlc', 'dluo', 'tracabilite', 'traçabilité',
    'metrologie', 'métrologie', 'verification reglementaire', 'vérification réglementaire'
  ].some(mot => texte.includes(normaliserTexteSimple(mot)));
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

// =========================================================================
// FLAIR V2026.1 — COPILOTE COMMERCIAL EXTERNALISÉ
// =========================================================================
// Les fonctions Copilote sont désormais dans flair-copilote.js.
// Ces wrappers conservent l'API historique window.FLAIR_METIER utilisée par app.js.
// =========================================================================

let copiloteMetierApiCache = null;

function getCopiloteMetierApi() {
  if (copiloteMetierApiCache) return copiloteMetierApiCache;

  const factory = window.FLAIR_COPILOTE && window.FLAIR_COPILOTE.createMetierApi;
  if (typeof factory !== 'function') {
    console.warn('FLAIR_COPILOTE.createMetierApi indisponible : fallback Copilote minimal.');
    return null;
  }

  copiloteMetierApiCache = factory({
    normaliserTexteSimple,
    dedoublonnerListeTexte,
    signalRegion,
    signalCompany,
    signalTitle,
    profilCommercialActuel,
    getCopilotePhraseEngine,
    nettoyerTexteQualiteHorsContexte,
    signalSemblePME,
    signalFamilleLogistique,
    signalFamilleQualite,
    signalFamilleProductionProjet,
    signalFamilleExtension,
    signalFamilleProcess,
    signalFamilleCapitalistique,
    signalMentionneImpressionPackaging,
    signalMentionnePesageControlePoids,
    signalMentionnePesageEtiquetage,
    signalMentionneRobotisation,
    signalMentionneFinLigne,
    signalMentionneProcessConditionnement,
    signalMentionneProcessConvoyage
  });

  return copiloteMetierApiCache;
}

function appelCopiloteMetier(nom, args, fallback) {
  const api = getCopiloteMetierApi();
  if (api && typeof api[nom] === 'function') {
    return api[nom](...args);
  }
  return typeof fallback === 'function' ? fallback() : fallback;
}

function interlocuteursPourProfil(profil = '', signal = {}) {
  return appelCopiloteMetier('interlocuteursPourProfil', arguments, '');
}

function questionAnglePourProfil(profil = '', signal = {}) {
  return appelCopiloteMetier('questionAnglePourProfil', arguments, 'Où en est le projet et quels équipements de ligne sont encore à définir ?');
}

function prochaineActionCopilote(signal = {}, timing = {}, interlocuteurs = '') {
  return appelCopiloteMetier('prochaineActionCopilote', arguments, timing.prochaine_action || 'Qualifier le calendrier, les décideurs et le périmètre technique.');
}

function preparerCopiloteCommercial(signal = {}, resultat = {}, timing = {}) {
  return appelCopiloteMetier('preparerCopiloteCommercial', arguments, {
    interlocuteurs_cibles: '',
    angle_conseille: '',
    message_linkedin: '',
    email_prepare: '',
    plan_appel: '',
    prochaine_action: timing?.prochaine_action || '',
    pourquoi_maintenant: timing?.fenetre || 'Timing à qualifier'
  });
}

function normaliserListeCopilote(value) {
  return appelCopiloteMetier('normaliserListeCopilote', arguments, []);
}

function dedoublonnerListeCopilote(items = []) {
  return appelCopiloteMetier('dedoublonnerListeCopilote', arguments, dedoublonnerListeTexte(items));
}

function estPersonaCopilote(value = '') {
  return appelCopiloteMetier('estPersonaCopilote', arguments, false);
}

function parserContactCopilote(item = '') {
  return appelCopiloteMetier('parserContactCopilote', arguments, { role: '', themes: [] });
}

function extraireContactsEtThemesCopilote(value) {
  return appelCopiloteMetier('extraireContactsEtThemesCopilote', arguments, { contacts: [], themes: [] });
}

function renderListeContactsCopilote(contacts = []) {
  return appelCopiloteMetier('renderListeContactsCopilote', arguments, '<small>À qualifier.</small>');
}

function renderTexteOuPucesCopilote(value = '') {
  return appelCopiloteMetier('renderTexteOuPucesCopilote', arguments, '');
}

function construirePourquoiCopilote(signal = {}, resultat = {}, timing = {}, secteur = {}, themes = []) {
  return appelCopiloteMetier('construirePourquoiCopilote', arguments, ['Signal industriel à qualifier.']);
}

function construireCopiloteCommercialJson(signal = {}, resultat = {}, timing = {}, secteur = {}, copilote = {}) {
  return appelCopiloteMetier('construireCopiloteCommercialJson', arguments, {
    pourquoi: ['Signal industriel à qualifier.'],
    qui_contacter: [],
    vigilance: '',
    timing: timing?.fenetre || 'Timing à qualifier',
    angle: '',
    prochaine_action: ''
  });
}

function determinerVigilanceCopilote(signal = {}, resultat = {}, timing = {}, secteur = {}) {
  return appelCopiloteMetier('determinerVigilanceCopilote', arguments, 'Vérifier le calendrier réel, le périmètre technique et le bon interlocuteur avant contact.');
}

function lireCopiloteCommercialJson(signal = {}) {
  return appelCopiloteMetier('lireCopiloteCommercialJson', arguments, null);
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
  const texteSourceValidator = texteCompletSignalFlair(signal);
  if (window.FLAIR_SIGNAL_VALIDATOR?.validerSignal) {
    signal = window.FLAIR_SIGNAL_VALIDATOR.validerSignal(signal, texteSourceValidator, { mode: 'distribution' }).signal || signal;
  }

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

  const scoreBase = Math.max(0, Math.min(95, Math.round(Number(resultat.score_pertinence) || 0)));

  const enrichissementMetier = window.FLAIR_SOURCE_VEILLE?.analyserSignalAvecRegles
    ? window.FLAIR_SOURCE_VEILLE.analyserSignalAvecRegles(signalContexte)
    : null;

  // FLAIR V2026.1 — pipeline unique IA / manuel
  // La distribution commerciale utilise le même moteur de séparation, timing
  // et crédibilité que l'import manuel. Aucun ancien bonus d'affinité ne doit
  // pouvoir réaugmenter un score après la règle de crédibilité.
  const separation = calculerScoresSeparationFlair({
    score_industriel: scoreBase,
    signal: signalContexte,
    enrichissement: enrichissementMetier,
    timing,
    commercial: profilProvider() || {},
    profil_commercial: profilCommercialActuel()
  });

  const scoreIntrinseque = separation.score_industriel;
  const affinity = separation;
  const scoreDistribution = separation.score;
  const phraseGeographiqueDistribution = construirePhraseGeographique(separation.geo);

  const familleStrategique = familleStrategiqueProjet(signalContexte);
  const resultatTexteContextualise = appliquerMaturiteAuResultatFlair(
    contextualiserResultatSelonFamille(resultat, signalContexte),
    signalContexte,
    timing
  );

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

const resultatAvantMaturite = {
  score_pertinence: score,
  chaleur,
  type_signal,
  raison_score,
  angle_commercial,
  action_recommandee
};

const resultatMaturite = appliquerMaturiteAuResultatFlair(
  resultatAvantMaturite,
  { titre, entreprise_nom: entreprise },
  {}
);

return normaliserResultatScoring(resultatMaturite);
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
  pesage_industriel: "pesage industriel",
  pesage_dynamique: "pesage dynamique",
  pesage_statique: "pesage statique",
  controle_poids: "contrôle poids",
  controle_ponderal: "contrôle pondéral",
  tri_ponderal: "tri pondéral",
  checkweigher: "checkweigher",
  poids_moyen: "poids moyen",
  preemballes: "préemballés",
  tu1_tu2: "TU1/TU2",
  tne: "TNE",
  etiquetage: "étiquetage",
  impression_pose: "impression-pose",
  poids_prix: "poids/prix",
  tracabilite_poids: "traçabilité poids",
  metrologie: "métrologie",
  verification_reglementaire: "vérification réglementaire",
  dosage: "dosage",

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
  impression: "impression",
  heliogravure: "héliogravure",
  rotogravure: "rotogravure",
  flexographie: "flexographie",
  pre_presse: "prépresse",
  cliche_flexo: "cliché flexo",
  cylindre_helio: "cylindre hélio",
  contre_collage: "contre-collage",
  lamination: "lamination",
  pelliculage: "pelliculage",
  dorure: "dorure",
  marquage: "marquage",
  barquette: "barquette",
  emballage_souple: "emballage souple",
  film_complexe: "film complexe",

  presence_absence: "présence/absence",
  controle_etiquette: "contrôle étiquette",
  ocr: "OCR",
  lecture_code: "lecture code",
  controle_aspect: "contrôle aspect",

  convoyage: "convoyage",
  convoyeur: "convoyeur",
  ligne_convoyage: "ligne de convoyage",
  transport_interne: "transport interne",
  manutention: "manutention",
  guidage_produit: "guidage produit",
  accumulation: "accumulation",
  transfert_produit: "transfert produit",
  conditionnement: "conditionnement",
  ensachage: "ensachage",
  remplissage: "remplissage",
  dosage: "dosage",
  mise_en_carton: "mise en carton",
  mise_en_caisse: "mise en caisse",
  etuyage: "étuyage",
  automatisme: "automatisme",
  automatisation: "automatisation",
  encaissage: "encaissage",
  fin_de_ligne: "fin de ligne",
  palettisation: "palettisation",
  depalettisation: "dépalettisation",
  banderolage: "banderolage",
  filmage_palette: "filmage palette",
  houssage: "houssage",
  robotique: "robotique",
  robotisation: "robotisation",
  cobot: "cobot",
  cellule_robotisee: "cellule robotisée",
  picking_robotise: "picking robotisé",
  industrialisation: "industrialisation",
  travaux_neufs: "travaux neufs",
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
      return "Qualifier les besoins packaging : films, carton, étiquettes, impression hélio/flexo, complexage, prépresse, vernis, encres, contrôle impression ou conditionnement secondaire.";
    }
    if (compatibilite > 0) {
      return "Vérifier les besoins packaging associés : carton, étuis, étiquettes, impression, hélio/flexo, complexage, marquage, finition, contrôle impression ou traçabilité.";
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

  // FLAIR V2026.1 — application de la doctrine dès le score stocké.
  // Les imports manuels et signaux sources doivent respecter les mêmes garde-fous
  // que la distribution personnalisée : pas de 95 sans preuve forte et actuelle.
  const timingDoctrine = calculerTimingCommercial(signal, {
    ...resultatInitial,
    score_pertinence: scoreFinal
  });
  const prioriteTimingDoctrine = ajusterScoreSelonPrioriteTimingFlair(
    scoreFinal,
    timingDoctrine,
    95
  );

  // FLAIR V2026.1 — AUTORITÉ FINALE DU SCORE
  // Le score stocké pour les imports manuels et le bouton IA doit respecter
  // la même doctrine que le cockpit distribué : le dernier mot revient à la
  // crédibilité, pas aux bonus de timing ou de compatibilité métier.
  const credibiliteDoctrine = appliquerRegleCredibiliteFlair(signal, {
    score: prioriteTimingDoctrine.score,
    score_final_distribue: prioriteTimingDoctrine.score,
    timing: timingDoctrine
  });
  scoreFinal = credibiliteDoctrine.score;

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

    type_signal: window.FLAIR_SIGNAL_VALIDATOR?.validerSignal
      ? (window.FLAIR_SIGNAL_VALIDATOR.validerSignal({ ...signal, type_signal: (enrichissement.type_signal || resultatInitial.type_signal) }, texteCompletSignalFlair(signal), { mode: 'source_veille_type' }).signal?.type_signal || enrichissement.type_signal || resultatInitial.type_signal)
      : (enrichissement.type_signal || resultatInitial.type_signal),

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
    detecterPreuvesCredibiliteFlair,
    plafondCredibiliteDepuisPreuvesFlair,
    appliquerRegleCredibiliteFlair,
    detecterMaturiteProjetFlair,
    appliquerMaturiteAuTimingFlair,
    appliquerMaturiteAuResultatFlair,
    detecterGuardrailSemantiqueFlair,
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
