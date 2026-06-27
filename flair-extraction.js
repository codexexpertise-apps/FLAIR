// =========================================================================
// FLAIR — MOTEUR D'EXTRACTION / TEXTE BRUT V2026.1
// =========================================================================
// Rôle : transformer un texte collé par un commercial en signaux structurés
// exploitables par app.js et flair-metier.js, sans faire le scoring final.
//
// Ce module reste volontairement déterministe :
// - il sécurise l'entreprise, la géographie, le type de signal et la maturité ;
// - il distingue les preuves positives des formulations prospectives ;
// - il évite qu'un texte libre surclasse artificiellement un signal.
// =========================================================================

(function () {
  "use strict";

  function getGeoApi() {
    return window.FLAIR_GEO || {};
  }

  function normaliserTexte(value) {
    const fn = getGeoApi().normaliserTexteSimple;
    if (typeof fn === 'function') return fn(value);
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\-–—]+/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function nettoyerValeur(value) {
    const fn = getGeoApi().nettoyerValeurImport;
    if (typeof fn === 'function') return fn(value);
    return String(value || '').replace(/^[-•\s]+/, '').replace(/\s+/g, ' ').trim();
  }

  function extraireChampStructureLocal(texte, libelles) {
    const fn = getGeoApi().extraireChampStructure;
    if (typeof fn === 'function') return fn(texte, libelles);

    const lignes = String(texte || '').split(/\r?\n/);
    const labels = (libelles || []).map(normaliserTexte);
    for (const ligne of lignes) {
      const index = ligne.search(/[:：]/);
      if (index === -1) continue;
      const label = normaliserTexte(ligne.slice(0, index));
      if (labels.some(l => label === l || label.startsWith(l))) {
        return nettoyerValeur(ligne.slice(index + 1));
      }
    }
    return '';
  }

  function normaliserGeographie(value) {
    const fn = getGeoApi().normaliserGeographieImport;
    if (typeof fn === 'function') return fn(value);
    return { region_nom: value || 'Non déterminée', departement_nom: '', departement_code: '', valide: Boolean(value) };
  }

  const GEO_COMPLEMENTS = [
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Saône-et-Loire', departement_code: '71', alias: ['saone et loire', 'saone-et-loire', 'saone loire', 'fragnes la loyere', 'fragnes-la-loyere', 'fragnes la loyère', 'fragnes-la-loyère'] },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Côte-d\'Or', departement_code: '21', alias: ['cote d or', 'cote-d-or', 'côte d or', 'côte-d-or', 'dijon'] },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Doubs', departement_code: '25', alias: ['doubs', 'besancon', 'besançon', 'montbeliard', 'montbéliard'] },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Jura', departement_code: '39', alias: ['jura', 'lons le saunier', 'lons-le-saunier'] },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Nièvre', departement_code: '58', alias: ['nievre', 'nièvre', 'nevers'] },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Haute-Saône', departement_code: '70', alias: ['haute saone', 'haute-saone', 'haute saône', 'haute-saône', 'vesoul'] },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Yonne', departement_code: '89', alias: ['yonne', 'auxerre', 'sens'] },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Territoire de Belfort', departement_code: '90', alias: ['territoire de belfort', 'belfort'] },
    { region_nom: 'Pays de la Loire', departement_nom: 'Mayenne', departement_code: '53', alias: ['mayenne', 'vaiges', 'laval'] }
  ];

  function extraireGeographieDepuisTexte(texteBrut = '') {
    const texte = String(texteBrut || '');
    const structuree = extraireChampStructureLocal(texte, ['Département', 'Departement', 'Région', 'Region', 'Localisation', 'Lieu', 'Site']);
    const geoStructuree = normaliserGeographie(structuree);
    if (geoStructuree?.valide) return geoStructuree;

    const geoApi = getGeoApi();
    const regionImportee = typeof geoApi.extraireRegionImportDepuisTexte === 'function'
      ? geoApi.extraireRegionImportDepuisTexte(texte)
      : '';
    const geoStandard = normaliserGeographie(regionImportee);
    if (geoStandard?.valide) return geoStandard;

    const normalise = normaliserTexte(texte);
    const complement = GEO_COMPLEMENTS.find(item =>
      item.alias.some(alias => normalise.includes(normaliserTexte(alias))) ||
      normalise.includes(normaliserTexte(item.departement_nom)) ||
      normalise.includes(` ${item.departement_code} `)
    );

    if (complement) {
      return {
        region_nom: complement.region_nom,
        departement_nom: complement.departement_nom,
        departement_code: complement.departement_code,
        valide: true,
        source_extraction: 'flair_extraction_geo'
      };
    }

    return { region_nom: 'Non déterminée', departement_nom: '', departement_code: '', valide: false };
  }

  function nettoyerNomEntreprise(nomBrut = '') {
    let nom = nettoyerValeur(nomBrut)
      .replace(/\s+/g, ' ')
      .replace(/^[\s:：,;\-–—]+|[\s:：,;\-–—]+$/g, '')
      .trim();

    if (!nom) return '';

    const stopPatterns = [
      /\s+(?:situ[eé]e?|bas[eé]e?|implant[eé]e?)\s+(?:à|a|en|dans|sur)\b.*$/i,
      /\s+(?:annonce|poursuit|confirme|investit|lance|pr[eé]voit|construit|agrandit|modernise|recrute|cr[eé]e|ouvre|inaugure|d[eé]ploie|installe|renforce|rappelle|retire)\b.*$/i,
      /\s+(?:va|souhaite|compte|projette)\s+.*$/i,
      /\s+(?:avec|afin|pour|dans le cadre|sur son site|sur le site)\b.*$/i,
      /\s*[:：;,.\(\)\[\]{}].*$/i,
      /\s+[–—-]\s+.*$/i
    ];

    for (const pattern of stopPatterns) nom = nom.replace(pattern, '').trim();

    nom = nom
      .replace(/^(?:le|la|les|l['’])\s+/i, '')
      .replace(/^(?:groupe|soci[eé]t[eé]|entreprise)\s+/i, '')
      .trim();

    const motsExclus = new Set([
      'investissement', 'nouvelle ligne', 'signal', 'article', 'projet', 'extension',
      'modernisation', 'montant', 'millions', 'capacites', 'capacités'
    ]);
    const cle = normaliserTexte(nom);
    if (!nom || nom.length < 3 || motsExclus.has(cle)) return '';
    if (/^\d/.test(nom)) return '';

    return nom;
  }

  function extraireEntrepriseDepuisTexte(texteBrut = '') {
    const texte = String(texteBrut || '').replace(/\s+/g, ' ').trim();
    if (!texte) return '';

    const structuree = extraireChampStructureLocal(texte, ['Entreprise', 'Société', 'Societe', 'Groupe']);
    const nomStructure = nettoyerNomEntreprise(structuree);
    if (nomStructure) return nomStructure;

    // Si le texte parle explicitement de l'usine d'une société cible, on privilégie
    // l'industriel concerné plutôt que l'investisseur ou le groupe en début de phrase.
    const usineCible = texte.match(/\busine\s+([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’.\-]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’.\-]+){0,5})\s+(?:situ[eé]e?|bas[eé]e?|implant[eé]e?)\b/i);
    const nomUsine = nettoyerNomEntreprise(usineCible?.[1]);
    if (nomUsine) return nomUsine;

    // Cas le plus fiable dans un texte libre : l'entreprise est sujet de la phrase.
    // Exemple : "Vicky Foods poursuit le développement...".
    const debutAction = texte.match(/^\s*([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’.\-]+(?:\s+(?:de|du|des|d['’]|la|le|les|l['’]|et|&|[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’.\-]+)){0,5})\s+(?:annonce|poursuit|confirme|investit|lance|pr[eé]voit|construit|agrandit|modernise|recrute|cr[eé]e|ouvre|inaugure|d[eé]ploie|installe|renforce)\b/i);
    const nomDebut = nettoyerNomEntreprise(debutAction?.[1]);
    if (nomDebut) return nomDebut;

    const patternsPrioritaires = [
      /\b(?:chez|pour|à|a)\s+([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’.\-]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’.\-]+){0,5})\s+(?:avec|sur|afin|pour|qui|dans)\b/i
    ];

    for (const pattern of patternsPrioritaires) {
      const nom = nettoyerNomEntreprise(texte.match(pattern)?.[1]);
      if (nom) return nom;
    }

    const fallback = texte.match(/^\s*([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’.\-]+(?:\s+(?:de|du|des|d['’]|la|le|les|l['’]|et|&|[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’.\-]+)){0,4})\b/);
    return nettoyerNomEntreprise(fallback?.[1]);
  }

  function detecterTypeSignalDepuisTexte(texteBrut = '') {
    const texte = normaliserTexte(texteBrut);
    if (!texte) return 'autre';
    const appelOffresNie = /(aucun|aucune|pas de|pas d |sans|non annonce|non lance|pas encore).{0,80}(appel d offres|appel d offre|dce|marche public|marché public)/i.test(texte);
    if (!appelOffresNie && /(appel d offres|appel d offre|dce|marche public|marché public)/i.test(texte)) return 'appel_offre';
    if (/(rappel produit|rappel de lot|contamination|corps etranger|corps etrangers|incident qualite)/i.test(texte)) return 'qualite_rappel_conso';
    if (/(nouvelle ligne|ligne de fabrication|ligne de production|ligne de conditionnement|ligne industrielle)/i.test(texte)) return 'nouvelle_ligne';
    if (/(investit|investissement|extension|agrandissement|capacite de production|capacites de production|montée en capacité|montee en capacite|modernisation)/i.test(texte)) return 'investissement';
    if (/(recrute|recrutement|embauche)/i.test(texte)) return 'recrutement';
    return 'autre';
  }

  function decouperPhrases(texte = '') {
    return String(texte || '')
      .split(/(?<=[.!?;。])\s+|\n+/)
      .map(p => p.trim())
      .filter(Boolean);
  }

  function contientPhrase(phraseNorm = '', indices = []) {
    return indices.some(indice => phraseNorm.includes(normaliserTexte(indice)));
  }

  function detecterMaturiteCommerciale(texteBrut = '') {
    const phrases = decouperPhrases(texteBrut).map(p => normaliserTexte(p));
    const texte = normaliserTexte(texteBrut);

    const negation = (phrase) => contientPhrase(phrase, [
      'aucun', 'aucune', 'pas de', 'pas d ', 'sans', 'non annonce', 'non annoncé',
      'non lance', 'non lancé', 'pas encore', 'n est pas encore'
    ]);

    const appelOffresNie = phrases.some(p => negation(p) && contientPhrase(p, ['appel d offres', 'appel d offre', 'dce', 'marche public', 'marché public']));
    const consultationNiee = phrases.some(p => negation(p) && contientPhrase(p, ['consultation', 'consultations', 'fournisseur', 'fournisseurs', 'demande de prix', 'demande de devis']));
    const phaseAmont = phrases.some(p => contientPhrase(p, [
      'phase amont', 'encore en phase amont', 'projet encore amont', 'necessite encore un suivi',
      'nécessite encore un suivi', 'suivi avant une action commerciale forte', 'equipements de ligne devront etre definis ulterieurement',
      'équipements de ligne devront être définis ultérieurement', 'futurs equipements', 'futurs équipements'
    ]));

    const consultationEnCours = !consultationNiee && contientPhrase(texte, [
      'consultation en cours', 'consultations en cours', 'consultation fournisseurs lancee',
      'consultation fournisseurs lancée', 'demande de prix en cours', 'demande de devis en cours'
    ]);
    const appelOffresEnCours = !appelOffresNie && contientPhrase(texte, [
      'appel d offres en cours', 'appel d offre en cours', 'appel d offres publie', 'appel d offre publié',
      'dce publie', 'dce publié'
    ]);
    const chantierLance = !phaseAmont && contientPhrase(texte, [
      'travaux demarres', 'travaux démarrés', 'chantier demarre', 'chantier démarré',
      'chantier lance', 'chantier lancé', 'installation en cours'
    ]);

    const prospectifConsultation = !consultationNiee && !consultationEnCours && contientPhrase(texte, [
      'consultations fournisseurs et les choix techniques sont susceptibles d intervenir',
      'consultations fournisseurs sont susceptibles d intervenir',
      'sont susceptibles d intervenir dans les prochains mois',
      'consultations devraient intervenir', 'consultations pourraient intervenir',
      'consultations prevues', 'consultations prévues', 'preparation consultation', 'préparation consultation',
      'choix techniques dans les prochains mois', 'choix techniques sont susceptibles d intervenir',
      'dans les prochains mois'
    ]);

    if (appelOffresEnCours || consultationEnCours || chantierLance) {
      return {
        phase: 'urgence_0_3_mois',
        score: 95,
        impact_score: 18,
        fenetre: '0-3 mois — agir vite',
        raison: 'Preuve forte : consultation, appel d’offres ou chantier réellement en cours.',
        niveau: 'preuve_forte_court_terme'
      };
    }

    if (phaseAmont || (appelOffresNie && consultationNiee)) {
      return {
        phase: 'veille_active_12_24_mois',
        score: 45,
        impact_score: -6,
        fenetre: '12-24 mois — veille active',
        raison: 'Le texte indique une phase amont ou l’absence de consultation/appel d’offres : signal à suivre avant action commerciale forte.',
        niveau: 'amont_negation'
      };
    }

    if (prospectifConsultation) {
      return {
        phase: 'contact_ideal_3_6_mois',
        score: 88,
        impact_score: 12,
        fenetre: '3-6 mois — prise de contact idéale',
        raison: 'Les consultations ou choix techniques sont évoqués comme prochains jalons : bon moment pour qualifier avant figement.',
        niveau: 'prospectif_3_6'
      };
    }

    if (contientPhrase(texte, ['investissement annonce', 'annonce un investissement', 'augmentation de capacite', 'augmentation des capacites', 'montée en capacité', 'montee en capacite'])) {
      return {
        phase: 'amont_6_12_mois',
        score: 72,
        impact_score: 6,
        fenetre: '6-12 mois — se positionner en amont',
        raison: 'Projet industriel annoncé : fenêtre favorable pour qualifier le besoin et identifier les prochains jalons.',
        niveau: 'amont_6_12'
      };
    }

    return null;
  }

  function construireTitreDepuisExtraction(texteBrut = '', entreprise = '', typeSignal = '') {
    const titreStructure = extraireChampStructureLocal(texteBrut, ['Titre', 'Signal']);
    if (titreStructure) return nettoyerValeur(titreStructure);

    const texte = String(texteBrut || '').replace(/\s+/g, ' ').trim();
    if (entreprise && typeSignal === 'nouvelle_ligne') {
      const ligne = texte.match(/nouvelle\s+ligne[^.]{0,120}/i)?.[0];
      if (ligne) return `${entreprise} — ${nettoyerValeur(ligne)}`;
      return `${entreprise} — nouvelle ligne industrielle`;
    }
    if (entreprise && typeSignal === 'investissement') return `${entreprise} — investissement industriel`;
    return texte.slice(0, 180) || 'Signal importé';
  }

  function analyserTexteImporte(texteBrut = '') {
    const texte = String(texteBrut || '').trim();
    const entreprise = extraireEntrepriseDepuisTexte(texte);
    const geographie = extraireGeographieDepuisTexte(texte);
    const typeSignal = detecterTypeSignalDepuisTexte(texte);
    const maturite = detecterMaturiteCommerciale(texte);
    const titre = construireTitreDepuisExtraction(texte, entreprise, typeSignal);

    return {
      entreprise_nom: entreprise,
      geographie,
      type_signal: typeSignal,
      maturite,
      titre,
      texte_original: texte
    };
  }

  function appliquerTimingExtraction(timing = {}, extraction = null) {
    if (!extraction?.maturite) return timing;

    return {
      ...timing,
      phase: extraction.maturite.phase,
      score: extraction.maturite.score,
      impact_score: extraction.maturite.impact_score,
      fenetre: extraction.maturite.fenetre,
      raison: extraction.maturite.raison,
      prochaine_action: extraction.maturite.phase === 'veille_active_12_24_mois'
        ? 'Mettre le projet sous surveillance et rechercher le prochain jalon commercial.'
        : (extraction.maturite.phase === 'contact_ideal_3_6_mois'
          ? 'Prendre contact maintenant pour qualifier les choix techniques avant figement.'
          : timing.prochaine_action),
      source_timing: 'flair_extraction'
    };
  }

  function enrichirSignalScoring(signal = {}, extraction = null) {
    if (!extraction) return signal;
    const geo = extraction.geographie || {};
    return {
      ...signal,
      entreprise_nom: extraction.entreprise_nom || signal.entreprise_nom,
      region: geo.valide ? geo.region_nom : signal.region,
      region_nom: geo.valide ? geo.region_nom : signal.region_nom,
      departement_nom: geo.valide ? geo.departement_nom : signal.departement_nom,
      departement_code: geo.valide ? geo.departement_code : signal.departement_code,
      type_signal: extraction.type_signal && extraction.type_signal !== 'autre' ? extraction.type_signal : signal.type_signal,
      titre: extraction.titre || signal.titre,
      maturite_extraction_flair: extraction.maturite?.niveau || ''
    };
  }

  window.FLAIR_EXTRACTION = {
    analyserTexteImporte,
    appliquerTimingExtraction,
    enrichirSignalScoring,
    nettoyerNomEntreprise,
    extraireEntrepriseDepuisTexte,
    extraireGeographieDepuisTexte,
    detecterMaturiteCommerciale,
    detecterTypeSignalDepuisTexte
  };
})();
