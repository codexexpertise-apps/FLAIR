// =========================================================================
// FLAIR — GEO ENGINE V1.2
// =========================================================================
// Rôle : isoler la normalisation géographique, régions, départements,
// France entière et périmètre commercial sans modifier la logique métier.
// Module autonome exposé via window.FLAIR_GEO.
// =========================================================================

(function () {
  "use strict";

  let profilProvider = function () {
    return null;
  };

  function setProfilProvider(provider) {
    if (typeof provider === 'function') {
      profilProvider = provider;
    }
  }

function normaliserTexteSimple(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-–—]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function nettoyerValeurImport(value) {
  return String(value || '')
    .replace(/^[-•\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraireChampStructure(texte, libelles) {
  const lignes = String(texte || '').split(/\r?\n/);
  const labels = libelles.map(normaliserTexteSimple);

  for (const ligne of lignes) {
    const index = ligne.search(/[:：]/);
    if (index === -1) continue;

    const label = normaliserTexteSimple(ligne.slice(0, index));
    const valeur = nettoyerValeurImport(ligne.slice(index + 1));

    if (labels.some(l => label === l || label.startsWith(l))) {
      return valeur;
    }
  }

  return '';
}

function normaliserRegionImport(value) {
  let region = nettoyerValeurImport(value);

  // Sécurité import FLAIR :
  // Si le texte collé est sur une seule ligne, la valeur après "Région :"
  // peut embarquer la suite du diagnostic métier. On coupe uniquement l'excédent
  // pour conserver une région courte et laisser Pourquoi / Opportunité / Action
  // dans leurs champs dédiés.
  const separateursMetier = [
    /\s+pourquoi\s+c['’]est\s+important\s*[:：-]?/i,
    /\s+opportunit[eé]\s+commerciale\s*[:：-]?/i,
    /\s+action\s+(?:rapide\s+)?conseill[eé]e\s*[:：-]?/i,
    /\s+l['’]entreprise\s+/i,
    /\s+projet\s+industriel\s+/i,
    /\s+signal\s+(?:directement\s+)?/i,
    /\s+se\s+positionner\s+/i,
    /\s+identifier\s+/i,
    /\s+contacter\s+/i,
    /\s+date\s*[:：-]/i,
    /\s+score\s*[:：-]/i,
    /\s+type\s*[:：-]/i,
    /\s+entreprise\s*[:：-]/i
  ];

  let coupeIndex = -1;
  separateursMetier.forEach(regex => {
    const match = region.match(regex);
    if (match && match.index !== undefined) {
      coupeIndex = coupeIndex === -1 ? match.index : Math.min(coupeIndex, match.index);
    }
  });

  if (coupeIndex > 0) {
    region = region.slice(0, coupeIndex);
  }

  return region
    .replace(/\s*[.;,]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Référentiel léger côté client pour normaliser les zones prioritaires FLAIR.
// La table Supabase departements reste la référence base ; ce tableau permet
// de structurer immédiatement les imports sans appel supplémentaire.
const FLAIR_DEPARTEMENTS_REFERENCE = [
  { region: 'Bretagne', nom: 'Côtes-d\'Armor', code: '22', alias: ['cotes d armor', 'cotes-d armor', 'côtes d armor'] },
  { region: 'Bretagne', nom: 'Finistère', code: '29', alias: ['finistere'] },
  { region: 'Bretagne', nom: 'Ille-et-Vilaine', code: '35', alias: ['ille et vilaine'] },
  { region: 'Bretagne', nom: 'Morbihan', code: '56', alias: [] },

  { region: 'Normandie', nom: 'Calvados', code: '14', alias: [] },
  { region: 'Normandie', nom: 'Eure', code: '27', alias: [] },
  { region: 'Normandie', nom: 'Manche', code: '50', alias: ['la manche'] },
  { region: 'Normandie', nom: 'Orne', code: '61', alias: [] },
  { region: 'Normandie', nom: 'Seine-Maritime', code: '76', alias: ['seine maritime'] },

  { region: 'Pays de la Loire', nom: 'Loire-Atlantique', code: '44', alias: ['loire atlantique'] },
  { region: 'Pays de la Loire', nom: 'Maine-et-Loire', code: '49', alias: ['maine et loire'] },
  { region: 'Pays de la Loire', nom: 'Mayenne', code: '53', alias: [] },
  { region: 'Pays de la Loire', nom: 'Sarthe', code: '72', alias: [] },
  { region: 'Pays de la Loire', nom: 'Vendée', code: '85', alias: ['vendee'] },

  { region: 'Hauts-de-France', nom: 'Aisne', code: '02', alias: [] },
  { region: 'Hauts-de-France', nom: 'Nord', code: '59', alias: [] },
  { region: 'Hauts-de-France', nom: 'Oise', code: '60', alias: [] },
  { region: 'Hauts-de-France', nom: 'Pas-de-Calais', code: '62', alias: ['pas de calais'] },
  { region: 'Hauts-de-France', nom: 'Somme', code: '80', alias: [] },

  { region: 'Grand Est', nom: 'Ardennes', code: '08', alias: [] },
  { region: 'Grand Est', nom: 'Aube', code: '10', alias: [] },
  { region: 'Grand Est', nom: 'Marne', code: '51', alias: [] },
  { region: 'Grand Est', nom: 'Haute-Marne', code: '52', alias: ['haute marne'] },
  { region: 'Grand Est', nom: 'Meurthe-et-Moselle', code: '54', alias: ['meurthe et moselle'] },
  { region: 'Grand Est', nom: 'Meuse', code: '55', alias: [] },
  { region: 'Grand Est', nom: 'Moselle', code: '57', alias: [] },
  { region: 'Grand Est', nom: 'Bas-Rhin', code: '67', alias: ['bas rhin'] },
  { region: 'Grand Est', nom: 'Haut-Rhin', code: '68', alias: ['haut rhin', 'ensisheim', 'mulhouse', 'colmar'] },
  { region: 'Grand Est', nom: 'Vosges', code: '88', alias: [] },

  { region: 'Occitanie', nom: 'Ariège', code: '09', alias: ['ariege'] },
  { region: 'Occitanie', nom: 'Aude', code: '11', alias: [] },
  { region: 'Occitanie', nom: 'Aveyron', code: '12', alias: [] },
  { region: 'Occitanie', nom: 'Gard', code: '30', alias: [] },
  { region: 'Occitanie', nom: 'Haute-Garonne', code: '31', alias: ['haute garonne'] },
  { region: 'Occitanie', nom: 'Gers', code: '32', alias: [] },
  { region: 'Occitanie', nom: 'Hérault', code: '34', alias: ['herault'] },
  { region: 'Occitanie', nom: 'Lot', code: '46', alias: [] },
  { region: 'Occitanie', nom: 'Lozère', code: '48', alias: ['lozere'] },
  { region: 'Occitanie', nom: 'Hautes-Pyrénées', code: '65', alias: ['hautes pyrenees'] },
  { region: 'Occitanie', nom: 'Pyrénées-Orientales', code: '66', alias: ['pyrenees orientales'] },
  { region: 'Occitanie', nom: 'Tarn', code: '81', alias: [] },
  { region: 'Occitanie', nom: 'Tarn-et-Garonne', code: '82', alias: ['tarn et garonne'] }
];

const FLAIR_REGIONS_REFERENCE = [
  'Bretagne',
  'Normandie',
  'Pays de la Loire',
  'Hauts-de-France',
  'Grand Est',
  'Occitanie'
];

function normaliserCleGeographie(value) {
  return normaliserTexteSimple(value)
    .replace(/['’]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trouverRegionReference(value) {
  const cle = normaliserCleGeographie(value);
  if (!cle) return '';

  const aliasRegions = [
    { region: 'Grand Est', alias: ['alsace', 'lorraine', 'champagne ardenne', 'champagne-ardenne', 'ensisheim', 'mulhouse', 'colmar', 'strasbourg'] },
    { region: 'Bretagne', alias: ['vannes', 'lorient', 'rennes', 'brest', 'quimper', 'saint brieuc', 'saint-brieuc'] },
    { region: 'Hauts-de-France', alias: ['hauts de france', 'nord pas de calais', 'nord-pas-de-calais', 'picardie'] },
    { region: 'Pays de la Loire', alias: ['pays de loire', 'nantes', 'angers', 'le mans', 'laval', 'la roche sur yon'] },
    { region: 'Normandie', alias: ['rouen', 'caen', 'le havre', 'evreux', 'évreux'] },
    { region: 'Occitanie', alias: ['toulouse', 'montpellier', 'perpignan', 'nimes', 'nîmes'] }
  ];

  const aliasMatch = aliasRegions.find(item =>
    item.alias.some(alias => {
      const aliasCle = normaliserCleGeographie(alias);
      return cle === aliasCle || cle.includes(aliasCle);
    })
  );

  if (aliasMatch) return aliasMatch.region;

  return FLAIR_REGIONS_REFERENCE.find(region => {
    const regionCle = normaliserCleGeographie(region);
    return cle === regionCle || cle.includes(regionCle) || regionCle.includes(cle);
  }) || '';
}

function trouverDepartementReference(value) {
  const cle = normaliserCleGeographie(value);
  if (!cle) return null;

  return FLAIR_DEPARTEMENTS_REFERENCE.find(dep => {
    const noms = [dep.nom, dep.code, ...(dep.alias || [])];
    return noms.some(nom => {
      const depCle = normaliserCleGeographie(nom);
      return cle === depCle || cle.includes(depCle) || depCle.includes(cle);
    });
  }) || null;
}

function contientTermeGeographiqueStrict(texteNormalise, terme) {
  const cle = normaliserCleGeographie(terme);
  const texte = ` ${normaliserCleGeographie(texteNormalise)} `;
  if (!cle) return false;

  // Les codes départements doivent être isolés, pour éviter de détecter 27 dans 2027.
  if (/^\d{2,3}$/.test(cle)) {
    return new RegExp(`(?:^|\\D)${cle}(?:\\D|$)`).test(texte);
  }

  // Les départements courts comme Eure, Lot, Gard ou Nord doivent être des mots complets.
  // Cela évite les faux positifs du type "heure" => Eure ou "copilote" => Lot.
  return new RegExp(`(^|\\s)${cle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`).test(texte);
}


function contientDepartementFiableDepuisTexte(texteNormalise, dep = {}) {
  const texte = ` ${normaliserCleGeographie(texteNormalise)} `;
  const noms = [dep.nom, ...(dep.alias || [])].map(normaliserCleGeographie).filter(Boolean);
  const code = String(dep.code || '').trim();

  if (code) {
    // Sécurité V1.2 : un code département seul ne suffit plus.
    // Exemple à éviter : 14/06/2026 ne doit pas devenir Calvados (14).
    const codeAvecContexte = new RegExp(`(?:departement|département|dept|dep|code\s+postal|cp)\s*[:#-]?\s*${code}(?:\D|$)`).test(texte);
    if (codeAvecContexte) return true;
  }


  return noms.some(nom => {
    const escaped = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const motComplet = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`).test(texte);
    if (!motComplet) return false;

    // Les noms courts ou ambigus doivent être accompagnés d'un contexte géographique.
    // Exemples acceptés : "dans l'Eure", "département du Lot", "(Tarn)", "Tarn (81)".
    const courtOuAmbigu = nom.length <= 5;
    if (!courtOuAmbigu) return true;

    const contexteAvant = new RegExp(`(?:dans|en|du|de|d|departement|département|dept|dep|\\(|,|/)\\s+(?:l\\s+|le\\s+|la\\s+|les\\s+)?${escaped}(?=\\s|\\)|,|\\.|$)`).test(texte);
    const contexteApresCode = code ? new RegExp(`${escaped}\\s*\\(?\\s*${code}\\s*\\)?`).test(texte) : false;
    return contexteAvant || contexteApresCode;
  });
}

function normaliserGeographieImport(value) {
  // Sécurité FLAIR V3.2 : une géographie absente ou non textuelle doit rester neutre.
  // On évite toute déduction hasardeuse et tout crash sur split/trim/toLowerCase.
  if (!value || typeof value !== 'string') {
    return {
      region_nom: 'Non déterminée',
      departement_nom: '',
      departement_code: '',
      valide: false
    };
  }

  const brut = normaliserRegionImport(value);
  if (!brut) {
    return {
      region_nom: 'Non déterminée',
      departement_nom: '',
      departement_code: '',
      valide: false
    };
  }

  const morceaux = brut
    .split(/\s*(?:\/|\||;|,|\bet\b|\(|\)|-)\s*/i)
    .map(part => nettoyerValeurImport(part))
    .filter(Boolean);

  const regionDirecte = trouverRegionReference(brut);
  const departementDirect = trouverDepartementReference(brut);
  let regionNom = regionDirecte || departementDirect?.region || '';
  let departementNom = departementDirect?.nom || '';
  let departementCode = departementDirect?.code || '';

  morceaux.forEach(part => {
    const region = trouverRegionReference(part);
    const departement = trouverDepartementReference(part);

    if (!regionNom && region) regionNom = region;
    if (!departementNom && departement) {
      departementNom = departement.nom;
      departementCode = departement.code;
      if (!regionNom) regionNom = departement.region;
    }
  });

  // Sécurité FLAIR V2 : si aucune région/département fiable n'est détecté,
  // on ne transforme pas le texte libre en région. La géographie restera neutre.

  return {
    region_nom: regionNom || 'Non déterminée',
    departement_nom: departementNom,
    departement_code: departementCode,
    valide: Boolean(regionNom || departementNom || departementCode)
  };
}

function signalDepartement(s) {
  const region = normaliserTexteSimple(signalRegion(s) || s.region_nom || s.region || '');

  // Un signal national / France entière ne doit pas hériter par erreur d'un département
  // détecté dans un mot parasite (ex : "copilote" pouvant contenir "lot").
  if (estRegionNationaleFlair(region)) {
    return '';
  }

  let nom = s.departement_nom || s.departement || '';
  let code = s.departement_code || '';

  if (!nom && !code) {
    const texteLibre = [
      s.titre,
      s.entreprise_nom,
      s.description,
      s.texte_original
    ].filter(Boolean).join(' ');

    const regionInferree = extraireRegionImportDepuisTexte(texteLibre);
    const geographie = normaliserGeographieImport(regionInferree);
    nom = geographie.departement_nom || '';
    code = geographie.departement_code || '';
  }

  if (nom && code) return `${nom} (${code})`;
  return nom || code || '';
}

function extraireRegionImportDepuisTexte(texte) {
  const contenu = String(texte || '');

  const regionStructuree = extraireChampStructure(contenu, [
    'Région',
    'Region',
    'Zone',
    'Localisation',
    'Territoire'
  ]);

  if (regionStructuree) return normaliserRegionImport(regionStructuree);

  const match = contenu.match(/(?:^|\n|\r)\s*(?:r[eé]gion|region|zone)\s*[:：-]\s*([^\n\r]+)/i);
  if (match) return normaliserRegionImport(match[1]);

  // Déduction automatique STRICTE depuis le texte libre.
  // Pas de dictionnaire de sites : FLAIR ne doit pas maintenir des milliers d'usines.
  // On ne retient que les régions et départements explicitement écrits dans le signal.
  const texteNormalise = normaliserCleGeographie(contenu);

  const departementTrouve = FLAIR_DEPARTEMENTS_REFERENCE.find(dep =>
    contientDepartementFiableDepuisTexte(texteNormalise, dep)
  );

  if (departementTrouve) return departementTrouve.nom;

  const regionAliasTrouvee = trouverRegionReference(contenu);
  if (regionAliasTrouvee) return regionAliasTrouvee;

  const regionTrouvee = FLAIR_REGIONS_REFERENCE.find(region =>
    contientTermeGeographiqueStrict(texteNormalise, region)
  );

  return regionTrouvee || '';
}

function normaliserListeRegionsSecondaires(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/[,;|]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function labelRegionCommerciale(value) {
  const labels = {
    grand_est: 'Grand Est',
    ile_de_france: 'Île-de-France',
    hauts_de_france: 'Hauts-de-France',
    bourgogne_franche_comte: 'Bourgogne-Franche-Comté',
    auvergne_rhone_alpes: 'Auvergne-Rhône-Alpes',
    nouvelle_aquitaine: 'Nouvelle-Aquitaine',
    occitanie: 'Occitanie',
    paca: 'PACA',
    bretagne: 'Bretagne',
    normandie: 'Normandie',
    pays_de_la_loire: 'Pays de la Loire',
    centre_val_de_loire: 'Centre-Val de Loire',
    corse: 'Corse',
    france: 'France entière'
  };

  return labels[value] || String(value || '').replaceAll('_', ' ').trim() || 'Non renseignée';
}

function labelRegionsSecondaires(value) {
  const regions = normaliserListeRegionsSecondaires(value);
  if (!regions.length) return '';
  return regions.map(labelRegionCommerciale).join(', ');
}

function extraireRegionDepuisSignalTexte(s = {}) {
  const texte = [
    s.titre,
    s.entreprise_nom,
    s.description,
    s.contenu,
    s.resume,
    s.texte_original
  ].filter(Boolean).join('\n');

  const match = String(texte || '').match(
    /(?:^|[\n\r])\s*(?:r[eé]gion|region|zone)\s*[:：]\s*([^\n\r|]+)/i
  );

  if (!match) return '';

  return normaliserRegionImport(match[1]);
}

function signalRegion(s) {
  const regionDirecte = s.region_nom || s.region || s.region_signal || s.zone || extraireRegionDepuisSignalTexte(s) || '';
  if (regionDirecte) return normaliserRegionImport(regionDirecte);

  const texteLibre = [
    s.titre,
    s.entreprise_nom,
    s.description,
    s.texte_original,
    s.raison_score,
    s.angle_commercial,
    s.action_recommandee
  ].filter(Boolean).join(' ');

  const regionInferree = extraireRegionImportDepuisTexte(texteLibre);
  const geographie = normaliserGeographieImport(regionInferree);
  return geographie.region_nom || regionInferree || '';
}

function regionsCommercialesPreparees() {
  const profil = profilProvider() || {};
  const regionPrincipale = profil?.region || '';
  const regionsSecondaires = profil?.regions_secondaires || profil?.regionsSecondaires || [];
  const listeSecondaire = Array.isArray(regionsSecondaires)
    ? regionsSecondaires
    : String(regionsSecondaires || '').split(/[,;|]/);

  return [regionPrincipale, ...listeSecondaire]
    .map(r => normaliserTexteSimple(r))
    .filter(Boolean);
}

function estRegionNationaleFlair(value) {
  const region = normaliserTexteSimple(value);
  if (!region) return false;

  return [
    'france',
    'france entiere',
    'toute france',
    'national',
    'nationale',
    'multi sites',
    'multisites',
    'multi site',
    'toutes regions',
    'toutes les regions'
  ].includes(region);
}

function signalDansPerimetreRegionPrepare(signal) {
  const regions = regionsCommercialesPreparees();
  if (!regions.length) return true;

  const regionSignal = normaliserTexteSimple(signalRegion(signal));
  if (!regionSignal || regionSignal === 'non determinee' || regionSignal === 'non renseignee') return true;

  // FLAIR : un signal national ou multi-sites doit pouvoir être proposé
  // à tous les commerciaux, quelle que soit leur région.
  if (estRegionNationaleFlair(regionSignal)) return true;

  // Sécurité symétrique : si un commercial est paramétré "France entière",
  // il peut recevoir les signaux de toutes les régions.
  if (regions.some(estRegionNationaleFlair)) return true;

  return regions.some(regionCommerciale =>
    regionSignal.includes(regionCommerciale) || regionCommerciale.includes(regionSignal)
  );
}

  window.FLAIR_GEO = {
    setProfilProvider,
    normaliserTexteSimple,
    nettoyerValeurImport,
    extraireChampStructure,
    normaliserRegionImport,
    normaliserCleGeographie,
    trouverRegionReference,
    trouverDepartementReference,
    contientTermeGeographiqueStrict,
    contientDepartementFiableDepuisTexte,
    normaliserGeographieImport,
    normaliserListeRegionsSecondaires,
    labelRegionCommerciale,
    labelRegionsSecondaires,
    extraireRegionDepuisSignalTexte,
    signalRegion,
    signalDepartement,
    extraireRegionImportDepuisTexte,
    regionsCommercialesPreparees,
    estRegionNationaleFlair,
    signalDansPerimetreRegionPrepare,
    FLAIR_DEPARTEMENTS_REFERENCE,
    FLAIR_REGIONS_REFERENCE
  };
})();
