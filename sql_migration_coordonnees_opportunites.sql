-- =========================================================================
-- FLAIR — Migration coordonnées publiques entreprise + liste d'opportunités
-- =========================================================================
-- Objectif : enrichir le signal brut avec des coordonnées publiques simples.
-- Ces champs restent des données de contexte commercial, sans transformer FLAIR en CRM.
-- =========================================================================

ALTER TABLE signaux
ADD COLUMN IF NOT EXISTS entreprise_site_web text,
ADD COLUMN IF NOT EXISTS entreprise_telephone_standard text,
ADD COLUMN IF NOT EXISTS entreprise_email_generique text;

-- Optionnel mais utile si vous souhaitez conserver une copie des coordonnées
-- au niveau de la distribution personnalisée. L'application sait aussi relire
-- ces informations depuis signaux via la jointure signal:signaux(*).
ALTER TABLE signaux_commerciaux
ADD COLUMN IF NOT EXISTS entreprise_site_web text,
ADD COLUMN IF NOT EXISTS entreprise_telephone_standard text,
ADD COLUMN IF NOT EXISTS entreprise_email_generique text;

-- Exemple de forme SQL à utiliser désormais pour les nouveaux signaux réels :
-- Ne pas ajouter score, chaleur, profil métier, secteur, timing, recommandation ou angle.
--
-- INSERT INTO signaux (
--   source_nom,
--   type_source,
--   entreprise_nom,
--   entreprise_site_web,
--   entreprise_telephone_standard,
--   entreprise_email_generique,
--   titre,
--   resume_brut,
--   lien_source,
--   date_signal,
--   region_nom,
--   departement_nom,
--   departement_code,
--   statut,
--   traite_par_ia,
--   origine_signal
-- ) VALUES (...);
