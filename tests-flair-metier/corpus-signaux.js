'use strict';

const lexicalCases = [
  { id: 'soins_dans_besoins', texte: 'besoins industriels', motCle: 'soins', attenduCible: false, defautHistoriquePossible: true },
  { id: 'soins_positif', texte: 'fabrication de produits de soins', motCle: 'soins', attenduCible: true },
  { id: 'lot_dans_copilote', texte: 'copilote commercial', motCle: 'lot', attenduCible: false },
  { id: 'lots_positif', texte: 'production par lots', motCle: 'lots', attenduCible: true },
  { id: 'expression_ligne', texte: 'nouvelle ligne de production', motCle: 'ligne de production', attenduCible: true },
  { id: 'apostrophe_typographique', texte: 'impression d’emballages souples', motCle: 'impression d’emballages', attenduCible: true },
  { id: 'apostrophe_simple', texte: "impression d'emballages souples", motCle: "impression d'emballages", attenduCible: true },
  { id: 'tiret', texte: 'atelier de contre-collage', motCle: 'contre-collage', attenduCible: true },
  { id: 'accent', texte: 'fabrication cosmétique', motCle: 'cosmetique', attenduCible: true },
  { id: 'ccp_dans_haccp', texte: 'certification haccp', motCle: 'ccp', attenduCible: false }
];

const classificationCases = [
  {
    id: 'faux_positif_besoins',
    signal: { titre: 'Besoins industriels en illumination', description: 'L’entreprise modernise ses besoins industriels et ses équipements lumineux.' },
    attenduCible: { secteurInterdit: 'Cosmétique' },
    defautHistoriquePossible: true
  },
  {
    id: 'cosmetique_soins',
    signal: { titre: 'Nouvelle unité de soins cosmétiques', description: 'Fabrication de crèmes de soins et de maquillage.' },
    attenduCible: { secteur: 'Cosmétique' }
  },
  {
    id: 'agro_laitier',
    signal: { titre: 'Nouvelle ligne de fromagerie', description: 'Production de fromages et conditionnement de produits laitiers.' },
    attenduCible: { secteur: 'Agroalimentaire', sousContient: 'laitiers' }
  },
  {
    id: 'pharma_comprimes',
    signal: { titre: 'Extension d’un site pharmaceutique', description: 'Nouvelle ligne de comprimés et de gélules.' },
    attenduCible: { secteur: 'Pharmaceutique' }
  },
  {
    id: 'packaging_flowpack',
    signal: { titre: 'Investissement packaging', description: 'Nouvelle ligne flowpack avec operculage et barquettes.' },
    attenduCible: { secteur: 'Packaging' }
  },
  {
    id: 'process_neutre',
    signal: { titre: 'Nouvelle ligne de production', description: 'Automatisation et convoyage du process industriel.' },
    attenduCible: { secteurFacultatif: true }
  }
];

const sourceRuleCases = [
  {
    id: 'nouvelle_ligne_process',
    signal: { titre: 'Nouvelle ligne de production', description: 'Le site installe une ligne automatisée avec convoyage.' },
    attendu: { regleInclut: 'process' }
  },
  {
    id: 'consultation_niee',
    signal: { titre: 'Projet encore amont', description: 'Aucune consultation fournisseur n’est lancée à ce stade.' },
    attendu: { regleExclut: 'appel_offre_consultation' }
  },
  {
    id: 'qualite_corps_etranger',
    signal: { titre: 'Rappel produit', description: 'Rappel de lot après présence d’un corps étranger métallique.' },
    attendu: { famille: 'qualite' }
  },
  {
    id: 'extension',
    signal: { titre: 'Extension du site', description: 'Construction d’un nouveau bâtiment pour augmenter la capacité de production.' },
    attendu: { famille: 'extension' }
  }
];

const scoringCases = [
  {
    id: 'signal_ligne_credible',
    signal: {
      titre: 'Nouvelle ligne de production de biscuits',
      description: 'Investissement de 8 M€ dans une nouvelle ligne. Mise en service prévue dans six mois.',
      type_signal: 'nouvelle_ligne',
      region: 'grand_est'
    }
  },
  {
    id: 'signal_amont',
    signal: {
      titre: 'Projet industriel annoncé',
      description: 'Projet encore en phase amont. Les équipements devront être définis ultérieurement.',
      type_signal: 'investissement',
      region: 'bretagne'
    }
  }
];

module.exports = {
  lexicalCases,
  classificationCases,
  sourceRuleCases,
  scoringCases
};
