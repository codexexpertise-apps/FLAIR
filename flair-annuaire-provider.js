// =========================================================================
// FLAIR — PROVIDER ANNUAIRE EDGE FUNCTION V2026.2
// =========================================================================
// Rôle : brancher le module flair-annuaire-enrichissement.js sur une
// Supabase Edge Function sécurisée.
//
// Doctrine :
// - coordonnées publiques uniquement ;
// - aucune modification du score, timing, type_signal, chaleur ou crédibilité ;
// - aucune clé OpenAI dans le navigateur ;
// - 1 appel ciblé par signal, avec cache côté serveur.
// =========================================================================

(function () {
  "use strict";

  const FUNCTION_NAME = "flair-annuaire";
  const TIMEOUT_MS = 45000;
  const MEMOIRE_SESSION = new Map();

  function nettoyer(value) {
    return String(value ?? "").trim();
  }

  function cleMemoire(signal = {}, contexte = {}) {
    const entreprise = nettoyer(signal.entreprise_nom || signal.entreprise || contexte.entreprise_nom || contexte.entreprise).toLowerCase();
    const departement = nettoyer(signal.departement_code || contexte.departement_code || signal.departement_nom || contexte.departement_nom).toLowerCase();
    const region = nettoyer(signal.region_nom || signal.region || contexte.region_nom || contexte.region).toLowerCase();
    return [entreprise, departement, region].filter(Boolean).join("|");
  }

  async function invoquerEdgeFunction(body = {}) {
    const client = window.FLAIR_CONFIG?.supabaseClient || window.supabaseClient || window.__FLAIR_SUPABASE_CLIENT__;
    if (!client?.functions?.invoke) {
      throw new Error("Client Supabase indisponible pour l'enrichissement annuaire.");
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
        body,
        signal: controller.signal
      });

      if (error) {
        throw new Error(error.message || "Erreur Edge Function annuaire.");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data?.coordonnees || data || null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  window.FLAIR_ANNUAIRE_CONFIG = {
    rechercherCoordonnees: async ({ signal = {}, contexte = {}, prompt = "" } = {}) => {
      const key = cleMemoire(signal, contexte);
      if (key && MEMOIRE_SESSION.has(key)) return MEMOIRE_SESSION.get(key);

      const payload = {
        signal: {
          entreprise_nom: nettoyer(signal.entreprise_nom || signal.entreprise),
          titre: nettoyer(signal.titre),
          resume_brut: nettoyer(signal.resume_brut || signal.description || signal.texte_original),
          lien_source: nettoyer(signal.lien_source),
          region_nom: nettoyer(signal.region_nom || signal.region),
          departement_nom: nettoyer(signal.departement_nom),
          departement_code: nettoyer(signal.departement_code)
        },
        contexte: {
          entreprise_nom: nettoyer(contexte.entreprise_nom || contexte.entreprise || signal.entreprise_nom),
          localisation: nettoyer(contexte.localisation),
          region_nom: nettoyer(contexte.region_nom || signal.region_nom || signal.region),
          departement_nom: nettoyer(contexte.departement_nom || signal.departement_nom),
          departement_code: nettoyer(contexte.departement_code || signal.departement_code)
        },
        prompt: nettoyer(prompt)
      };

      const resultat = await invoquerEdgeFunction(payload);
      if (key && resultat) MEMOIRE_SESSION.set(key, resultat);
      return resultat;
    }
  };
})();
