// =========================================================================
// FLAIR — COPILOTE COMMERCIAL / PHRASES V2026.1
// =========================================================================
// Rôle : externaliser les formulations du Copilote Commercial pour éviter
// les textes trop répétitifs dans le cockpit, sans modifier le scoring,
// la crédibilité, le timing ni les règles métier.
// =========================================================================

(function () {
  "use strict";

  function normaliserTexte(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function hashTexte(value) {
    const texte = String(value || "");
    let hash = 0;
    for (let i = 0; i < texte.length; i += 1) {
      hash = ((hash << 5) - hash) + texte.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function choisir(liste = [], contexte = "") {
    const items = Array.isArray(liste) ? liste.filter(Boolean) : [];
    if (!items.length) return "";
    return items[hashTexte(contexte) % items.length];
  }

  function fusionnerBibliotheques(base = {}, extension = {}) {
    if (!extension || typeof extension !== "object") return base;
    const sortie = Array.isArray(base) ? [...base] : { ...(base || {}) };

    Object.keys(extension).forEach(cle => {
      const valeurExtension = extension[cle];
      const valeurBase = sortie[cle];

      if (Array.isArray(valeurBase) || Array.isArray(valeurExtension)) {
        sortie[cle] = [
          ...(Array.isArray(valeurExtension) ? valeurExtension : []),
          ...(Array.isArray(valeurBase) ? valeurBase : [])
        ].filter(Boolean);
        return;
      }

      if (
        valeurExtension &&
        typeof valeurExtension === "object" &&
        valeurBase &&
        typeof valeurBase === "object"
      ) {
        sortie[cle] = fusionnerBibliotheques(valeurBase, valeurExtension);
        return;
      }

      sortie[cle] = valeurExtension;
    });

    return sortie;
  }

  function bibliothequeExterneCopilote() {
    const source = window.FLAIR_COPILOTE_BIBLIOTHEQUE;
    if (!source) return {};
    if (typeof source.get === "function") return source.get() || {};
    return source.BIBLIOTHEQUE || {};
  }

  function valeurSignal(signal = {}, cles = []) {
    for (const cle of cles) {
      const valeur = signal?.[cle] ?? signal?.signal?.[cle];
      if (valeur !== null && valeur !== undefined && String(valeur).trim() !== "") {
        return String(valeur).trim();
      }
    }
    return "";
  }

  function signalOrigineTerrain(signal = {}) {
    const origine = normaliserTexte(valeurSignal(signal, [
      "origine_signal",
      "origine",
      "source_origine",
      "type_source",
      "source_distribution"
    ]));
    return origine.includes("terrain") || origine.includes("manuel") || origine.includes("visite") || origine.includes("salon");
  }

  function contactTerrainLabel(signal = {}) {
    const nom = valeurSignal(signal, [
      "contact_nom",
      "contact_terrain_nom",
      "contact_public_nom",
      "nom_contact",
      "terrain_contact_nom"
    ]);
    const fonction = valeurSignal(signal, [
      "contact_fonction",
      "contact_terrain_fonction",
      "contact_public_fonction",
      "fonction_contact",
      "terrain_contact_fonction"
    ]);

    if (nom && fonction) return `${nom}, ${fonction}`;
    return nom || fonction || "";
  }


  function texteSignal(signal = {}, resultat = {}) {
    return normaliserTexte([
      signal.titre,
      signal.resume_brut,
      signal.texte_original,
      signal.type_signal,
      signal.famille_projet,
      signal.secteur_detecte_label,
      signal.sous_secteur_detecte_label,
      resultat.raison_score,
      resultat.angle_commercial
    ].filter(Boolean).join(" "));
  }

  function contexteCle(signal = {}, resultat = {}, timing = {}, profil = "") {
    return [
      profil,
      signal.entreprise_nom || signal.entreprise || "",
      signal.titre || "",
      signal.type_signal || "",
      signal.origine_signal || signal.type_source || "",
      contactTerrainLabel(signal),
      timing.phase || "",
      resultat.score_pertinence || ""
    ].filter(Boolean).join("|");
  }

  function detecterContexte(signal = {}, resultat = {}, timing = {}) {
    const texte = texteSignal(signal, resultat);
    const type = normaliserTexte(signal.type_signal || resultat.type_signal || "");
    const has = (...mots) => mots.some(mot => texte.includes(normaliserTexte(mot)));

    const famille = normaliserTexte(signal.famille_projet || signal.famille_strategique || signal.famille_strategique_label || "");
    const projetLogistique = famille.includes("logistique") || has("logistique", "entrepot", "plateforme", "plate-forme", "flux");
    const qualite = type.includes("qualite") || famille.includes("qualite") || has("rappel", "contamination", "corps etranger", "incident qualite", "incident qualité", "retrait de vente", "particules metalliques", "particules métalliques");
    const terrain = signalOrigineTerrain(signal);
    const contactTerrain = contactTerrainLabel(signal);
    const annonce = has("annonce", "annoncee", "annonce", "prevoit", "va investir");
    const consultation = has("consultation", "appel d offres", "appel d offre", "demande de prix", "cahier des charges");
    const investissement = type.includes("investissement") || has("investissement", "millions", "m€", "modernisation", "extension", "agrandissement");
    const nouvelleLigne = type.includes("nouvelle_ligne") || has("nouvelle ligne", "ligne de production", "ligne de conditionnement", "nouvelle unite");
    const pharma = has("pharmaceutique", "pharma", "medicament", "sante");
    const agro = has("agroalimentaire", "alimentaire", "boisson", "proteines", "produits de la mer");
    const packaging = has("packaging", "emballage", "conditionnement", "etiquette", "impression", "carton", "film");
    const process = has("convoyage", "process", "automatisation", "robotisation", "dosage", "ensachage", "palettisation");

    return {
      texte,
      type,
      projetLogistique,
      qualite,
      annonce,
      consultation,
      investissement,
      nouvelleLigne,
      pharma,
      agro,
      packaging,
      process,
      terrain,
      contactTerrain,
      phase: timing?.phase || ""
    };
  }

  const PHRASES = {
    pourquoi: {
      logistique: [
        "Projet logistique : les enjeux de flux, traçabilité et montée en charge méritent une qualification rapide.",
        "La création ou l’évolution d’un site logistique peut ouvrir des besoins en automatisation, contrôle et intégration.",
        "Signal orienté flux : vérifier les équipements prévus pour sécuriser la cadence et la traçabilité."
      ],
      investissement: [
        "Investissement confirmé : période favorable pour identifier les choix techniques encore ouverts.",
        "Le budget annoncé laisse présager des besoins d’équipements, d’intégration ou de contrôle sur ligne.",
        "Une enveloppe d’investissement significative peut créer une fenêtre commerciale avant figement des fournisseurs.",
        "Montée en capacité probable : les équipements périphériques et contrôles qualité doivent être qualifiés."
      ],
      nouvelle_ligne: [
        "Nouvelle ligne identifiée : contexte favorable aux équipements de contrôle, inspection, pesage ou intégration.",
        "Une ligne neuve implique généralement plusieurs points de contrôle qualité et de sécurisation produit.",
        "Le projet semble lié à une capacité industrielle nouvelle : bon moment pour qualifier les choix techniques.",
        "Nouvelle implantation ou ligne : vérifier si les équipements de fin de ligne sont déjà spécifiés."
      ],
      qualite: [
        "Signal qualité : opportunité de discuter prévention, inspection, maîtrise des contaminants et sécurisation des lignes.",
        "Le contexte qualité peut déclencher des besoins de contrôle supplémentaires ou de renforcement des CCP.",
        "Un incident ou enjeu qualité rend la qualification technique plus prioritaire qu’une simple veille."
      ],
      annonce: [
        "Projet au stade annonce : intéressant, mais à qualifier avant de conclure que la consultation est ouverte.",
        "L’information est exploitable commercialement, sous réserve de confirmer calendrier, décideurs et périmètre technique.",
        "Signal prometteur : la priorité est d’identifier le bon interlocuteur et le niveau réel de maturité."
      ],
      generic: [
        "Signal industriel compatible avec le profil commercial : à transformer en échange de qualification.",
        "Le projet mérite une approche courte pour valider le besoin, le calendrier et les interlocuteurs.",
        "Information exploitable : elle indique un contexte industriel pouvant générer un besoin équipement."
      ]
    },

    vigilance: {
      geo: [
        "Géographie non déterminée : confirmer le site concerné avant toute action terrain.",
        "Localisation insuffisante : vérifier l’usine ou l’établissement réellement concerné par le projet.",
        "Site industriel à confirmer : ne pas prioriser fortement sans localisation fiable."
      ],
      amont: [
        "Projet encore amont : surveiller les prochains jalons avant action commerciale forte.",
        "Maturité encore limitée : rechercher un signe de consultation, budget validé ou planning travaux.",
        "Phase probablement précoce : privilégier une prise d’information plutôt qu’une approche commerciale appuyée."
      ],
      tard: [
        "Projet possiblement déjà attribué : chercher une extension, un lot complémentaire ou un besoin de remplacement.",
        "Fenêtre commerciale peut-être passée : vérifier si des équipements restent ouverts ou si un second lot existe.",
        "Attention au timing : l’intérêt dépendra d’un besoin complémentaire, SAV, extension ou standardisation future."
      ],
      logistique: [
        "Projet logistique : vérifier périmètre automatisation, flux internes, maintenance et lots techniques avant contact.",
        "Avant contact, confirmer les lots réellement ouverts : convoyage, tri, traçabilité, maintenance ou intégration.",
        "Ne pas supposer le besoin équipement : qualifier d’abord les flux, interfaces et fournisseurs déjà retenus."
      ],
      annonce: [
        "Projet au stade annonce : vérifier budget, calendrier, décideurs et ouverture fournisseurs.",
        "Annonce publique ne signifie pas consultation ouverte : confirmer la phase projet et les achats encore disponibles.",
        "Vérifier si les choix techniques sont déjà figés ou si le projet entre seulement en cadrage."
      ],
      secteur: [
        "Secteur à confirmer : qualifier le contexte métier avant de prioriser fortement.",
        "Spécialisation industrielle insuffisante : rester prudent et confirmer l’usage réel du site.",
        "Le secteur n’est pas assez documenté : éviter une lecture trop précise avant qualification."
      ],
      generic: [
        "Vérifier le calendrier réel, le périmètre technique et le bon interlocuteur avant contact.",
        "Confirmer les décideurs, le planning et les fournisseurs déjà consultés avant d’engager l’action.",
        "Ne pas présumer l’ouverture fournisseur : commencer par une qualification simple du projet."
      ]
    },

    action: {
      urgence: [
        "Agir vite : identifier {contact} et proposer un échange court sous 48 h.",
        "Priorité contact : joindre {contact} pour savoir si les choix équipements sont encore ouverts.",
        "Prendre une information rapide auprès de {contact} avant que le périmètre technique ne soit figé."
      ],
      ideal: [
        "Prendre contact maintenant avec {contact} avant le figement des choix techniques.",
        "Fenêtre favorable : qualifier le calendrier avec {contact} et identifier les fournisseurs déjà consultés.",
        "Initier un échange court avec {contact} pour comprendre planning, lots ouverts et décisionnaires."
      ],
      amont: [
        "Qualifier le projet avec {contact}, puis prévoir une relance structurée.",
        "Entrer en veille active : identifier {contact}, le jalon suivant et la date de relance utile.",
        "Prendre une première information légère avec {contact}, sans approche commerciale trop insistante."
      ],
      veille: [
        "Mettre le projet sous surveillance et chercher un prochain signal de maturité.",
        "Suivre les prochains jalons publics avant d’engager une action commerciale forte.",
        "Créer une veille projet et attendre un signal plus précis : consultation, travaux ou ligne confirmée."
      ],
      tard: [
        "Ne pas prioriser sauf besoin complémentaire, extension ou nouveau site.",
        "Approcher uniquement si une extension, un lot complémentaire ou un remplacement est plausible.",
        "Classer en suivi : intérêt commercial dépendant d’une phase 2 ou d’un besoin non couvert."
      ],
      logistique: [
        "Qualifier rapidement le projet avec {contact} : flux, automatisation, maintenance et lots techniques encore ouverts.",
        "Identifier {contact}, puis qualifier les besoins flux, convoyage, traçabilité et montée en charge du futur site.",
        "Vérifier auprès de {contact} quels lots logistiques ou automatisation restent à définir."
      ],
      generic: [
        "Qualifier le calendrier, les décideurs et le périmètre technique.",
        "Identifier le bon interlocuteur puis vérifier si le besoin équipement est encore ouvert.",
        "Préparer un premier échange centré sur planning, équipements, fournisseurs et contraintes qualité."
      ]
    },

    angle: {
      detection: {
        qualite: [
          "Quels contrôles contaminants ou points d’inspection doivent être renforcés après ce signal qualité ?",
          "Quels risques corps étrangers, contaminants ou défauts produit cherchez-vous à sécuriser sur vos lignes ?",
          "Les CCP et points de contrôle inspection sont-ils déjà définis ou encore ouverts ?"
        ],
        extension: [
          "Quels équipements de détection ou d’inspection devront être prévus dans cette extension industrielle ?",
          "Les points de contrôle qualité de la future extension sont-ils déjà spécifiés ?",
          "À quel stade sont les choix détection, rayons X ou inspection pour cette extension ?"
        ],
        ligne: [
          "Comment prévoyez-vous d’intégrer les points de détection ou inspection sur cette nouvelle ligne ?",
          "Les équipements de contrôle contaminants sont-ils déjà définis pour la ligne annoncée ?",
          "Quels points de contrôle qualité devront être intégrés avant la mise en production ?"
        ],
        generic: [
          "Quels points de contrôle qualité, détection ou inspection devront être intégrés dans ce projet ?",
          "Où en êtes-vous sur la définition des contrôles qualité en ligne ?",
          "Les besoins détection, rayons X ou inspection sont-ils déjà couverts par un fournisseur ?"
        ]
      },
      packaging: {
        generic: [
          "Avez-vous déjà défini les matériaux, formats, impressions, fournisseurs et contraintes de conditionnement ?",
          "Quels choix packaging restent ouverts : support, impression, contrôle qualité ou transformation ?",
          "Le projet implique-t-il une évolution des films, étiquettes, cartons, encres ou standards d’impression ?"
        ]
      },
      pesage: {
        generic: [
          "Comment allez-vous maîtriser le contrôle poids, l’étiquetage ou la traçabilité sur cette ligne ?",
          "Les besoins de pesage, contrôle pondéral et rejet sont-ils déjà spécifiés ?",
          "Quels points poids-prix, tolérances ou traçabilité restent à définir ?"
        ]
      },
      process: {
        generic: [
          "Quels sont les points sensibles de flux, convoyage, conditionnement et fin de ligne dans ce projet ?",
          "Quels équipements de process, convoyage ou fin de ligne restent à définir ?",
          "La cadence, les formats et l’intégration avec l’existant sont-ils déjà figés ?"
        ]
      },
      vision: {
        generic: [
          "Quels contrôles visuels, marquages ou lectures codes devront être sécurisés sur la ligne ?",
          "Les besoins vision, OCR, codes ou conformité étiquetage sont-ils déjà cadrés ?",
          "Quels défauts produit ou emballage devront être détectés automatiquement ?"
        ]
      },
      generic: [
        "Où en est le projet et quels choix techniques restent encore ouverts ?",
        "Quel est le calendrier réel et qui pilote les choix équipements ?",
        "Quels fournisseurs sont déjà consultés et quels lots restent à attribuer ?"
      ]
    }
  };

  const PHRASES_EXTERNES = bibliothequeExterneCopilote();
  const PHRASES_BASE = PHRASES;
  const PHRASES_ENRICHIES = fusionnerBibliotheques(PHRASES_BASE, PHRASES_EXTERNES);
  Object.keys(PHRASES_BASE).forEach(cle => { delete PHRASES_BASE[cle]; });
  Object.assign(PHRASES_BASE, PHRASES_ENRICHIES);

  function enrichirPourquoi(liste = [], signal = {}, resultat = {}, timing = {}, secteur = {}) {
    const contexte = detecterContexte(signal, resultat, timing);
    const cle = contexteCle(signal, resultat, timing, "pourquoi");
    const ajouts = [];

    if (contexte.terrain) ajouts.push(choisir(PHRASES.pourquoi.terrain, cle + "terrain"));
    if (contexte.projetLogistique) ajouts.push(choisir(PHRASES.pourquoi.logistique, cle));
    if (contexte.investissement) ajouts.push(choisir(PHRASES.pourquoi.investissement, cle + "inv"));
    if (contexte.nouvelleLigne) ajouts.push(choisir(PHRASES.pourquoi.nouvelle_ligne, cle + "ligne"));
    if (contexte.qualite) ajouts.push(choisir(PHRASES.pourquoi.qualite, cle + "qualite"));
    if (contexte.annonce && !contexte.consultation) ajouts.push(choisir(PHRASES.pourquoi.annonce, cle + "annonce"));
    if (!ajouts.length) ajouts.push(choisir(PHRASES.pourquoi.generic, cle + "generic"));

    return [...ajouts, ...(Array.isArray(liste) ? liste : [])].filter(Boolean);
  }

  function vigilance(signal = {}, resultat = {}, timing = {}, secteur = {}, defaut = "") {
    const contexte = detecterContexte(signal, resultat, timing);
    const cle = contexteCle(signal, resultat, timing, "vigilance");

    if (contexte.terrain) return choisir(PHRASES.vigilance.terrain, cle);
    if (!signal.region_nom && !signal.region && !signal.region_signal) return choisir(PHRASES.vigilance.geo, cle);
    if (timing?.phase === "veille_active_12_24_mois" || timing?.phase === "veille_longue_plus_24_mois") return choisir(PHRASES.vigilance.amont, cle);
    if (timing?.phase === "probablement_trop_tard") return choisir(PHRASES.vigilance.tard, cle);
    if (contexte.projetLogistique) return choisir(PHRASES.vigilance.logistique, cle);
    if (contexte.annonce && !contexte.consultation) return choisir(PHRASES.vigilance.annonce, cle);
    if (!secteur?.secteur) return choisir(PHRASES.vigilance.secteur, cle);
    return choisir(PHRASES.vigilance.generic, cle) || defaut;
  }

  function action(signal = {}, timing = {}, interlocuteurs = "", defaut = "") {
    const contexte = detecterContexte(signal, {}, timing);
    const premierContact = contexte.contactTerrain || String(interlocuteurs || "").split(";")[0]?.trim() || "le bon interlocuteur";
    const cle = contexteCle(signal, {}, timing, "action");
    let pool = PHRASES.action.generic;

    if (contexte.terrain) pool = PHRASES.action.terrain;
    else if (contexte.projetLogistique) pool = PHRASES.action.logistique;
    else if (timing?.phase === "urgence_0_3_mois") pool = PHRASES.action.urgence;
    else if (timing?.phase === "contact_ideal_3_6_mois") pool = PHRASES.action.ideal;
    else if (timing?.phase === "amont_6_12_mois") pool = PHRASES.action.amont;
    else if (timing?.phase === "veille_active_12_24_mois" || timing?.phase === "veille_longue_plus_24_mois") pool = PHRASES.action.veille;
    else if (timing?.phase === "probablement_trop_tard") pool = PHRASES.action.tard;

    return (choisir(pool, cle) || defaut).replaceAll("{contact}", premierContact);
  }

  function angle(profil = "", signal = {}, defaut = "") {
    const profilNormalise = normaliserTexte(profil).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const contexte = detecterContexte(signal, {}, {});
    const cle = contexteCle(signal, {}, {}, profilNormalise || "angle");

    if (profilNormalise === "detection") {
      if (contexte.qualite) return choisir(PHRASES.angle.detection.qualite, cle);
      if (contexte.investissement && !contexte.nouvelleLigne) return choisir(PHRASES.angle.detection.extension, cle);
      if (contexte.nouvelleLigne || contexte.process) return choisir(PHRASES.angle.detection.ligne, cle);
      return choisir(PHRASES.angle.detection.generic, cle) || defaut;
    }

    if (profilNormalise === "packaging") return choisir(PHRASES.angle.packaging.generic, cle) || defaut;
    if (profilNormalise === "pesage") return choisir(PHRASES.angle.pesage.generic, cle) || defaut;
    if (profilNormalise === "process") return choisir(PHRASES.angle.process.generic, cle) || defaut;
    if (profilNormalise === "vision") return choisir(PHRASES.angle.vision.generic, cle) || defaut;

    return choisir(PHRASES.angle.generic, cle) || defaut;
  }



  // =========================================================================
  // FLAIR V2026.1 — API métier Copilote externalisée
  // =========================================================================
  function createMetierApi(deps = {}) {
    const {
      normaliserTexteSimple = value => String(value || '').toLowerCase().trim(),
      dedoublonnerListeTexte = items => Array.from(new Set((items || []).filter(Boolean))),
      signalRegion = signal => signal?.region_nom || signal?.region || '',
      signalCompany = signal => signal?.entreprise_nom || signal?.entreprise || '',
      signalTitle = signal => signal?.titre || 'Signal industriel',
      profilCommercialActuel = () => '',
      getCopilotePhraseEngine = () => window.FLAIR_COPILOTE || null,
      nettoyerTexteQualiteHorsContexte = texte => texte,
      signalSemblePME = () => false,
      signalFamilleLogistique = () => false,
      signalFamilleQualite = () => false,
      signalFamilleProductionProjet = () => false,
      signalFamilleExtension = () => false,
      signalFamilleProcess = () => false,
      signalFamilleCapitalistique = () => false,
      signalMentionneImpressionPackaging = () => false,
      signalMentionnePesageControlePoids = () => false,
      signalMentionnePesageEtiquetage = () => false,
      signalMentionneRobotisation = () => false,
      signalMentionneFinLigne = () => false,
      signalMentionneProcessConditionnement = () => false,
      signalMentionneProcessConvoyage = () => false
    } = deps;


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
        ajouter('Directeur général', 'vision d’intégration et décisions rapides');
        ajouter('Directeur industriel', 'harmonisation sites, équipements et CAPEX');
        ajouter('Responsable achats', 'référencement fournisseurs et contrats groupe');
        if (profil === 'packaging') {
          ajouter('Directeur packaging', 'standardisation des supports, décors, fournisseurs et cahiers des charges');
          ajouter('Responsable impression / transformation', 'hélio, flexo, complexage, encres, vernis et contrôle impression');
        }
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
        ajouter('Responsable packaging', 'matériaux, supports, essais et spécifications');
        ajouter('Responsable production', 'faisabilité industrielle, cadence et contraintes atelier');
        if (signalMentionneImpressionPackaging(signal)) {
          ajouter('Responsable impression', 'hélio, flexo, encres, vernis et qualité d’impression');
          ajouter('Responsable transformation / complexage', 'complexage, contre-collage, finition et performance support');
          ajouter('Responsable prépresse / méthodes impression', 'fichiers, clichés, cylindres, repérage couleur et essais');
          ajouter('Responsable qualité impression', 'défauts visuels, conformité décor et contrôle impression');
        }
        if (signalFamilleCapitalistique(signal)) {
          ajouter('Directeur packaging', 'harmonisation post-rachat des gammes, fournisseurs et standards');
          ajouter('Responsable achats groupe', 'renégociation fournisseurs et standardisation des consommables');
        }
        ajouter('Achats packaging', 'consultation fournisseurs et consommables');
        ajouter('Responsable achats', 'budget et contractualisation');
        ajouter('Directeur industriel', 'arbitrage projet, investissements et standardisation');
      } else if (profil === 'pesage') {
        if (signalMentionnePesageControlePoids(signal)) {
          ajouter('Responsable qualité', 'conformité poids, préemballés, tolérances et traçabilité');
          ajouter('Responsable production', 'cadence, formats et contrôle pondéral en ligne');
          ajouter('Responsable méthodes', 'intégration trieuse, rejet et statistiques poids');
          ajouter('Responsable maintenance', 'fiabilité trieuse, convoyage et disponibilité');
          ajouter('Responsable métrologie', 'vérification réglementaire et suivi des équipements');
        } else if (signalMentionnePesageEtiquetage(signal)) {
          ajouter('Responsable étiquetage / conditionnement', 'poids-prix, impression-pose, données et formats');
          ajouter('Responsable qualité', 'traçabilité, conformité étiquettes et données poids');
          ajouter('Responsable production', 'cadence, flux et intégration ligne');
          ajouter('Responsable méthodes', 'standardisation et intégration');
          ajouter('Responsable maintenance', 'fiabilité équipements et imprimantes');
        } else {
          ajouter('Responsable qualité', 'conformité poids et traçabilité');
          ajouter('Responsable production', 'cadence et contrôle en ligne');
          ajouter('Responsable méthodes', 'standardisation et intégration');
          ajouter('Responsable maintenance', 'fiabilité équipements');
          ajouter('Responsable amélioration continue', 'pertes, écarts et performance');
        }
      } else if (profil === 'vision') {
        ajouter('Responsable qualité', 'défauts visibles et preuves de contrôle');
        ajouter('Responsable production', 'contrôle en ligne et cadence');
        ajouter('Responsable automatisme', 'intégration caméra, éclairage et communication');
        ajouter('Responsable maintenance', 'réglages et disponibilité');
        ajouter('Directeur industriel', 'arbitrage équipement');
      } else if (profil === 'process') {
        if (signalMentionneRobotisation(signal)) {
          ajouter('Responsable automatisme', 'robotisation, interfaces, sécurité machine et supervision');
          ajouter('Responsable méthodes', 'cellule robotisée, implantation et temps de cycle');
          ajouter('Responsable production', 'opérations à automatiser, cadence et ergonomie');
          ajouter('Responsable maintenance', 'disponibilité, essais et maintenance robot');
          ajouter('Directeur industriel', 'CAPEX robotisation et priorité projet');
        } else if (signalMentionneFinLigne(signal)) {
          ajouter('Responsable production', 'fin de ligne, formats cartons/palettes et cadence');
          ajouter('Responsable méthodes', 'implantation palettisation, banderolage et flux sortants');
          ajouter('Responsable maintenance', 'disponibilité palettiseur, convoyeurs et sécurité');
          ajouter('Responsable logistique', 'flux palettes, expédition et contraintes entrepôt');
          ajouter('Directeur industriel', 'arbitrage CAPEX fin de ligne');
        } else if (signalMentionneProcessConditionnement(signal)) {
          ajouter('Responsable conditionnement', 'ensachage, remplissage, dosage et formats');
          ajouter('Responsable production', 'cadence, alimentation produit et changements de format');
          ajouter('Responsable méthodes', 'intégration ligne et standardisation');
          ajouter('Responsable maintenance', 'fiabilité équipements et disponibilité');
          ajouter('Responsable automatisme', 'interfaces, supervision et communication ligne');
        } else if (signalMentionneProcessConvoyage(signal)) {
          ajouter('Responsable production', 'flux, cadence, accumulation et ergonomie ligne');
          ajouter('Responsable méthodes', 'implantation convoyeurs, transferts et guidage produit');
          ajouter('Responsable maintenance', 'fiabilité convoyeurs et disponibilité');
          ajouter('Responsable automatisme', 'interfaces, capteurs et supervision');
          ajouter('Directeur industriel', 'CAPEX et priorité projet');
        } else {
          ajouter('Responsable production', 'flux, cadence et ergonomie ligne');
          ajouter('Responsable méthodes', 'implantation et standardisation');
          ajouter('Responsable maintenance', 'fiabilité et disponibilité');
          ajouter('Responsable automatisme', 'interfaces et supervision');
          ajouter('Directeur industriel', 'CAPEX et priorité projet');
        }
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
      const copiloteEngine = getCopilotePhraseEngine();
      if (copiloteEngine && typeof copiloteEngine.angle === 'function') {
        const angleVariante = copiloteEngine.angle(profil, signal, '');
        if (angleVariante) return angleVariante;
      }

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
        if (signalFamilleCapitalistique(signal)) return 'Le rachat, la fusion ou le regroupement va-t-il entraîner une harmonisation des supports, impressions, fournisseurs packaging, standards qualité ou lignes de transformation ?';
        if (signalMentionneImpressionPackaging(signal)) return 'Quels besoins d’impression, hélio, flexo, complexage, encres, vernis, prépresse ou contrôle impression sont liés à ce projet packaging ?';
        return 'Avez-vous déjà défini les matériaux, formats, impressions, fournisseurs et contraintes de conditionnement pour ce projet ?';
      }
      if (profil === 'pesage') {
        if (signalMentionnePesageControlePoids(signal)) return 'Comment allez-vous maîtriser le contrôle pondéral, les tolérances, le rejet et la traçabilité poids sur cette ligne ?';
        if (signalMentionnePesageEtiquetage(signal)) return 'Comment allez-vous gérer le pesage, l’impression-pose, les données poids-prix et la conformité des étiquettes ?';
        return 'Comment allez-vous maîtriser le contrôle poids, l’étiquetage ou la traçabilité sur cette ligne ?';
      }
      if (profil === 'vision') return 'Quels contrôles visuels, marquages ou lectures codes devront être sécurisés sur la ligne ?';
      if (profil === 'process') {
        if (signalMentionneRobotisation(signal)) return 'Quelles opérations souhaitez-vous robotiser et quels choix restent ouverts sur la cellule, les interfaces et la sécurité machine ?';
        if (signalMentionneFinLigne(signal)) return 'Quels sont les points sensibles de fin de ligne : encaisseuse, palettisation, banderolage, formats, cadence et flux palettes ?';
        if (signalMentionneProcessConditionnement(signal)) return 'Quels équipements de conditionnement, dosage, ensachage ou mise en carton restent à définir dans ce projet ?';
        if (signalMentionneProcessConvoyage(signal)) return 'Quels sont les points sensibles de convoyage, accumulation, transfert produit et intégration avec les équipements existants ?';
        return 'Quels sont les points sensibles de flux, convoyage, conditionnement et fin de ligne dans ce projet ?';
      }

      if (secteur.includes('plasturgie') || sous.includes('extrusion')) return 'Quels points de contrôle, de flux ou de qualité sont critiques sur cette ligne plastique ?';
      if (secteur.includes('bois')) return 'Quels sont les points sensibles de flux, contrôle ou manutention sur votre ligne bois ?';

      return 'Où en est le projet et quels équipements de ligne sont encore à définir ?';
    }

    function prochaineActionCopilote(signal = {}, timing = {}, interlocuteurs = '') {
      const copiloteEngine = getCopilotePhraseEngine();
      if (copiloteEngine && typeof copiloteEngine.action === 'function') {
        const actionVariante = copiloteEngine.action(signal, timing, interlocuteurs, '');
        if (actionVariante) return actionVariante;
      }

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

      const copiloteEngine = getCopilotePhraseEngine();
      const phrasesEnrichies = copiloteEngine && typeof copiloteEngine.enrichirPourquoi === 'function'
        ? copiloteEngine.enrichirPourquoi(phrases, signal, resultat, timing, secteur)
        : phrases;

      return dedoublonnerListeCopilote(phrasesEnrichies).slice(0, 8);
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
      const copiloteEngine = getCopilotePhraseEngine();
      if (copiloteEngine && typeof copiloteEngine.vigilance === 'function') {
        const vigilanceVariante = copiloteEngine.vigilance(signal, resultat, timing, secteur, '');
        if (vigilanceVariante) return vigilanceVariante;
      }

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

    return {
      interlocuteursPourProfil,
      questionAnglePourProfil,
      prochaineActionCopilote,
      preparerCopiloteCommercial,
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
      lireCopiloteCommercialJson
    };
  }

  window.FLAIR_COPILOTE = {
    PHRASES,
    choisir,
    enrichirPourquoi,
    vigilance,
    action,
    angle,
    createMetierApi
  };
})();
