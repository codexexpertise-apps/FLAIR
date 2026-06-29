// =========================
// FLAIR — SOURCE VEILLE RULES V3.3
// =========================
// Référentiel métier complémentaire du moteur app.js.
// Note V3.3 : ajout d’une couche familles de projets sans modifier le scoring.
// Note V3.2 : l’affinité géographique/métier est appliquée côté app.js, dans signaux_commerciaux.
// Rôle : enrichir le scoring avec une lecture industrielle plus fine.
// Limite volontaire : aucun appel Supabase, aucune logique UI, aucune IA générative.
//
// Doctrine :
// - app.js reste le moteur applicatif et décide du score final ;
// - ce fichier apporte des bonus métier, des scénarios et des recommandations ;
// - les règles ci-dessous préparent une future IA en explicitant la façon de penser FLAIR.
//
// Lecture cible : Secteur industriel → Profil métier → Sous-profil technique → Compatibilité commerciale.
//
// Structure métier cible :
// - secteurs : contexte industriel du signal ;
// - profils_metiers : familles commerciales principales utilisées par FLAIR ;
// - sous_profils_metiers : technologies / solutions concernées derrière chaque profil ;
// - intensite_metier : pondération indicative pour préparer un Top 3 personnalisé par commercial.

(function () {
  "use strict";


  // =========================
  // TAXONOMIE MÉTIER FLAIR
  // =========================
  // Objectif : séparer clairement les SECTEURS industriels des MÉTIERS commerciaux.
  // Les secteurs changent selon le marché ; les technologies restent souvent transversales.
  // Exemple : une ligne agro, pharma, cosmétique, bois ou textile peut nécessiter
  // convoyage, conditionnement, détection, vision, pesage, étiquetage et palettisation.
  // =========================
  // TIMING COMMERCIAL FLAIR V2
  // =========================
  // Ces fenêtres préparent la future collecte IA :
  // l'IA devra repérer les indices de maturité projet puis alimenter ces champs.
  const FLAIR_TIMING_COMMERCIAL = {
    urgence_0_3_mois: {
      fenetre: "0-3 mois — agir vite",
      score: 96,
      impact_score: 22,
      intention: "Consultation, chantier, installation, démarrage, mise en service proche ou urgence qualité."
    },
    contact_ideal_3_6_mois: {
      fenetre: "3-6 mois — prise de contact idéale",
      score: 90,
      impact_score: 16,
      intention: "Projet validé, nouvelle ligne proche, installation prévue ou préparation de consultation."
    },
    amont_6_12_mois: {
      fenetre: "6-12 mois — se positionner en amont",
      score: 68,
      impact_score: 4,
      intention: "Projet annoncé, investissement ou nouvelle ligne encore à qualifier."
    },
    veille_active_12_24_mois: {
      fenetre: "12-24 mois — veille active",
      score: 42,
      impact_score: -8,
      intention: "Projet encore amont, à suivre."
    },
    veille_longue_plus_24_mois: {
      fenetre: ">24 mois — veille lointaine",
      score: 18,
      impact_score: -14,
      intention: "Horizon stratégique long."
    },
    probablement_trop_tard: {
      fenetre: "Déjà trop tard",
      score: 8,
      impact_score: -18,
      intention: "Projet attribué, inauguré ou déjà opérationnel."
    }
  };


  // =========================
  // SOURCES VEILLE — CADRE COMPATIBILITÉ SUPABASE
  // =========================
  // La contrainte actuelle observée sur sources_veille.frequence_scan accepte :
  // - daily : veille régulière / collecte quotidienne ou hebdomadaire opérée manuellement
  // - manual : source ajoutée ou exploitée manuellement
  // Ne pas utiliser weekly/monthly dans les INSERT SQL tant que la contrainte Supabase
  // n'a pas été élargie.
  const FLAIR_SOURCES_VEILLE_FREQUENCES_AUTORISEES = ["daily", "manual"];

  const FLAIR_SOURCES_SPECIALISEES_RECOMMANDEES = {
    industrie_transverse: [
      "L'Usine Nouvelle",
      "L'Usine Nouvelle - Quotidien des Usines",
      "Techniques de l'Ingénieur - Actualité"
    ],
    agroalimentaire: [
      "Process Alimentaire",
      "Process Alimentaire - Qualité",
      "Process Alimentaire - Emballage",
      "Agro Media"
    ],
    packaging_impression: [
      "Graphiline",
      "Emballages Magazine",
      "Info Carton",
      "Pack & Label Around",
      "Labels & Labeling"
    ],
    process_logistique_robotique: [
      "Voxlog",
      "Supply Chain Village",
      "L'Usine Nouvelle - Quotidien des Usines"
    ],
    pharma_cosmetique: [
      "L'Usine Nouvelle - Santé Pharma",
      "ActuLabo",
      "Leem"
    ],
    institutionnelles: [
      "DRAAF",
      "Choose France",
      "Business France"
    ]
  };

  const FLAIR_SECTEURS_SOUS_SECTEURS_CIBLES = {
    agroalimentaire: [
      "Viande / salaison",
      "Produits de la mer / poisson",
      "Produits laitiers / fromages",
      "Plats cuisinés / traiteur frais",
      "Snacking / sandwichs / salades",
      "Boulangerie / biscuiterie / viennoiserie",
      "Fruits transformés / compotes / confitures",
      "Fruits et légumes / stations de conditionnement",
      "Boissons / sirops / liquides alimentaires",
      "Produits végétaux / alternatives"
    ],
    pharma: [
      "Formes sèches / comprimés",
      "Formes liquides / injectables",
      "CDMO / sous-traitance pharma",
      "Conditionnement pharma",
      "Dispositifs médicaux / conditionnement stérile"
    ],
    cosmetique: [
      "Fabrication cosmétique",
      "Conditionnement cosmétique",
      "Parfumerie / flaconnage",
      "Crèmes / soins / maquillage"
    ],
    plasturgie: [
      "Extrusion / film plastique",
      "Injection / thermoformage",
      "Films techniques / barrière",
      "Recyclage plastique / tri matière"
    ],
    packaging: [
      "Films souples / flowpack / sachets",
      "Operculage / thermoformage / barquettes / skin pack",
      "Carton / étuis / caisses / conditionnement secondaire",
      "Étiquettes / sleeves / traçabilité / marquage",
      "Impression packaging / hélio / rotogravure",
      "Impression flexo / impression bobine",
      "Complexage / contre-collage / lamination",
      "Finition / vernis / encres / dorure",
      "Prépresse / cylindres / clichés / repérage couleur",
      "Contrôle impression / défauts visuels / conformité décor"
    ],
    bois: ["Scierie / panneaux / palettes", "Menuiserie industrielle", "Lignes bois automatisées"],
    textile: ["Textile technique / non-tissé", "Recyclage textile", "Confection industrielle"],
    chimie: ["Process chimique / poudres", "Conditionnement chimique / liquides"],
    logistique: ["Plateforme / flux internes", "Préparation de commandes / automatisation"]
  };

  const FLAIR_PROFILS_METIER_ALIASES = {
    detection_metaux: 'detection',
    detecteur_metaux: 'detection',
    rayons_x: 'detection',
    rayon_x: 'detection',
    chimie_logistique: 'process',
    batiment_industriel: 'process',
    emballage: 'packaging',
    vision_industrielle: 'vision',
    convoyage: 'process',
    convoyeur: 'process',
    ligne_convoyage: 'process',
    conditionnement: 'process',
    ensachage: 'process',
    fin_de_ligne: 'process',
    palettisation: 'process',
    robotisation: 'process',
    automatisation: 'process',
    controle_poids: 'pesage',
    controle_ponderal: 'pesage',
    tri_ponderal: 'pesage',
    pesee: 'pesage',
    etiquetage: 'pesage'
  };

  const FLAIR_TAXONOMIE_METIER = {
    secteurs_industriels: [
      "industrie",
      "agroalimentaire",
      "pharma",
      "cosmetique",
      "plasturgie",
      "bois",
      "textile",
      "logistique",
      "qualite"
    ],

    profils_metiers: {
      detection: {
        label: "Détection / contrôle qualité",
        sous_profils: ["detecteur_metaux", "rayon_x"]
      },
      pesage: {
        label: "Pesage / contrôle poids / étiquetage industriel",
        sous_profils: [
          "balance",
          "pesage_industriel",
          "pesage_dynamique",
          "pesage_statique",
          "controle_poids",
          "controle_ponderal",
          "tri_ponderal",
          "checkweigher",
          "poids_moyen",
          "preemballes",
          "tu1_tu2",
          "tne",
          "etiquetage",
          "impression_pose",
          "poids_prix",
          "tracabilite_poids",
          "metrologie",
          "verification_reglementaire"
        ]
      },
      packaging: {
        label: "Packaging / films / impression / étiquettes / carton",
        sous_profils: [
          "films",
          "emballage_souple",
          "film_complexe",
          "thermoformage",
          "flowpack",
          "operculage",
          "sachet",
          "barquette",
          "boite",
          "etui",
          "carton",
          "conditionnement_secondaire",
          "etiquettes",
          "sleeves",
          "marquage",
          "impression_packaging",
          "impression",
          "helio",
          "heliogravure",
          "rotogravure",
          "flexo",
          "flexographie",
          "pre_presse",
          "cliche_flexo",
          "cylindre_helio",
          "complexage",
          "contre_collage",
          "lamination",
          "finition",
          "vernis",
          "encres",
          "dorure",
          "pelliculage",
          "controle_impression"
        ]
      },
      vision: {
        label: "Vision industrielle / contrôle qualité",
        sous_profils: [
          "presence_absence",
          "controle_etiquette",
          "ocr",
          "lecture_code",
          "controle_aspect"
        ]
      },
      process: {
        label: "Process / convoyage / conditionnement / fin de ligne",
        sous_profils: [
          "convoyage",
          "convoyeur",
          "ligne_convoyage",
          "transport_interne",
          "manutention",
          "guidage_produit",
          "accumulation",
          "transfert_produit",
          "conditionnement",
          "ensachage",
          "remplissage",
          "dosage",
          "mise_en_carton",
          "mise_en_caisse",
          "encaissage",
          "etuyage",
          "fin_de_ligne",
          "palettisation",
          "depalettisation",
          "banderolage",
          "filmage_palette",
          "houssage",
          "robotique",
          "robotisation",
          "cobot",
          "cellule_robotisee",
          "picking_robotise",
          "automatisme",
          "automatisation",
          "industrialisation",
          "travaux_neufs",
          "logistique_interne"
        ]
      }
    }
  };


  // =========================
  // FAMILLES PROJETS — ANTI-DOUBLON V1
  // =========================
  // Objectif : identifier qu'un nouveau signal appartient probablement à un projet
  // déjà détecté, sans jamais supprimer ni masquer le signal.
  // Ces listes doivent rester simples et modifiables à l'usage.
  const FLAIR_FAMILLES_PROJETS = {
    extension: {
      label: "Extension / capacité industrielle",
      keywords: [
        "extension",
        "agrandissement",
        "nouvelle usine",
        "nouveau site",
        "augmentation capacité",
        "augmentation de capacité",
        "augmentation capacite",
        "augmentation de capacite",
        "augmente sa capacité",
        "augmente sa capacite",
        "augmente fortement sa capacité",
        "augmente fortement sa capacite",
        "capacité de production",
        "capacite de production",
        "augmentation de production",
        "augmentation production",
        "hausse de production",
        "montee en cadence",
        "montée en cadence",
        "capacité industrielle",
        "capacite industrielle",
        "accroissement de capacité",
        "accroissement de capacite",
        "hausse de capacité",
        "hausse de capacite",
        "doublement capacité",
        "doublement capacite",
        "doublement de capacité",
        "doublement de capacite",
        "nouvel atelier",
        "nouveau bâtiment",
        "nouveau batiment",
        "bâtiment industriel",
        "batiment industriel",
        "construction d'un nouveau bâtiment",
        "construction d un nouveau batiment",
        "capacités de production",
        "capacites de production"
      ]
    },

    logistique: {
      label: "Logistique / entrepôt / distribution",
      keywords: [
        "entrepôt",
        "entrepot",
        "plateforme logistique",
        "plate-forme logistique",
        "centre logistique",
        "centre de distribution",
        "hub logistique",
        "site logistique",
        "base logistique",
        "stockage",
        "préparation de commandes",
        "preparation de commandes",
        "flux logistiques",
        "flux logistique",
        "logistique",
        "distribution",
        "supply chain",
        "automatisation d'entrepôt",
        "automatisation entrepot",
        "robotisation entrepôt",
        "robotisation entrepot",
        "tri colis",
        "convoyage colis",
        "préparateurs de commandes",
        "preparateurs de commandes"
      ]
    },

    rh_recrutement: {
      label: "RH / recrutement industriel",
      keywords: [
        "recrute",
        "recrutement",
        "embauche",
        "embauches",
        "création d'emplois",
        "creation d'emplois",
        "emplois créés",
        "emplois crees",
        "conducteur de ligne",
        "conducteurs de ligne",
        "opérateur de production",
        "operateur de production",
        "technicien maintenance",
        "techniciens maintenance",
        "responsable maintenance",
        "responsable production",
        "responsable qualité",
        "responsable qualite",
        "équipe de nuit",
        "equipe de nuit",
        "nouvelle équipe",
        "nouvelle equipe",
        "chef d'équipe",
        "chef d equipe"
      ]
    },

    qualite: {
      label: "Qualité / contamination / rappel",
      keywords: [
        "rappel produit",
        "rappel de lot",
        "rappel lots",
        "contamination",
        "corps étranger",
        "corps etranger",
        "corps étrangers",
        "corps etrangers",
        "particules métalliques",
        "particules metalliques",
        "particules de métal",
        "particules de metal",
        "présence de métal",
        "presence de metal",
        "contaminant",
        "contaminants",
        "risque de contamination",
        "retrait de vente",
        "retiré de la vente",
        "retire de la vente"
      ]
    },

    packaging: {
      label: "Packaging / impression / emballage",
      keywords: [
        "nouveau film",
        "nouveaux films",
        "nouvel emballage",
        "nouveaux emballages",
        "changement matériau",
        "changement materiau",
        "changement de support",
        "carton d'emballage",
        "carton emballage",
        "conditionnement secondaire",
        "étui carton",
        "etui carton",
        "film barrière",
        "film barriere",
        "film complexe",
        "film imprimé",
        "film imprime",
        "film recyclable",
        "emballage recyclable",
        "eco-conception",
        "éco-conception",
        "barquette",
        "sachet",
        "opercule",
        "operculage",
        "thermoformage",
        "flowpack",
        "étiquette",
        "etiquette",
        "étiquetage",
        "etiquetage",
        "sleeve",
        "sleeves",
        "marquage",
        "codage",
        "impression packaging",
        "imprimerie packaging",
        "impression emballage",
        "impression d'emballages",
        "impression d’emballages",
        "impression hélio",
        "impression helio",
        "héliogravure",
        "heliogravure",
        "rotogravure",
        "impression flexo",
        "flexographie",
        "flexo",
        "complexage",
        "contre-collage",
        "contre collage",
        "lamination",
        "pelliculage",
        "finition",
        "vernis",
        "vernis technique",
        "encres",
        "encres alimentaires",
        "prépresse",
        "pre-presse",
        "pre presse",
        "cliché flexo",
        "cliche flexo",
        "cylindre hélio",
        "cylindre helio",
        "repérage couleur",
        "reperage couleur",
        "contrôle impression",
        "controle impression",
        "défaut d'impression",
        "defaut d'impression"
      ]
    },

    capitalistique: {
      label: "Rachat / fusion / changement d’actionnaire",
      keywords: [
        "rachat",
        "rachète",
        "rachete",
        "a racheté",
        "a rachete",
        "être racheté",
        "etre rachete",
        "acquisition",
        "acquiert",
        "acquérir",
        "acquerir",
        "croissance externe",
        "fusion",
        "fusionne",
        "fusion-acquisition",
        "rapprochement",
        "regroupement",
        "regroupe",
        "regroupement de sites",
        "consolidation",
        "intégration au groupe",
        "integration au groupe",
        "intègre le groupe",
        "integre le groupe",
        "rejoint le groupe",
        "prise de participation",
        "participation majoritaire",
        "participation minoritaire",
        "entrée au capital",
        "entree au capital",
        "investit au capital",
        "fonds d'investissement",
        "fonds d’investissement",
        "capital-investissement",
        "private equity",
        "LBO",
        "MBO",
        "changement d'actionnaire",
        "changement d’actionnaire",
        "nouvel actionnaire",
        "nouveaux actionnaires",
        "cession",
        "cède",
        "cede",
        "transmission",
        "reprise",
        "reprend",
        "repreneur",
        "nouvelle direction",
        "nouveau dirigeant",
        "nouvelle gouvernance",
        "nomination d'un directeur général",
        "nomination d’un directeur général",
        "nouveau directeur général",
        "nouveau president",
        "nouveau président"
      ]
    },

    process: {
      label: "Process / convoyage / conditionnement / fin de ligne",
      keywords: [
        "nouvelle ligne",
        "nouvelles lignes",
        "ligne de production",
        "lignes de production",
        "ligne de conditionnement",
        "ligne automatisée",
        "ligne automatisee",
        "nouvelle ligne automatisée",
        "nouvelle ligne automatisee",
        "ligne process",
        "îlot de production",
        "ilot de production",
        "îlot automatisé",
        "ilot automatise",
        "convoyage",
        "convoyeur",
        "convoyeurs",
        "ligne de convoyage",
        "tapis convoyeur",
        "tapis roulant",
        "bande transporteuse",
        "transport interne",
        "manutention continue",
        "accumulation",
        "table d'accumulation",
        "table accumulation",
        "transfert produit",
        "transfert produits",
        "guidage produit",
        "flux de transfert",
        "flux internes",
        "séquençage",
        "sequencage",
        "conditionnement",
        "ensachage",
        "ensacheuse",
        "remplissage",
        "remplisseuse",
        "doseuse",
        "dosage",
        "mise en carton",
        "mise en caisse",
        "étuyage",
        "etuyage",
        "encaisseuse",
        "encaissage",
        "formeuse de cartons",
        "fermeuse de cartons",
        "fin de ligne",
        "ligne fin de ligne",
        "palettisation",
        "palettiseur",
        "dépalettisation",
        "depalettisation",
        "dépalettiseur",
        "depalettiseur",
        "banderolage",
        "banderoleuse",
        "filmage palette",
        "filmeuse palette",
        "houssage",
        "préparation expédition",
        "preparation expedition",
        "robot",
        "robots",
        "robotisation",
        "robotisé",
        "robotise",
        "cobot",
        "cobots",
        "bras robotisé",
        "bras robotise",
        "cellule robotisée",
        "cellule robotisee",
        "picking robotisé",
        "picking robotise",
        "manutention robotisée",
        "manutention robotisee",
        "automatisation",
        "automatisation industrielle",
        "automatisme",
        "travaux neufs",
        "industrialisation",
        "modernisation de ligne",
        "optimisation process"
      ]
    }
  };

  const FLAIR_SOURCE_VEILLE_RULES = [
    {
      id: "agro_ingredients_produits_deshydrates",
      label: "Agroalimentaire / ingrédients & produits déshydratés",
      couche: "bonus_metier",
      profils_metiers: ["detection", "process", "packaging", "pesage", "vision"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        process: ["convoyage", "automatisme"],
        packaging: ["sachet", "etiquettes"],
        pesage: ["tri_ponderal"],
        vision: ["controle_etiquette"]
      },
      intensite_metier: { detection: 0.78, process: 0.72, packaging: 0.58, pesage: 0.5, vision: 0.45 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "ingrédients alimentaires", "ingredients alimentaires",
        "produits alimentaires déshydratés", "produits alimentaires deshydrates",
        "produit alimentaire déshydraté", "produit alimentaire deshydrate",
        "déshydratation alimentaire", "deshydratation alimentaire",
        "produits déshydratés", "produits deshydrates",
        "ingrédients déshydratés", "ingredients deshydrates"
      ],
      score_bonus: 14,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Activité alimentaire ou ingrédients déshydratés : classification générique retenue sans inventer de sous-secteur trop précis.",
      opportunite: "Qualifier les besoins de contrôle contaminants, inspection, pesage et intégration sur les lignes.",
      action: "Identifier production, qualité et maintenance pour qualifier le projet."
    },
    // =========================
    // D.1 — SECTEURS / SOUS-SECTEURS ENRICHIS
    // Règles sectorielles génériques : pas de marques dans les mots-clés.
    // Ces règles affinent la lecture sectorielle sans modifier l'architecture FLAIR.
    // =========================
    {
      id: "agro_fruits_transformes",
      label: "Agroalimentaire / fruits transformés",
      couche: "bonus_metier",
      profils_metiers: ["detection", "packaging", "pesage", "vision", "process"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        packaging: ["operculage", "sachet", "etiquettes"],
        pesage: ["tri_ponderal", "etiquetage"],
        vision: ["controle_etiquette", "lecture_code"],
        process: ["convoyage", "automatisme"]
      },
      intensite_metier: { detection: 0.82, packaging: 0.72, pesage: 0.6, vision: 0.55, process: 0.65 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["compote", "compotes", "confiture", "confitures", "dessert fruitier", "desserts fruitiers", "fruits transformés", "fruits transformes", "purée de fruits", "puree de fruits"],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Site agroalimentaire de transformation fruitière : besoin probable de contrôle qualité, traçabilité et sécurisation de ligne.",
      opportunite: "Qualifier les points de contrôle contaminants, poids, étiquetage et conditionnement sur les futures lignes.",
      action: "Identifier qualité, production, maintenance et conditionnement pour qualifier le projet."
    },
    {
      id: "agro_produits_mer",
      label: "Agroalimentaire / produits de la mer",
      couche: "bonus_metier",
      profils_metiers: ["detection", "packaging", "vision", "pesage", "process"],
      sous_profils_metiers: { detection: ["rayon_x", "detecteur_metaux"], packaging: ["films", "operculage"], vision: ["controle_aspect"], pesage: ["tri_ponderal"], process: ["convoyage"] },
      intensite_metier: { detection: 0.88, packaging: 0.76, vision: 0.62, pesage: 0.62, process: 0.62 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["poisson", "poissons", "produits de la mer", "produit de la mer", "surimi", "pané de poisson", "pane de poisson", "panés de poisson", "panes de poisson", "filet de poisson", "filets de poisson", "saumon", "thon", "arête", "arete"],
      score_bonus: 20, chaleur: "tiede", type_signal: "investissement",
      raison: "Produits de la mer : contexte favorable au contrôle contaminants, arêtes, conformité poids et conditionnement.",
      opportunite: "Explorer détection, rayons X, pesage et inspection fin de ligne.",
      action: "Approcher qualité et production avec un angle sécurisation produit."
    },
    {
      id: "agro_snacking_traiteur",
      label: "Agroalimentaire / snacking & traiteur frais",
      couche: "bonus_metier",
      profils_metiers: ["detection", "packaging", "pesage", "vision", "process"],
      sous_profils_metiers: { detection: ["detecteur_metaux", "rayon_x"], packaging: ["flowpack", "films", "etiquettes"], pesage: ["tri_ponderal", "etiquetage"], vision: ["controle_etiquette", "controle_aspect"], process: ["convoyage", "automatisme"] },
      intensite_metier: { detection: 0.86, packaging: 0.86, pesage: 0.72, vision: 0.66, process: 0.68 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["traiteur frais", "plats cuisinés", "plats cuisines", "plat cuisiné", "plat cuisine", "snacking", "sandwich", "sandwichs", "wrap", "wraps", "salades composées", "salades composees", "barquette repas", "prêt à manger", "pret a manger"],
      score_bonus: 22, chaleur: "chaud", type_signal: "nouvelle_ligne",
      raison: "Traiteur frais / snacking : lignes rapides avec enjeux de détection, étiquetage, poids et conditionnement.",
      opportunite: "Qualifier la future ligne : détection, rayons X, tri pondéral, vision étiquette et packaging.",
      action: "Contacter qualité ou production avec un angle ligne complète et contrôle fin de ligne."
    },
    {
      id: "pharma_cosmetique_conditionnement",
      label: "Pharma / cosmétique / conditionnement réglementé",
      couche: "bonus_metier",
      profils_metiers: ["vision", "detection", "pesage", "packaging", "process"],
      sous_profils_metiers: { vision: ["ocr", "lecture_code", "controle_etiquette"], detection: ["rayon_x", "detecteur_metaux"], pesage: ["balance", "etiquetage"], packaging: ["etiquettes", "sleeves"], process: ["convoyage", "automatisme"] },
      intensite_metier: { vision: 0.82, detection: 0.7, pesage: 0.68, packaging: 0.62, process: 0.6 },
      secteur: ["pharma", "cosmetique"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["pharma", "pharmaceutique", "cdmo", "cosmétique", "cosmetique", "salle blanche", "conditionnement stérile", "conditionnement sterile", "flaconnage", "blister", "traçabilité", "tracabilite"],
      score_bonus: 16, chaleur: "tiede", type_signal: "investissement",
      raison: "Secteur réglementé : besoins fréquents de traçabilité, contrôle code, inspection, pesage et sécurisation de ligne.",
      opportunite: "Qualifier les exigences de contrôle, traçabilité et validation ligne.",
      action: "Cibler qualité, production, validation ou industrialisation."
    },

    // =========================
    // COUCHE 1 — POTENTIEL INDUSTRIEL GÉNÉRIQUE
    // =========================
    {
      id: "industrie_extension_nouvelles_lignes",
      label: "Extension / nouvelles lignes",
      couche: "potentiel_industriel",
      profils_metiers: ["process", "packaging", "detection", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "guidage_produit", "encaissage", "palettisation"],
        packaging: ["films", "sachet", "boite", "carton", "conditionnement_secondaire"],
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["balance", "tri_ponderal", "etiquetage"],
        vision: ["presence_absence", "controle_etiquette", "controle_aspect"]
      },
      intensite_metier: { process: 0.85, packaging: 0.8, detection: 0.75, pesage: 0.7, vision: 0.55 },
      secteur: ["industrie", "agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "extension", "extension usine", "extension d'usine", "agrandissement",
        "agrandit", "agrandir", "s'agrandit", "se développe", "se developpe",
        "nouvelle ligne", "nouvelles lignes", "plusieurs lignes", "ligne de production",
        "lignes de production", "ligne de conditionnement", "nouvel atelier", "nouveaux ateliers",
        "atelier de production", "augmentation capacité", "augmentation capacite",
        "augmente sa capacité", "augmente sa capacite", "augmentation de capacité",
        "augmentation de capacite", "montée en cadence", "montee en cadence"
      ],
      score_bonus: 32,
      chaleur: "chaud",
      type_signal: "nouvelle_ligne",
      raison: "L'entreprise augmente ou transforme sa capacité industrielle, ce qui peut déclencher des besoins en équipements de ligne.",
      opportunite: "Se positionner en amont sur les futurs besoins de contrôle qualité, détection, inspection, pesage ou automatisation.",
      action: "Identifier production, maintenance ou travaux neufs et proposer un échange ciblé sur les nouvelles lignes."
    },
    {
      id: "industrie_nouvelle_usine_site",
      label: "Nouvelle usine / nouveau site",
      couche: "potentiel_industriel",
      profils_metiers: ["process", "packaging", "detection", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "automatisme", "encaissage", "palettisation", "robotique", "logistique_interne"],
        packaging: ["films", "sachet", "boite", "carton", "conditionnement_secondaire"],
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["balance", "tri_ponderal", "etiquetage"],
        vision: ["presence_absence", "controle_etiquette", "controle_aspect"]
      },
      intensite_metier: { process: 0.9, packaging: 0.8, detection: 0.75, pesage: 0.7, vision: 0.55 },
      secteur: ["industrie", "agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "nouvelle usine", "nouveau site", "nouveau bâtiment", "nouveau batiment",
        "construction usine", "construit une usine", "site industriel", "site de production",
        "nouvel outil industriel", "outil de production", "plateforme industrielle"
      ],
      score_bonus: 34,
      chaleur: "chaud",
      type_signal: "investissement",
      raison: "Création ou structuration d'un site industriel : signal fort de projets équipements.",
      opportunite: "Entrer tôt dans le projet avant figement des choix techniques et des fournisseurs.",
      action: "Rechercher les responsables travaux neufs, production, maintenance ou qualité."
    },
    {
      id: "industrie_investissement_modernisation",
      label: "Investissement / modernisation",
      couche: "potentiel_industriel",
      profils_metiers: ["process", "packaging", "detection", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "automatisme", "robotique", "palettisation"],
        packaging: ["films", "carton", "conditionnement_secondaire"],
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["balance", "tri_ponderal", "etiquetage"],
        vision: ["presence_absence", "controle_aspect", "controle_etiquette"]
      },
      intensite_metier: { process: 0.8, packaging: 0.65, detection: 0.6, pesage: 0.6, vision: 0.55 },
      secteur: ["industrie", "agroalimentaire", "plasturgie", "bois", "textile"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "investissement", "investit", "millions d'euros", "millions euros",
        "plan d'investissement", "modernisation", "modernisation industrielle",
        "automatisation", "robotisation", "nouvel équipement", "nouveaux équipements",
        "nouveaux equipements", "remplacement d'équipements", "remplacement equipements",
        "renouvellement équipement", "renouvellement equipement", "capex"
      ],
      score_bonus: 26,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Investissement ou modernisation industrielle détecté : besoin équipement possible.",
      opportunite: "Qualifier le périmètre du projet et vérifier s'il concerne les lignes, la qualité, l'inspection ou la fin de ligne.",
      action: "Approche découverte structurée auprès de la production ou de la maintenance."
    },

    // =========================
    // COUCHE 2 — BONUS MÉTIER / SECTEUR INDUSTRIEL
    // =========================
    {
      id: "agro_qualite_certification",
      label: "Agroalimentaire / qualité / certification",
      couche: "bonus_metier",
      profils_metiers: ["detection", "vision", "pesage"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        vision: ["presence_absence", "controle_etiquette", "ocr", "lecture_code", "controle_aspect"],
        pesage: ["tri_ponderal", "etiquetage"]
      },
      intensite_metier: { detection: 0.85, vision: 0.65, pesage: 0.6 },
      secteur: ["agroalimentaire", "qualite"],
      sources: ["presse", "linkedin", "google_alerts", "rss", "manuel"],
      keywords: [
        "ifs", "brc", "brcgs", "haccp", "audit ifs", "audit brc", "audit brcgs",
        "certification ifs", "certification brc", "certification brcgs",
        "certification qualité", "certification qualite", "sécurité alimentaire",
        "securite alimentaire", "contrôle qualité", "controle qualite", "plan de contrôle",
        "plan de controle", "qualité produit", "qualite produit"
      ],
      score_bonus: 20,
      chaleur: "tiede",
      type_signal: "qualite_rappel_conso",
      raison: "Contexte qualité ou certification : besoin possible de sécurisation et de traçabilité des contrôles.",
      opportunite: "Positionner une approche conseil autour de la maîtrise des risques et des audits qualité.",
      action: "Contacter le responsable qualité avec un angle conformité, CCP et preuves d'autocontrôle."
    },
    {
      id: "agro_packaging_film_technique",
      label: "Emballage / film plastique technique & barrière",
      profils_metiers: ["packaging"],
      sous_profils_metiers: {
        packaging: ["films", "flowpack", "thermoformage", "operculage", "sachet"]
      },
      intensite_metier: { packaging: 0.9 },
      couche: "bonus_metier",
      secteur: ["agroalimentaire", "packaging"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "film plastique", "film technique", "film barrière", "film barriere",
        "film alimentaire", "film complexe", "film imprimé", "film imprime",
        "films spéciaux", "films speciaux", "emballage flexible", "packaging flexible",
        "atmosphère protectrice", "atmosphere protectrice", "atmosphère modifiée",
        "atmosphere modifiee", "sous atmosphère modifiée", "sous atmosphere modifiee",
        "map", "operculage", "opercule", "barquette operculée", "barquette operculee",
        "conditionnement sous vide", "thermoformage", "thermoformeuse",
        "ensacheuse", "flowpack", "flow-pack", "skin pack",
        "film étirable", "film etirable", "film retractable", "film rétractable",
        "conservation longue durée", "conservation longue duree", "perméabilité",
        "permeabilite", "barrière oxygène", "barriere oxygene", "evoh"
      ],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Changement de format d'emballage ou investissement de conditionnement sous film technique détecté : besoin possible en consommables, essais matière ou optimisation de ligne.",
      opportunite: "Proposer une alternative de film technique haute performance, barrière, anti-buée, operculable ou imprimé, et qualifier les gains possibles sur les lignes flowpack, operculage ou thermoformage.",
      action: "Contacter le responsable conditionnement, le chef de ligne, les achats packaging ou le responsable production."
    },
    {
      id: "agro_packaging_etiquettes_tracabilite",
      label: "Étiquettes & traçabilité industrielle",
      profils_metiers: ["packaging", "pesage", "vision"],
      sous_profils_metiers: {
        packaging: ["etiquettes", "sleeves"],
        pesage: ["etiquetage", "poids_prix"],
        vision: ["controle_etiquette", "ocr", "lecture_code"]
      },
      intensite_metier: { packaging: 0.85, pesage: 0.65, vision: 0.55 },
      couche: "bonus_metier",
      secteur: ["agroalimentaire", "packaging"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "étiquetage", "etiquetage", "étiqueteuse", "etiqueteuse", "pose d'étiquette",
        "pose etiquette", "étiquette adhésive", "etiquette adhesive", "étiquette technique",
        "etiquette technique", "étiquette alimentaire", "etiquette alimentaire",
        "manchon", "sleeve", "impression thermique", "transfert thermique",
        "traçabilité unitaire", "tracabilite unitaire", "traçabilité", "tracabilite",
        "marquage jet d'encre", "marquage jet d encre", "laser", "clear-on-clear",
        "nutriscore", "nutri-score", "eco-score", "origine produit", "qr code"
      ],
      score_bonus: 16,
      chaleur: "tiede",
      type_signal: "qualite_rappel_conso",
      raison: "Modernisation des lignes d'étiquetage, nouvelle contrainte d'affichage ou besoin de traçabilité détecté : opportunité packaging à qualifier.",
      opportunite: "Se positionner sur la fourniture d'étiquettes techniques compatibles avec les contraintes produit, humidité, gras, froid, traçabilité ou machines de dépose existantes.",
      action: "Contacter le responsable traçabilité, le responsable production, le responsable conditionnement ou les achats packaging."
    },

    {
      id: "plasturgie_process",
      label: "Plasturgie / process",
      couche: "bonus_metier",
      profils_metiers: ["process", "detection", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["convoyage", "automatisme", "manutention"],
        detection: ["detecteur_metaux"],
        pesage: ["balance"],
        vision: ["controle_aspect"]
      },
      intensite_metier: { process: 0.75, detection: 0.45, pesage: 0.45, vision: 0.45 },
      secteur: ["plasturgie"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "plasturgie", "injection", "extrusion", "granulés", "granules",
        "compound", "recyclage plastique", "ligne d'extrusion", "ligne extrusion",
        "presse à injecter", "presse a injecter"
      ],
      score_bonus: 12,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Process plasturgie détecté : contexte industriel compatible avec contrôle, pesage ou détection selon l'application.",
      opportunite: "Qualifier les contraintes matière, contamination, dosage ou contrôle de production.",
      action: "Approche découverte technique auprès de la production ou du process."
    },
    {
      id: "bois_lignes_industrielles",
      label: "Bois / lignes industrielles",
      couche: "bonus_metier",
      profils_metiers: ["process", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "palettisation"],
        pesage: ["balance"],
        vision: ["controle_aspect"]
      },
      intensite_metier: { process: 0.8, pesage: 0.45, vision: 0.4 },
      secteur: ["bois"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "scierie", "palettes", "rabotage", "ligne bois", "bois industrie",
        "panneaux bois", "sciage", "ligne de sciage"
      ],
      score_bonus: 10,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Activité bois industrielle détectée : signal exploitable pour certains équipements de ligne.",
      opportunite: "Identifier les besoins de convoyage, contrôle, automatisation ou pesage industriel.",
      action: "Surveiller et qualifier le projet avant contact ciblé."
    },
    {
      id: "textile_lignes_recyclage",
      label: "Textile / non-tissé / recyclage",
      couche: "bonus_metier",
      profils_metiers: ["process", "detection", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "automatisme"],
        detection: ["detecteur_metaux"],
        pesage: ["balance"],
        vision: ["controle_aspect"]
      },
      intensite_metier: { process: 0.75, detection: 0.45, pesage: 0.45, vision: 0.45 },
      secteur: ["textile"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "non-tissé", "non tissé", "non tisse", "fibres", "ligne textile",
        "recyclage textile", "lignes textiles", "textile technique"
      ],
      score_bonus: 12,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Contexte textile industriel détecté : ligne ou recyclage pouvant nécessiter contrôle ou automatisation.",
      opportunite: "Qualifier les besoins de contrôle, tri, pesage ou inspection selon la matière.",
      action: "Approche découverte technique si le signal mentionne ligne, capacité ou investissement."
    },


    {
      id: "agro_packaging_carton_conditionnement_secondaire",
      label: "Packaging / carton / conditionnement secondaire",
      couche: "bonus_metier",
      secteur: ["agroalimentaire", "pharma", "cosmetique", "packaging", "industrie"],
      profils_metiers: ["packaging", "process"],
      sous_profils_metiers: {
        packaging: ["carton", "boite", "etui", "conditionnement_secondaire"],
        process: ["encaissage", "convoyage", "palettisation"]
      },
      intensite_metier: { packaging: 0.9, process: 0.65 },
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "carton", "cartonnage", "mise en carton", "encartonnage", "encaisseuse",
        "caisse carton", "boîte carton", "boite carton", "étui", "etui",
        "conditionnement secondaire", "emballage secondaire", "suremballage",
        "formeuse de cartons", "fermeuse de cartons", "étuyeuse", "etuyeuse"
      ],
      score_bonus: 16,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Signal lié au carton, à la mise en boîte ou au conditionnement secondaire : opportunité packaging et fin de ligne à qualifier.",
      opportunite: "Identifier les besoins en emballage carton, étuis, caisses, encartonnage, convoyage ou palettisation.",
      action: "Contacter conditionnement, production, méthode ou achats packaging."
    },
    {
      id: "process_convoyage_manutention_fin_ligne",
      label: "Process / convoyage / manutention / fin de ligne",
      couche: "bonus_metier",
      secteur: ["industrie", "agroalimentaire", "pharma", "cosmetique", "plasturgie", "bois", "textile", "logistique"],
      profils_metiers: ["process"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "guidage_produit", "automatisme", "encaissage", "palettisation", "robotique", "logistique_interne"]
      },
      intensite_metier: { process: 1 },
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "convoyeur", "convoyage", "bande transporteuse", "bandes transporteuses",
        "manutention", "guidage produit", "guidage produits", "accumulation",
        "fin de ligne", "automatisme", "automatisation fin de ligne",
        "encaissage", "encaisseuse", "palettisation", "palettiseur",
        "robot palettiseur", "robotique", "agv", "amr", "logistique interne"
      ],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Signal lié au flux produit, au convoyage, à la manutention ou à la fin de ligne : opportunité process transverse.",
      opportunite: "Qualifier les flux, cadences, points de contrôle, interfaces packaging, pesage, détection ou palettisation.",
      action: "Contacter production, maintenance, méthode, travaux neufs ou responsable process."
    },

    // =========================
    // COUCHE 3 — COMPATIBILITÉ OFFRE COMMERCIALE / TECHNOLOGIE
    // =========================
    {
      id: "detection_metaux_corps_etrangers",
      label: "Détection / corps étrangers",
      profils_metiers: ["detection"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"]
      },
      intensite_metier: { detection: 1 },
      couche: "compatibilite_offre",
      secteur: ["agroalimentaire", "qualite", "industrie"],
      sources: ["rappel_conso", "presse", "google_alerts", "rss", "manuel"],
      keywords: [
        "détecteur de métaux", "detecteur de metaux", "détection de métaux",
        "detection de metaux", "corps étranger", "corps etranger", "métal", "metal",
        "particule métallique", "particule metallique", "particules métalliques",
        "particules metalliques", "particule de métal", "particule de metal",
        "particules de métal", "particules de metal", "contamination métallique",
        "contamination metallique", "ccp", "point critique", "maîtrise des risques",
        "maitrise des risques"
      ],
      score_bonus: 32,
      chaleur: "chaud",
      type_signal: "qualite_rappel_conso",
      raison: "Signal directement compatible avec une approche détection de métaux ou maîtrise des corps étrangers.",
      opportunite: "Proposer un échange autour de la sécurisation des lignes, des tests et de la conformité audit.",
      action: "Contacter prioritairement qualité, maintenance ou production."
    },
    {
      id: "inspection_rayons_x_qualite",
      label: "Inspection / rayons X",
      profils_metiers: ["detection"],
      sous_profils_metiers: {
        detection: ["rayon_x"]
      },
      intensite_metier: { detection: 1 },
      couche: "compatibilite_offre",
      secteur: ["agroalimentaire", "qualite", "industrie"],
      sources: ["presse", "google_alerts", "rss", "manuel"],
      keywords: [
        "rayons x", "rayon x", "inspection rayons x", "inspection rayon x",
        "inspection par rayons x", "inspection par rayon x", "x-ray", "xray",
        "système rayons x", "systeme rayons x", "système rayon x", "systeme rayon x",
        "contrôle intégrité par rayons x", "controle integrite par rayons x",
        "verre", "os", "arête", "arete", "arêtes", "aretes", "pierre",
        "plastique dense", "corps étranger dense", "corps etranger dense",
        "densité", "densite", "emballage complexe"
      ],
      score_bonus: 24,
      chaleur: "chaud",
      type_signal: "qualite_rappel_conso",
      raison: "Signal compatible avec une approche inspection produit ou rayons X.",
      opportunite: "Explorer les besoins de contrôle corps étrangers, intégrité produit ou qualité fin de ligne.",
      action: "Identifier le responsable qualité ou production et préparer un angle inspection."
    },
    {
      id: "pesage_etiquetage_controle_poids",
      label: "Pesage / étiquetage / contrôle poids",
      profils_metiers: ["pesage"],
      sous_profils_metiers: {
        pesage: ["balance", "tri_ponderal", "etiquetage", "poids_prix"]
      },
      intensite_metier: { pesage: 1 },
      couche: "compatibilite_offre",
      secteur: ["agroalimentaire", "industrie"],
      sources: ["presse", "google_alerts", "rss", "manuel"],
      keywords: [
        "pesage", "étiquetage", "etiquetage", "contrôle poids", "controle poids",
        "contrôle pondéral", "controle ponderal", "trieuse pondérale", "trieuse ponderale",
        "checkweigher", "peseuse", "pesage dynamique", "balance industrielle",
        "poids prix", "préemballé", "preemballe", "préemballés", "preemballes",
        "surdosage", "rendement matière", "rendement matiere", "traçabilité", "tracabilite",
        "allergènes", "allergenes", "lot", "codification", "qr code"
      ],
      score_bonus: 26,
      chaleur: "chaud",
      type_signal: "investissement",
      raison: "Signal compatible avec pesage, contrôle poids, étiquetage ou traçabilité.",
      opportunite: "Qualifier les besoins de conformité, rendement matière, contrôle poids ou identification produit.",
      action: "Préparer un angle pesage / contrôle poids / traçabilité."
    },

    // =========================
    // COUCHE 4 — SIGNAUX DIRECTS, INDIRECTS OU LONG TERME
    // =========================
    {
      id: "appel_offre_consultation",
      label: "Consultation / appel d'offre",
      couche: "signal_direct",
      profils_metiers: ["process", "packaging", "detection", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "automatisme", "encaissage", "palettisation"],
        packaging: ["films", "sachet", "boite", "carton", "conditionnement_secondaire"],
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["balance", "tri_ponderal", "etiquetage"],
        vision: ["presence_absence", "controle_etiquette", "controle_aspect"]
      },
      intensite_metier: { process: 0.55, packaging: 0.55, detection: 0.55, pesage: 0.55, vision: 0.55 },
      secteur: ["industrie", "public", "agroalimentaire"],
      sources: ["boamp", "ted", "marches_publics", "presse", "manuel"],
      keywords: [
        "boamp", "ted", "marché public", "marche public", "appel d'offre",
        "appel d’offres", "avis de marché", "avis de marche", "consultation",
        "cahier des charges", "dce", "demande de prix", "demande de devis",
        "recherche fournisseur"
      ],
      score_bonus: 30,
      chaleur: "chaud",
      type_signal: "appel_offre",
      raison: "Consultation ou intention d'achat détectée : opportunité commerciale plus directe.",
      opportunite: "Vérifier rapidement l'adéquation avec l'offre et le délai de réponse.",
      action: "Analyser le besoin et contacter si l'offre est pertinente."
    },
    {
      id: "recrutement_industriel_cle",
      label: "Recrutement industriel clé",
      couche: "signal_indirect",
      profils_metiers: ["process", "detection", "pesage", "packaging", "vision"],
      sous_profils_metiers: {
        process: ["automatisme", "convoyage", "manutention", "palettisation"],
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["balance", "tri_ponderal", "etiquetage"],
        packaging: ["films", "carton", "conditionnement_secondaire"],
        vision: ["controle_aspect", "controle_etiquette"]
      },
      intensite_metier: { process: 0.65, detection: 0.55, pesage: 0.5, packaging: 0.5, vision: 0.45 },
      secteur: ["industrie", "agroalimentaire"],
      sources: ["linkedin", "job_board", "presse", "google_alerts", "manuel"],
      keywords: [
        "recrutement responsable qualité", "recrutement responsable qualite",
        "nouveau responsable qualité", "nouvelle responsable qualité",
        "responsable qualité rejoint", "responsable qualite rejoint",
        "recrutement responsable production", "recrutement responsable maintenance",
        "directeur de production", "technicien maintenance", "ingénieur process",
        "ingenieur process", "travaux neufs", "responsable amélioration continue",
        "responsable amelioration continue", "chef de projet industriel"
      ],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "recrutement",
      raison: "Recrutement industriel pouvant indiquer croissance, réorganisation ou projet de ligne.",
      opportunite: "Fenêtre d'entrée commerciale auprès d'un nouvel interlocuteur ou d'une équipe en évolution.",
      action: "Surveiller puis contacter avec une approche découverte ciblée."
    },
    {
      id: "permis_industriel_long_terme",
      label: "Permis / bâtiment industriel",
      couche: "signal_long_terme",
      profils_metiers: ["process", "packaging", "detection", "pesage"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "automatisme", "encaissage", "palettisation", "logistique_interne"],
        packaging: ["carton", "boite", "conditionnement_secondaire"],
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["balance", "tri_ponderal"]
      },
      intensite_metier: { process: 0.6, packaging: 0.45, detection: 0.4, pesage: 0.35 },
      secteur: ["industrie", "immobilier_industriel"],
      sources: ["sitadel", "open_data", "presse", "manuel"],
      keywords: [
        "permis de construire", "sitadel", "bâtiment industriel", "batiment industriel",
        "construction bâtiment", "construction batiment", "plateforme logistique",
        "atelier de production"
      ],
      score_bonus: 12,
      chaleur: "froid",
      type_signal: "investissement",
      raison: "Signal long terme : projet immobilier ou industriel potentiel, encore peu qualifié.",
      opportunite: "À exploiter seulement si l'exploitant, l'activité ou les lignes futures sont identifiés.",
      action: "Surveiller l'avancement et enrichir avant contact commercial."
    }
  ,
    // =========================
    // COUCHE 2B — SECTEURS / SOUS-SECTEURS À FORTE SPÉCIALISATION
    // =========================
    {
      id: "pharma_conditionnement_controle",
      label: "Pharmaceutique / conditionnement & contrôle",
      couche: "bonus_metier",
      profils_metiers: ["detection", "vision", "pesage", "process"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        vision: ["lecture_code", "ocr", "controle_etiquette", "controle_aspect"],
        pesage: ["tri_ponderal", "etiquetage"],
        process: ["convoyage", "automatisme", "robotique"]
      },
      intensite_metier: { detection: 0.75, vision: 0.7, pesage: 0.55, process: 0.55 },
      secteur: ["pharma", "pharmaceutique"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "pharmaceutique", "pharma", "laboratoire pharmaceutique", "medicament", "médicament",
        "formes seches", "formes sèches", "formes liquides", "injectable", "blister",
        "conditionnement pharma", "ligne de conditionnement pharma", "validation", "qualification equipement"
      ],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Contexte pharmaceutique : les projets de ligne impliquent souvent validation, traçabilité, inspection et contrôle qualité.",
      opportunite: "Qualifier les besoins de contrôle, inspection, traçabilité ou pesage selon le niveau de validation attendu.",
      action: "Rechercher assurance qualité, production, validation, maintenance ou direction industrielle."
    },
    {
      id: "cosmetique_conditionnement_industriel",
      label: "Cosmétique / fabrication & conditionnement",
      couche: "bonus_metier",
      profils_metiers: ["packaging", "vision", "detection", "process"],
      sous_profils_metiers: {
        packaging: ["etiquettes", "sleeves", "boite", "conditionnement_secondaire"],
        vision: ["controle_aspect", "controle_etiquette", "ocr"],
        detection: ["rayon_x", "detecteur_metaux"],
        process: ["convoyage", "automatisme"]
      },
      intensite_metier: { packaging: 0.78, vision: 0.65, detection: 0.45, process: 0.55 },
      secteur: ["cosmetique"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "cosmetique", "cosmétique", "parfum", "parfumerie", "maquillage", "beaute", "beauté",
        "flacon", "tube cosmetique", "tube cosmétique", "conditionnement cosmetique",
        "fabrication cosmetique", "sous traitance cosmetique"
      ],
      score_bonus: 16,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Projet cosmétique : opportunité possible en conditionnement, contrôle aspect, marquage ou inspection de fin de ligne.",
      opportunite: "Qualifier les contraintes de packaging, étiquetage, contrôle visuel et intégration ligne.",
      action: "Approcher conditionnement, qualité, production ou achats packaging."
    },
    {
      id: "plasturgie_extrusion_injection",
      label: "Plasturgie / extrusion / injection / recyclage",
      couche: "bonus_metier",
      profils_metiers: ["process", "detection", "vision", "pesage"],
      sous_profils_metiers: {
        process: ["convoyage", "automatisme", "manutention"],
        detection: ["detecteur_metaux"],
        vision: ["controle_aspect"],
        pesage: ["balance"]
      },
      intensite_metier: { process: 0.78, detection: 0.55, vision: 0.5, pesage: 0.45 },
      secteur: ["plasturgie"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "plasturgie", "extrusion", "ligne d'extrusion", "ligne extrusion", "injection plastique",
        "presse a injecter", "presse à injecter", "thermoformage", "soufflage plastique",
        "compound", "granules", "granulés", "recyclage plastique"
      ],
      score_bonus: 16,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Projet plasturgie : contexte compatible avec flux matière, contrôle process, détection ou automatisation.",
      opportunite: "Qualifier les risques de contamination matière, contrôle qualité, flux et automatisation.",
      action: "Contacter production, industrialisation, maintenance ou process."
    }
    ,
    // =========================
    // COUCHE D.1 / D.2 — ENRICHISSEMENT SECTEURS & SOUS-SECTEURS
    // Organisation cible : règles par grands secteurs, puis sous-secteurs métier.
    // =========================
    {
      id: "agro_fruits_compotes_confitures",
      label: "Agroalimentaire / fruits, compotes, confitures",
      couche: "bonus_metier",
      profils_metiers: ["detection", "vision", "pesage", "packaging", "process"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        vision: ["controle_aspect", "controle_etiquette", "lecture_code"],
        pesage: ["tri_ponderal", "etiquetage"],
        packaging: ["operculage", "sachet", "etiquettes", "conditionnement_secondaire"],
        process: ["convoyage", "automatisme", "palettisation"]
      },
      intensite_metier: { detection: 0.82, vision: 0.62, pesage: 0.58, packaging: 0.58, process: 0.62 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "compote", "compotes", "confiture", "confitures", "dessert fruitier", "desserts fruitiers",
        "transformation fruits", "fruits transformes", "fruits transformés", "preparation fruitiere",
        "préparation fruitière", "purée de fruits", "puree de fruits", "site fruitier"
      ],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Sous-secteur fruits / compotes / confitures identifié : les lignes de préparation et conditionnement peuvent nécessiter contrôle contaminants, inspection, pesage ou traçabilité.",
      opportunite: "Qualifier les points de contrôle qualité, détection, inspection et conditionnement sur les futures lignes.",
      action: "Cibler qualité, production, maintenance, conditionnement ou direction industrielle."
    },
    {
      id: "agro_plats_cuisines_traiteur",
      label: "Agroalimentaire / plats cuisinés & traiteur",
      couche: "bonus_metier",
      profils_metiers: ["detection", "packaging", "pesage", "vision", "process"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        packaging: ["operculage", "films", "barquette", "etiquettes"],
        pesage: ["tri_ponderal", "etiquetage"],
        vision: ["controle_etiquette", "ocr", "lecture_code"],
        process: ["convoyage", "encaissage", "palettisation"]
      },
      intensite_metier: { detection: 0.85, packaging: 0.72, pesage: 0.62, vision: 0.6, process: 0.65 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["plat cuisiné", "plats cuisinés", "plat cuisine", "plats cuisines", "traiteur", "barquette repas", "snacking", "sandwich", "salade préparée", "salade preparee"],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Sous-secteur plats cuisinés / traiteur : risque qualité, cadence de conditionnement et traçabilité souvent déterminants.",
      opportunite: "Approcher la sécurisation fin de ligne : détection, inspection, pesage, étiquetage ou conditionnement.",
      action: "Prioriser qualité, production, conditionnement et maintenance."
    },
    {
      id: "agro_viande_salaison_volaille",
      label: "Agroalimentaire / viande, salaison, volaille",
      couche: "bonus_metier",
      profils_metiers: ["detection", "pesage", "vision", "packaging", "process"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["tri_ponderal", "etiquetage", "poids_prix"],
        vision: ["controle_etiquette", "lecture_code", "controle_aspect"],
        packaging: ["films", "thermoformage", "operculage"],
        process: ["convoyage", "manutention"]
      },
      intensite_metier: { detection: 0.9, pesage: 0.72, vision: 0.58, packaging: 0.62, process: 0.6 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["viande", "salaison", "charcuterie", "volaille", "abattoir", "découpe viande", "decoupe viande", "boucherie industrielle", "jambon", "saucisson"],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Sous-secteur viande / salaison / volaille : forte sensibilité au contrôle contaminants, poids, étiquetage et traçabilité.",
      opportunite: "Positionner les contrôles qualité en ligne et la sécurisation des lots.",
      action: "Contacter qualité, production, maintenance ou responsable atelier."
    },
    {
      id: "agro_mer_poisson",
      label: "Agroalimentaire / produits de la mer",
      couche: "bonus_metier",
      profils_metiers: ["detection", "vision", "pesage", "packaging"],
      sous_profils_metiers: {
        detection: ["rayon_x", "detecteur_metaux"],
        vision: ["controle_aspect", "controle_etiquette"],
        pesage: ["tri_ponderal", "etiquetage"],
        packaging: ["operculage", "films", "etiquettes"]
      },
      intensite_metier: { detection: 0.88, vision: 0.62, pesage: 0.6, packaging: 0.6 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["poisson", "produits de la mer", "produit de la mer", "saumon", "surimi", "crustacé", "crustace", "arête", "arete", "filet de poisson"],
      score_bonus: 22,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Produits de la mer : contrôle arêtes, corps étrangers, étiquetage et conditionnement peuvent être critiques.",
      opportunite: "Qualifier les besoins rayons X, détection, contrôle aspect et traçabilité.",
      action: "Cibler qualité, production et maintenance."
    },
    {
      id: "agro_laitier_fromage",
      label: "Agroalimentaire / produits laitiers / fromages",
      couche: "bonus_metier",
      profils_metiers: ["detection", "pesage", "packaging", "vision", "process"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["tri_ponderal", "etiquetage"],
        packaging: ["films", "operculage", "etiquettes"],
        vision: ["controle_etiquette", "controle_aspect"],
        process: ["convoyage", "automatisme"]
      },
      intensite_metier: { detection: 0.78, pesage: 0.68, packaging: 0.62, vision: 0.58, process: 0.55 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["laiterie", "laiteries", "fromagerie", "fromageries", "fromage", "fromages", "produits laitiers", "produit laitier", "affinage", "affineur", "fruitière", "fruitiere", "yaourt", "yaourts", "dessert lacté", "dessert lacte", "beurre", "crème", "creme", "découpe fromage", "decoupe fromage", "portionnage fromage", "emballage fromage"],
      score_bonus: 20,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Produits laitiers / fromages : lignes sensibles au contrôle qualité, poids, conditionnement et traçabilité.",
      opportunite: "Qualifier les contrôles en ligne et contraintes de conditionnement.",
      action: "Approcher qualité, production, conditionnement ou maintenance."
    },
    {
      id: "agro_boulangerie_biscuiterie",
      label: "Agroalimentaire / boulangerie, biscuiterie, pâtisserie",
      couche: "bonus_metier",
      profils_metiers: ["detection", "pesage", "packaging", "vision", "process"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["tri_ponderal", "etiquetage"],
        packaging: ["flowpack", "sachet", "carton", "etiquettes"],
        vision: ["controle_etiquette", "lecture_code"],
        process: ["convoyage", "encaissage", "palettisation"]
      },
      intensite_metier: { detection: 0.82, pesage: 0.62, packaging: 0.72, vision: 0.55, process: 0.62 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["boulangerie", "biscuiterie", "pâtisserie", "patisserie", "viennoiserie", "biscuit", "gâteau", "gateau", "pain industriel", "flowpack"],
      score_bonus: 22,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Boulangerie / biscuiterie : opportunités fréquentes en flowpack, détection, pesage et contrôle étiquettes.",
      opportunite: "Qualifier les besoins fin de ligne, détection, pesage, packaging et traçabilité.",
      action: "Contacter production, conditionnement, qualité ou maintenance."
    },
    {
      id: "agro_boissons_liquides",
      label: "Agroalimentaire / boissons & liquides",
      couche: "bonus_metier",
      profils_metiers: ["vision", "detection", "pesage", "packaging", "process"],
      sous_profils_metiers: {
        vision: ["controle_etiquette", "ocr", "lecture_code", "controle_aspect"],
        detection: ["rayon_x", "detecteur_metaux"],
        pesage: ["balance", "etiquetage"],
        packaging: ["etiquettes", "sleeves", "carton"],
        process: ["convoyage", "automatisme"]
      },
      intensite_metier: { vision: 0.78, detection: 0.48, pesage: 0.52, packaging: 0.62, process: 0.55 },
      secteur: ["agroalimentaire"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["boisson", "boissons", "jus", "eau minérale", "eau minerale", "soda", "sirop", "brasserie", "embouteillage", "ligne d'embouteillage", "flacon", "bouteille"],
      score_bonus: 18,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Boissons / liquides : contrôle étiquette, marquage, inspection et flux de ligne sont souvent déterminants.",
      opportunite: "Qualifier les besoins vision, étiquetage, convoyage, contrôle ou packaging.",
      action: "Cibler production, qualité, maintenance ou conditionnement."
    },
    {
      id: "bois_scierie_panneaux",
      label: "Bois / scierie, panneaux, palettes",
      couche: "bonus_metier",
      profils_metiers: ["process", "detection", "vision", "pesage"],
      sous_profils_metiers: {
        process: ["convoyage", "manutention", "automatisme", "palettisation"],
        detection: ["detecteur_metaux"],
        vision: ["controle_aspect"],
        pesage: ["balance"]
      },
      intensite_metier: { process: 0.82, detection: 0.55, vision: 0.45, pesage: 0.4 },
      secteur: ["bois"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["scierie", "panneaux bois", "palette", "palettes", "sciage", "rabotage", "menuiserie industrielle", "bois", "panneaux"],
      score_bonus: 16,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Bois / scierie / panneaux : besoins possibles en flux, manutention, détection métallique ou contrôle process.",
      opportunite: "Qualifier convoyage, manutention, détection et automatisation de flux.",
      action: "Approcher direction de site, production ou maintenance."
    },
    {
      id: "textile_technique_non_tisse",
      label: "Textile / technique & non-tissé",
      couche: "bonus_metier",
      profils_metiers: ["process", "vision", "detection", "pesage"],
      sous_profils_metiers: {
        process: ["convoyage", "automatisme"],
        vision: ["controle_aspect"],
        detection: ["detecteur_metaux"],
        pesage: ["balance"]
      },
      intensite_metier: { process: 0.7, vision: 0.62, detection: 0.45, pesage: 0.35 },
      secteur: ["textile"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["textile", "non tissé", "non tisse", "textile technique", "fibres", "filature", "tissage", "recyclage textile"],
      score_bonus: 14,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Textile technique / non-tissé : besoins possibles en contrôle aspect, flux et automatisation.",
      opportunite: "Qualifier contrôle qualité, flux et automatisation de ligne.",
      action: "Approcher production, process ou maintenance."
    },
    {
      id: "chimie_conditionnement_process",
      label: "Chimie / process & conditionnement",
      couche: "bonus_metier",
      profils_metiers: ["process", "pesage", "detection", "vision", "packaging"],
      sous_profils_metiers: {
        process: ["convoyage", "automatisme", "manutention"],
        pesage: ["balance", "etiquetage"],
        detection: ["detecteur_metaux", "rayon_x"],
        vision: ["lecture_code", "controle_etiquette"],
        packaging: ["etiquettes", "carton", "conditionnement_secondaire"]
      },
      intensite_metier: { process: 0.78, pesage: 0.62, detection: 0.52, vision: 0.5, packaging: 0.48 },
      secteur: ["chimie"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: ["chimie", "chimique", "poudre chimique", "poudres chimiques", "conditionnement chimique", "process chimique", "formulation", "granulation"],
      score_bonus: 16,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Chimie / conditionnement : besoins possibles en process, pesage, traçabilité, contrôle et flux.",
      opportunite: "Qualifier dosage, pesage, traçabilité, inspection ou conditionnement.",
      action: "Cibler process, production, maintenance, HSE ou qualité."
    }
    ,
    {
      id: "packaging_impression_helio_flexo",
      label: "Packaging / impression hélio-flexo & finition",
      couche: "bonus_metier",
      profils_metiers: ["packaging", "vision", "process"],
      sous_profils_metiers: {
        packaging: [
          "impression_packaging", "impression", "helio", "heliogravure", "rotogravure", "flexo", "flexographie",
          "pre_presse", "cliche_flexo", "cylindre_helio", "complexage", "contre_collage", "lamination",
          "finition", "vernis", "encres", "dorure", "pelliculage", "controle_impression", "emballage_souple", "film_complexe"
        ],
        vision: ["controle_aspect", "controle_etiquette", "lecture_code"],
        process: ["convoyage", "automatisme"]
      },
      intensite_metier: { packaging: 0.94, vision: 0.64, process: 0.56 },
      secteur: ["packaging"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "impression packaging", "imprimerie packaging", "impression emballage", "impression d'emballages", "impression d’emballages",
        "impression hélio", "impression helio", "héliogravure", "heliogravure", "rotogravure", "impression rotogravure",
        "impression flexo", "flexographie", "flexo", "ligne d'impression", "ligne d’impression", "machine d'impression", "machine d’impression",
        "groupe d'impression", "groupe d’impression", "impression bobine", "bobine imprimée", "bobine imprimee",
        "complexage", "complexe souple", "film complexe", "films imprimés", "films imprimes", "emballage souple", "packaging souple",
        "contre-collage", "contre collage", "lamination", "pelliculage", "finition", "façonnage", "faconnage",
        "vernis", "vernis technique", "vernis de protection", "encres", "encres alimentaires", "encres UV", "encres uv",
        "dorure", "marquage à chaud", "marquage a chaud",
        "prépresse", "pre-presse", "pre presse", "cliché flexo", "cliche flexo", "cylindre hélio", "cylindre helio",
        "contrôle impression", "controle impression", "contrôle qualité impression", "controle qualite impression",
        "défaut d'impression", "defaut d'impression", "repérage couleur", "reperage couleur", "défaut couleur", "defaut couleur"
      ],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Impression et finition packaging : besoin probable autour des supports imprimés, encres, vernis, contrôle impression, qualité visuelle et intégration ligne.",
      opportunite: "Qualifier les besoins liés à l'impression packaging : hélio, flexo, complexage, finition, contrôle qualité impression et évolution des lignes.",
      action: "Approcher responsable packaging, responsable impression, production ou direction industrielle pour comprendre les projets supports, lignes et contrôles."
    },
    {
      id: "capitalistique_rachat_fusion_industriel",
      label: "Rachat / fusion / regroupement industriel",
      couche: "potentiel_industriel",
      profils_metiers: ["detection", "pesage", "packaging", "vision", "process"],
      sous_profils_metiers: {
        detection: ["detecteur_metaux", "rayon_x"],
        pesage: ["balance", "tri_ponderal", "etiquetage"],
        packaging: ["films", "emballage_souple", "etiquettes", "carton", "impression_packaging", "helio", "flexo", "complexage", "controle_impression"],
        vision: ["controle_aspect", "controle_etiquette", "lecture_code"],
        process: ["convoyage", "automatisme", "manutention"]
      },
      intensite_metier: { detection: 0.6, pesage: 0.58, packaging: 0.76, vision: 0.6, process: 0.66 },
      secteur: ["industrie"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "rachat", "rachète", "rachete", "a racheté", "a rachete", "être racheté", "etre rachete",
        "acquisition", "acquiert", "acquérir", "acquerir", "croissance externe",
        "fusion", "fusionne", "fusion-acquisition", "rapprochement", "regroupement", "regroupe", "regroupement de sites",
        "consolidation", "intégration au groupe", "integration au groupe", "rejoint le groupe",
        "prise de participation", "participation majoritaire", "participation minoritaire", "entrée au capital", "entree au capital",
        "fonds d'investissement", "fonds d’investissement", "capital-investissement", "private equity", "LBO", "MBO",
        "changement d'actionnaire", "changement d’actionnaire", "nouvel actionnaire", "nouveaux actionnaires",
        "cession", "cède", "cede", "transmission", "reprend", "reprise", "repreneur",
        "nouvelle direction", "nouveau dirigeant", "nouvelle gouvernance", "nouveau directeur général", "nouveau président", "nouveau president"
      ],
      score_bonus: 20,
      chaleur: "tiede",
      type_signal: "changement_capitalistique",
      raison: "Changement capitalistique, rachat, fusion ou regroupement : période où les budgets, sites, fournisseurs et standards industriels peuvent être remis à plat.",
      opportunite: "Qualifier les conséquences industrielles du mouvement capitalistique : harmonisation d'équipements, nouveaux standards qualité, packaging, impression, process, achats groupe ou investissements post-intégration.",
      action: "Identifier direction générale, direction industrielle, achats et responsables packaging/production pour comprendre les priorités post-rachat et les projets techniques ouverts."
    }

    ,
    {
      id: "process_convoyage_flux",
      label: "Process / convoyage & flux internes",
      couche: "bonus_metier",
      profils_metiers: ["process", "packaging", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["convoyage", "convoyeur", "ligne_convoyage", "transport_interne", "accumulation", "transfert_produit", "guidage_produit", "manutention"],
        packaging: ["conditionnement_secondaire", "carton"],
        pesage: ["pesage_dynamique", "controle_poids"],
        vision: ["lecture_code", "presence_absence"]
      },
      intensite_metier: { process: 0.94, packaging: 0.48, pesage: 0.46, vision: 0.42 },
      secteur: ["industrie", "agroalimentaire", "pharma", "cosmetique", "logistique"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "convoyage", "convoyeur", "convoyeurs", "ligne de convoyage", "tapis convoyeur", "tapis roulant",
        "bande transporteuse", "transport interne", "manutention continue", "accumulation", "table d'accumulation",
        "table accumulation", "transfert produit", "transfert produits", "guidage produit", "flux de transfert",
        "flux internes", "séquençage", "sequencage", "ligne automatisée", "ligne automatisee"
      ],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Convoyage et flux internes : besoin probable d'intégration mécanique, automatisme, cadence, accumulation, transferts produits et disponibilité ligne.",
      opportunite: "Qualifier les besoins de convoyeurs, transferts produits, accumulation, guidage, interfaces équipements et intégration avec la ligne existante.",
      action: "Approcher production, méthodes, maintenance ou automatisme pour comprendre les flux, cadences, contraintes d'implantation et lots techniques ouverts."
    },
    {
      id: "process_conditionnement_ensachage",
      label: "Process / conditionnement, dosage & ensachage",
      couche: "bonus_metier",
      profils_metiers: ["process", "packaging", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["conditionnement", "ensachage", "remplissage", "dosage", "mise_en_carton", "mise_en_caisse", "encaissage", "etuyage"],
        packaging: ["films", "flowpack", "sachet", "barquette", "carton", "conditionnement_secondaire"],
        pesage: ["dosage", "controle_poids", "pesage_dynamique", "tri_ponderal"],
        vision: ["controle_etiquette", "lecture_code", "presence_absence"]
      },
      intensite_metier: { process: 0.9, packaging: 0.74, pesage: 0.68, vision: 0.52 },
      secteur: ["agroalimentaire", "pharma", "cosmetique", "industrie"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "conditionnement", "ligne de conditionnement", "ensachage", "ensacheuse", "remplissage", "remplisseuse",
        "doseuse", "dosage", "mise en carton", "mise en caisse", "étuyage", "etuyage", "encaisseuse",
        "encaissage", "formeuse de cartons", "fermeuse de cartons", "doypack", "sachet", "mise en pot",
        "mise en barquette", "conditionnement primaire", "conditionnement secondaire"
      ],
      score_bonus: 22,
      chaleur: "tiede",
      type_signal: "nouvelle_ligne",
      raison: "Conditionnement / ensachage / dosage : contexte favorable à des besoins d'intégration ligne, cadence, dosage, mise en carton, contrôle poids et traçabilité.",
      opportunite: "Qualifier la ligne : alimentation produit, dosage, ensachage, mise en caisse, contrôle poids, marquage, interfaces et contraintes de cadence.",
      action: "Identifier production, méthodes, maintenance, conditionnement et achats industriels pour qualifier les équipements encore ouverts."
    },
    {
      id: "process_fin_ligne_palettisation",
      label: "Process / fin de ligne & palettisation",
      couche: "bonus_metier",
      profils_metiers: ["process", "packaging", "pesage", "vision"],
      sous_profils_metiers: {
        process: ["fin_de_ligne", "palettisation", "depalettisation", "banderolage", "filmage_palette", "houssage", "encaissage", "manutention"],
        packaging: ["carton", "conditionnement_secondaire"],
        pesage: ["pesage_industriel"],
        vision: ["lecture_code", "presence_absence"]
      },
      intensite_metier: { process: 0.95, packaging: 0.56, pesage: 0.42, vision: 0.4 },
      secteur: ["industrie", "agroalimentaire", "pharma", "cosmetique", "logistique"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "fin de ligne", "ligne fin de ligne", "palettisation", "palettiseur", "dépalettisation", "depalettisation",
        "dépalettiseur", "depalettiseur", "banderolage", "banderoleuse", "filmage palette", "filmeuse palette",
        "houssage", "préparation expédition", "preparation expedition", "encaissage", "mise en caisse",
        "formeuse de cartons", "fermeuse de cartons", "îlot de fin de ligne", "ilot de fin de ligne"
      ],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Fin de ligne / palettisation : besoin probable autour des cartons, palettes, flux sortants, automatisation, manutention et disponibilité.",
      opportunite: "Qualifier les lots fin de ligne : encaisseuse, palettiseur, convoyeurs, banderoleuse, houssage, sécurité et interfaces logistiques.",
      action: "Approcher production, maintenance, méthodes ou logistique pour comprendre cadence, formats, contraintes palettes et planning d'installation."
    },
    {
      id: "process_robotisation_automatisation",
      label: "Process / robotisation & automatisation",
      couche: "bonus_metier",
      profils_metiers: ["process", "vision", "packaging"],
      sous_profils_metiers: {
        process: ["robotique", "robotisation", "cobot", "cellule_robotisee", "picking_robotise", "automatisation", "automatisme", "manutention"],
        vision: ["presence_absence", "controle_aspect", "lecture_code"],
        packaging: ["conditionnement_secondaire", "carton"]
      },
      intensite_metier: { process: 0.96, vision: 0.58, packaging: 0.48 },
      secteur: ["industrie", "agroalimentaire", "pharma", "cosmetique", "plasturgie", "logistique"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "robot", "robots", "robotisation", "robotisé", "robotise", "robotisée", "robotisee",
        "cobot", "cobots", "bras robotisé", "bras robotise", "cellule robotisée", "cellule robotisee",
        "picking robotisé", "picking robotise", "manutention robotisée", "manutention robotisee",
        "automatisation", "automatisation industrielle", "automatisme", "îlot automatisé", "ilot automatise"
      ],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Robotisation / automatisation : signal fort pour intégrateurs, constructeurs de lignes, robotique, convoyage et interfaces d'automatisme.",
      opportunite: "Qualifier les tâches à automatiser : picking, chargement, déchargement, palettisation, manutention, vision et sécurité machine.",
      action: "Identifier directeur industriel, responsable automatisme, méthodes, production ou maintenance pour comprendre le périmètre robotique et les fournisseurs envisagés."
    },
    {
      id: "pesage_controle_poids_trieuse",
      label: "Pesage / contrôle poids & trieuse pondérale",
      couche: "bonus_metier",
      profils_metiers: ["pesage", "detection", "packaging", "process"],
      sous_profils_metiers: {
        pesage: ["controle_poids", "controle_ponderal", "tri_ponderal", "checkweigher", "poids_moyen", "preemballes", "tu1_tu2", "tne", "pesage_dynamique"],
        detection: ["detecteur_metaux", "rayon_x"],
        packaging: ["etiquettes", "conditionnement_secondaire"],
        process: ["convoyage", "conditionnement"]
      },
      intensite_metier: { pesage: 0.95, detection: 0.56, packaging: 0.52, process: 0.5 },
      secteur: ["agroalimentaire", "pharma", "cosmetique", "industrie"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "contrôle poids", "controle poids", "contrôle pondéral", "controle ponderal", "trieuse pondérale",
        "trieuse ponderale", "tri pondéral", "tri ponderal", "checkweigher", "poids moyen",
        "préemballés", "preemballes", "TU1", "TU2", "TNE", "conformité poids", "conformite poids",
        "pesage dynamique", "pesage en ligne", "contrôle poids en ligne", "controle poids en ligne"
      ],
      score_bonus: 24,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Contrôle poids / trieuse pondérale : besoin probable de conformité poids, contrôle dynamique, rejet, traçabilité et sécurisation des préemballés.",
      opportunite: "Qualifier les besoins en contrôle pondéral, trieuse, rejet, statistiques poids, conformité préemballés et intégration avec la ligne.",
      action: "Approcher qualité, production, méthodes ou maintenance pour qualifier cadence, formats, tolérances, contraintes réglementaires et interfaces."
    },
    {
      id: "pesage_etiquetage_metrologie",
      label: "Pesage / étiquetage, poids-prix & métrologie",
      couche: "bonus_metier",
      profils_metiers: ["pesage", "packaging", "vision", "process"],
      sous_profils_metiers: {
        pesage: ["balance", "pesage_industriel", "pesage_statique", "etiquetage", "impression_pose", "poids_prix", "tracabilite_poids", "metrologie", "verification_reglementaire"],
        packaging: ["etiquettes", "marquage", "conditionnement_secondaire"],
        vision: ["controle_etiquette", "ocr", "lecture_code"],
        process: ["conditionnement", "convoyage"]
      },
      intensite_metier: { pesage: 0.92, packaging: 0.58, vision: 0.54, process: 0.42 },
      secteur: ["agroalimentaire", "pharma", "cosmetique", "industrie", "logistique"],
      sources: ["presse", "google_alerts", "rss", "linkedin", "manuel"],
      keywords: [
        "pesage industriel", "balance industrielle", "balances industrielles", "plateforme de pesage",
        "pesage statique", "étiquetage", "etiquetage", "impression pose", "print and apply",
        "poids prix", "poids-prix", "prix poids", "DLC", "DLUO", "date limite", "traçabilité",
        "tracabilite", "métrologie", "metrologie", "vérification réglementaire", "verification reglementaire",
        "contrôle réglementaire", "controle reglementaire"
      ],
      score_bonus: 22,
      chaleur: "tiede",
      type_signal: "investissement",
      raison: "Pesage / étiquetage / métrologie : besoins possibles en balances, impression-pose, poids-prix, traçabilité, conformité et contrôle réglementaire.",
      opportunite: "Qualifier pesage statique ou dynamique, étiquetage, données poids-prix, traçabilité, métrologie et intégration avec les flux.",
      action: "Contacter qualité, production, méthodes, maintenance ou responsable métrologie pour préciser formats, cadences, exigences et validation."
    }


  ];

  function normaliserTexteFlair(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeRegexFlair(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function keywordMatchesText(keyword, texteNormalise) {
    const keywordNormalise = normaliserTexteFlair(keyword).trim();
    if (!keywordNormalise) return false;

    // Sécurité FLAIR :
    // Les mots-clés courts comme "os", "ifs", "brc", "ccp" ou "map"
    // ne doivent pas matcher à l'intérieur d'un autre mot.
    // Exemple à éviter : "os" dans "cosmétique", ou "ccp" dans "haccp".
    if (keywordNormalise.length <= 3) {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegexFlair(keywordNormalise)}([^a-z0-9]|$)`, "i");
      return pattern.test(texteNormalise);
    }

    return texteNormalise.includes(keywordNormalise);
  }

  function ruleMatchesText(rule, texteNormalise) {
    return (rule.keywords || []).some(keyword =>
      keywordMatchesText(keyword, texteNormalise)
    );
  }

  function getSignalText(signal = {}) {
    return [
      signal.titre,
      signal.entreprise_nom,
      signal.description,
      signal.contenu,
      signal.resume_brut,
      signal.resume,
      signal.source,
      signal.type_source,
      signal.region,
      signal.secteur,
      signal.tags
    ].filter(Boolean).join(" ");
  }


  function ajouterUniqueDansSet(set, values) {
    (values || []).forEach(value => {
      if (value) set.add(value);
    });
  }

  function fusionnerSousProfils(target, source = {}) {
    Object.entries(source || {}).forEach(([profil, sousProfils]) => {
      if (!target[profil]) target[profil] = new Set();
      ajouterUniqueDansSet(target[profil], sousProfils);
    });
  }

  function construireMatchingMetier(matchedRules = []) {
    const profilsSet = new Set();
    const sousProfilsSets = {};
    const intensite = {};

    matchedRules.forEach(rule => {
      ajouterUniqueDansSet(profilsSet, rule.profils_metiers);
      fusionnerSousProfils(sousProfilsSets, rule.sous_profils_metiers);

      Object.entries(rule.intensite_metier || {}).forEach(([profil, valeur]) => {
        const numericValue = Number(valeur) || 0;
        intensite[profil] = Math.max(intensite[profil] || 0, numericValue);
      });
    });

    const profilsMetiers = Array.from(profilsSet);
    const sousProfilsMetiers = Object.fromEntries(
      Object.entries(sousProfilsSets).map(([profil, set]) => [profil, Array.from(set)])
    );

    const profilMetierPrincipal = profilsMetiers
      .slice()
      .sort((a, b) => (intensite[b] || 0) - (intensite[a] || 0))[0] || null;

    return {
      profils_metiers_detectes: profilsMetiers,
      profil_metier_principal: profilMetierPrincipal,
      sous_profils_metiers_detectes: sousProfilsMetiers,
      compatibilite_metier: intensite
    };
  }

  function texteContientNegationCommercialeFlairRules(texte = '', cibles = []) {
    const phrases = String(texte || '').split(/(?<=[.!?;。])\s+|\n+/).map(normaliserTexteFlair).filter(Boolean);
    const negations = ['aucun', 'aucune', 'pas de', 'pas d ', 'sans', 'non annonce', 'non lance', 'pas encore', 'n est pas', 'n est mentionne'];
    return phrases.some(phrase =>
      negations.some(neg => phrase.includes(normaliserTexteFlair(neg))) &&
      cibles.some(cible => phrase.includes(normaliserTexteFlair(cible)))
    );
  }

  function analyserSignalAvecRegles(signal = {}) {
    const texte = normaliserTexteFlair(getSignalText(signal));
    const appelOuConsultationNie = texteContientNegationCommercialeFlairRules(texte, [
      'appel d offres', 'appel d offre', 'consultation', 'consultations',
      'fournisseur', 'fournisseurs', 'demande de devis', 'demande de prix'
    ]);
    const matchedRules = FLAIR_SOURCE_VEILLE_RULES.filter(rule => {
      if (appelOuConsultationNie && rule.id === 'appel_offre_consultation') return false;
      return ruleMatchesText(rule, texte);
    });

    if (!matchedRules.length) {
      return {
        score_bonus: 0,
        chaleur: null,
        type_signal: null,
        raison: "",
        opportunite: "",
        action: "",
        matched_rules: [],
        profils_metiers_detectes: [],
        profil_metier_principal: null,
        sous_profils_metiers_detectes: {},
        compatibilite_metier: {}
      };
    }

    const scoreBonus = matchedRules.reduce(
      (total, rule) => total + (Number(rule.score_bonus) || 0),
      0
    );

    const chaleurRank = { froid: 1, tiede: 2, chaud: 3 };
    const bestRule = matchedRules
      .slice()
      .sort((a, b) => {
        const couchePriorite = { compatibilite_offre: 4, signal_direct: 4, potentiel_industriel: 3, bonus_metier: 2, signal_indirect: 1, signal_long_terme: 0 };
        const coucheDiff = (couchePriorite[b.couche] || 0) - (couchePriorite[a.couche] || 0);
        if (coucheDiff !== 0) return coucheDiff;
        const chaleurDiff = (chaleurRank[b.chaleur] || 0) - (chaleurRank[a.chaleur] || 0);
        if (chaleurDiff !== 0) return chaleurDiff;
        return (b.score_bonus || 0) - (a.score_bonus || 0);
      })[0];

    const hasPotentielIndustriel = matchedRules.some(rule => rule.couche === "potentiel_industriel");
    const hasCompatibiliteOffre = matchedRules.some(rule => rule.couche === "compatibilite_offre");
    const hasBonusMetier = matchedRules.some(rule => rule.couche === "bonus_metier");

    let bonusCombine = 0;
    if (hasPotentielIndustriel && hasCompatibiliteOffre) bonusCombine += 12;
    if (hasPotentielIndustriel && hasBonusMetier) bonusCombine += 6;

    const matchingMetier = construireMatchingMetier(matchedRules);

    return {
      score_bonus: Math.min(scoreBonus + bonusCombine, 60),
      chaleur: bestRule.chaleur || null,
      type_signal: bestRule.type_signal || null,
      raison: bestRule.raison || "",
      opportunite: bestRule.opportunite || "",
      action: bestRule.action || "",
      profils_metiers_detectes: matchingMetier.profils_metiers_detectes,
      profil_metier_principal: matchingMetier.profil_metier_principal,
      sous_profils_metiers_detectes: matchingMetier.sous_profils_metiers_detectes,
      compatibilite_metier: matchingMetier.compatibilite_metier,
      classification_prudente: (() => {
        const texteBrutClassification = texte;
        const hasAlimentaire = ['alimentaire', 'agroalimentaire', 'ingredient', 'ingredients', 'deshydrat', 'déshydrat']
          .some(mot => texteBrutClassification.includes(normaliserTexteFlair(mot)));
        const hasCosmetiqueFort = ['cosmetique', 'cosmétique', 'creme', 'crème', 'maquillage', 'parfum', 'soin']
          .some(mot => texteBrutClassification.includes(normaliserTexteFlair(mot)));
        if (hasAlimentaire && !hasCosmetiqueFort) {
          return {
            secteur: 'Agroalimentaire',
            sous_secteur: texteBrutClassification.includes('deshydrat') || texteBrutClassification.includes('déshydrat')
              ? 'Ingrédients / produits déshydratés'
              : 'Ingrédients / produits alimentaires',
            confiance: 'moyenne',
            doctrine: 'classification_generique_si_precision_insuffisante'
          };
        }
        return null;
      })(),
      matched_rules: matchedRules.map(rule => ({
        id: rule.id,
        label: rule.label,
        couche: rule.couche,
        score_bonus: rule.score_bonus,
        chaleur: rule.chaleur,
        profils_metiers: rule.profils_metiers || [],
        sous_profils_metiers: rule.sous_profils_metiers || {},
        intensite_metier: rule.intensite_metier || {}
      }))
    };
  }


  function detecterFamilleStrategiqueProjet(signal = {}) {
    // V2.2 : la famille stratégique reste déterminée uniquement depuis le signal brut.
    // Les textes générés par FLAIR (raison_score, action, commentaire projet suivi)
    // sont exclus pour éviter l'auto-contamination "Qualité / rappel".
    const texteBrut = normaliserTexteFlair([
      signal.titre,
      signal.description,
      signal.resume_brut,
      signal.texte_original,
      signal.contenu,
      signal.source_nom,
      signal.entreprise_nom,
      signal.type_signal
    ].filter(Boolean).join(' '));

    if (!texteBrut) return null;

    const matches = Object.entries(FLAIR_FAMILLES_PROJETS).map(([id, famille]) => {
      const mots = (famille.keywords || []).filter(mot => keywordMatchesText(mot, texteBrut));
      const score = mots.reduce((total, mot) => total + Math.max(1, normaliserTexteFlair(mot).split(' ').length), 0);
      return { id, label: famille.label, score, mots };
    }).filter(item => item.score > 0);

    if (!matches.length) return null;

    const trouver = (id) => matches.find(item => item.id === id);
    const contientUn = (liste) => liste.some(mot => keywordMatchesText(mot, texteBrut));

    const marqueursLogistique = [
      "entrepôt", "entrepot", "plateforme logistique", "centre logistique",
      "centre de distribution", "préparation de commandes", "preparation de commandes"
    ];

    const marqueursQualiteCrise = [
      "rappel produit", "rappel de lot", "rappel lots", "contamination",
      "corps étranger", "corps etranger", "corps étrangers", "corps etrangers",
      "particules métalliques", "particules metalliques", "particules de métal",
      "particules de metal", "présence de métal", "presence de metal",
      "retrait de vente", "retiré de la vente", "retire de la vente", "listeria"
    ];

    const marqueursProcessForts = [
      "nouvelle ligne", "ligne automatisée", "ligne automatisee",
      "nouvelle ligne automatisée", "nouvelle ligne automatisee",
      "ligne de conditionnement", "ligne de production", "conditionnement",
      "convoyeur", "convoyeurs", "convoyage", "équipements de pesage",
      "equipements de pesage", "contrôle qualité en ligne", "controle qualite en ligne",
      "systèmes de contrôle qualité en ligne", "systemes de controle qualite en ligne"
    ];

    const marqueursExtensionForts = [
      "agrandissement", "agrandit", "extension", "nouveau bâtiment",
      "nouveau batiment", "construction d'un nouveau bâtiment",
      "construction d un nouveau batiment", "m²", "m2", "nouveau site",
      "nouvelle usine", "augmentation des capacités", "augmentation des capacites"
    ];

    const logistique = trouver('logistique');
    if (logistique && contientUn(marqueursLogistique)) {
      return { id: logistique.id, label: logistique.label, score: logistique.score, indices: logistique.mots.slice(0, 6), matches };
    }

    const process = trouver('process');
    if (process && contientUn(marqueursProcessForts)) {
      return { id: process.id, label: process.label, score: process.score, indices: process.mots.slice(0, 6), matches };
    }

    const extension = trouver('extension');
    if (extension && contientUn(marqueursExtensionForts) && !(process && contientUn(marqueursProcessForts))) {
      return { id: extension.id, label: extension.label, score: extension.score, indices: extension.mots.slice(0, 6), matches };
    }

    const qualite = trouver('qualite');
    if (qualite && contientUn(marqueursQualiteCrise)) {
      return { id: qualite.id, label: qualite.label, score: qualite.score, indices: qualite.mots.slice(0, 6), matches };
    }

    const capitalistique = trouver('capitalistique');
    if (capitalistique) {
      return { id: capitalistique.id, label: capitalistique.label, score: capitalistique.score, indices: capitalistique.mots.slice(0, 6), matches };
    }

    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const priorite = ["capitalistique", "logistique", "process", "extension", "qualite", "rh_recrutement", "packaging"];
      return priorite.indexOf(a.id) - priorite.indexOf(b.id);
    });

    const best = matches[0];
    return {
      id: best.id,
      label: best.label,
      score: best.score,
      indices: best.mots.slice(0, 6),
      matches
    };
  }

  window.FLAIR_PROFILS_METIER_ALIASES = FLAIR_PROFILS_METIER_ALIASES;
  window.FLAIR_TAXONOMIE_METIER = FLAIR_TAXONOMIE_METIER;
  window.FLAIR_SECTEURS_SOUS_SECTEURS_CIBLES = FLAIR_SECTEURS_SOUS_SECTEURS_CIBLES;
  window.FLAIR_SOURCE_VEILLE_RULES = FLAIR_SOURCE_VEILLE_RULES;
  window.FLAIR_DETECTER_FAMILLE_STRATEGIQUE_PROJET = detecterFamilleStrategiqueProjet;
  window.FLAIR_TIMING_COMMERCIAL = FLAIR_TIMING_COMMERCIAL;
  window.FLAIR_FAMILLES_PROJETS = FLAIR_FAMILLES_PROJETS;
  window.FLAIR_SOURCES_VEILLE_FREQUENCES_AUTORISEES = FLAIR_SOURCES_VEILLE_FREQUENCES_AUTORISEES;
  window.FLAIR_SOURCES_SPECIALISEES_RECOMMANDEES = FLAIR_SOURCES_SPECIALISEES_RECOMMANDEES;
  window.FLAIR_SOURCE_VEILLE = {
    rules: FLAIR_SOURCE_VEILLE_RULES,
    frequences_sources_autorisees: FLAIR_SOURCES_VEILLE_FREQUENCES_AUTORISEES,
    sources_specialisees_recommandees: FLAIR_SOURCES_SPECIALISEES_RECOMMANDEES,
    taxonomie_metier: FLAIR_TAXONOMIE_METIER,
    secteurs_sous_secteurs_cibles: FLAIR_SECTEURS_SOUS_SECTEURS_CIBLES,
    familles_projets: FLAIR_FAMILLES_PROJETS,
    timing_commercial: FLAIR_TIMING_COMMERCIAL,
    analyserSignalAvecRegles,
    detecterFamilleStrategiqueProjet,
    construireMatchingMetier,
    normaliserTexteFlair
  };
})();
