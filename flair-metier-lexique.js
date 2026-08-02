// =========================================================================
// FLAIR — MOTEUR LEXICAL MÉTIER V1.0 — MODE COMPATIBILITÉ STRICTE
// =========================================================================
// Objectif du Lot 2 : centraliser les fonctions lexicales historiques sans
// modifier leurs résultats. Les faux positifs connus sont donc volontairement
// conservés à ce stade afin de permettre une comparaison avant/après fiable.
//
// Ce module ne contient :
// - aucune taxonomie sectorielle ;
// - aucun scoring ;
// - aucune logique de timing, crédibilité, maturité ou Copilote.
// =========================================================================

(function () {
  "use strict";

  function normaliserTexteHistoriqueSource(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeRegexFlair(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function keywordMatchesTextHistoriqueSource(keyword, texteNormalise) {
    const keywordNormalise = normaliserTexteHistoriqueSource(keyword).trim();
    if (!keywordNormalise) return false;

    // Compatibilité stricte source-veille-rules.js : seuls les mots-clés
    // de 3 caractères ou moins utilisent des limites lexicales.
    if (keywordNormalise.length <= 3) {
      const pattern = new RegExp(
        `(^|[^a-z0-9])${escapeRegexFlair(keywordNormalise)}([^a-z0-9]|$)`,
        "i"
      );
      return pattern.test(String(texteNormalise || ""));
    }

    return String(texteNormalise || "").includes(keywordNormalise);
  }

  function motClePresentHistoriqueMetier(texteNormalise = "", motCle = "", normaliserFn = null) {
    const normaliser = typeof normaliserFn === "function"
      ? normaliserFn
      : normaliserTexteHistoriqueSource;

    const mot = normaliser(motCle);
    if (!mot) return false;

    // Compatibilité stricte flair-metier.js : mots de 4 caractères ou moins,
    // plus la liste historique d'ambiguïtés, recherchés avec limites lexicales.
    if (mot.length <= 4 || ["soin", "lot", "os", "map"].includes(mot)) {
      const escaped = escapeRegexFlair(mot);
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i")
        .test(String(texteNormalise || ""));
    }

    return String(texteNormalise || "").includes(mot);
  }

  function diagnostiquerCorrespondanceHistorique(options = {}) {
    const mode = options.mode === "source_veille" ? "source_veille" : "metier";
    const texte = String(options.texteNormalise || "");
    const motCle = String(options.motCle || "");
    const normaliserFn = options.normaliserFn;

    const trouve = mode === "source_veille"
      ? keywordMatchesTextHistoriqueSource(motCle, texte)
      : motClePresentHistoriqueMetier(texte, motCle, normaliserFn);

    const normaliser = mode === "source_veille"
      ? normaliserTexteHistoriqueSource
      : (typeof normaliserFn === "function" ? normaliserFn : normaliserTexteHistoriqueSource);
    const motNormalise = normaliser(motCle).trim();
    const position = trouve && motNormalise ? texte.indexOf(motNormalise) : -1;

    return {
      trouve,
      mot_cle: motCle,
      mot_cle_normalise: motNormalise,
      occurrence: position >= 0 ? texte.slice(position, position + motNormalise.length) : "",
      position,
      mode: mode === "source_veille" ? "historique_source_veille" : "historique_metier"
    };
  }

  window.FLAIR_METIER_LEXIQUE = {
    version: "1.0.0-compatibilite-stricte",
    mode: "compatibilite_stricte",
    normaliserTexteHistoriqueSource,
    escapeRegexFlair,
    keywordMatchesTextHistoriqueSource,
    motClePresentHistoriqueMetier,
    diagnostiquerCorrespondanceHistorique
  };
})();
