// =========================================================================
// FLAIR — UTILS D'EXPORTATION ET PRODUCTIVITÉ V1.1
// =========================================================================
// Rôle : exports CSV Excel France, nettoyage texte, passerelle légère vers CRM/Excel.
// Sécurité : module applicatif autonome, aucune écriture Supabase, aucune logique CRM.
// =========================================================================

(function () {
  "use strict";

  function nettoyerTextePourCSV(texte) {
    if (texte === null || texte === undefined) return "";
    return texte
      .toString()
      .replace(/[\r\n]+/g, " ")
      .replace(/"/g, '""')
      .trim();
  }

  function valeurSignal(sig, cles = []) {
    for (const cle of cles) {
      const valeur = sig?.[cle];
      if (valeur !== null && valeur !== undefined && String(valeur).trim() !== "") return valeur;
    }
    return "";
  }

  function formatDateSignal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toISOString().slice(0, 10);
  }

  function exporterSignauxEnCSV(signaux, nomEntrepriseCommercial = "FLAIR") {
    if (!Array.isArray(signaux) || signaux.length === 0) {
      alert("Aucun signal disponible pour l'export.");
      return;
    }

    const entetes = [
      "Date_Signal",
      "Entreprise_Cible",
      "Site_Web_Public",
      "Telephone_Standard_Public",
      "Email_Generique_Public",
      "Score_Flair",
      "Region",
      "Departement",
      "Secteur",
      "Metier_Detecte",
      "Opportunite",
      "Action_Conseillee",
      "Source_Url"
    ];

    const separateur = ";";
    const lignes = [entetes.join(separateur)];

    signaux.forEach(sig => {
      const ligne = [
        formatDateSignal(valeurSignal(sig, ["date_signal", "created_at"])),
        valeurSignal(sig, ["entreprise_nom", "entreprise", "Entreprise_Cible"]),
        valeurSignal(sig, ["entreprise_site_web", "site_web", "siteweb", "url_site"]),
        valeurSignal(sig, ["entreprise_telephone_standard", "telephone_standard", "telephone", "tel_standard"]),
        valeurSignal(sig, ["entreprise_email_generique", "email_generique", "email_contact", "contact_email"]),
        valeurSignal(sig, ["score_distribution", "score_pertinence", "score_final_distribue", "Score_Flair"]),
        valeurSignal(sig, ["region_nom", "region", "region_signal", "Region"]),
        [
          valeurSignal(sig, ["departement_nom", "Departement"]),
          valeurSignal(sig, ["departement_code"]) ? `(${valeurSignal(sig, ["departement_code"])})` : ""
        ].filter(Boolean).join(" "),
        valeurSignal(sig, ["secteur_detecte_label", "secteur", "secteur_estime", "Secteur"]),
        valeurSignal(sig, ["profil_metier_principal", "profil_metier", "sous_profils_metiers", "Metier_Detecte"]),
        valeurSignal(sig, ["angle_commercial_distribution", "angle_commercial", "opportunite", "resume_brut", "Opportunite"]),
        valeurSignal(sig, ["action_recommandee_distribution", "action_recommandee", "Action_Conseillee"]),
        valeurSignal(sig, ["source_url", "lien_source", "url", "Source_Url"])
      ];

      lignes.push(ligne.map(valeur => `"${nettoyerTextePourCSV(valeur)}"`).join(separateur));
    });

    const contenuCsv = "\uFEFF" + lignes.join("\n");
    const blob = new Blob([contenuCsv], { type: "text/csv;charset=utf-8;" });
    const urlBlob = URL.createObjectURL(blob);
    const lienTelechargement = document.createElement("a");
    const dateExport = new Date().toISOString().split("T")[0];

    lienTelechargement.href = urlBlob;
    lienTelechargement.setAttribute("download", `Export_FLAIR_${nomEntrepriseCommercial}_${dateExport}.csv`);
    document.body.appendChild(lienTelechargement);
    lienTelechargement.click();
    document.body.removeChild(lienTelechargement);
    URL.revokeObjectURL(urlBlob);
  }

  window.FLAIR_EXPORT_UTILS = {
    nettoyerTextePourCSV,
    exporterSignauxEnCSV
  };
})();
