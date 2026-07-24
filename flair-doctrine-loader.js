(function () {
  'use strict';

  const DOCTRINE_URL = './FLAIR-DOCTRINE.json';
  const VERSION_REQUISE = 'V2026.2';
  const BLOCS_REQUIS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  function texte(value) {
    return String(value ?? '').trim();
  }

  function normaliser(value) {
    return texte(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function lireChemin(obj, chemin) {
    return chemin.split('.').reduce((acc, key) => acc && acc[key], obj);
  }

  function extrairePipeline(doctrine = {}) {
    const candidats = [
      lireChemin(doctrine, 'blocs.D.ordre'),
      lireChemin(doctrine, 'bloc_D.pipeline_ordre_obligatoire'),
      lireChemin(doctrine, 'bloc_D.ordre'),
      lireChemin(doctrine, 'pipeline.ordre'),
      lireChemin(doctrine, 'pipeline_ordre_obligatoire')
    ];
    return candidats.find(Array.isArray) || [];
  }

  function pipelineComplet(pipeline = []) {
    if (!Array.isArray(pipeline) || pipeline.length !== 12) return false;
    const numeros = pipeline.map((etape, index) => {
      const valeur = typeof etape === 'string'
        ? etape
        : (etape?.id || etape?.code || etape?.etape || etape?.nom || '');
      const match = texte(valeur).match(/\bD\s*([1-9]|1[0-2])\b/i);
      return match ? Number(match[1]) : index + 1;
    });
    return numeros.every((numero, index) => numero === index + 1);
  }

  function validerStructure(doctrine) {
    const erreurs = [];
    if (!doctrine || typeof doctrine !== 'object') erreurs.push('Document JSON vide ou invalide.');

    const version = lireChemin(doctrine, 'meta.version');
    const statut = lireChemin(doctrine, 'meta.statut');
    const blocs = lireChemin(doctrine, 'validation.blocs_valides');
    const validationComplete = lireChemin(doctrine, 'validation.validation_complete');
    const pipeline = extrairePipeline(doctrine);

    if (version !== VERSION_REQUISE) erreurs.push(`Version attendue ${VERSION_REQUISE}, version reçue ${version || 'absente'}.`);
    if (statut !== 'OFFICIELLE') erreurs.push('Le statut de la doctrine doit être OFFICIELLE.');
    if (validationComplete !== true) erreurs.push('La validation complète de la doctrine n’est pas confirmée.');
    if (!Array.isArray(blocs) || BLOCS_REQUIS.some(bloc => !blocs.includes(bloc))) {
      erreurs.push('Les blocs A à I ne sont pas tous déclarés comme validés.');
    }
    if (!pipelineComplet(pipeline)) {
      erreurs.push('Le pipeline doctrinal D1 à D12 est absent ou incomplet.');
    }

    return { valide: erreurs.length === 0, erreurs, pipeline };
  }

  function extraireDates(signal = {}, source = '') {
    const valeurs = [
      signal.date_signal,
      signal.date_publication,
      signal.published_at,
      signal.created_at,
      signal.updated_at
    ].filter(Boolean);

    const motifs = texte(source).match(/\b(?:20\d{2})[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b|\b(?:0?[1-9]|[12]\d|3[01])[/.](?:0?[1-9]|1[0-2])[/.](?:20\d{2})\b/g) || [];
    return [...valeurs, ...motifs]
      .map(value => {
        const brut = texte(value);
        let date = new Date(brut);
        if (Number.isNaN(date.getTime())) {
          const m = brut.match(/^(\d{1,2})[/.](\d{1,2})[/.](20\d{2})$/);
          if (m) date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        }
        return Number.isNaN(date.getTime()) ? null : date;
      })
      .filter(Boolean);
  }

  function evaluerFraicheur(signal = {}, source = '') {
    const corpus = normaliser([
      signal.titre,
      signal.resume,
      signal.resume_brut,
      signal.description,
      signal.texte_original,
      signal.raison_score,
      signal.action_recommandee,
      signal.angle_commercial,
      signal.timing_commercial,
      signal.projet_label,
      signal.type_signal,
      source
    ].filter(Boolean).join(' '));

    const fermeture = [
      'projet acheve', 'travaux acheves', 'mise en service en 2024', 'mise en service en 2025',
      'inaugure en 2024', 'inaugure en 2025', 'a ete inaugure', 'est desormais operationnel',
      'chantier termine', 'projet termine', 'ligne deja en service'
    ].some(indice => corpus.includes(indice));

    const ouverture = [
      'en cours', 'sera mise en service', 'mise en service prevue', 'travaux prevus',
      'construction', 'extension', 'nouvelle ligne', 'deuxieme tranche', 'appel d offres',
      'consultation', 'recherche de fournisseurs', 'recrutement', 'programme pluriannuel',
      'nouveau site', 'nouvelle usine', 'modernisation', 'investit', 'investissement',
      'augmentation de capacite', 'montee en capacite', 'livraison prevue', 'livraison attendue',
      'd ici 2026', 'd ici 2027', 'd ici 2028', 'en 2026', 'en 2027', 'en 2028', 'a venir', 'prochainement'
    ].some(indice => corpus.includes(indice));

    const dates = extraireDates(signal, source);
    const maintenant = new Date();
    const datePlusRecente = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    const ageJours = datePlusRecente ? Math.floor((maintenant - datePlusRecente) / 86400000) : null;

    let statut = 'fenetre_non_demontrée';
    let conforme = false;
    let raison = 'Aucune preuve suffisante ne démontre une fenêtre commerciale encore ouverte.';

    if (fermeture && !ouverture) {
      statut = 'fenetre_fermee';
      raison = 'Le texte contient des indices indiquant que le projet est terminé ou déjà mis en service sans nouvelle phase démontrée.';
    } else if (ouverture && datePlusRecente && ageJours <= 550) {
      statut = 'fenetre_ouverte';
      conforme = true;
      raison = 'Le signal associe une preuve d’activité future ou en cours à une date suffisamment récente.';
    } else if (ouverture) {
      statut = 'fenetre_ouverte_sous_reserve';
      conforme = true;
      raison = 'Le texte contient une preuve d’activité future ou en cours, mais la datation doit être surveillée.';
    } else if (datePlusRecente && ageJours <= 120) {
      statut = 'fenetre_ouverte_sous_reserve';
      conforme = true;
      raison = 'La publication est récente, mais la fenêtre commerciale doit être confirmée par une preuve projet complémentaire.';
    }

    return {
      statut,
      conforme,
      raison,
      date_verification: maintenant.toISOString(),
      date_reference: datePlusRecente ? datePlusRecente.toISOString() : null,
      age_jours: ageJours
    };
  }

  function verifierAvantScoring(signal = {}, source = '') {
    const nonConformites = [];
    const entreprise = texte(signal.entreprise_nom || signal.entreprise);
    const titre = texte(signal.titre);
    const sourceTexte = texte(source || signal.resume_brut || signal.description || signal.texte_original);
    const fraicheur = evaluerFraicheur(signal, sourceTexte);

    if (!entreprise) nonConformites.push({ code: 'ENTREPRISE_ABSENTE', criticite: 'majeure', message: 'Entreprise ou site industriel non identifié.' });
    if (!titre) nonConformites.push({ code: 'TITRE_ABSENT', criticite: 'majeure', message: 'Projet ou signal non identifié.' });
    if (!sourceTexte && !signal.source_url && !signal.url_source && !signal.lien_source) nonConformites.push({ code: 'PREUVE_ABSENTE', criticite: 'majeure', message: 'Aucune preuve ou source exploitable n’est disponible.' });
    if (!fraicheur.conforme) nonConformites.push({ code: 'FRAICHEUR_NON_CONFORME', criticite: 'critique', message: fraicheur.raison });

    return {
      conforme: nonConformites.length === 0,
      fraicheur,
      non_conformites: nonConformites,
      doctrine_version: VERSION_REQUISE
    };
  }

  function certifierSignal(signal = {}, source = '', options = {}) {
    const controle = verifierAvantScoring(signal, source);
    const maintenant = new Date().toISOString();
    const certification = {
      doctrine_version: VERSION_REQUISE,
      doctrine_conformite: controle.conforme ? 'conforme' : 'non_conforme',
      doctrine_certification_statut: controle.conforme ? 'certifie' : 'refuse',
      doctrine_date_certification: maintenant,
      doctrine_non_conformites: controle.non_conformites,
      fraicheur_statut: controle.fraicheur.statut,
      fraicheur_date_verification: controle.fraicheur.date_verification,
      fraicheur_raison: controle.fraicheur.raison,
      origine_controle: options.origine || 'application'
    };

    return {
      conforme: controle.conforme,
      signal: { ...signal, ...certification },
      certification
    };
  }

  function messageBlocage(resultat) {
    const details = (resultat?.non_conformites || resultat?.certification?.doctrine_non_conformites || [])
      .map(item => `• ${item.message}`)
      .join('\n');
    return `Signal non conforme à la Doctrine ${VERSION_REQUISE}.\n${details || 'Contrôle doctrinal incomplet.'}`;
  }

  async function chargerDoctrine() {
    const response = await fetch(DOCTRINE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Doctrine introuvable (${response.status}).`);
    const doctrine = await response.json();
    const controle = validerStructure(doctrine);
    if (!controle.valide) throw new Error(controle.erreurs.join(' '));

    window.FLAIR_DOCTRINE = Object.freeze(doctrine);
    window.FLAIR_DOCTRINE_STATUS = Object.freeze({
      chargee: true,
      valide: true,
      version: VERSION_REQUISE,
      date_chargement: new Date().toISOString()
    });
    document.documentElement.dataset.flairDoctrine = VERSION_REQUISE;
    return doctrine;
  }

  window.FLAIR_DOCTRINE_API = Object.freeze({
    VERSION_REQUISE,
    validerStructure,
    extrairePipeline,
    evaluerFraicheur,
    verifierAvantScoring,
    certifierSignal,
    messageBlocage
  });

  window.FLAIR_DOCTRINE_READY = chargerDoctrine().catch(error => {
    console.error('FLAIR — Doctrine non chargée :', error);
    window.FLAIR_DOCTRINE = null;
    window.FLAIR_DOCTRINE_STATUS = Object.freeze({
      chargee: false,
      valide: false,
      version: null,
      erreur: error?.message || String(error)
    });
    throw error;
  });
})();
