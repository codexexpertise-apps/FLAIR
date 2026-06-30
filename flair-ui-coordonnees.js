// =========================================================================
// FLAIR — UI COORDONNÉES PUBLIQUES V2026.2
// =========================================================================
// Rôle : préparer l'affichage enrichi des coordonnées publiques sans alourdir
// app.js. Ce module n'invente aucune donnée : il affiche uniquement les champs
// présents dans le signal ou sa distribution.
// =========================================================================

(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function lire(s = {}, cles = []) {
    for (const cle of cles) {
      const valeur = s?.[cle] ?? s?.signal?.[cle];
      if (valeur !== null && valeur !== undefined && String(valeur).trim() !== "") {
        return String(valeur).trim();
      }
    }
    return "";
  }

  function coordonneesDepuisSignal(s = {}) {
    return {
      site_web: lire(s, ["entreprise_site_web", "site_web", "siteweb", "url_site"]),
      telephone_standard: lire(s, ["entreprise_telephone_standard", "telephone_standard", "telephone", "tel_standard"]),
      email_generique: lire(s, ["entreprise_email_generique", "email_generique", "email_contact", "contact_email"]),
      adresse: lire(s, ["entreprise_adresse", "adresse", "adresse_complete", "site_adresse"]),
      page_contact: lire(s, ["entreprise_page_contact", "page_contact", "url_contact", "contact_url"]),
      formulaire_contact: lire(s, ["entreprise_formulaire_contact", "formulaire_contact", "url_formulaire_contact"]),
      linkedin_entreprise: lire(s, ["entreprise_linkedin", "linkedin_entreprise", "linkedin_url", "url_linkedin"]),
      contact_public_nom: lire(s, ["contact_public_nom", "contact_nom_public", "nom_contact_public"]),
      contact_public_fonction: lire(s, ["contact_public_fonction", "contact_fonction_public", "fonction_contact_public"]),
      contact_public_source_url: lire(s, ["contact_public_source_url", "source_contact_public", "url_source_contact_public"]),
      contact_terrain_nom: lire(s, ["contact_terrain_nom", "contact_nom", "nom_contact", "terrain_contact_nom"]),
      contact_terrain_fonction: lire(s, ["contact_terrain_fonction", "contact_fonction", "fonction_contact", "terrain_contact_fonction"]),
      coordonnees_source: lire(s, ["coordonnees_source", "source_coordonnees", "source_contact"]),
      coordonnees_niveau: lire(s, ["coordonnees_niveau", "niveau_coordonnees"])
    };
  }

  function ligne(label, valeur, options = {}) {
    const afficherVide = options.afficherVide === true;
    if (!valeur && !afficherVide) return "";
    const contenu = valeur || "—";
    const isUrl = /^https?:\/\//i.test(contenu);
    const rendu = isUrl
      ? `<a href="${escapeHtml(contenu)}" target="_blank" rel="noopener">${escapeHtml(contenu)}</a>`
      : escapeHtml(contenu);
    return `<small><b>${escapeHtml(label)} :</b> ${rendu}</small>`;
  }

  function labelContact(nom = "", fonction = "") {
    if (nom && fonction) return `${nom} — ${fonction}`;
    return nom || fonction || "";
  }

  function payloadCopieDepuisCoordonnees(c = {}) {
    return encodeURIComponent(JSON.stringify(c || {}));
  }

  function renderCoordonneesEntreprise(s = {}, options = {}) {
    const c = coordonneesDepuisSignal(s);
    const afficherVide = options.afficherVide === true;

    const contactPublic = labelContact(c.contact_public_nom, c.contact_public_fonction);
    const contactTerrain = labelContact(c.contact_terrain_nom, c.contact_terrain_fonction);

    const valeursPrincipales = [
      c.site_web,
      c.telephone_standard,
      c.email_generique,
      c.adresse,
      c.page_contact,
      c.formulaire_contact,
      c.linkedin_entreprise,
      contactPublic,
      contactTerrain
    ];

    if (!valeursPrincipales.some(Boolean) && !afficherVide) return "";

    const titre = options.titre || "📇 Coordonnées publiques";
    const payloadCopie = payloadCopieDepuisCoordonnees(c);

    const lignes = [
      ligne("🌐 Site web", c.site_web, { afficherVide }),
      ligne("☎ Téléphone", c.telephone_standard, { afficherVide }),
      ligne("✉ Email", c.email_generique, { afficherVide }),
      ligne("📍 Adresse", c.adresse),
      ligne("🔗 Page contact", c.page_contact),
      ligne("📝 Formulaire", c.formulaire_contact),
      ligne("🏢 LinkedIn entreprise", c.linkedin_entreprise),
      ligne("👤 Contact public", contactPublic),
      ligne("🧑‍🏭 Contact terrain", contactTerrain),
      ligne("🔎 Source contact public", c.contact_public_source_url),
      ligne("📌 Niveau coordonnées", c.coordonnees_niveau),
      ligne("🧾 Source coordonnées", c.coordonnees_source)
    ].filter(Boolean).join("");

    return `
      <div class="coordonnees-publiques-card">
        <div class="coordonnees-publiques-head">
          <b>${escapeHtml(titre)}</b>
          <button type="button" class="coordonnees-copy-btn" onclick="window.FLAIR_UI_COORDONNEES.copierCoordonneesPubliques('${payloadCopie}')">📋 Copier coordonnées</button>
        </div>
        <div class="coordonnees-publiques-lines">
          ${lignes}
        </div>
      </div>
    `;
  }

  function texteCopie(c = {}) {
    const contactPublic = labelContact(c.contact_public_nom, c.contact_public_fonction);
    const contactTerrain = labelContact(c.contact_terrain_nom, c.contact_terrain_fonction);
    return [
      `Site web : ${c.site_web || "—"}`,
      `Téléphone standard : ${c.telephone_standard || "—"}`,
      `Email générique : ${c.email_generique || "—"}`,
      c.adresse ? `Adresse : ${c.adresse}` : "",
      c.page_contact ? `Page contact : ${c.page_contact}` : "",
      c.formulaire_contact ? `Formulaire : ${c.formulaire_contact}` : "",
      c.linkedin_entreprise ? `LinkedIn entreprise : ${c.linkedin_entreprise}` : "",
      contactPublic ? `Contact public : ${contactPublic}` : "",
      c.contact_public_source_url ? `Source contact public : ${c.contact_public_source_url}` : "",
      contactTerrain ? `Contact terrain : ${contactTerrain}` : "",
      c.coordonnees_niveau ? `Niveau coordonnées : ${c.coordonnees_niveau}` : ""
    ].filter(Boolean).join("\n");
  }

  async function copierCoordonneesPubliques(payloadEncode = "") {
    let payload = {};
    try {
      payload = JSON.parse(decodeURIComponent(payloadEncode || "")) || {};
    } catch (err) {
      payload = {};
    }

    const texte = texteCopie(payload);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texte);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = texte;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      alert("Coordonnées publiques copiées.");
    } catch (err) {
      alert("Copie indisponible. Vous pouvez copier les coordonnées manuellement.");
    }
  }

  window.FLAIR_UI_COORDONNEES = {
    coordonneesDepuisSignal,
    renderCoordonneesEntreprise,
    copierCoordonneesPubliques
  };
})();
