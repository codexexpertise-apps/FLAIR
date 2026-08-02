// =========================================================================
// FLAIR — MOTEUR LEXICAL MÉTIER V1.1 — CORRESPONDANCES GÉNÉRIQUES
// =========================================================================
// Objectif du Lot 4 : corriger les correspondances lexicales fragiles sans
// modifier le scoring, le timing, la crédibilité, la maturité ou le Copilote.
//
// Principes :
// - un mot simple est recherché comme mot entier ;
// - une expression composée accepte espaces, apostrophes et tirets comme
//   séparateurs équivalents ;
// - les accents sont neutralisés ;
// - les variantes grammaticales restent déclarées dans les taxonomies.
// =========================================================================

(function () {
  "use strict";

  function normaliserTexteFlair(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeRegexFlair(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function tokensLexicaux(value, normaliserFn = normaliserTexteFlair) {
    return String(normaliserFn(value) || "")
      .trim()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);
  }

  function construireRegexLexicale(motCle, normaliserFn = normaliserTexteFlair) {
    const tokens = tokensLexicaux(motCle, normaliserFn);
    if (!tokens.length) return null;

    const expression = tokens.map(escapeRegexFlair).join("[^a-z0-9]+");
    return new RegExp(`(^|[^a-z0-9])(${expression})(?=[^a-z0-9]|$)`, "i");
  }

  function diagnostiquerCorrespondance(options = {}) {
    const normaliser = typeof options.normaliserFn === "function"
      ? options.normaliserFn
      : normaliserTexteFlair;

    const texteNormalise = normaliser(options.texteNormalise ?? options.texte ?? "");
    const motCle = String(options.motCle || "");
    const regex = construireRegexLexicale(motCle, normaliser);
    const match = regex ? regex.exec(texteNormalise) : null;

    if (!match) {
      return {
        trouve: false,
        mot_cle: motCle,
        mot_cle_normalise: normaliser(motCle).trim(),
        occurrence: "",
        position: -1,
        mode: "mot_ou_expression_delimitee"
      };
    }

    const prefixe = match[1] || "";
    const occurrence = match[2] || "";
    const position = match.index + prefixe.length;

    return {
      trouve: true,
      mot_cle: motCle,
      mot_cle_normalise: normaliser(motCle).trim(),
      occurrence,
      position,
      mode: occurrence.includes(" ") || /[^a-z0-9]/i.test(occurrence)
        ? "expression_delimitee"
        : "mot_entier"
    };
  }

  function motOuExpressionPresent(texteNormalise = "", motCle = "", normaliserFn = null) {
    return diagnostiquerCorrespondance({
      texteNormalise,
      motCle,
      normaliserFn
    }).trouve;
  }

  function keywordMatchesText(keyword, texteNormalise) {
    return motOuExpressionPresent(texteNormalise, keyword, normaliserTexteFlair);
  }

  function motClePresentMetier(texteNormalise = "", motCle = "", normaliserFn = null) {
    return motOuExpressionPresent(texteNormalise, motCle, normaliserFn || normaliserTexteFlair);
  }

  // Wrappers historiques conservés pour compatibilité API.
  function normaliserTexteHistoriqueSource(value) {
    return normaliserTexteFlair(value);
  }

  function keywordMatchesTextHistoriqueSource(keyword, texteNormalise) {
    return keywordMatchesText(keyword, texteNormalise);
  }

  function motClePresentHistoriqueMetier(texteNormalise = "", motCle = "", normaliserFn = null) {
    return motClePresentMetier(texteNormalise, motCle, normaliserFn);
  }

  function diagnostiquerCorrespondanceHistorique(options = {}) {
    return diagnostiquerCorrespondance(options);
  }

  window.FLAIR_METIER_LEXIQUE = {
    version: "1.1.0-correspondances-generiques",
    mode: "correspondances_generiques",
    normaliserTexteFlair,
    normaliserTexteHistoriqueSource,
    escapeRegexFlair,
    tokensLexicaux,
    construireRegexLexicale,
    motOuExpressionPresent,
    keywordMatchesText,
    motClePresentMetier,
    diagnostiquerCorrespondance,
    // Compatibilité historique : mêmes noms publics, nouveau comportement corrigé.
    keywordMatchesTextHistoriqueSource,
    motClePresentHistoriqueMetier,
    diagnostiquerCorrespondanceHistorique
  };
})();
