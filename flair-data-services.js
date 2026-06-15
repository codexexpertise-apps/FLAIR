// =========================================================================
// FLAIR — DATA SERVICES V1.5
// =========================================================================
// Rôle : point d'entrée unique pour les requêtes Supabase utilisées par FLAIR.
// Objectif V1.5 : centraliser les accès aux tables métier sans modifier la
// logique existante des requêtes, filtres, tris, insert/update/upsert.
// =========================================================================
(function () {
  "use strict";

  function client() {
    const supabaseClient = window.supabaseClient || window.__FLAIR_SUPABASE_CLIENT__;
    if (!supabaseClient) {
      throw new Error("FLAIR_DATA_SERVICES : client Supabase non initialisé.");
    }
    return supabaseClient;
  }

  function table(nomTable) {
    return client().from(nomTable);
  }

  const api = {
    client,
    table,

    // Tables principales FLAIR
    signaux: () => table("signaux"),
    signauxCommerciaux: () => table("signaux_commerciaux"),
    commerciaux: () => table("commerciaux"),
    sourcesVeille: () => table("sources_veille"),
    recherchesIaCommerciaux: () => table("recherches_ia_commerciaux"),

    // Alias explicites pour futures extractions plus fines.
    lireSignaux: () => table("signaux"),
    lireDistributions: () => table("signaux_commerciaux"),
    lireCommerciaux: () => table("commerciaux"),
    lireSourcesVeille: () => table("sources_veille"),
    journalRecherchesIa: () => table("recherches_ia_commerciaux")
  };

  window.FLAIR_DATA_SERVICES = api;
})();
