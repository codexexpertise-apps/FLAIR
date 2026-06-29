// =========================================================================
// FLAIR — SIGNAL VALIDATOR V2026.1
// =========================================================================
// Rôle : contrôler un objet signal normalisé avant qualification/scoring.
// Ce module ne score pas, ne priorise pas et ne remplace pas les moteurs métier.
// Il corrige uniquement les incohérences factuelles détectables :
// - négation commerciale ("aucun appel d'offres" ≠ type appel d'offre) ;
// - géographie explicite prioritaire (département nommé > région > inconnu) ;
// - codes numériques acceptés uniquement avec contexte géographique.
// =========================================================================

(function () {
  "use strict";

  function getGeoApi() {
    return window.FLAIR_GEO || {};
  }

  function getExtractionApi() {
    return window.FLAIR_EXTRACTION || {};
  }

  function normaliserTexte(value) {
    const fn = getGeoApi().normaliserTexteSimple;
    if (typeof fn === 'function') return fn(value);
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .replace(/[_\-–—]+/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function texteSignal(signal = {}, texteBrut = '') {
    return [
      texteBrut,
      signal.texte_original,
      signal.resume_brut,
      signal.description,
      signal.contenu,
      signal.titre,
      signal.entreprise_nom,
      signal.type_signal,
      signal.raison_score,
      signal.angle_commercial,
      signal.action_recommandee,
      signal.region_nom,
      signal.departement_nom
    ].filter(Boolean).join(' ');
  }

  function decouperPhrases(texte = '') {
    return String(texte || '')
      .split(/(?<=[.!?;。])\s+|\n+/)
      .map(p => normaliserTexte(p))
      .filter(Boolean);
  }

  function phraseContient(phrase = '', indices = []) {
    return (indices || []).some(indice => phrase.includes(normaliserTexte(indice)));
  }

  function phraseNegation(phrase = '') {
    return phraseContient(phrase, [
      'aucun', 'aucune', 'pas de', 'pas d ', 'sans', 'non annonce', 'non annoncé',
      'non lance', 'non lancé', 'pas encore', 'n est pas encore', 'n est pas',
      'ne sont pas', 'ne sera pas', 'n est mentionne', 'n est mentionné'
    ]);
  }

  function detecterNegationsCommerciales(texteBrut = '') {
    const phrases = decouperPhrases(texteBrut);
    const cibleAppelOffres = ['appel d offres', 'appel d offre', 'dce', 'marche public', 'marché public'];
    const cibleConsultation = [
      'consultation', 'consultations', 'fournisseur', 'fournisseurs',
      'demande de prix', 'demande de devis', 'selection fournisseurs', 'sélection fournisseurs'
    ];
    const cibleChantier = ['chantier', 'travaux', 'installation', 'mise en service', 'demarrage', 'démarrage'];

    return {
      appel_offres_nie: phrases.some(p => phraseNegation(p) && phraseContient(p, cibleAppelOffres)),
      consultation_niee: phrases.some(p => phraseNegation(p) && phraseContient(p, cibleConsultation)),
      chantier_nie: phrases.some(p => phraseNegation(p) && phraseContient(p, cibleChantier))
    };
  }

  function detecterPreuvesPositives(texteBrut = '') {
    const texte = normaliserTexte(texteBrut);
    const contient = (items) => items.some(item => texte.includes(normaliserTexte(item)));

    return {
      appel_offres_actuel: contient([
        'appel d offres en cours', 'appel d offre en cours', 'appel d offres publie',
        'appel d offre publié', 'dce publie', 'dce publié', 'marche public publie', 'marché public publié'
      ]),
      consultation_actuelle: contient([
        'consultation en cours', 'consultations en cours', 'consultation fournisseurs lancee',
        'consultation fournisseurs lancée', 'demande de prix en cours', 'demande de devis en cours'
      ]),
      nouvelle_ligne: contient([
        'nouvelle ligne', 'nouvelles lignes', 'ligne de fabrication', 'ligne de production',
        'ligne de conditionnement', 'ligne industrielle', 'deux nouvelles lignes', 'trois nouvelles lignes'
      ]),
      investissement: contient([
        'investit', 'investissement', 'extension', 'agrandissement', 'modernisation',
        'montee en capacite', 'montée en capacité', 'capacite de production', 'capacités de production'
      ]),
      qualite: contient([
        'rappel produit', 'rappel de lot', 'contamination', 'corps etranger',
        'corps étranger', 'incident qualite', 'incident qualité'
      ]),
      recrutement: contient(['recrute', 'recrutement', 'embauche'])
    };
  }


  function normaliserOrigineSignal(value = '', texteBrut = '') {
    const source = normaliserTexte(value);
    const texte = normaliserTexte(texteBrut);

    if (source.includes('terrain') || source.includes('salon') || source.includes('client') || source.includes('fournisseur')) {
      return 'terrain';
    }

    if ([
      'suite visite', 'visite client', 'rdv client', 'rendez vous client', 'rendez-vous client',
      'lors de ma visite', 'rencontre salon', 'salon professionnel', 'information terrain',
      'contact rencontre', 'contact rencontré', 'echange avec', 'échange avec'
    ].some(item => texte.includes(normaliserTexte(item)))) {
      return 'terrain';
    }

    if (source.includes('web') || source.includes('ia') || source.includes('presse') || source.includes('rss')) {
      return 'web_ia';
    }

    return value || '';
  }

  function enrichirConfianceSource(signal = {}, texteBrut = '') {
    const origine = normaliserOrigineSignal(signal.origine_signal || signal.type_source || '', texteBrut);
    if (!origine) return signal;

    const confiance = origine === 'terrain'
      ? 'elevee_terrain_direct'
      : 'standard_web_ia';

    return {
      ...signal,
      origine_signal: origine,
      source_confiance: signal.source_confiance || confiance
    };
  }

  function normaliserType(value = '') {
    const texte = normaliserTexte(value);
    if (!texte) return '';
    if (texte.includes('appel') || texte.includes('consultation') || texte.includes('devis')) return 'appel_offre';
    if (texte.includes('rappel') || texte.includes('contamination') || texte.includes('qualite')) return 'qualite_rappel_conso';
    if (texte.includes('ligne')) return 'nouvelle_ligne';
    if (texte.includes('investissement') || texte.includes('extension') || texte.includes('agrandissement') || texte.includes('modernisation') || texte.includes('usine')) return 'investissement';
    if (texte.includes('recrutement')) return 'recrutement';
    return value || '';
  }

  function choisirTypePrudent(typeCourant = '', texteBrut = '') {
    const type = normaliserType(typeCourant) || 'autre';
    const neg = detecterNegationsCommerciales(texteBrut);
    const preuves = detecterPreuvesPositives(texteBrut);

    const appelOuConsultationNieSansPreuveActuelle =
      (neg.appel_offres_nie || neg.consultation_niee) &&
      !preuves.appel_offres_actuel &&
      !preuves.consultation_actuelle;

    if (type === 'appel_offre' && appelOuConsultationNieSansPreuveActuelle) {
      if (preuves.nouvelle_ligne) return 'nouvelle_ligne';
      if (preuves.investissement) return 'investissement';
      if (preuves.qualite) return 'qualite_rappel_conso';
      if (preuves.recrutement) return 'recrutement';
      return 'autre';
    }

    // Un texte qui ne contient qu'une consultation prospective ne doit pas devenir
    // un appel d'offre. Le moteur timing pourra le classer 3-6 mois si pertinent.
    if (type === 'appel_offre' && !preuves.appel_offres_actuel && !preuves.consultation_actuelle) {
      const texte = normaliserTexte(texteBrut);
      const prospectif = [
        'susceptible d intervenir', 'susceptibles d intervenir', 'pourrait intervenir',
        'pourraient intervenir', 'devrait intervenir', 'devraient intervenir',
        'a venir', 'à venir', 'dans les prochains mois', 'prochains mois'
      ].some(item => texte.includes(normaliserTexte(item)));

      if (prospectif) {
        if (preuves.nouvelle_ligne) return 'nouvelle_ligne';
        if (preuves.investissement) return 'investissement';
      }
    }

    return type;
  }

  function corrigerGeographie(signal = {}, texteBrut = '') {
    const extraction = getExtractionApi();
    if (typeof extraction.extraireGeographieDepuisTexte !== 'function') return signal;

    const geo = extraction.extraireGeographieDepuisTexte(texteBrut || texteSignal(signal));
    if (!geo?.valide) return signal;

    // Une géographie explicitement extraite du texte source est prioritaire.
    // Aucun département ne doit être choisi par défaut à partir d'une région seule.
    return {
      ...signal,
      region: geo.region_nom || signal.region,
      region_nom: geo.region_nom || signal.region_nom,
      region_signal: geo.region_nom || signal.region_signal,
      departement_nom: geo.departement_nom || signal.departement_nom || '',
      departement_code: geo.departement_code || signal.departement_code || ''
    };
  }

  function validerSignal(signal = {}, texteBrut = '', options = {}) {
    const texteSource = texteBrut || signal.texte_original || signal.resume_brut || signal.description || signal.contenu || '';
    const texte = texteSignal(signal, texteSource);
    let corrige = { ...signal };

    corrige = enrichirConfianceSource(corrige, texteSource || texte);
    corrige = corrigerGeographie(corrige, texteSource || texte);

    const typeAvant = corrige.type_signal || '';
    const typeApres = choisirTypePrudent(typeAvant, texteSource || texte);
    if (typeApres && typeApres !== typeAvant) {
      corrige.type_signal = typeApres;
      corrige.type_signal_corrige_validator = true;
    }

    return {
      signal: corrige,
      diagnostics: {
        negations: detecterNegationsCommerciales(texteSource || texte),
        type_avant: typeAvant,
        type_apres: corrige.type_signal || '',
        mode: options.mode || ''
      }
    };
  }

  window.FLAIR_SIGNAL_VALIDATOR = {
    validerSignal,
    detecterNegationsCommerciales,
    detecterPreuvesPositives,
    choisirTypePrudent,
    normaliserOrigineSignal,
    enrichirConfianceSource
  };
})();
