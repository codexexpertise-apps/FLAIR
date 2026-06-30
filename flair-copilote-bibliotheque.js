// =========================================================================
// FLAIR — BIBLIOTHÈQUE MÉTIER COPILOTE V2026.2
// =========================================================================
// Rôle : base de formulations commerciales contextuelles.
// Ce fichier ne contient aucune règle de scoring, de crédibilité ou de timing.
// Il sert uniquement à enrichir la lisibilité du Copilote, pour les signaux IA
// comme pour les signaux Terrain, en restant conforme à la doctrine FLAIR.
// =========================================================================

(function () {
  "use strict";

  const BIBLIOTHEQUE = {
    meta: {
      version: "V2026.2",
      doctrine: "Copilote lisible, contextuel, compatible Collecte IA et Collecte Terrain.",
      principes: [
        "Ne jamais augmenter le score avec une phrase Copilote.",
        "Ne jamais transformer un contact terrain en preuve commerciale.",
        "Ne jamais inventer un contact, une consultation ou une spécialisation.",
        "Préférer une formulation prudente lorsque le contexte est incomplet."
      ]
    },

    pourquoi: {
      investissement: [
        "L’enveloppe annoncée crée une fenêtre utile pour identifier les lots techniques encore ouverts.",
        "Un investissement industriel déclenche souvent des arbitrages équipements avant le choix des fournisseurs.",
        "Le budget communiqué justifie une qualification commerciale, sans présumer que la consultation est ouverte.",
        "La modernisation du site peut générer des besoins périphériques en contrôle, intégration ou automatisation.",
        "Ce type d’investissement mérite d’identifier rapidement qui pilote les choix industriels.",
        "La priorité est de comprendre si les équipements de contrôle font partie du périmètre du projet.",
        "Un CAPEX visible est un bon prétexte pour ouvrir un échange de qualification non intrusif.",
        "Le projet peut créer une opportunité si les spécifications techniques ne sont pas encore figées.",
        "L’annonce d’investissement indique une dynamique industrielle, mais le niveau de maturité doit être confirmé.",
        "Une enveloppe significative peut cacher plusieurs lots : process, conditionnement, contrôle, maintenance ou automatisation.",
        "L’intérêt commercial dépendra surtout du calendrier achats et de l’ouverture réelle aux fournisseurs.",
        "Le montant annoncé permet de prioriser le suivi, tout en restant prudent sur le timing.",
        "L’investissement confirme un contexte industriel actif, favorable à une prise d’information structurée.",
        "La modernisation peut être l’occasion de remettre à plat les standards équipements du site.",
        "Le projet doit être qualifié avant toute approche commerciale appuyée."
      ],

      nouvelle_ligne: [
        "Une ligne nouvelle implique généralement des choix d’intégration, de cadence et de contrôle qualité.",
        "Le signal est pertinent car les équipements de ligne sont souvent définis avant la mise en production.",
        "La création ou l’évolution d’une ligne ouvre une fenêtre pour qualifier les points de contrôle.",
        "Une nouvelle capacité industrielle peut nécessiter des équipements périphériques encore non spécifiés.",
        "La ligne annoncée doit être analysée sous l’angle cadence, rejet, intégration et validation qualité.",
        "L’opportunité se situe probablement autour des interfaces entre production, qualité et maintenance.",
        "Une ligne neuve impose souvent de revoir les contrôles en ligne avant démarrage.",
        "Le bon enjeu n’est pas seulement la ligne, mais les équipements de sécurisation autour de cette ligne.",
        "Ce projet peut ouvrir un besoin si les points de contrôle ne sont pas déjà verrouillés par l’intégrateur.",
        "La priorité est de savoir qui définit les équipements et à quelle échéance.",
        "Le signal mérite une qualification car une ligne nouvelle entraîne souvent de nouveaux standards de contrôle.",
        "Le contexte laisse supposer des choix techniques à confirmer avant figement du cahier des charges.",
        "La ligne peut nécessiter des essais, validations et adaptations avec les équipes qualité et maintenance.",
        "Une ligne industrielle nouvelle est rarement isolée : elle implique souvent convoyage, contrôle, rejet et traçabilité.",
        "Le potentiel commercial dépendra du stade réel du projet et de l’intégrateur retenu ou non."
      ],

      extension: [
        "Une extension industrielle peut créer des besoins transverses : implantation, flux, contrôle et maintenance.",
        "L’agrandissement du site est un signal intéressant si les lots équipements ne sont pas encore figés.",
        "La montée en capacité doit être qualifiée pour identifier les impacts sur les lignes existantes.",
        "Une extension peut générer des opportunités même sans ligne explicitement décrite.",
        "Le projet mérite une approche prudente centrée sur planning, lots techniques et responsables projet.",
        "L’intérêt commercial dépendra du lien entre bâtiment, process et équipements de contrôle.",
        "Une extension peut modifier les flux et nécessiter de nouveaux points de contrôle ou de rejet.",
        "Le bon angle consiste à comprendre comment le site va absorber la capacité supplémentaire.",
        "L’annonce d’extension justifie de rechercher le pilote travaux neufs ou industrialisation.",
        "Le projet peut être encore bâtimentaire : il faut confirmer la partie équipements avant de prioriser."
      ],

      qualite: [
        "Le contexte qualité peut justifier une qualification prioritaire des points de contrôle et de prévention.",
        "Un signal qualité documenté peut déclencher des besoins de sécurisation de ligne.",
        "L’enjeu est de comprendre si l’entreprise cherche à renforcer ses contrôles ou ses preuves qualité.",
        "Le sujet peut ouvrir une discussion sur prévention, détection, rejet et traçabilité des non-conformités.",
        "La valeur commerciale dépendra du niveau de risque, de récurrence et de décision corrective.",
        "Un incident ou risque documenté doit être traité avec prudence, sans dramatiser l’approche commerciale.",
        "Ce type de signal peut révéler un besoin latent de contrôle, d’audit ligne ou de validation process.",
        "La priorité est de qualifier les actions déjà décidées et les équipements envisagés.",
        "Un enjeu qualité peut accélérer les arbitrages si le site cherche une solution préventive.",
        "Le contact qualité ou production doit permettre de comprendre si le besoin est ponctuel ou structurel."
      ],

      logistique: [
        "Un projet logistique peut ouvrir des besoins en flux, traçabilité, convoyage, tri ou automatisation.",
        "La valeur commerciale se situe dans la compréhension des flux et des interfaces équipements.",
        "Une plateforme ou un entrepôt en évolution peut nécessiter des lots techniques encore ouverts.",
        "Le signal doit être qualifié autour de l’exploitation, de la cadence et de l’intégration.",
        "Les enjeux de montée en charge logistique peuvent générer des besoins en contrôle et automatisation.",
        "Le bon angle consiste à identifier les flux critiques et les équipements déjà retenus.",
        "Un projet orienté flux mérite une qualification avec exploitation, maintenance ou automatisation.",
        "La priorité est de savoir si le projet porte sur bâtiment, process logistique ou équipements internes.",
        "Un site logistique nouveau peut impliquer convoyage, tri, pesage, traçabilité ou contrôle codes.",
        "L’opportunité dépendra des lots ouverts et du rôle de l’intégrateur."
      ],

      capitalistique: [
        "Un changement d’actionnaire peut entraîner une harmonisation des standards industriels.",
        "La recomposition capitalistique peut ouvrir des décisions d’investissement ou de rationalisation fournisseurs.",
        "Le signal est intéressant si le groupe remet à plat achats, process ou équipements.",
        "Après une acquisition, les directions industrielles peuvent chercher à standardiser les sites.",
        "L’opportunité dépendra des priorités post-rachat : capacité, qualité, productivité ou intégration.",
        "Le bon angle est de comprendre si une feuille de route industrielle accompagne l’opération.",
        "Un regroupement peut créer un besoin de référencement fournisseur ou d’audit équipements.",
        "Le signal doit être suivi pour repérer les investissements concrets qui suivront l’opération.",
        "Le potentiel commercial est réel, mais dépend d’un prochain jalon industriel observable.",
        "La prise de contact doit rester exploratoire, orientée priorités industrielles et calendrier."
      ],

      terrain: [
        "Le signal terrain apporte un contexte utile, mais il doit rejoindre le même pipeline de qualification.",
        "L’information recueillie sur le terrain est précieuse pour préparer l’action, sans modifier le score.",
        "Le contact déjà identifié facilite l’entrée commerciale, mais ne constitue pas une preuve de maturité.",
        "L’origine terrain permet de personnaliser l’approche avec davantage de pertinence.",
        "Le retour terrain doit être transformé en opportunité qualifiée avant toute priorisation forte.",
        "Le commercial dispose d’un point d’entrée, mais le calendrier et le périmètre restent à confirmer.",
        "Le signal terrain mérite une action contextualisée, fondée sur le contact rencontré et le projet évoqué.",
        "L’enjeu est de passer d’une information brute à une qualification structurée.",
        "Le contact terrain peut accélérer la prise d’information, pas la crédibilité du projet.",
        "Cette information est utile si elle est reliée à un besoin, un site, un timing et une décision."
      ],

      annonce: [
        "L’annonce est exploitable, mais ne prouve pas encore que les achats sont ouverts.",
        "Le signal doit être traité comme une piste à qualifier, pas comme une opportunité déjà mûre.",
        "L’information publique donne un bon prétexte d’approche, sous réserve de confirmer le stade projet.",
        "Le projet est intéressant, mais le niveau d’avancement doit être vérifié avant action forte.",
        "Une annonce industrielle doit être reliée à un calendrier, des lots et des décideurs.",
        "Le bon réflexe est de confirmer si les fournisseurs sont déjà retenus.",
        "Le signal est prometteur, mais la maturité commerciale reste à établir.",
        "L’annonce mérite une veille active si aucune consultation n’est identifiée.",
        "La qualification doit porter sur le périmètre réellement ouvert.",
        "Il faut éviter de confondre visibilité médiatique et fenêtre commerciale."
      ],

      generic: [
        "Le signal mérite une qualification courte pour valider besoin, timing et décideurs.",
        "L’information est commercialement exploitable si elle se relie à un projet équipement concret.",
        "La priorité est de transformer ce signal en échange utile avec le bon interlocuteur.",
        "Le potentiel existe, mais doit être confirmé par un calendrier et un périmètre technique.",
        "Le signal est compatible avec une démarche de qualification, sans conclusion prématurée.",
        "L’intérêt commercial dépendra de la maturité réelle et des fournisseurs déjà engagés.",
        "Ce contexte industriel peut générer une opportunité si les choix techniques restent ouverts.",
        "La prochaine étape doit rester simple : comprendre le projet avant de vendre une solution.",
        "La valeur du signal repose sur sa capacité à déclencher une action commerciale concrète.",
        "FLAIR doit ici aider à préparer l’échange, pas à surinterpréter l’information."
      ]
    },

    vigilance: {
      geo: [
        "Localisation insuffisante : confirmer le site concerné avant de prioriser.",
        "La géographie doit être vérifiée avant toute action terrain.",
        "Ne pas déduire le site industriel si le texte ne le démontre pas.",
        "Confirmer commune, département ou établissement avant contact opérationnel.",
        "Un signal multi-sites nécessite d’identifier le site réellement porteur du projet."
      ],
      amont: [
        "Phase amont probable : privilégier une prise d’information légère.",
        "Ne pas engager d’approche commerciale forte tant que les jalons ne sont pas clarifiés.",
        "Surveiller budget, consultation, travaux ou recrutement projet avant accélération.",
        "Le signal est intéressant mais doit rester en veille active.",
        "Risque de timing trop précoce : chercher le prochain jalon concret.",
        "La priorité est d’obtenir une date de relance pertinente.",
        "Ne pas pousser une offre avant d’avoir confirmé le périmètre équipement.",
        "Le projet peut être stratégique mais pas encore achetable.",
        "Conserver le signal, mais éviter la pression commerciale.",
        "Rechercher un indice de maturité : permis, travaux, consultation, intégrateur ou mise en service."
      ],
      annonce: [
        "Annonce publique ne signifie pas consultation ouverte.",
        "Vérifier si les fournisseurs sont déjà consultés ou retenus.",
        "Confirmer le périmètre technique avant toute proposition.",
        "Identifier le pilote projet avant de solliciter plusieurs interlocuteurs.",
        "Le budget annoncé ne suffit pas à qualifier le besoin équipement.",
        "Ne pas supposer que la ligne ou le lot contrôle est inclus.",
        "Confirmer calendrier, lots ouverts et rôle éventuel d’un intégrateur.",
        "Attention à l’effet presse : le projet peut déjà être avancé.",
        "Vérifier si l’annonce concerne le site, la ligne ou seulement le bâtiment.",
        "Commencer par une qualification simple plutôt qu’une démarche commerciale directe."
      ],
      tard: [
        "Fenêtre peut-être passée : chercher une phase 2 ou un besoin complémentaire.",
        "Projet possiblement déjà attribué : ne pas prioriser sans lot ouvert.",
        "Vérifier s’il reste maintenance, extension, remplacement ou standardisation à adresser.",
        "Ne pas investir trop d’effort si les équipements sont déjà installés.",
        "Approche possible uniquement si un besoin résiduel est plausible."
      ],
      qualite: [
        "Traiter le sujet qualité avec prudence : comprendre avant de proposer.",
        "Ne pas dramatiser le risque ; qualifier les actions correctives déjà engagées.",
        "Vérifier si le besoin est ponctuel, réglementaire ou structurel.",
        "Identifier si le sujet relève de la qualité, de la production ou de la maintenance.",
        "Confirmer l’existence d’un plan d’action avant de parler équipement."
      ],
      terrain: [
        "Le contact terrain enrichit l’approche mais ne doit pas modifier le score.",
        "Ne pas considérer une conversation terrain comme une consultation lancée.",
        "Requalifier le besoin, le timing et les décideurs avant toute opportunité CRM.",
        "Le nom du contact doit servir à personnaliser l’action, pas à gonfler la crédibilité.",
        "Vérifier que l’information terrain est suffisamment précise pour être exploitable."
      ],
      generic: [
        "Confirmer calendrier, décideurs, périmètre technique et fournisseurs engagés.",
        "Qualifier le stade réel du projet avant de prioriser fortement.",
        "Ne pas présumer l’ouverture fournisseur.",
        "Vérifier le bon interlocuteur avant d’engager une action commerciale.",
        "Rechercher les preuves manquantes avant relance appuyée.",
        "Rester factuel : ce signal indique un contexte, pas encore une décision d’achat.",
        "Clarifier le rôle de l’intégrateur éventuel.",
        "Identifier les contraintes qualité, cadence et implantation.",
        "Vérifier si le projet concerne une ligne existante ou une nouvelle implantation.",
        "S’assurer que l’action proposée est proportionnée à la maturité du signal."
      ]
    },

    action: {
      urgence: [
        "Contacter {contact} rapidement pour vérifier si les choix équipements sont encore ouverts.",
        "Proposer un échange court sous 48 h avec {contact} pour qualifier périmètre et calendrier.",
        "Identifier immédiatement le décideur technique et le niveau d’urgence réel.",
        "Valider sans délai si le projet accepte encore de nouveaux fournisseurs.",
        "Préparer un appel court centré sur lot ouvert, planning et interlocuteur décisionnaire."
      ],
      ideal: [
        "Prendre contact maintenant avec {contact} avant figement des choix techniques.",
        "Qualifier le calendrier avec {contact} et identifier les fournisseurs déjà consultés.",
        "Initier un échange court pour comprendre planning, lots ouverts et contraintes qualité.",
        "Se positionner en amont du cahier des charges, sans approche trop insistante.",
        "Chercher le bon pilote projet et obtenir une date de relance structurée.",
        "Demander si les équipements de contrôle ou d’intégration sont déjà spécifiés.",
        "Identifier l’intégrateur éventuel et les lots encore ouverts.",
        "Préparer une approche conseil autour du besoin, pas une offre immédiate.",
        "Valider le stade projet avant de créer une opportunité CRM.",
        "Faire confirmer le calendrier achats et le niveau de décision."
      ],
      amont: [
        "Qualifier légèrement le projet avec {contact}, puis planifier une relance.",
        "Entrer en veille active et rechercher le prochain jalon concret.",
        "Identifier le pilote industriel et la date probable de cadrage technique.",
        "Documenter le signal sans pression commerciale.",
        "Demander qui suivra les choix équipements lorsque le projet avancera.",
        "Programmer une relance liée à travaux, consultation ou mise en service.",
        "Vérifier si le projet est encore bâtimentaire ou déjà orienté équipements.",
        "Rechercher un contact travaux neufs ou industrialisation.",
        "Créer un suivi projet plutôt qu’une opportunité immédiate.",
        "Conserver le signal jusqu’à preuve de maturité plus forte."
      ],
      veille: [
        "Mettre le projet sous surveillance et attendre un signal de maturité.",
        "Suivre les prochains jalons publics avant action commerciale forte.",
        "Créer une veille projet : consultation, travaux, recrutement, mise en service.",
        "Ne pas prioriser l’appel immédiat sans nouvel indice.",
        "Prévoir une relance documentaire si un jalon apparaît.",
        "Surveiller les communications site, recrutement et investissements complémentaires.",
        "Chercher une preuve d’équipement avant de mobiliser du temps commercial.",
        "Identifier l’entreprise et le site, puis rester en observation structurée.",
        "Relancer uniquement si un événement confirme l’avancement.",
        "Classer en suivi long sans surcharger le pipeline commercial."
      ],
      tard: [
        "Ne pas prioriser sauf extension, phase 2 ou besoin complémentaire.",
        "Chercher un angle maintenance, remplacement ou standardisation future.",
        "Vérifier si un nouveau site ou un autre lot reste ouvert.",
        "Classer en suivi si aucun besoin résiduel n’est identifiable.",
        "Éviter une approche commerciale tardive non contextualisée."
      ],
      terrain: [
        "Reprendre contact avec {contact} pour confirmer le besoin évoqué sur le terrain.",
        "Utiliser le contact terrain comme point d’entrée, puis requalifier projet, timing et décideurs.",
        "Transformer l’information terrain en échange structuré : besoin, échéance, périmètre et suite attendue.",
        "Préparer une relance personnalisée en rappelant le contexte de l’échange terrain.",
        "Vérifier avec {contact} si l’information peut être partagée avec le décideur projet.",
        "Demander au contact terrain qui pilote réellement le sujet côté industriel.",
        "Confirmer que le besoin est actuel, budgété ou simplement en réflexion.",
        "Utiliser la relation existante pour obtenir le bon interlocuteur, sans présumer l’achat.",
        "Requalifier la maturité avant création d’opportunité commerciale.",
        "Faire préciser le prochain jalon utile : réunion projet, budget, consultation ou essai."
      ],
      generic: [
        "Qualifier le calendrier, les décideurs et le périmètre technique.",
        "Identifier le bon interlocuteur puis vérifier si le besoin équipement est ouvert.",
        "Préparer un premier échange centré sur planning, équipements et contraintes.",
        "Valider d’abord le niveau de maturité commerciale.",
        "Chercher le pilote projet et le prochain jalon décisionnel.",
        "Confirmer les fournisseurs déjà en place avant d’aller plus loin.",
        "Structurer la prise de contact autour d’une question simple.",
        "Obtenir une information de timing avant toute proposition.",
        "Vérifier si le sujet relève de la production, de la qualité ou de la maintenance.",
        "Passer du signal à une action mesurable : appel, qualification ou relance."
      ]
    },

    angle: {
      detection: {
        qualite: [
          "Quels contrôles contaminants ou points d’inspection doivent être renforcés ?",
          "Les risques corps étrangers sont-ils traités par contrôle métal, rayons X ou inspection complémentaire ?",
          "Les CCP et points de rejet sont-ils déjà définis ou encore ouverts ?",
          "Quels défauts ou contaminants cherchez-vous à mieux sécuriser ?",
          "Les contrôles actuels couvrent-ils les nouveaux formats ou cadences ?",
          "Avez-vous prévu une validation qualité des équipements avant démarrage ?",
          "Le besoin porte-t-il sur prévention, détection, rejet ou traçabilité de preuve ?",
          "Quels écarts qualité souhaitez-vous éviter sur la future configuration de ligne ?"
        ],
        ligne: [
          "Comment les points de détection ou rayons X seront-ils intégrés sur la nouvelle ligne ?",
          "Les équipements de contrôle contaminants sont-ils déjà spécifiés ?",
          "Quels points de contrôle qualité devront être intégrés avant mise en production ?",
          "La cadence prévue impose-t-elle des contraintes particulières de détection ou de rejet ?",
          "Les produits seront-ils contrôlés en vrac, conditionnés, en carton ou en fin de ligne ?",
          "L’intégrateur a-t-il déjà prévu l’espace, les interfaces et les rejets ?",
          "Quels formats produit devront passer sur les équipements de contrôle ?",
          "Le choix entre détecteur de métaux et rayons X est-il déjà arbitré ?",
          "Les validations qualité et maintenance sont-elles intégrées au planning projet ?",
          "Les points de contrôle seront-ils standards groupe ou spécifiques au site ?"
        ],
        extension: [
          "Quels équipements de contrôle devront être prévus dans l’extension ?",
          "L’extension modifie-t-elle les flux produit ou les points de contrôle existants ?",
          "Les contrôles qualité de la future zone sont-ils déjà spécifiés ?",
          "Le projet bâtiment inclut-il déjà les réservations pour inspection, rejet et maintenance ?",
          "À quel stade sont les choix détection, rayons X ou inspection ?",
          "Les nouvelles capacités nécessitent-elles de nouveaux standards de contrôle ?",
          "Le site prévoit-il une harmonisation des contrôles avec les lignes existantes ?",
          "Qui pilote les choix équipements entre travaux neufs, production et qualité ?"
        ],
        generic: [
          "Où en êtes-vous sur la définition des contrôles qualité en ligne ?",
          "Les besoins détection, rayons X ou inspection sont-ils déjà couverts ?",
          "Quels équipements de sécurisation produit restent à définir ?",
          "Quel est le niveau d’exigence qualité attendu sur ce projet ?",
          "Les fournisseurs de contrôle sont-ils déjà consultés ?",
          "Quels points de rejet, traçabilité ou preuves qualité doivent être prévus ?",
          "Le projet comporte-t-il des contraintes produits particulières : humidité, emballage, densité, format ?",
          "Quels interlocuteurs valideront les choix contrôle : qualité, production ou maintenance ?"
        ]
      },

      packaging: {
        generic: [
          "Quels choix packaging restent ouverts : support, impression, contrôle ou transformation ?",
          "Les matériaux, formats, décors et fournisseurs sont-ils déjà définis ?",
          "Le projet implique-t-il films, étiquettes, cartons, encres ou standards d’impression ?",
          "La ligne impose-t-elle de nouveaux formats ou nouvelles cadences de conditionnement ?",
          "Quels essais packaging sont prévus avant industrialisation ?",
          "Le besoin porte-t-il sur primaire, secondaire, impression ou finition ?",
          "Les contraintes qualité impression ou traçabilité sont-elles intégrées au cahier des charges ?",
          "L’entreprise cherche-t-elle à standardiser ses fournisseurs packaging ?",
          "Quels supports devront être validés par production, qualité et achats ?",
          "Le projet implique-t-il une modification des bobines, étuis, sleeves ou cartons ?"
        ]
      },

      pesage: {
        generic: [
          "Les besoins de pesage, contrôle pondéral et rejet sont-ils déjà spécifiés ?",
          "Comment le site prévoit-il de maîtriser poids, tolérances et traçabilité ?",
          "La nouvelle cadence nécessite-t-elle une trieuse pondérale ou un contrôle en ligne ?",
          "Quels formats produits devront être contrôlés en poids ?",
          "Les données poids devront-elles être reliées à l’étiquetage ou au reporting qualité ?",
          "Le besoin relève-t-il du contrôle réglementaire, de la performance ou de la traçabilité ?",
          "Quels rejets, statistiques ou preuves de conformité seront attendus ?",
          "Le site a-t-il déjà défini les contraintes métrologie et validation ?"
        ]
      },

      process: {
        generic: [
          "Quels équipements de process, convoyage ou fin de ligne restent à définir ?",
          "La cadence, les formats et l’intégration avec l’existant sont-ils déjà figés ?",
          "Quels flux produit seront les plus sensibles dans ce projet ?",
          "Le besoin porte-t-il sur convoyage, dosage, conditionnement, robotisation ou palettisation ?",
          "L’intégrateur est-il déjà choisi ou les lots techniques restent-ils ouverts ?",
          "Quels points d’accumulation, transfert ou rejet doivent être prévus ?",
          "Les contraintes maintenance et nettoyage sont-elles intégrées à la conception ?",
          "La montée en capacité nécessite-t-elle une automatisation complémentaire ?"
        ]
      },

      vision: {
        generic: [
          "Quels contrôles visuels, codes ou marquages devront être sécurisés ?",
          "Les besoins vision, OCR, codes ou conformité étiquetage sont-ils cadrés ?",
          "Quels défauts produit ou emballage devront être détectés automatiquement ?",
          "La cadence de ligne impose-t-elle une inspection vision en continu ?",
          "Les preuves de contrôle devront-elles être archivées ou reliées à la traçabilité ?",
          "Le besoin porte-t-il sur présence, conformité, marquage, code ou défaut visuel ?",
          "L’éclairage, la caméra et l’intégration automate sont-ils déjà définis ?",
          "Quels critères qualité doivent être validés avant mise en production ?"
        ]
      },

      generic: [
        "Où en est le projet et quels choix techniques restent ouverts ?",
        "Quel est le calendrier réel et qui pilote les choix équipements ?",
        "Quels fournisseurs sont déjà consultés et quels lots restent à attribuer ?",
        "Le projet est-il en cadrage, consultation, travaux ou mise en service ?",
        "Quels besoins sont déjà figés et lesquels restent à qualifier ?",
        "Qui décide techniquement et qui valide économiquement ?",
        "Quel est le prochain jalon : budget, consultation, essai, installation ou démarrage ?",
        "Quels risques industriels cherchent-ils à réduire avec ce projet ?"
      ]
    }
  };

  function get() {
    return BIBLIOTHEQUE;
  }

  window.FLAIR_COPILOTE_BIBLIOTHEQUE = {
    get,
    BIBLIOTHEQUE
  };
})();
