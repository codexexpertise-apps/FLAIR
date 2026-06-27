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

  // FLAIR V2026.1 — géographie générique
  // Ne pas coder une région ou un cas client en dur. Le moteur s'appuie d'abord
  // sur flair-geo.js puis complète avec un référentiel départemental France
  // utilisable pour toutes les régions. Les villes ne sont pas forcées ici :
  // si un texte mentionne seulement une commune sans département, FLAIR reste prudent.
  const FLAIR_DEPARTEMENTS_FRANCE_GENERIC = [
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Ain', departement_code: '01' },
    { region_nom: 'Hauts-de-France', departement_nom: 'Aisne', departement_code: '02' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Allier', departement_code: '03' },
    { region_nom: 'Provence-Alpes-Côte d\'Azur', departement_nom: 'Alpes-de-Haute-Provence', departement_code: '04' },
    { region_nom: 'Provence-Alpes-Côte d\'Azur', departement_nom: 'Hautes-Alpes', departement_code: '05' },
    { region_nom: 'Provence-Alpes-Côte d\'Azur', departement_nom: 'Alpes-Maritimes', departement_code: '06' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Ardèche', departement_code: '07' },
    { region_nom: 'Grand Est', departement_nom: 'Ardennes', departement_code: '08' },
    { region_nom: 'Occitanie', departement_nom: 'Ariège', departement_code: '09' },
    { region_nom: 'Grand Est', departement_nom: 'Aube', departement_code: '10' },
    { region_nom: 'Occitanie', departement_nom: 'Aude', departement_code: '11' },
    { region_nom: 'Occitanie', departement_nom: 'Aveyron', departement_code: '12' },
    { region_nom: 'Provence-Alpes-Côte d\'Azur', departement_nom: 'Bouches-du-Rhône', departement_code: '13' },
    { region_nom: 'Normandie', departement_nom: 'Calvados', departement_code: '14' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Cantal', departement_code: '15' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Charente', departement_code: '16' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Charente-Maritime', departement_code: '17' },
    { region_nom: 'Centre-Val de Loire', departement_nom: 'Cher', departement_code: '18' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Corrèze', departement_code: '19' },
    { region_nom: 'Corse', departement_nom: 'Corse-du-Sud', departement_code: '2A' },
    { region_nom: 'Corse', departement_nom: 'Haute-Corse', departement_code: '2B' },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Côte-d\'Or', departement_code: '21' },
    { region_nom: 'Bretagne', departement_nom: 'Côtes-d\'Armor', departement_code: '22' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Creuse', departement_code: '23' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Dordogne', departement_code: '24' },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Doubs', departement_code: '25' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Drôme', departement_code: '26' },
    { region_nom: 'Normandie', departement_nom: 'Eure', departement_code: '27' },
    { region_nom: 'Centre-Val de Loire', departement_nom: 'Eure-et-Loir', departement_code: '28' },
    { region_nom: 'Bretagne', departement_nom: 'Finistère', departement_code: '29' },
    { region_nom: 'Occitanie', departement_nom: 'Gard', departement_code: '30' },
    { region_nom: 'Occitanie', departement_nom: 'Haute-Garonne', departement_code: '31' },
    { region_nom: 'Occitanie', departement_nom: 'Gers', departement_code: '32' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Gironde', departement_code: '33' },
    { region_nom: 'Occitanie', departement_nom: 'Hérault', departement_code: '34' },
    { region_nom: 'Bretagne', departement_nom: 'Ille-et-Vilaine', departement_code: '35' },
    { region_nom: 'Centre-Val de Loire', departement_nom: 'Indre', departement_code: '36' },
    { region_nom: 'Centre-Val de Loire', departement_nom: 'Indre-et-Loire', departement_code: '37' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Isère', departement_code: '38' },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Jura', departement_code: '39' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Landes', departement_code: '40' },
    { region_nom: 'Centre-Val de Loire', departement_nom: 'Loir-et-Cher', departement_code: '41' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Loire', departement_code: '42' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Haute-Loire', departement_code: '43' },
    { region_nom: 'Pays de la Loire', departement_nom: 'Loire-Atlantique', departement_code: '44' },
    { region_nom: 'Centre-Val de Loire', departement_nom: 'Loiret', departement_code: '45' },
    { region_nom: 'Occitanie', departement_nom: 'Lot', departement_code: '46' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Lot-et-Garonne', departement_code: '47' },
    { region_nom: 'Occitanie', departement_nom: 'Lozère', departement_code: '48' },
    { region_nom: 'Pays de la Loire', departement_nom: 'Maine-et-Loire', departement_code: '49' },
    { region_nom: 'Normandie', departement_nom: 'Manche', departement_code: '50' },
    { region_nom: 'Grand Est', departement_nom: 'Marne', departement_code: '51' },
    { region_nom: 'Grand Est', departement_nom: 'Haute-Marne', departement_code: '52' },
    { region_nom: 'Pays de la Loire', departement_nom: 'Mayenne', departement_code: '53' },
    { region_nom: 'Grand Est', departement_nom: 'Meurthe-et-Moselle', departement_code: '54' },
    { region_nom: 'Grand Est', departement_nom: 'Meuse', departement_code: '55' },
    { region_nom: 'Bretagne', departement_nom: 'Morbihan', departement_code: '56' },
    { region_nom: 'Grand Est', departement_nom: 'Moselle', departement_code: '57' },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Nièvre', departement_code: '58' },
    { region_nom: 'Hauts-de-France', departement_nom: 'Nord', departement_code: '59' },
    { region_nom: 'Hauts-de-France', departement_nom: 'Oise', departement_code: '60' },
    { region_nom: 'Normandie', departement_nom: 'Orne', departement_code: '61' },
    { region_nom: 'Hauts-de-France', departement_nom: 'Pas-de-Calais', departement_code: '62' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Puy-de-Dôme', departement_code: '63' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Pyrénées-Atlantiques', departement_code: '64' },
    { region_nom: 'Occitanie', departement_nom: 'Hautes-Pyrénées', departement_code: '65' },
    { region_nom: 'Occitanie', departement_nom: 'Pyrénées-Orientales', departement_code: '66' },
    { region_nom: 'Grand Est', departement_nom: 'Bas-Rhin', departement_code: '67' },
    { region_nom: 'Grand Est', departement_nom: 'Haut-Rhin', departement_code: '68' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Rhône', departement_code: '69' },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Haute-Saône', departement_code: '70' },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Saône-et-Loire', departement_code: '71' },
    { region_nom: 'Pays de la Loire', departement_nom: 'Sarthe', departement_code: '72' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Savoie', departement_code: '73' },
    { region_nom: 'Auvergne-Rhône-Alpes', departement_nom: 'Haute-Savoie', departement_code: '74' },
    { region_nom: 'Île-de-France', departement_nom: 'Paris', departement_code: '75' },
    { region_nom: 'Normandie', departement_nom: 'Seine-Maritime', departement_code: '76' },
    { region_nom: 'Île-de-France', departement_nom: 'Seine-et-Marne', departement_code: '77' },
    { region_nom: 'Île-de-France', departement_nom: 'Yvelines', departement_code: '78' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Deux-Sèvres', departement_code: '79' },
    { region_nom: 'Hauts-de-France', departement_nom: 'Somme', departement_code: '80' },
    { region_nom: 'Occitanie', departement_nom: 'Tarn', departement_code: '81' },
    { region_nom: 'Occitanie', departement_nom: 'Tarn-et-Garonne', departement_code: '82' },
    { region_nom: 'Provence-Alpes-Côte d\'Azur', departement_nom: 'Var', departement_code: '83' },
    { region_nom: 'Provence-Alpes-Côte d\'Azur', departement_nom: 'Vaucluse', departement_code: '84' },
    { region_nom: 'Pays de la Loire', departement_nom: 'Vendée', departement_code: '85' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Vienne', departement_code: '86' },
    { region_nom: 'Nouvelle-Aquitaine', departement_nom: 'Haute-Vienne', departement_code: '87' },
    { region_nom: 'Grand Est', departement_nom: 'Vosges', departement_code: '88' },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Yonne', departement_code: '89' },
    { region_nom: 'Bourgogne-Franche-Comté', departement_nom: 'Territoire de Belfort', departement_code: '90' },
    { region_nom: 'Île-de-France', departement_nom: 'Essonne', departement_code: '91' },
    { region_nom: 'Île-de-France', departement_nom: 'Hauts-de-Seine', departement_code: '92' },
    { region_nom: 'Île-de-France', departement_nom: 'Seine-Saint-Denis', departement_code: '93' },
    { region_nom: 'Île-de-France', departement_nom: 'Val-de-Marne', departement_code: '94' },
    { region_nom: 'Île-de-France', departement_nom: 'Val-d\'Oise', departement_code: '95' },
    { region_nom: 'Guadeloupe', departement_nom: 'Guadeloupe', departement_code: '971' },
    { region_nom: 'Martinique', departement_nom: 'Martinique', departement_code: '972' },
    { region_nom: 'Guyane', departement_nom: 'Guyane', departement_code: '973' },
    { region_nom: 'La Réunion', departement_nom: 'La Réunion', departement_code: '974' },
    { region_nom: 'Mayotte', departement_nom: 'Mayotte', departement_code: '976' }
  ];

  const FLAIR_REGIONS_FRANCE_GENERIC = [
    { region_nom: 'Auvergne-Rhône-Alpes', alias: ['auvergne rhone alpes', 'auvergne-rhone-alpes', 'aura'] },
    { region_nom: 'Bourgogne-Franche-Comté', alias: ['bourgogne franche comte', 'bourgogne-franche-comte', 'bfc'] },
    { region_nom: 'Bretagne', alias: ['bretagne'] },
    { region_nom: 'Centre-Val de Loire', alias: ['centre val de loire', 'centre-val de loire', 'centre'] },
    { region_nom: 'Corse', alias: ['corse'] },
    { region_nom: 'Grand Est', alias: ['grand est', 'alsace', 'lorraine', 'champagne ardenne'] },
    { region_nom: 'Hauts-de-France', alias: ['hauts de france', 'hauts-de-france', 'nord pas de calais', 'picardie'] },
    { region_nom: 'Île-de-France', alias: ['ile de france', 'île-de-france', 'idf', 'paris region'] },
    { region_nom: 'Normandie', alias: ['normandie'] },
    { region_nom: 'Nouvelle-Aquitaine', alias: ['nouvelle aquitaine', 'nouvelle-aquitaine'] },
    { region_nom: 'Occitanie', alias: ['occitanie'] },
    { region_nom: 'Pays de la Loire', alias: ['pays de la loire', 'pays-de-la-loire'] },
    { region_nom: 'Provence-Alpes-Côte d\'Azur', alias: ['provence alpes cote d azur', 'provence-alpes-cote-d-azur', 'paca', 'sud paca'] },
    { region_nom: 'Guadeloupe', alias: ['guadeloupe'] },
    { region_nom: 'Martinique', alias: ['martinique'] },
    { region_nom: 'Guyane', alias: ['guyane'] },
    { region_nom: 'La Réunion', alias: ['la reunion', 'la réunion', 'reunion', 'réunion'] },
    { region_nom: 'Mayotte', alias: ['mayotte'] }
  ];

  function aliasesDepartementGeneriques(item = {}) {
    const nom = String(item.departement_nom || '');
    return [
      nom,
      nom.replace(/-/g, ' '),
      nom.replace(/[’']/g, ' '),
      `${nom} ${item.departement_code || ''}`,
      `departement ${item.departement_code || ''}`,
      `département ${item.departement_code || ''}`
    ].filter(Boolean);
  }

  function rechercherDepartementGeneriqueDepuisTexte(texteBrut = '') {
    const geoApi = getGeoApi();
    const normalise = normaliserTexte(texteBrut);
    if (!normalise) return null;

    const references = [
      ...(Array.isArray(geoApi.FLAIR_DEPARTEMENTS_REFERENCE) ? geoApi.FLAIR_DEPARTEMENTS_REFERENCE.map(item => ({
        region_nom: item.region || item.region_nom,
        departement_nom: item.nom || item.departement_nom,
        departement_code: item.code || item.departement_code,
        alias: item.alias || []
      })) : []),
      ...FLAIR_DEPARTEMENTS_FRANCE_GENERIC
    ];

    for (const item of references) {
      const alias = [...aliasesDepartementGeneriques(item), ...(item.alias || [])];
      const matchAlias = alias.some(value => {
        const cle = normaliserTexte(value);
        return cle && new RegExp(`(^|[^a-z0-9])${cle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(normalise);
      });

      const code = String(item.departement_code || '').toLowerCase();
      const matchCode = code && new RegExp(`(^|[^a-z0-9])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(normalise);

      if (matchAlias || matchCode) {
        return {
          region_nom: item.region_nom,
          departement_nom: item.departement_nom,
          departement_code: item.departement_code,
          valide: true,
          source_extraction: 'flair_extraction_departement_generique'
        };
      }
    }

    return null;
  }

  function rechercherRegionGeneriqueDepuisTexte(texteBrut = '') {
    const normalise = normaliserTexte(texteBrut);
    if (!normalise) return null;

    const region = FLAIR_REGIONS_FRANCE_GENERIC.find(item =>
      item.alias.some(alias => {
        const cle = normaliserTexte(alias);
        return cle && normalise.includes(cle);
      })
    );

    return region
      ? { region_nom: region.region_nom, departement_nom: '', departement_code: '', valide: true, source_extraction: 'flair_extraction_region_generique' }
      : null;
  }

  function extraireGeographieDepuisTexte(texteBrut = '') {
    const texte = String(texteBrut || '');
    const structuree = extraireChampStructureLocal(texte, ['Département', 'Departement', 'Région', 'Region', 'Localisation', 'Lieu', 'Site']);
    const geoStructuree = normaliserGeographie(structuree);
    if (geoStructuree?.valide) return geoStructuree;

    // 1) Moteur géographique officiel flair-geo.js.
    const geoApi = getGeoApi();
    const regionImportee = typeof geoApi.extraireRegionImportDepuisTexte === 'function'
      ? geoApi.extraireRegionImportDepuisTexte(texte)
      : '';
    const geoStandard = normaliserGeographie(regionImportee);
    if (geoStandard?.valide) return geoStandard;

    // 2) Complément générique France entière : département par nom/code.
    const departementGenerique = rechercherDepartementGeneriqueDepuisTexte(texte);
    if (departementGenerique?.valide) return departementGenerique;

    // 3) Dernier recours : région seule si elle est explicitement mentionnée.
    const regionGenerique = rechercherRegionGeneriqueDepuisTexte(texte);
    if (regionGenerique?.valide) return regionGenerique;

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
