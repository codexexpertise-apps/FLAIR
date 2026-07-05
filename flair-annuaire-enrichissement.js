// =========================================================================
// FLAIR — ENRICHISSEMENT ANNUAIRE V2026.2
// =========================================================================
// Rôle : enrichir un signal avec des coordonnées publiques OFFICIELLES,
// sans modifier le score, le timing, le type_signal ou la crédibilité.
//
// Doctrine :
// - ce module ne vend pas, ne score pas, ne qualifie pas le projet.
// - il prépare un second prompt "annuaire" ou exploite un provider externe
//   optionnel, si l'application en fournit un.
// - en absence de provider, il extrait seulement les coordonnées explicitement
//   présentes dans le texte importé.
// - aucune coordonnée n'est inventée ou déduite.
// =========================================================================

(function () {
  "use strict";

  const NON_TROUVE = "—";

  function nettoyerValeur(value) {
    const texte = String(value ?? "").trim();
    if (!texte || texte === NON_TROUVE || /^null$/i.test(texte) || /^undefined$/i.test(texte)) return "";
    return texte;
  }

  function normaliserTexte(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function estUrlOfficielleProbable(url = "") {
    const value = nettoyerValeur(url);
    if (!value) return false;
    if (!/^https?:\/\//i.test(value)) return false;
    return !/(facebook\.com|instagram\.com|linkedin\.com|societe\.com|pagesjaunes\.fr|verif\.com|kompass\.com|manageo\.fr|google\.|bing\.|wikipedia\.org)/i.test(value);
  }

  function normaliserUrl(url = "") {
    const value = nettoyerValeur(url).replace(/[),.;\]]+$/g, "");
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    if (/^www\./i.test(value)) return `https://${value}`;
    return "";
  }

  function extraireUrls(texte = "") {
    const urls = [];
    const source = String(texte || "");
    const regex = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;
    let match;
    while ((match = regex.exec(source)) !== null) {
      const url = normaliserUrl(match[0]);
      if (url && !urls.includes(url)) urls.push(url);
    }
    return urls;
  }

  function extraireEmails(texte = "") {
    const emails = [];
    const source = String(texte || "");
    const regex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
    let match;
    while ((match = regex.exec(source)) !== null) {
      const email = nettoyerValeur(match[0]).toLowerCase();
      if (email && !emails.includes(email)) emails.push(email);
    }
    return emails;
  }

  function emailGeneriquePrioritaire(emails = []) {
    const generiques = [
      "contact", "info", "accueil", "commercial", "sales", "hello",
      "serviceclient", "service-client", "relationclient", "relationsclients",
      "customer", "office", "administration"
    ];

    const scoreEmail = (email) => {
      const local = String(email || "").split("@")[0].toLowerCase();
      const index = generiques.findIndex(prefix => local === prefix || local.startsWith(`${prefix}.`) || local.startsWith(`${prefix}-`));
      if (index >= 0) return index;
      // On accepte un email publié dans le texte, mais on évite de valoriser les emails nominatifs.
      if (/^[a-z]+[._-][a-z]+$/.test(local)) return 999;
      return 100;
    };

    return (emails || [])
      .slice()
      .sort((a, b) => scoreEmail(a) - scoreEmail(b))[0] || "";
  }

  function extraireTelephones(texte = "") {
    const tels = [];
    const source = String(texte || "");
    const regex = /(?:\+33\s?|\b0)[1-9](?:[\s.\-]?\d{2}){4}\b/g;
    let match;
    while ((match = regex.exec(source)) !== null) {
      const tel = nettoyerValeur(match[0]).replace(/\s+/g, " ").trim();
      if (tel && !tels.includes(tel)) tels.push(tel);
    }
    return tels;
  }

  function choisirSiteOfficiel(urls = [], entreprise = "") {
    const entrepriseNorm = normaliserTexte(entreprise).replace(/[^a-z0-9]+/g, "");
    const candidats = (urls || []).filter(estUrlOfficielleProbable);
    if (!candidats.length) return "";

    const scoreUrl = (url) => {
      const domaine = normaliserTexte(url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].replace(/[^a-z0-9]+/g, "");
      let score = 0;
      if (entrepriseNorm && domaine.includes(entrepriseNorm.slice(0, Math.min(8, entrepriseNorm.length)))) score -= 20;
      if (/\/contact|\/nous-contacter|\/mentions-legales|\/legal/i.test(url)) score += 5;
      return score;
    };

    return candidats.slice().sort((a, b) => scoreUrl(a) - scoreUrl(b))[0] || "";
  }

  function choisirPageContact(urls = []) {
    return (urls || []).find(url => /\/contact|\/nous-contacter|\/contactez-nous|\/mentions-legales|\/mentions-l[eé]gales/i.test(url)) || "";
  }

  function extraireAdresseSimple(texte = "") {
    // Extraction volontairement prudente : uniquement si le texte contient un CP français
    // et un libellé de type adresse / siège / établissement / localisation.
    const lignes = String(texte || "")
      .split(/\n|;/)
      .map(l => l.trim())
      .filter(Boolean);

    const ligneAdresse = lignes.find(ligne => {
      const n = normaliserTexte(ligne);
      return /\b\d{5}\b/.test(ligne) &&
        /(adresse|siege|si[eè]ge|etablissement|site|rue|avenue|boulevard|route|zi|za|zac|parc d|allee|allée)/i.test(ligne) &&
        !/@/.test(ligne);
    });

    return nettoyerValeur(ligneAdresse || "");
  }

  function extraireCoordonneesDepuisTexte(texte = "", contexte = {}) {
    const urls = extraireUrls(texte);
    const emails = extraireEmails(texte);
    const tels = extraireTelephones(texte);

    const site = choisirSiteOfficiel(urls, contexte.entreprise_nom || contexte.entreprise || "");
    const pageContact = choisirPageContact(urls);
    const email = emailGeneriquePrioritaire(emails);
    const telephone = tels[0] || "";
    const adresse = extraireAdresseSimple(texte);

    const niveauConfiance = (site || telephone || email || adresse)
      ? "texte_source"
      : "non_trouve";

    return normaliserResultatAnnuaire({
      site_web: site,
      page_contact: pageContact,
      telephone,
      email_general: email,
      adresse,
      linkedin_entreprise: "",
      source_site: site,
      source_contact: pageContact || site,
      niveau_confiance: niveauConfiance
    });
  }

  function construirePromptAnnuaire(contexte = {}) {
    const entreprise = nettoyerValeur(contexte.entreprise_nom || contexte.entreprise || "");
    const localisation = nettoyerValeur(contexte.localisation || contexte.region_nom || contexte.region || contexte.departement_nom || "");

    return `CONTEXTE :
Tu es un assistant d'enrichissement de données B2B. L'utilisateur a détecté un projet industriel chez l'entreprise suivante : ${entreprise || "[NOM_ENTREPRISE]"}, située à ${localisation || "[LOCALISATION]"}.

MISSION :
Recherche exclusivement des informations de contact PUBLIQUES et OFFICIELLES pour l'établissement ou le siège de cette entreprise.

RÈGLES STRICTES :
1. Ne cherche QUE le site web officiel, la page contact, le téléphone du standard, l'adresse email générique, l'adresse publique et la page LinkedIn entreprise.
2. Priorité absolue au site officiel de l'entreprise.
3. Vérifie en priorité les pages : Contact, Nous contacter, Mentions légales, Implantations, Sites, Équipe ou Direction.
4. Si tu ne trouves pas l'information exacte pour cette localisation précise, cherche le site web national ou le siège social principal.
5. Si aucune information fiable n'est disponible publiquement sur le web officiel de l'entreprise, renvoie exclusivement un tiret "—" pour le champ concerné.
6. Tu as interdiction formelle d'inventer, de deviner ou de générer un email ou un numéro de téléphone théorique.
7. Retourne la source exacte utilisée pour chaque information quand elle existe.

FORMAT DE SORTIE JSON STRICT :
{
  "site_web": "URL ou —",
  "page_contact": "URL ou —",
  "telephone": "Numéro ou —",
  "email_general": "Email ou —",
  "adresse": "Adresse ou —",
  "linkedin_entreprise": "URL ou —",
  "source_site": "URL source ou —",
  "source_contact": "URL source ou —",
  "niveau_confiance": "officiel | texte_source | non_trouve"
}`;
  }

  function normaliserResultatAnnuaire(resultat = {}) {
    const site = normaliserUrl(resultat.site_web || resultat.entreprise_site_web || "");
    const pageContact = normaliserUrl(resultat.page_contact || resultat.contact_url || "");
    const linkedin = normaliserUrl(resultat.linkedin_entreprise || resultat.linkedin || "");
    const telephone = nettoyerValeur(resultat.telephone || resultat.telephone_standard || resultat.entreprise_telephone_standard || "");
    const email = nettoyerValeur(resultat.email_general || resultat.email_generique || resultat.entreprise_email_generique || "").toLowerCase();
    const adresse = nettoyerValeur(resultat.adresse || resultat.adresse_complete || "");
    const sourceSite = normaliserUrl(resultat.source_site || site || "");
    const sourceContact = normaliserUrl(resultat.source_contact || pageContact || site || "");
    const niveau = nettoyerValeur(resultat.niveau_confiance || "");

    return {
      site_web: site || NON_TROUVE,
      page_contact: pageContact || NON_TROUVE,
      telephone: telephone || NON_TROUVE,
      email_general: email || NON_TROUVE,
      adresse: adresse || NON_TROUVE,
      linkedin_entreprise: linkedin || NON_TROUVE,
      source_site: sourceSite || NON_TROUVE,
      source_contact: sourceContact || NON_TROUVE,
      niveau_confiance: ["officiel", "texte_source", "probable", "non_trouve"].includes(niveau) ? niveau : (site || telephone || email || adresse ? "texte_source" : "non_trouve")
    };
  }

  function valeurTrouvee(value) {
    const texte = nettoyerValeur(value);
    return Boolean(texte && texte !== NON_TROUVE);
  }

  function appliquerCoordonneesAuSignal(signal = {}, annuaire = {}) {
    const normalise = normaliserResultatAnnuaire(annuaire);
    const patch = {};

    if (valeurTrouvee(normalise.site_web)) {
      patch.entreprise_site_web = signal.entreprise_site_web || signal.site_web || normalise.site_web;
      patch.site_web = signal.site_web || signal.entreprise_site_web || normalise.site_web;
    }

    if (valeurTrouvee(normalise.telephone)) {
      patch.entreprise_telephone_standard = signal.entreprise_telephone_standard || signal.telephone_standard || normalise.telephone;
      patch.telephone_standard = signal.telephone_standard || signal.entreprise_telephone_standard || normalise.telephone;
    }

    if (valeurTrouvee(normalise.email_general)) {
      patch.entreprise_email_generique = signal.entreprise_email_generique || signal.email_generique || normalise.email_general;
      patch.email_generique = signal.email_generique || signal.entreprise_email_generique || normalise.email_general;
    }

    // Champs enrichis conservés en mémoire. Ils ne sont pas envoyés à Supabase
    // tant que les colonnes correspondantes ne sont pas garanties.
    if (valeurTrouvee(normalise.page_contact)) patch.entreprise_page_contact = normalise.page_contact;
    if (valeurTrouvee(normalise.adresse)) patch.entreprise_adresse = normalise.adresse;
    if (valeurTrouvee(normalise.linkedin_entreprise)) patch.entreprise_linkedin = normalise.linkedin_entreprise;
    if (valeurTrouvee(normalise.source_site)) patch.coordonnees_source_site = normalise.source_site;
    if (valeurTrouvee(normalise.source_contact)) patch.coordonnees_source_contact = normalise.source_contact;
    patch.coordonnees_niveau_confiance = normalise.niveau_confiance;

    return { ...signal, ...patch };
  }

  async function enrichirSignalAvecAnnuaire(signal = {}, options = {}) {
    const texteSource = String(options.texte || options.texte_source || signal.resume_brut || signal.description || "");
    const contexte = {
      entreprise_nom: signal.entreprise_nom || signal.entreprise || "",
      localisation: options.localisation || signal.localisation_connue || signal.departement_nom || signal.region_nom || signal.region || "",
      region_nom: signal.region_nom || signal.region || "",
      departement_nom: signal.departement_nom || ""
    };

    const depuisTexte = extraireCoordonneesDepuisTexte(texteSource, contexte);
    let signalEnrichi = appliquerCoordonneesAuSignal(signal, depuisTexte);

    const provider = window.FLAIR_ANNUAIRE_CONFIG?.rechercherCoordonnees;
    if (typeof provider === "function") {
      try {
        const resultatProvider = await provider({
          signal: { ...signalEnrichi },
          contexte,
          prompt: construirePromptAnnuaire(contexte)
        });

        if (resultatProvider) {
          signalEnrichi = appliquerCoordonneesAuSignal(signalEnrichi, resultatProvider);
        }
      } catch (err) {
        console.warn("Enrichissement annuaire indisponible :", err?.message || err);
      }
    }

    return signalEnrichi;
  }

  window.FLAIR_ANNUAIRE_ENRICHISSEMENT = {
    construirePromptAnnuaire,
    extraireCoordonneesDepuisTexte,
    normaliserResultatAnnuaire,
    appliquerCoordonneesAuSignal,
    enrichirSignalAvecAnnuaire
  };
})();
