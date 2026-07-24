// Client Supabase initialisé dans flair-config.js
const supabaseClient = window.FLAIR_CONFIG?.supabaseClient || window.supabaseClient;

let user = null;
let currentProfil = null;
let invitationCourante = null;
let modeCreationFlair = null;
let profilCreationEnAttente = null;

const FLAIR_GEO = window.FLAIR_GEO || {};
const {
  normaliserTexteSimple,
  nettoyerValeurImport,
  normaliserListeRegionsSecondaires,
  labelRegionCommerciale,
  labelRegionsSecondaires,
  extraireChampStructure,
  normaliserRegionImport,
  normaliserCleGeographie,
  normaliserGeographieImport,
  extraireRegionImportDepuisTexte,
  signalRegion,
  signalDepartement,
  estRegionNationaleFlair,
  signalDansPerimetreRegionPrepare
} = FLAIR_GEO;

if (FLAIR_GEO.setProfilProvider) {
  FLAIR_GEO.setProfilProvider(() => currentProfil);
}

const FLAIR_METIER = window.FLAIR_METIER || {};
const {
  GeoAffinityEngine,
  coefficientGeographiqueSignal,
  construirePhraseGeographique,
  calculerScoresSeparationFlair,
  formaterResumeScoresFlair,
  texteCompletSignalFlair,
  calculerTimingCommercial,
  motCleFlairPresent,
  detecterSecteurSousSecteur,
  dedoublonnerListeTexte,
  signalSemblePME,
  interlocuteursPourProfil,
  questionAnglePourProfil,
  prochaineActionCopilote,
  preparerCopiloteCommercial,
  calculerScoreDistributionIA,
  normaliserListeCopilote,
  dedoublonnerListeCopilote,
  estPersonaCopilote,
  parserContactCopilote,
  extraireContactsEtThemesCopilote,
  renderListeContactsCopilote,
  renderTexteOuPucesCopilote,
  construirePourquoiCopilote,
  construireCopiloteCommercialJson,
  determinerVigilanceCopilote,
  lireCopiloteCommercialJson,
  normaliserResultatScoring,
  scoringLocal,
  labelProfilMetierRadar,
  labelSousProfilMetierRadar,
  profilsMetiersDetectes,
  profilCommercialActuel,
  compatibiliteMetierPourProfil,
  facteurBonusSelonCompatibilite,
  texteSignalPourAjustementMetier,
  signalDetectionMetallique,
  calculerAffiniteMetierCommerciale,
  appliquerAffinityScoring,
  appliquerCoefficientGeographique,
  appliquerPlancherTimingStrategique,
  hasSousProfilMetier,
  hasRegleMetier,
  signalAQualiteOuInspection,
  chaleurDepuisScoreMetier,
  reglesMetierDetectees,
  construireResumeReglesMetier,
  construireResumeSousProfils,
  construireSousProfilsPourProfil,
  construireResumeMetierCourt,
  construireLectureMetier,
  nettoyerPhraseMetierBase,
  ajouterPhraseMetier,
  construireAngleMetier,
  construirePrioriteMetier,
  enrichirScoringAvecSourceVeille
} = FLAIR_METIER;

if (FLAIR_METIER.setProfilProvider) {
  FLAIR_METIER.setProfilProvider(() => currentProfil);
}

// =========================
// DOCTRINE MÉTIER FLAIR
// =========================
// FLAIR détecte, score, priorise et déclenche l'action.
// Le CRM gère ensuite la relation commerciale.
// Objectif : gestion de l'attention commerciale, sans logique CRM lourde.
// Feedback discret uniquement après passage en À contacter : confirme, non_confirme.
// Le CRM reste externe ; FLAIR peut seulement marquer qu'une opportunité CRM a été créée.


// =========================
// DOCTRINE OFFICIELLE FLAIR V2026.2
// =========================
function doctrineApiFlair() {
  return window.FLAIR_DOCTRINE_API || null;
}

function controlerDoctrineAvantScoring(signal = {}, texteSource = '') {
  const api = doctrineApiFlair();
  if (!api || !window.FLAIR_DOCTRINE_STATUS?.valide) {
    throw new Error('Doctrine FLAIR V2026.2 absente ou invalide. Analyse interrompue.');
  }

  const controle = api.verifierAvantScoring(signal, texteSource);
  if (!controle.conforme) {
    const erreur = new Error(api.messageBlocage(controle));
    erreur.flairDoctrine = controle;
    throw erreur;
  }
  return controle;
}

function certifierSignalFlair(signal = {}, texteSource = '', origine = 'application') {
  const api = doctrineApiFlair();
  if (!api || !window.FLAIR_DOCTRINE_STATUS?.valide) {
    return {
      conforme: false,
      signal,
      certification: {
        doctrine_version: 'V2026.2',
        doctrine_conformite: 'non_conforme',
        doctrine_certification_statut: 'refuse',
        doctrine_non_conformites: [{
          code: 'DOCTRINE_INDISPONIBLE',
          criticite: 'critique',
          message: 'Doctrine FLAIR V2026.2 absente ou invalide.'
        }]
      }
    };
  }
  return api.certifierSignal(signal, texteSource, { origine });
}

function appliquerMetaDoctrinePayload(payload = {}, certification = {}) {
  const nonConformites = certification.doctrine_non_conformites || [];
  return {
    ...payload,
    doctrine_version: certification.doctrine_version || 'V2026.2',
    doctrine_conformite: certification.doctrine_conformite || null,
    doctrine_certification_statut: certification.doctrine_certification_statut || null,
    doctrine_date_certification: certification.doctrine_date_certification || null,
    doctrine_non_conformites: nonConformites,
    fraicheur_statut: certification.fraicheur_statut || null,
    fraicheur_date_verification: certification.fraicheur_date_verification || null,
    fraicheur_raison: certification.fraicheur_raison || null
  };
}

function getInvitationTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('invitation');
}

function normaliserEmail(email) {
  return (email || '').trim().toLowerCase();
}

function roleDepuisFonction(fonction) {
  return [
    'manager_commercial',
    'solo_commercial',
    'responsable_grands_comptes',
    'direction_commerciale'
  ].includes(fonction) ? 'manager' : 'commercial';
}

function roleDepuisInvitation(invitation) {
  if (!invitation) return null;
  return invitation.role || roleDepuisFonction(invitation.fonction || 'commercial_industrie');
}

function estProfilManagerSolo(profil = currentProfil) {
  return profil?.role === 'manager' && profil?.fonction === 'solo_commercial';
}

function labelFonctionOnboarding(value) {
  const labels = {
    manager_commercial: 'Vous êtes Manager',
    solo_commercial: 'Vous êtes Manager / commercial solo',
    commercial_industrie: 'Rejoindre une équipe commerciale',
    responsable_grands_comptes: 'Responsable grands comptes',
    direction_commerciale: 'Direction commerciale',
    autre: 'Autre fonction'
  };

  return labels[value] || 'Fonction non renseignée';
}


function labelProfilMetier(value) {
  const labels = {
    pesage: 'Pesage / contrôle poids / étiquetage industriel',
    detection: 'Détection / contrôle qualité',
    vision: 'Vision industrielle / contrôle qualité',
    packaging: 'Packaging / films / étiquettes',
    process: 'Process / convoyage / conditionnement / fin de ligne',
    chimie_logistique: 'Chimie / process / logistique industrielle',
    batiment_industriel: 'Bâtiment industriel',
    autre: 'Autre spécialité industrielle'
  };

  return labels[value] || managerLabel(String(value || '').replaceAll('_', ' '), 'Métier non renseigné');
}


function normaliserSlugProfilMetierFlair(value) {
  const brut = String(value || '').trim().toLowerCase();

  const aliases = {
    detection_metaux: 'detection',
    detecteur_metaux: 'detection',
    detecteur_de_metaux: 'detection',
    detection: 'detection',
    rayons_x: 'detection',
    rayon_x: 'detection',
    xray: 'detection',

    pesage: 'pesage',
    pesee: 'pesage',
    poids_prix: 'pesage',
    etiquetage: 'pesage',
    controle_poids: 'pesage',
    controle_ponderal: 'pesage',
    tri_ponderal: 'pesage',
    checkweigher: 'pesage',

    packaging: 'packaging',
    emballage: 'packaging',
    conditionnement: 'packaging',

    vision: 'vision',
    vision_industrielle: 'vision',
    controle_vision: 'vision',

    process: 'process',
    convoyage: 'process',
    convoyeur: 'process',
    ligne_convoyage: 'process',
    conditionnement: 'process',
    ensachage: 'process',
    fin_de_ligne: 'process',
    palettisation: 'process',
    robotisation: 'process',
    automatisation: 'process',

    chimie_logistique: 'process',
    chimie: 'process',
    logistique: 'process',
    batiment_industriel: 'process',

    autre: 'autre'
  };

  return aliases[brut] || brut;
}

function invitationCorrespondUtilisateur(invitation, authUser) {
  if (!invitation || !authUser?.email) return true;
  return normaliserEmail(invitation.email) === normaliserEmail(authUser.email);
}

function invitationStatutValide(statut) {
  return ['en_attente', 'acceptee', 'acceptée', 'accepte'].includes(statut);
}

async function chargerInvitationCourantePourUtilisateur(authUser) {
  const invitationEmail = await recupererInvitationUtilisateurParEmail(authUser);

  if (
    invitationEmail &&
    invitationStatutValide(invitationEmail.statut) &&
    invitationCorrespondUtilisateur(invitationEmail, authUser)
  ) {
    invitationCourante = invitationEmail;
  }

  return invitationCourante;
}

function construirePayloadInvitation(invitation) {
  if (!invitation) return {};

  const payload = {};

  if (invitation.team_id) payload.team_id = invitation.team_id;
  if (invitation.team_nom) payload.societe = invitation.team_nom;
  if (invitation.region) payload.region = invitation.region;
  if (invitation.regions_secondaires) payload.regions_secondaires = normaliserListeRegionsSecondaires(invitation.regions_secondaires);
  if (invitation.profil_metier) payload.profil_metier = invitation.profil_metier;
  if (invitation.prenom) payload.prenom = invitation.prenom;
  if (invitation.nom) payload.nom = invitation.nom;
  if (invitation.fonction) payload.fonction = invitation.fonction;

  const role = roleDepuisInvitation(invitation);
  if (role) payload.role = role;

  return payload;
}

async function completerInvitationDepuisTable(invitation, token) {
  if (!token) return invitation;
  if (invitation?.id && invitation?.team_id && invitation?.region) {
    return { ...invitation, token: invitation.token || token };
  }

  const { data, error } = await supabaseClient
    .from('invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.warn('Complément invitation indisponible :', error.message);
    return { ...(invitation || {}), token };
  }

  return { ...(invitation || {}), ...(data || {}), token };
}

async function enrichirInvitationAvecEquipe(invitation) {
  if (!invitation?.team_id) return invitation;

  const { data, error } = await supabaseClient
    .from('teams')
    .select('id, nom')
    .eq('id', invitation.team_id)
    .maybeSingle();

  if (error) {
    console.warn('Nom équipe invitation indisponible :', error.message);
    return invitation;
  }

  return {
    ...invitation,
    team_nom: data?.nom || invitation.team_nom || ''
  };
}

async function recupererInvitationUtilisateurParEmail(authUser) {
  const email = normaliserEmail(authUser?.email);
  if (!email) return null;

  const { data, error } = await supabaseClient
    .from('invitations')
    .select('*')
    .ilike('email', email)
    .in('statut', ['en_attente', 'acceptee', 'acceptée', 'accepte'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Invitation par email indisponible :', error.message);
    return null;
  }

  console.log("Invitation récupérée par email :", data);

  return data ? enrichirInvitationAvecEquipe(data) : null;
}
async function marquerInvitationAcceptee(invitation) {
  if (!invitation?.id) return;

  const { error } = await supabaseClient
    .from('invitations')
    .update({
      statut: 'acceptee',
      accepted_at: new Date().toISOString()
    })
    .eq('id', invitation.id);

  if (error) {
    console.warn('Invitation non marquée comme acceptée :', error.message);
  }
}

async function chargerInvitationDepuisUrl() {
  const token = getInvitationTokenFromUrl();
  if (!token) return;

  const { data, error } = await supabaseClient
    .from('invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    alert("Erreur lecture invitation : " + error.message);
    return;
  }

  if (!data) {
    alert("Invitation introuvable. Merci de demander un nouveau lien à votre manager.");
    return;
  }

  if (data.statut === 'expiree' || (data.expires_at && new Date(data.expires_at) < new Date())) {
    alert("Cette invitation a expiré. Merci de demander un nouveau lien à votre manager.");
    return;
  }

  invitationCourante = await enrichirInvitationAvecEquipe(data);

  if (data.statut === 'acceptee') {
    afficherInvitationRecue(invitationCourante);
    return;
  }

  afficherInvitationRecue(invitationCourante);
}

function afficherInvitationRecue(invitation) {
  const bloc = document.getElementById('invitationLanding');
  if (bloc) bloc.style.display = 'block';

  const emailInput = document.getElementById('email');
  if (emailInput) emailInput.value = invitation.email || '';

  const teamLabel = managerLabel(invitation.team_nom, 'votre équipe');
  const regionLabel = labelRegionCommerciale(invitation.region || '');
  const regionsSecondairesLabel = labelRegionsSecondaires(invitation.regions_secondaires);
  const profilMetierLabel = labelProfilMetier(invitation.profil_metier || '');
  const prenomLabel = invitation.prenom ? ` ${invitation.prenom}` : '';

  const title = document.getElementById('invitationLandingTitle');
  if (title) {
    title.textContent = `Bienvenue${prenomLabel}, vous rejoignez ${teamLabel}`;
  }

  const text = document.getElementById('invitationLandingText');
  if (text) {
    const metierPart = invitation.profil_metier ? ` Métier : ${profilMetierLabel}.` : '';
    text.textContent = regionsSecondairesLabel
      ? `Votre accès est préparé pour l’équipe ${teamLabel}. Métier : ${profilMetierLabel}. Région principale : ${regionLabel}. Régions secondaires : ${regionsSecondairesLabel}. Créez votre compte avec l’email invité pour finaliser le rattachement.`
      : `Votre accès est préparé pour l’équipe ${teamLabel}.${metierPart} Région principale : ${regionLabel}. Créez votre compte avec l’email invité pour finaliser le rattachement.`;
  }

  const email = document.getElementById('invitationLandingEmail');
  if (email) email.textContent = invitation.email || 'Email non renseigné';

  const region = document.getElementById('invitationLandingRegion');
  if (region) {
    const metierMeta = invitation.profil_metier ? ` · Métier ${profilMetierLabel}` : '';
    region.textContent = regionsSecondairesLabel
      ? `Équipe ${teamLabel}${metierMeta} · Région principale ${regionLabel} · Secondaires ${regionsSecondairesLabel}`
      : `Équipe ${teamLabel}${metierMeta} · Région principale ${regionLabel}`;
  }

  const meta = document.querySelector('.invitation-landing-meta');
  if (meta) meta.style.display = '';
}

// =========================
// AUTH déplacée dans flair-config.js
// =========================

async function initUser() {
  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "none";
  document.getElementById('onboardingMetier').style.display = "none";
  const modeCreationEl = document.getElementById('modeCreationFlair');
  if (modeCreationEl) modeCreationEl.style.display = "none";

  const { data, error } = await window.FLAIR_DATA_SERVICES.commerciaux()
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    alert("Erreur lecture profil commercial : " + error.message);
    return;
  }

  if (invitationCourante && !invitationCorrespondUtilisateur(invitationCourante, user)) {
    alert("Cette invitation est associée à un autre email.");
    await supabaseClient.auth.signOut();
    document.getElementById('auth').style.display = "block";
    return;
  }

  let profil = data;

  if (!invitationCourante) {
    await chargerInvitationCourantePourUtilisateur(user);
  }

  const payloadInvitation = construirePayloadInvitation(invitationCourante);

  // Sécurité : si le profil existe déjà en base avec un team_id, on le conserve.
  if (!payloadInvitation.team_id && profil?.team_id) {
    payloadInvitation.team_id = profil.team_id;
  }

  console.log("Invitation initUser :", invitationCourante);
  console.log("Payload invitation initUser :", payloadInvitation);

  if (!profil) {
    const { data: insertedProfil, error: insertError } = await window.FLAIR_DATA_SERVICES.commerciaux()
      .insert([{
        id: user.id,
        email: normaliserEmail(user.email),
        onboarding_done: false,
        ...payloadInvitation
      }])
      .select('*')
      .single();

    if (insertError) {
      alert("Erreur création profil commercial : " + insertError.message);
      return;
    }

    profil = insertedProfil;
  } else if (invitationCourante && Object.keys(payloadInvitation).length) {
    const doitSynchroniserInvitation =
      (payloadInvitation.team_id && profil.team_id !== payloadInvitation.team_id) ||
      (payloadInvitation.societe && profil.societe !== payloadInvitation.societe) ||
      (payloadInvitation.region && profil.region !== payloadInvitation.region) ||
      (payloadInvitation.regions_secondaires && JSON.stringify(normaliserListeRegionsSecondaires(profil.regions_secondaires)) !== JSON.stringify(normaliserListeRegionsSecondaires(payloadInvitation.regions_secondaires))) ||
      (payloadInvitation.profil_metier && profil.profil_metier !== payloadInvitation.profil_metier) ||
      (payloadInvitation.role && profil.role !== payloadInvitation.role) ||
      (payloadInvitation.fonction && profil.fonction !== payloadInvitation.fonction);

    if (doitSynchroniserInvitation) {
      const { data: updatedProfil, error: updateError } = await window.FLAIR_DATA_SERVICES.commerciaux()
        .update(payloadInvitation)
        .eq('id', user.id)
        .select('*')
        .single();

      if (updateError) {
        alert("Erreur rattachement équipe : " + updateError.message);
        return;
      }

      profil = updatedProfil;
    }
  }

  if (profil.onboarding_done && invitationCourante?.id) {
    await marquerInvitationAcceptee(invitationCourante);
  }

  if (!profil.onboarding_done) {
    const doitChoisirModeCreation =
      !payloadInvitation.team_id &&
      !profil?.team_id &&
      !invitationCourante?.team_id;

    if (doitChoisirModeCreation) {
      afficherChoixModeCreation(profil);
    } else {
      afficherOnboardingMetier(profil);
    }
    return;
  }

  currentProfil = await reparerEquipeManagerSiNecessaire(profil);
  chargerProfilMetier(currentProfil.profil_metier || 'pesage');
  afficherApplication();
}


function afficherChoixModeCreation(profil = {}) {
  document.body.classList.add('onboarding-mode');
  document.body.classList.remove('cockpit-mode', 'manager-mode');

  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "none";
  document.getElementById('onboardingMetier').style.display = "none";

  const invitationLanding = document.getElementById('invitationLanding');
  if (invitationLanding) invitationLanding.style.display = 'none';

  profilCreationEnAttente = profil || {};
  modeCreationFlair = null;

  const bloc = document.getElementById('modeCreationFlair');
  if (bloc) bloc.style.display = "flex";
}

function choisirModeCreationFlair(mode) {
  const modeNormalise = mode === 'solo' ? 'solo' : 'manager';
  modeCreationFlair = modeNormalise;

  const bloc = document.getElementById('modeCreationFlair');
  if (bloc) bloc.style.display = "none";

  const profilBase = profilCreationEnAttente || {};
  afficherOnboardingMetier({
    ...profilBase,
    fonction: modeNormalise === 'solo' ? 'solo_commercial' : 'manager_commercial'
  });
}

function afficherOnboardingMetier(profil = {}) {
  document.body.classList.add('onboarding-mode');
  document.body.classList.remove('cockpit-mode', 'manager-mode');

  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "none";
  const modeCreationEl = document.getElementById('modeCreationFlair');
  if (modeCreationEl) modeCreationEl.style.display = "none";
  document.getElementById('onboardingMetier').style.display = "flex";

  const invitationLanding = document.getElementById('invitationLanding');
  if (invitationLanding) invitationLanding.style.display = 'none';

  document.getElementById('onboardingPrenom').value = profil.prenom || invitationCourante?.prenom || '';
  document.getElementById('onboardingNom').value = profil.nom || invitationCourante?.nom || '';
  document.getElementById('onboardingSociete').value = profil.societe || invitationCourante?.societe || invitationCourante?.team_nom || '';
  document.getElementById('onboardingProfilMetier').value = profil.profil_metier || invitationCourante?.profil_metier || 'pesage';

  const fonctionParModeCreation =
    modeCreationFlair === 'solo'
      ? 'solo_commercial'
      : (modeCreationFlair === 'manager' ? 'manager_commercial' : '');

  const onboardingFonctionSelect = document.getElementById('onboardingFonction');
  onboardingFonctionSelect.value =
    profil.fonction ||
    invitationCourante?.fonction ||
    fonctionParModeCreation ||
    'manager_commercial';

  const fonctionWrapper = document.getElementById('onboardingFonctionWrapper');
  const fonctionResume = document.getElementById('onboardingFonctionResume');
  const estOnboardingInvite = Boolean(invitationCourante?.team_id || profil.team_id);
  const fonctionImposeeParMode = Boolean(modeCreationFlair || invitationCourante?.team_id || profil.fonction === 'solo_commercial' || profil.fonction === 'manager_commercial');

  if (fonctionWrapper && fonctionResume && fonctionImposeeParMode) {
    fonctionWrapper.style.display = 'none';
    fonctionResume.style.display = 'block';
    fonctionResume.textContent = estOnboardingInvite
      ? `Mode : ${labelFonctionOnboarding(onboardingFonctionSelect.value)} — profil défini par l’invitation.`
      : `Mode sélectionné : ${labelFonctionOnboarding(onboardingFonctionSelect.value)}.`;
  } else {
    if (fonctionWrapper) fonctionWrapper.style.display = '';
    if (fonctionResume) fonctionResume.style.display = 'none';
  }

  const regionValue = profil.region || invitationCourante?.region || 'grand_est';
  document.getElementById('onboardingRegion').value = regionValue;

  const onboardingText =
    document.getElementById('onboardingIntroText') ||
    document.getElementById('onboardingSubtitle') ||
    document.querySelector('[data-onboarding-intro]') ||
    document.querySelector('.onboarding-subtitle');

  if (onboardingText) {
    if (invitationCourante?.team_id || profil.team_id) {
      const teamLabel = managerLabel(invitationCourante?.team_nom || profil.societe, 'votre équipe');
      const prenomLabel = managerLabel(profil.prenom || invitationCourante?.prenom, '');
      const fonctionBrute = profil.fonction || invitationCourante?.fonction || 'commercial';
      const fonctionLabel = managerLabel(String(fonctionBrute).replaceAll('_', ' '), 'commercial');
      const profilMetierValue = profil.profil_metier || invitationCourante?.profil_metier || '';
      const profilMetierLabel = labelProfilMetier(profilMetierValue);
      const regionLabel = labelRegionCommerciale(regionValue);
      const regionsSecondairesLabel = labelRegionsSecondaires(profil.regions_secondaires || invitationCourante?.regions_secondaires);

      onboardingText.textContent =
        `Bienvenue ${prenomLabel}, vous rejoignez l’équipe ${teamLabel}. ` +
        `Votre rôle est ${fonctionLabel}, votre métier est ${profilMetierLabel} et votre région principale est préconfigurée : ${regionLabel}. ` +
        (regionsSecondairesLabel ? `Régions secondaires : ${regionsSecondairesLabel}. ` : '') +
        `Vérifiez les informations puis validez votre cockpit.`;
    } else {
      if (modeCreationFlair === 'solo' || profil.fonction === 'solo_commercial') {
        onboardingText.textContent =
          `Vous créez un espace Manager / Commercial solo. FLAIR ouvrira directement votre cockpit commercial, tout en vous laissant accès au Dashboard Manager. Région : ${labelRegionCommerciale(regionValue)}.`;
      } else if (modeCreationFlair === 'manager' || profil.fonction === 'manager_commercial') {
        onboardingText.textContent =
          `Vous créez un espace Manager. FLAIR ouvrira votre Dashboard Manager pour piloter votre équipe et inviter vos commerciaux. Région : ${labelRegionCommerciale(regionValue)}.`;
      } else {
        onboardingText.textContent =
          `Configurez votre environnement métier afin que FLAIR détecte les signaux les plus pertinents pour votre activité dans la région : ${labelRegionCommerciale(regionValue)}`;
      }
    }
  }
}

function afficherApplication() {
  document.body.classList.remove('onboarding-mode', 'manager-mode');
  document.body.classList.add('cockpit-mode');

  const invitationLanding = document.getElementById('invitationLanding');
  if (invitationLanding) invitationLanding.style.display = 'none';

  document.getElementById('onboardingMetier').style.display = "none";
  document.getElementById('auth').style.display = "none";
  const modeCreationEl = document.getElementById('modeCreationFlair');
  if (modeCreationEl) modeCreationEl.style.display = "none";
  document.getElementById('app').style.display = "block";

  const prenom = currentProfil?.prenom || '';

  if (prenom) {
  const cockpitTitle = document.getElementById('cockpitWelcomeTitle');
  const managerTitle = document.getElementById('managerWelcomeTitle');

  if (cockpitTitle) cockpitTitle.textContent = `Bienvenue ${prenom}, voici vos signaux prioritaires`;
  if (managerTitle) managerTitle.textContent = `Bienvenue ${prenom}, voici votre vision manager`;
}  

  const cockpitRegionLabel = document.getElementById('cockpitRegionLabel');
  if (cockpitRegionLabel) {
    const regionPrincipale = currentProfil?.region || '';
    const regionsSecondairesLabel = labelRegionsSecondaires(currentProfil?.regions_secondaires);
    cockpitRegionLabel.textContent = regionPrincipale
      ? `📍 Région principale : ${labelRegionCommerciale(regionPrincipale)}${regionsSecondairesLabel ? ` · Secondaires : ${regionsSecondairesLabel}` : ''}`
      : '📍 Région principale non renseignée';
  }

  const isManager = currentProfil?.role === 'manager';
  const isManagerSolo = estProfilManagerSolo(currentProfil);

  document.querySelectorAll('[data-manager-only]').forEach(el => {
  el.style.display = isManager ? '' : 'none';
});

  document.querySelectorAll('[data-solo-manager-only]').forEach(el => {
  el.style.display = isManagerSolo ? '' : 'none';
});

  // FLAIR V2.4 — séparation Manager équipe / Manager solo.
  // Le responsable solo garde un dashboard personnel, mais pas la vue équipe/invitations.
  document.querySelectorAll('[data-view-btn="invitations"]').forEach(el => {
    el.style.display = isManagerSolo ? 'none' : '';
  });

  document.querySelectorAll('[data-view-btn="manager"]').forEach(el => {
    if (el.tagName === 'BUTTON') {
      el.textContent = isManagerSolo ? '▣ Dashboard Solo' : '▣ Dashboard PRO';
    }
  });

if (isManager && !isManagerSolo) {
  afficherVue('manager');
} else {
  afficherVue('cockpit');
}

  refreshCockpit();
}


async function garantirEquipeManagerPourProfil(profilPayload = {}) {
  const role = profilPayload.role || currentProfil?.role;
  const societe = (profilPayload.societe || currentProfil?.societe || '').trim();

  if (role !== 'manager') {
    return null;
  }

  if (!user?.id) {
    alert("Utilisateur non connecté. Impossible de rattacher l'équipe manager.");
    return null;
  }

  if (!societe) {
    alert("Merci d’indiquer la société pour créer ou retrouver l’équipe.");
    return null;
  }

  const nomEquipe = societe;
  let equipe = null;

  const { data: equipesExistantes, error: rechercheError } = await supabaseClient
    .from('teams')
    .select('id, nom, manager_id, description')
    .ilike('nom', nomEquipe)
    .limit(1);

  if (rechercheError) {
    alert("Erreur recherche équipe : " + rechercheError.message);
    return null;
  }

  if (equipesExistantes && equipesExistantes.length > 0) {
    equipe = equipesExistantes[0];

    if (equipe.manager_id !== user.id) {
      const { data: equipeMaj, error: majEquipeError } = await supabaseClient
        .from('teams')
        .update({ manager_id: user.id })
        .eq('id', equipe.id)
        .select('id, nom, manager_id')
        .single();

      if (majEquipeError) {
        console.warn("Manager non mis à jour sur l'équipe :", majEquipeError.message);
      } else {
        equipe = equipeMaj;
      }
    }
  } else {
    const { data: nouvelleEquipe, error: creationEquipeError } = await supabaseClient
      .from('teams')
      .insert([{
        nom: nomEquipe,
        manager_id: user.id,
        description: `Équipe commerciale ${nomEquipe} créée depuis l’onboarding FLAIR`
      }])
      .select('id, nom, manager_id')
      .single();

    if (creationEquipeError) {
      alert("Erreur création équipe : " + creationEquipeError.message);
      return null;
    }

    equipe = nouvelleEquipe;
  }

  if (!equipe?.id) {
    alert("Équipe introuvable ou non créée. Impossible de finaliser l’onboarding manager.");
    return null;
  }

  return equipe.id;
}

async function reparerEquipeManagerSiNecessaire(profil = {}) {
  if (!profil || profil.role !== 'manager' || profil.team_id) {
    return profil;
  }

  const teamId = await garantirEquipeManagerPourProfil({
    role: profil.role,
    societe: profil.societe,
    region: profil.region
  });

  if (!teamId) {
    return profil;
  }

  const { data: profilMaj, error: updateError } = await window.FLAIR_DATA_SERVICES.commerciaux()
    .update({ team_id: teamId })
    .eq('id', profil.id || user.id)
    .select('*')
    .single();

  if (updateError) {
    alert("Erreur rattachement équipe manager : " + updateError.message);
    return profil;
  }

  return profilMaj || { ...profil, team_id: teamId };
}


async function sauvegarderOnboardingMetier() {
  const prenom = document.getElementById('onboardingPrenom').value.trim();
  const nom = document.getElementById('onboardingNom').value.trim();
  const societe = document.getElementById('onboardingSociete').value.trim();
  const profil_metier = document.getElementById('onboardingProfilMetier').value;
  const fonction = document.getElementById('onboardingFonction').value;
  const role = roleDepuisFonction(fonction);
  const region = document.getElementById('onboardingRegion').value;

  if (!prenom) {
    alert("Merci d’indiquer votre prénom.");
    return;
  }

  if (!nom) {
    alert("Merci d’indiquer votre nom.");
    return;
  }

  if (!societe) {
    alert("Merci d’indiquer votre société.");
    return;
  }

  await chargerInvitationCourantePourUtilisateur(user);

  const { data: profilActuel } = await window.FLAIR_DATA_SERVICES.commerciaux()
    .select('team_id, role, fonction')
    .eq('id', user.id)
    .maybeSingle();

  const payloadInvitation = construirePayloadInvitation(invitationCourante);

  // Sécurité : si le profil existe déjà en base avec un team_id, on le conserve.
  if (!payloadInvitation.team_id && profilActuel?.team_id) {
    payloadInvitation.team_id = profilActuel.team_id;
  }

  console.log("Invitation onboarding :", invitationCourante);
  console.log("Payload invitation :", payloadInvitation);

  // Parcours FLAIR :
  // - Avec invitation/team_id : on respecte le rattachement manager -> commercial.
  // - Sans invitation/team_id :
  //   * "manager_commercial" crée un espace Manager et ouvre le Dashboard Manager.
  //   * "solo_commercial" crée aussi un espace manager, mais ouvre d'abord le Cockpit commercial.
  const estInvite = Boolean(payloadInvitation.team_id);
  const fonctionSansInvitationValide = [
    'manager_commercial',
    'solo_commercial',
    'responsable_grands_comptes',
    'direction_commerciale'
  ].includes(fonction);

  const roleFinal = estInvite
    ? (payloadInvitation.role || profilActuel?.role || role)
    : 'manager';

  const fonctionFinale = estInvite
    ? (payloadInvitation.fonction || fonction)
    : (fonctionSansInvitationValide ? fonction : 'manager_commercial');

  const profilPayload = {
    prenom,
    nom,
    societe,
    profil_metier,
    fonction: fonctionFinale,
    region,
    onboarding_done: true,
    ...payloadInvitation,
    role: roleFinal
  };

  if (roleFinal === 'manager' && !profilPayload.team_id) {
    const teamId = await garantirEquipeManagerPourProfil(profilPayload);
    if (!teamId) return;
    profilPayload.team_id = teamId;
  }

  const { data: updatedProfil, error } = await window.FLAIR_DATA_SERVICES.commerciaux()
    .update(profilPayload)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) {
    alert("Erreur sauvegarde profil métier : " + error.message);
    return;
  }

  currentProfil = updatedProfil || {
    id: user.id,
    email: normaliserEmail(user.email),
    ...profilPayload
  };

  await marquerInvitationAcceptee(invitationCourante);

  chargerProfilMetier(currentProfil.profil_metier || profil_metier);
  afficherApplication();
}

function chargerProfilMetier(profilMetier) {
  window.FLairProfilMetierRaw = profilMetier;
  window.FLairProfilMetier = normaliserSlugProfilMetierFlair(profilMetier);

  console.log("Profil métier FLAIR chargé :", profilMetier, "→", window.FLairProfilMetier);

  // Préparation future :
  // pesage        -> scoring/pesage.js
  // detection     -> scoring/detection.js
  // vision        -> scoring/vision.js
  // packaging     -> scoring/packaging.js
  // chimie_logistique  -> scoring/chimie_logistique.js
}

 // =========================
// HELPERS AFFICHAGE
// =========================



function afficherSectionCockpit(section = 'main') {
  const sectionValide = ['main', 'actifs', 'opportunites', 'historique'].includes(section) ? section : 'main';

  document.querySelectorAll('[data-cockpit-section]').forEach(el => {
    el.style.display = el.dataset.cockpitSection === sectionValide ? '' : 'none';
  });

  document.querySelectorAll('[data-cockpit-section-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cockpitSectionBtn === sectionValide);
  });

  if (sectionValide === 'actifs') {
    chargerSignaux();
  }

  if (sectionValide === 'opportunites') {
    chargerListeOpportunitesCommerciales();
  }

  if (sectionValide === 'historique') {
    chargerHistorique();
  }
}

async function afficherVue(vue) {
  // FLAIR V2.4 — un Manager / Commercial solo n'a pas de vue équipe & invitations.
  if (vue === 'invitations' && estProfilManagerSolo(currentProfil)) {
    vue = 'manager';
  }

  const cockpitView = document.getElementById('cockpitView');
  const managerView = document.getElementById('managerView');
  const invitationsView = document.getElementById('invitationsView');
  const btnCockpit = document.getElementById('btnCockpit');
  const btnManager = document.getElementById('btnManager');

  if (!cockpitView || !managerView) return;

  const managerSubViews = ['manager', 'sources', 'relances', 'opportunites', 'qualite'];
  const isManagerView = managerSubViews.includes(vue);
  const isInvitationsView = vue === 'invitations';
  const isCockpitView = !isManagerView && !isInvitationsView;

  cockpitView.style.display = isCockpitView ? 'block' : 'none';
  managerView.style.display = isManagerView ? 'grid' : 'none';
  if (invitationsView) invitationsView.style.display = isInvitationsView ? 'grid' : 'none';

  btnCockpit?.classList.toggle('active', isCockpitView);
  btnManager?.classList.toggle('active', isManagerView);

  document.querySelectorAll('[data-view-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.viewBtn === vue);
  });

  const isManagerSolo = estProfilManagerSolo(currentProfil);
  document.querySelectorAll('[data-solo-manager-only]').forEach(el => {
    el.style.display = isManagerSolo ? '' : 'none';
  });

  document.body.classList.toggle('manager-mode', !isCockpitView);
  document.body.classList.toggle('cockpit-mode', isCockpitView);

  if (isCockpitView) {
    afficherSectionCockpit('main');
  }

  if (isManagerView) {
    await chargerDashboardManager();
    await afficherManagerSubview(vue);
  }

  if (isInvitationsView) {
    await chargerInvitations();
  }
}


// =========================
// MANAGER — VUES SOURCES / RELANCES / QUALITÉ RADAR
// =========================
// Ces vues restent dans la philosophie FLAIR : pilotage du radar, sans logique CRM.

function managerEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normaliserChaleurManager(s = {}) {
  return s.chaleur_distribution || s.chaleur || '';
}

function normaliserStatutManager(s = {}) {
  return s.statut || '';
}

function normaliserSourceManagerDetail(s = {}) {
  const sourceNom =
    s.source_nom ||
    s.signal?.source_nom ||
    s.source_distribution ||
    s.type_source ||
    s.signal?.type_source ||
    s.origine_signal ||
    s.signal?.origine_signal ||
    'Source non renseignée';

  return managerLabel(sourceNom, 'Source non renseignée');
}

function normaliserSecteurManager(s = {}) {
  return managerLabel(
    s.secteur_detecte_label ||
    s.signal?.secteur_detecte_label ||
    s.signal?.secteur_estime ||
    s.secteur_estime,
    'Secteur non renseigné'
  );
}

function normaliserSousSecteurManager(s = {}) {
  return managerLabel(
    s.sous_secteur_detecte_label ||
    s.signal?.sous_secteur_detecte_label,
    ''
  );
}

function normaliserTypeSignalManager(s = {}) {
  return s.type_signal_distribution || s.type_signal || s.signal?.type_signal || 'autre';
}

function normaliserScoreManager(s = {}) {
  const score = s.score_distribution ?? s.score_pertinence ?? s.signal?.score_pertinence;
  return Number.isFinite(Number(score)) ? Number(score) : null;
}

function isDistributionInManagerPeriod(d = {}, period) {
  return (
    isDateInManagerPeriod(d.date_assignation, period) ||
    isDateInManagerPeriod(d.created_at, period) ||
    isDateInManagerPeriod(d.updated_at, period) ||
    isDateInManagerPeriod(d.date_derniere_action, period) ||
    isDateInManagerPeriod(d.date_a_contacter, period) ||
    isDateInManagerPeriod(d.date_crm_cree, period) ||
    isDateInManagerPeriod(d.relance_due_at, period)
  );
}

async function chargerContexteManagerRadar() {
  const teamId = currentProfil?.team_id;
  if (!teamId) return null;

  const period = getManagerPeriodConfig();

  const { data: signauxData, error: signauxError } = await window.FLAIR_DATA_SERVICES.signaux()
    .select('*')
    .eq('team_id', teamId);

  if (signauxError) throw signauxError;

  const { data: commerciauxData, error: commerciauxError } = await window.FLAIR_DATA_SERVICES.commerciaux()
    .select('*')
    .eq('team_id', teamId);

  if (commerciauxError) {
    console.warn('Vue manager : commerciaux indisponibles', commerciauxError.message);
  }

  const commerciaux = commerciauxData || [];
  const commercialIds = new Set(commerciaux.map(c => c.id).filter(Boolean));

  let distributions = [];
  const { data: distributionsData, error: distributionsError } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
    .select('*, signal:signaux(*)');

  if (distributionsError) {
    console.warn('Vue manager : distributions indisponibles', distributionsError.message);
  } else {
    distributions = (distributionsData || [])
      .filter(row => row.signal?.team_id === teamId || commercialIds.has(row.commercial_id))
      .map(row => normaliserDistributionSignal(row));
  }

  let sourcesVeille = [];
  const { data: sourcesData, error: sourcesError } = await window.FLAIR_DATA_SERVICES.sourcesVeille()
    .select('*');

  if (sourcesError) {
    console.warn('Vue Sources & veille : sources_veille indisponible', sourcesError.message);
  } else {
    sourcesVeille = sourcesData || [];
  }

  let recherchesIa = [];
  const { data: recherchesData, error: recherchesError } = await window.FLAIR_DATA_SERVICES.recherchesIaCommerciaux()
    .select('*');

  if (recherchesError) {
    console.warn('Vue Sources & veille : recherches IA indisponibles', recherchesError.message);
  } else {
    recherchesIa = (recherchesData || []).filter(r => !r.commercial_id || commercialIds.has(r.commercial_id));
  }

  const allSignaux = signauxData || [];
  const signauxPeriode = allSignaux.filter(s =>
    isSignalCreatedInPeriod(s, period) ||
    isSignalContactedInPeriod(s, period) ||
    isSignalCrmCreatedInPeriod(s, period) ||
    isDateInManagerPeriod(s.date_derniere_action, period) ||
    isDateInManagerPeriod(s.relance_due_at, period)
  );

  const distributionsPeriode = distributions.filter(d => isDistributionInManagerPeriod(d, period));

  return {
    teamId,
    period,
    allSignaux,
    signauxPeriode,
    distributions,
    distributionsPeriode,
    commerciaux,
    sourcesVeille,
    recherchesIa
  };
}

function afficherManagerDashboardPrincipal(show = true) {
  document.querySelectorAll('.manager-kpi-grid, .manager-pro-grid').forEach(el => {
    if (el.id === 'managerSubViewPanel') return;
    el.style.display = show ? '' : 'none';
  });

  const subPanel = document.getElementById('managerSubViewPanel');
  if (subPanel) subPanel.style.display = show ? 'none' : '';
}

function setManagerHeaderForSubview(view) {
  const kicker = document.querySelector('#managerView .manager-kicker');
  const title = document.getElementById('managerWelcomeTitle');

  const solo = estProfilManagerSolo(currentProfil);
  const configs = {
    manager: [
      solo ? 'Dashboard Solo' : 'Dashboard PRO',
      solo
        ? `Bienvenue ${currentProfil?.prenom || ''}, voici votre vision commerciale personnelle`
        : `Bienvenue ${currentProfil?.prenom || ''}, voici votre vision manager`
    ],
    sources: ['Sources & veille', solo ? 'Piloter les sources de votre radar personnel' : 'Piloter les sources qui alimentent le radar'],
    relances: ['Relances légères', 'Voir les signaux à reprendre sans devenir un CRM'],
    opportunites: ['Liste d’opportunités', 'Exporter une liste de travail sans transformer FLAIR en CRM'],
    qualite: ['Qualité du radar', solo ? 'Mesurer la pertinence de votre radar personnel' : 'Mesurer la pertinence et la transformation du radar']
  };

  const [k, t] = configs[view] || configs.manager;
  if (kicker) kicker.textContent = k;
  if (title) title.textContent = t;
}

async function afficherManagerSubview(view = 'manager') {
  setManagerHeaderForSubview(view);

  if (view === 'manager') {
    afficherManagerDashboardPrincipal(true);
    return;
  }

  afficherManagerDashboardPrincipal(false);

  const container = document.getElementById('managerSubViewPanel');
  if (!container) return;

  container.className = `manager-pro-grid manager-pro-grid-v51 manager-subview-${view}`;
  container.innerHTML = '<section class="manager-panel"><div class="manager-empty">Chargement…</div></section>';

  try {
    const ctx = await chargerContexteManagerRadar();
    if (!ctx) {
      container.innerHTML = '<section class="manager-panel"><div class="manager-empty">Équipe non rattachée.</div></section>';
      return;
    }

    if (estProfilManagerSolo(currentProfil) && view === 'opportunites') {
      await renderManagerListeOpportunitesSolo(container);
    } else if (estProfilManagerSolo(currentProfil) && ['sources', 'relances', 'qualite'].includes(view)) {
      container.innerHTML = '<section class="manager-panel" style="grid-column:1 / -1;"><div class="manager-empty">Vue équipe réservée au Dashboard Manager PRO. Le responsable solo utilise principalement le cockpit commercial et la liste d’opportunités personnelle.</div></section>';
    } else if (view === 'sources') {
      renderManagerSourcesVeille(ctx, container);
    } else if (view === 'relances') {
      renderManagerRelancesLegeres(ctx, container);
    } else if (view === 'opportunites') {
      renderManagerListeOpportunites(ctx, container);
    } else if (view === 'qualite') {
      renderManagerQualiteRadar(ctx, container);
    }
  } catch (err) {
    console.error('Erreur vue manager :', err);
    container.innerHTML = '<section class="manager-panel"><div class="manager-empty">Erreur de chargement de la vue manager.</div></section>';
  }
}


// =========================
// SOURCES & VEILLE — compatibilité fréquence Supabase
// =========================
// État constaté dans la table sources_veille : frequence_scan accepte actuellement
// "daily" et "manual". Ne pas envoyer "weekly" ou "monthly" tant que la contrainte
// Supabase n'a pas été élargie.
const FLAIR_SOURCES_VEILLE_FREQUENCES_AUTORISEES = ['daily', 'manual'];

function normaliserFrequenceSourceVeille(value) {
  const brut = String(value || '').trim().toLowerCase();
  if (FLAIR_SOURCES_VEILLE_FREQUENCES_AUTORISEES.includes(brut)) return brut;
  if (['quotidien', 'quotidienne', 'jour', 'daily_scan'].includes(brut)) return 'daily';
  if (['manuel', 'manuelle', 'manual_scan', 'manual_import'].includes(brut)) return 'manual';

  // Valeurs non compatibles avec la contrainte actuelle observée : weekly / monthly.
  // On les affiche comme non conformes plutôt que de les transformer silencieusement.
  return brut || '';
}

function labelFrequenceSourceVeille(value) {
  const freq = normaliserFrequenceSourceVeille(value);
  const labels = {
    daily: 'quotidienne',
    manual: 'manuelle'
  };
  if (labels[freq]) return labels[freq];
  if (!freq) return 'non définie';
  return `${freq} ⚠️ non compatible contrainte actuelle`;
}

function frequenceSourceVeilleCompatible(value) {
  return FLAIR_SOURCES_VEILLE_FREQUENCES_AUTORISEES.includes(normaliserFrequenceSourceVeille(value));
}

function renderManagerSourcesVeille(ctx, container) {
  const signaux = ctx.signauxPeriode.length ? ctx.signauxPeriode : ctx.allSignaux;
  const totalSignaux = signaux.length;

  const sourcesMap = new Map();
  signaux.forEach(s => {
    const source = normaliserSourceManagerDetail(s);
    const current = sourcesMap.get(source) || { total: 0, chauds: 0, crm: 0, typeSources: new Map() };
    current.total++;
    if (normaliserChaleurManager(s) === 'chaud') current.chauds++;
    if (s.crm_cree === true) current.crm++;
    const type = managerLabel(s.type_source || s.origine_signal || 'non renseigné', 'non renseigné');
    current.typeSources.set(type, (current.typeSources.get(type) || 0) + 1);
    sourcesMap.set(source, current);
  });

  const sourceEntries = Array.from(sourcesMap.entries())
    .map(([label, data]) => ({
      label,
      total: data.total,
      chauds: data.chauds,
      crm: data.crm,
      tauxChaud: safePercent(data.chauds, data.total),
      typePrincipal: Array.from(data.typeSources.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    }))
    .sort((a, b) => (b.chauds - a.chauds) || (b.total - a.total))
    .slice(0, 8);

  const sourcesActives = (ctx.sourcesVeille || [])
    .filter(s => s.actif === true || s.actif === 'true')
    .slice()
    .sort((a, b) => {
      const freqA = normaliserFrequenceSourceVeille(a.frequence_scan || '');
      const freqB = normaliserFrequenceSourceVeille(b.frequence_scan || '');
      const compatA = frequenceSourceVeilleCompatible(freqA) ? 0 : 1;
      const compatB = frequenceSourceVeilleCompatible(freqB) ? 0 : 1;
      if (compatA !== compatB) return compatA - compatB;
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
    });
  const totalIa = (ctx.recherchesIa || []).reduce((sum, r) => sum + (Number(r.nb_signaux_distribues) || 0), 0);

  container.innerHTML = `
    <section class="manager-panel manager-sources-performance-panel">
      <div class="manager-panel-head">
        <h4>Sources les plus performantes</h4>
        <span class="manager-mini-badge">${ctx.period.label}</span>
      </div>
      <p class="manager-panel-note">Objectif : savoir quelles sources alimentent réellement le radar en signaux utiles.</p>
      <div class="manager-bars-list">
        ${sourceEntries.length ? sourceEntries.map((s, index) => `
          <div class="manager-v51-bar-row">
            <div class="manager-v51-bar-head">
              <span>${index + 1}. ${managerEscape(s.label)}</span>
              <strong>${s.chauds} chaud(s) / ${s.total}</strong>
            </div>
            <div class="manager-v51-bar"><i style="width:${Math.max(6, s.tauxChaud)}%"></i></div>
            <small>${s.tauxChaud}% de signaux chauds · type : ${managerEscape(s.typePrincipal)} · CRM : ${s.crm}</small>
          </div>
        `).join('') : '<div class="manager-empty">Aucune source exploitable sur la période.</div>'}
      </div>
    </section>

    <section class="manager-panel manager-sources-lecture-panel">
      <div class="manager-panel-head">
        <h4>Lecture veille</h4>
        <span class="manager-mini-badge">Radar</span>
      </div>
      <div class="manager-kpi-grid manager-kpi-grid-pro" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
        <article class="manager-kpi-card manager-kpi-compact">
          <span>Sources actives</span>
          <strong>${sourcesActives.length}</strong>
          <small>sources_veille</small>
        </article>
        <article class="manager-kpi-card manager-kpi-compact">
          <span>Signaux analysés</span>
          <strong>${totalSignaux}</strong>
          <small>${ctx.period.label}</small>
        </article>
        <article class="manager-kpi-card manager-kpi-compact">
          <span>Distributions IA</span>
          <strong>${totalIa}</strong>
          <small>recherches IA</small>
        </article>
      </div>
      <div class="manager-bars-list" style="margin-top:14px;">
        ${sourcesActives.length ? sourcesActives.slice(0, 10).map(s => `
          <div class="manager-source-row">
            <div>
              <div class="manager-source-title">${managerEscape(s.nom || 'Source sans nom')}</div>
              <div class="manager-source-sub">${managerEscape(s.type_source || 'type non renseigné')} · fréquence : ${managerEscape(labelFrequenceSourceVeille(s.frequence_scan))}</div>
            </div>
            <div class="manager-row-score">${s.derniere_collecte ? formatDate(s.derniere_collecte) : '—'}</div>
          </div>
        `).join('') : '<div class="manager-empty">Aucune source active renseignée.</div>'}
      </div>
    </section>
  `;
}

function renderManagerRelancesLegeres(ctx, container) {
  const now = new Date();
  const distributions = ctx.distributions.length ? ctx.distributions : ctx.allSignaux;
  const signauxAction = distributions.filter(s => !['historique', 'ignore', 'traite'].includes(normaliserStatutManager(s)));

  const relancesRetard = signauxAction.filter(s => {
    if (!s.relance_due_at) return false;
    if (s.crm_cree === true) return false;
    return new Date(s.relance_due_at) < now;
  });

  const aContacterDormants = signauxAction.filter(s => {
    if (normaliserStatutManager(s) !== 'a_contacter') return false;
    if (s.crm_cree === true) return false;
    const ref = new Date(s.date_derniere_action || s.date_a_contacter || s.updated_at || s.date_assignation || s.created_at || 0);
    if (Number.isNaN(ref.getTime())) return false;
    return (now - ref) > 7 * 24 * 60 * 60 * 1000;
  });

  const aSuivre = signauxAction.filter(s => normaliserStatutManager(s) === 'a_suivre');

  const rows = [...relancesRetard, ...aContacterDormants, ...aSuivre]
    .filter((s, index, arr) => arr.findIndex(x => (x.id || x.signal_id) === (s.id || s.signal_id)) === index)
    .sort((a, b) => new Date(a.relance_due_at || a.date_derniere_action || a.created_at || 0) - new Date(b.relance_due_at || b.date_derniere_action || b.created_at || 0))
    .slice(0, 12);

  container.innerHTML = `
    <section class="manager-panel manager-team-performance-panel">
      <div class="manager-panel-head">
        <h4>Relances légères</h4>
        <span class="manager-mini-badge">Sans CRM</span>
      </div>
      <p class="manager-panel-note">Rappel simple : FLAIR signale les points à reprendre, sans automatisation ni suivi commercial lourd.</p>
      <div class="manager-kpi-grid manager-kpi-grid-pro" style="grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom:14px;">
        <article class="manager-kpi-card manager-kpi-compact manager-kpi-alert">
          <span>Relances à effectuer</span>
          <strong>${relancesRetard.length}</strong>
          <small>signaux à reprendre</small>
      </article>
        <article class="manager-kpi-card manager-kpi-compact">
          <span>À contacter dormants</span>
          <strong>${aContacterDormants.length}</strong>
          <small>plus de 7 jours sans action</small>
        </article>
        <article class="manager-kpi-card manager-kpi-compact">
          <span>À suivre</span>
          <strong>${aSuivre.length}</strong>
          <small>surveillance terrain</small>
        </article>
      </div>
      <div class="manager-bars-list">
        ${rows.length ? rows.map(s => {
          const statut = normaliserStatutManager(s);
          const dateRef = s.relance_due_at || s.date_derniere_action || s.date_assignation || s.created_at;
          return `
            <div class="manager-source-row">
              <div>
                <div class="manager-source-title">${managerEscape(signalTitle(s))}</div>
                <div class="manager-source-sub">${managerEscape(signalCompany(s) || 'Entreprise non renseignée')} · ${managerEscape(badgeStatut(statut).replace(/<[^>]+>/g, '') || statut || 'statut non renseigné')}</div>
              </div>
              <div class="manager-row-score">${dateRef ? formatDate(dateRef) : '—'}</div>
            </div>`;
        }).join('') : '<div class="manager-empty">Aucune relance légère à traiter.</div>'}
      </div>
    </section>
  `;
}

function renderManagerQualiteRadar(ctx, container) {
  const distributions = ctx.distributionsPeriode.length ? ctx.distributionsPeriode : ctx.distributions;
  const base = distributions.length ? distributions : ctx.signauxPeriode;

  const total = base.length;
  const chauds = base.filter(s => normaliserChaleurManager(s) === 'chaud').length;
  const tiedes = base.filter(s => normaliserChaleurManager(s) === 'tiede').length;
  const froids = base.filter(s => normaliserChaleurManager(s) === 'froid').length;
  const contactes = base.filter(s => normaliserStatutManager(s) === 'a_contacter' || Boolean(s.date_a_contacter)).length;
  const crm = base.filter(s => s.crm_cree === true).length;
  const ignores = base.filter(s => ['ignore', 'historique', 'traite'].includes(normaliserStatutManager(s))).length;
  const scores = base.map(normaliserScoreManager).filter(v => v !== null);
  const scoreMoyen = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : '—';

  const secteurMap = new Map();
  const sourceMap = new Map();
  const angleMap = new Map();

  base.forEach(s => {
    const secteur = normaliserSecteurManager(s);
    secteurMap.set(secteur, (secteurMap.get(secteur) || 0) + 1);

    const source = normaliserSourceManagerDetail(s);
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1);

    const angle = formatManagerTypeLabel(normaliserTypeSignalManager(s));
    angleMap.set(angle, (angleMap.get(angle) || 0) + 1);
  });

  const toEntries = map => Array.from(map.entries())
    .map(([label, value]) => ({ label, value, detail: `(${safePercent(value, Math.max(total, 1))}%)` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  container.innerHTML = `
    <section class="manager-panel manager-team-performance-panel">
      <div class="manager-panel-head">
        <h4>Qualité du radar</h4>
        <span class="manager-mini-badge">${ctx.period.label}</span>
      </div>
      <p class="manager-panel-note">Mesure la qualité du flux : chaleur, transformation, secteurs et sources utiles.</p>
      <div class="manager-kpi-grid manager-kpi-grid-pro" style="grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom:14px;">
        <article class="manager-kpi-card manager-kpi-compact">
          <span>Score moyen</span>
          <strong>${scoreMoyen}</strong>
          <small>score_distribution</small>
        </article>
        <article class="manager-kpi-card manager-kpi-compact">
          <span>% chauds</span>
          <strong>${safePercent(chauds, total)}%</strong>
          <small>${chauds} / ${total}</small>
        </article>
        <article class="manager-kpi-card manager-kpi-compact">
          <span>Contactés</span>
          <strong>${contactes}</strong>
          <small>actions terrain</small>
        </article>
        <article class="manager-kpi-card manager-kpi-compact">
          <span>CRM</span>
          <strong>${crm}</strong>
          <small>opportunités créées</small>
        </article>
      </div>
      <div class="manager-bars-list">
        <div class="manager-source-row">
          <div>
            <div class="manager-source-title">Entonnoir radar</div>
            <div class="manager-source-sub">${total} signaux → ${chauds} chauds → ${contactes} contactés → ${crm} CRM · ${ignores} ignorés/archivés</div>
          </div>
          <div class="manager-row-score">${safePercent(crm, total)}%</div>
        </div>
      </div>
    </section>

    <section class="manager-panel">
      <div class="manager-panel-head">
        <h4>Top secteurs</h4>
        <span class="manager-mini-badge">Pertinence</span>
      </div>
      <div id="mgrQualiteSecteurs" class="manager-bars-list"></div>
    </section>

    <section class="manager-panel">
      <div class="manager-panel-head">
        <h4>Top sources</h4>
        <span class="manager-mini-badge">Flux</span>
      </div>
      <div id="mgrQualiteSources" class="manager-bars-list"></div>
    </section>

    <section class="manager-panel">
      <div class="manager-panel-head">
        <h4>Top angles</h4>
        <span class="manager-mini-badge">Signaux</span>
      </div>
      <div id="mgrQualiteAngles" class="manager-bars-list"></div>
    </section>
  `;

  renderManagerBars('mgrQualiteSecteurs', toEntries(secteurMap), 'Aucun secteur exploitable.');
  renderManagerBars('mgrQualiteSources', toEntries(sourceMap), 'Aucune source exploitable.');
  renderManagerBars('mgrQualiteAngles', toEntries(angleMap), 'Aucun angle exploitable.');
}


async function refreshCockpit() {
  await chargerSignaux();
  await chargerTop3();
  await chargerAContacter();
  await chargerHistorique();
  await chargerStats();
}

function appliquerFiltreCommercial(query) {
  if (!user?.id) return query;
  return query.eq('commercial_id', user.id);
}


// =========================
// DISTRIBUTION SIGNAUX ↔ COMMERCIAUX
// =========================

function estDistributionCommerciale(s = {}) {
  return s._source_table === 'signaux_commerciaux';
}

function idSignalSource(s = {}) {
  return s.signal_id || s.id;
}

function normaliserDistributionSignal(row = {}) {
  const signal = row.signal || {};
  return {
    ...signal,
    // Les champs ci-dessous sont propres à la relation signal ↔ commercial.
    id: row.id,
    signal_id: signal.id || row.signal_id,
    commercial_id: row.commercial_id,
    statut: row.statut || signal.statut,
    date_assignation: row.date_assignation || signal.date_assignation,
    date_a_contacter: row.date_a_contacter || signal.date_a_contacter,
    crm_cree: row.crm_cree ?? signal.crm_cree,
    date_crm_cree: row.date_crm_cree || signal.date_crm_cree,
    feedback_commercial: row.feedback_commercial || signal.feedback_commercial,
    note_commercial: row.note_commercial ?? signal.note_commercial,
    commentaire_action: row.commentaire_action || signal.commentaire_action,
    relance_due_at: row.relance_due_at || signal.relance_due_at,
    date_derniere_action: row.updated_at || row.date_assignation || signal.date_derniere_action,

    // Résultat personnalisé pour le commercial.
    score_pertinence: row.score_distribution ?? signal.score_pertinence,
    chaleur: row.chaleur_distribution || signal.chaleur,
    type_signal: row.type_signal_distribution || signal.type_signal,
    raison_score: row.raison_score_distribution || signal.raison_score,
    angle_commercial: row.angle_commercial_distribution || signal.angle_commercial,
    action_recommandee: row.action_recommandee_distribution || signal.action_recommandee,

    // Copilote commercial : préparation avant CRM.
    timing_phase: row.timing_phase || signal.timing_phase,
    timing_score: row.timing_score ?? signal.timing_score,
    fenetre_contact: row.fenetre_contact || signal.fenetre_contact,
    raison_timing: row.raison_timing || signal.raison_timing,
    interlocuteurs_cibles: row.interlocuteurs_cibles || signal.interlocuteurs_cibles,
    angle_conseille: row.angle_conseille || signal.angle_conseille,
    message_linkedin: row.message_linkedin || signal.message_linkedin,
    email_prepare: row.email_prepare || signal.email_prepare,
    plan_appel: row.plan_appel || signal.plan_appel,
    copilote_commercial: row.copilote_commercial || signal.copilote_commercial || null,
    secteur_detecte_label: row.secteur_detecte_label || signal.secteur_detecte_label || signal.secteur_estime,
    sous_secteur_detecte_label: row.sous_secteur_detecte_label || signal.sous_secteur_detecte_label,

    // Coordonnées publiques entreprise — restent des données de contexte, pas du CRM.
    entreprise_site_web: row.entreprise_site_web || signal.entreprise_site_web || null,
    entreprise_telephone_standard: row.entreprise_telephone_standard || signal.entreprise_telephone_standard || null,
    entreprise_email_generique: row.entreprise_email_generique || signal.entreprise_email_generique || null,
    _source_table: 'signaux_commerciaux'
  };
}

function dedoublonnerSignauxPourAffichage(signaux = []) {
  const vus = new Set();
  return signaux.filter(signal => {
    const cle = idSignalSource(signal) || signal.id;
    if (!cle || vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

async function lireDistributionsCommerciales({ statuts = [], limit = 20, orderTop3 = false } = {}) {
  if (!user?.id) return { data: [], error: null };

  let query = window.FLAIR_DATA_SERVICES.signauxCommerciaux()
    .select('*, signal:signaux(*)')
    .eq('commercial_id', user.id);

  if (statuts.length === 1) {
    query = query.eq('statut', statuts[0]);
  } else if (statuts.length > 1) {
    query = query.in('statut', statuts);
  }

  if (orderTop3) {
    query = query
      .order('score_distribution', { ascending: false, nullsFirst: false })
      .order('date_assignation', { ascending: false });
  } else {
    query = query.order('updated_at', { ascending: false });
  }

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  return {
    data: error ? [] : (data || []).map(normaliserDistributionSignal),
    error
  };
}

async function lireIdsSignauxDejaDistribuesPourCommercial() {
  if (!user?.id) return new Set();

  const { data, error } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
    .select('signal_id')
    .eq('commercial_id', user.id);

  if (error) {
    console.warn('Lecture des distributions existantes indisponible :', error.message);
    return new Set();
  }

  return new Set((data || []).map(row => row.signal_id).filter(Boolean));
}

function exclureSignauxSourcesDejaDistribues(signaux = [], idsDistribues = new Set()) {
  if (!idsDistribues?.size) return signaux || [];
  return (signaux || []).filter(signal => !idsDistribues.has(signal.id));
}

async function lireSignalSourcePourCrm(signalIdOuDistributionId) {
  if (!signalIdOuDistributionId) return { data: null, error: null };

  const { data: distribution, error: distError } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
    .select('*, signal:signaux(*)')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  if (!distError && distribution?.signal) {
    return { data: normaliserDistributionSignal(distribution), error: null };
  }

  const { data, error } = await window.FLAIR_DATA_SERVICES.signaux()
    .select('*')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  return { data, error };
}

async function lireChaleurSignalPourAction(signalIdOuDistributionId) {
  const { data: distribution, error: distError } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
    .select('id, signal:signaux(chaleur)')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  if (!distError && distribution?.id) {
    return {
      table: 'signaux_commerciaux',
      chaleur: distribution.signal?.chaleur || ''
    };
  }

  const { data, error } = await window.FLAIR_DATA_SERVICES.signaux()
    .select('chaleur')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  if (error) {
    console.error('Erreur lecture signal action :', error);
  }

  return {
    table: 'signaux',
    chaleur: data?.chaleur || ''
  };
}

async function mettreAJourSignalOuDistribution(signalIdOuDistributionId, updateData) {
  const { data: distribution, error: distReadError } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
    .select('id')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  if (!distReadError && distribution?.id) {
    const { error } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', signalIdOuDistributionId);
    return error;
  }

  const { error } = await window.FLAIR_DATA_SERVICES.signaux()
    .update(updateData)
    .eq('id', signalIdOuDistributionId);

  return error;
}

async function garantirContexteSignal() {
  if (!user?.id) {
    alert("Tu dois être connecté.");
    return null;
  }

  let profil = currentProfil;

  if (!profil?.id || profil.id !== user.id || profil.team_id === undefined) {
    const { data, error } = await window.FLAIR_DATA_SERVICES.commerciaux()
      .select('id, email, prenom, nom, role, team_id, region, regions_secondaires, profil_metier')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      alert("Erreur lecture profil commercial : " + error.message);
      return null;
    }

    if (!data) {
      alert("Profil commercial introuvable.");
      return null;
    }

    profil = data;
    currentProfil = { ...currentProfil, ...data };
  }

  if (!profil.team_id) {
  const invitationEmail = await recupererInvitationUtilisateurParEmail(user);

  if (
    invitationEmail &&
    invitationEmail.team_id &&
    invitationCorrespondUtilisateur(invitationEmail, user)
  ) {
    const payloadInvitation = construirePayloadInvitation(invitationEmail);

    const { data: profilRepare, error: repairError } = await window.FLAIR_DATA_SERVICES.commerciaux()
      .update(payloadInvitation)
      .eq('id', user.id)
      .select('*')
      .single();

    if (!repairError && profilRepare?.team_id) {
      currentProfil = { ...currentProfil, ...profilRepare };
      profil = profilRepare;
    }
  }
}

if (!profil.team_id) {
  alert("Aucune équipe n'est rattachée à ce profil. Impossible de créer un signal sécurisé.");
  return null;
}

  return {
    commercial_id: user.id,
    team_id: profil.team_id
  };
}

  function signalTitle(s) {
  return s.titre || 'Signal sans titre';
}

function nettoyerEntrepriseNomRegion(value) {
  return String(value || '')
    .replace(/\s*[—–-]\s*(?:r[eé]gion|region)\s*[:：-]\s*[^|\n\r]+/i, '')
    .replace(/\s+(?:r[eé]gion|region)\s*[:：-]\s*[^|\n\r]+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function signalCompany(s) {
  return nettoyerEntrepriseNomRegion(s.entreprise_nom || '');
}

function signalCompanyLigne(s) {
  const entreprise = signalCompany(s);
  if (!entreprise) return '';
  const normaliser = (v) => normaliserTexteSimple ? normaliserTexteSimple(v) : String(v || '').toLowerCase().trim();
  // FLAIR V2.2 — évite l'affichage visuel "Amazon / Amazon" quand le titre
  // est déjà uniquement le nom de l'entreprise.
  if (normaliser(entreprise) === normaliser(signalTitle(s))) return '';
  return `${entreprise}<br>`;
}

function signalCoordonneePublique(s = {}, cles = []) {
  for (const cle of cles) {
    const valeur = s?.[cle] ?? s?.signal?.[cle];
    if (valeur !== null && valeur !== undefined && String(valeur).trim() !== '') return String(valeur).trim();
  }
  return '';
}

function signalSiteWeb(s = {}) {
  return signalCoordonneePublique(s, ['entreprise_site_web', 'site_web', 'siteweb', 'url_site']);
}

function signalTelephoneStandard(s = {}) {
  return signalCoordonneePublique(s, ['entreprise_telephone_standard', 'telephone_standard', 'telephone', 'tel_standard']);
}

function signalEmailGenerique(s = {}) {
  return signalCoordonneePublique(s, ['entreprise_email_generique', 'email_generique', 'email_contact', 'contact_email']);
}

function renderCoordonneesEntreprise(s = {}, options = {}) {
  if (window.FLAIR_UI_COORDONNEES?.renderCoordonneesEntreprise) {
    return window.FLAIR_UI_COORDONNEES.renderCoordonneesEntreprise(s, options);
  }

  const site = signalSiteWeb(s);
  const tel = signalTelephoneStandard(s);
  const email = signalEmailGenerique(s);
  const afficherVide = options.afficherVide === true;

  if (!site && !tel && !email && !afficherVide) return '';

  const siteLabel = site || '—';
  const telLabel = tel || '—';
  const emailLabel = email || '—';
  const payloadCopie = encodeURIComponent(JSON.stringify({
    site_web: siteLabel,
    telephone_standard: telLabel,
    email_generique: emailLabel
  }));

  const titre = options.titre || '📇 Coordonnées publiques';
  return `
    <div class="coordonnees-publiques-card">
      <div class="coordonnees-publiques-head">
        <b>${managerEscape(titre)}</b>
        <button type="button" class="coordonnees-copy-btn" onclick="copierCoordonneesPubliques('${payloadCopie}')">📋 Copier coordonnées</button>
      </div>
      <div class="coordonnees-publiques-lines">
        <small><b>🌐 Site web :</b> ${managerEscape(siteLabel)}</small>
        <small><b>☎ Téléphone :</b> ${managerEscape(telLabel)}</small>
        <small><b>✉ Email :</b> ${managerEscape(emailLabel)}</small>
      </div>
    </div>
  `;
}

async function copierCoordonneesPubliques(payloadEncode = '') {
  if (window.FLAIR_UI_COORDONNEES?.copierCoordonneesPubliques) {
    return window.FLAIR_UI_COORDONNEES.copierCoordonneesPubliques(payloadEncode);
  }

  let payload = {};
  try {
    payload = JSON.parse(decodeURIComponent(payloadEncode || '')) || {};
  } catch (err) {
    payload = {};
  }

  const texte = [
    `Site web : ${payload.site_web || '—'}`,
    `Téléphone standard : ${payload.telephone_standard || '—'}`,
    `Email générique : ${payload.email_generique || '—'}`
  ].join('\n');

  try {
    await copierTexteDansPressePapier(texte);
    alert('Coordonnées publiques copiées.');
  } catch (err) {
    alert('Copie indisponible. Vous pouvez copier les coordonnées manuellement.');
  }
}

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('fr-FR');
  } catch (err) {
    return '';
  }
}

function signalMetaDate(s) {
  return formatDate(s.date_signal || s.created_at);
}

function estSignalProjetSuivi(s = {}) {
  return Boolean(
    s.projet_detecte ||
    String(s.commentaire_action || '').toLowerCase().includes('projet déjà détecté') ||
    String(s.commentaire_action || '').toLowerCase().includes('projet deja detecte') ||
    String(s.commentaire_action || '').toLowerCase().includes('projet industriel suivi')
  );
}

function badgeProjetSuivi(s = {}) {
  return estSignalProjetSuivi(s)
    ? '<span class="badge badge-statut">📁 Projet suivi</span>'
    : '';
}

function nettoyerMessageProjetSuivi(message = '') {
  return String(message || '')
    .replace(/^\s*⚠\s*Projet déjà détecté\s*:\s*/i, '')
    .replace(/^\s*⚠\s*Projet deja detecte\s*:\s*/i, '')
    .trim();
}


// FLAIR V2.6 — synthèse courte générique pour tous les signaux compatibles métier.
// Objectif : conserver l'analyse complète en base, mais afficher d'abord 3 à 5 raisons lisibles.
function decouperPhrasesCourtesFlair(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .split(/\.\s+|;\s+|\n+/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.replace(/\.$/, '').trim())
    .filter(Boolean);
}

function nettoyerPhrasePrioriteFlair(value = '') {
  return String(value || '')
    .replace(/^Pourquoi\s*\??\s*/i, '')
    .replace(/^Prochaine action\s*:\s*/i, '')
    .replace(/^Action\s*:\s*/i, '')
    .replace(/^Timing\s*:\s*/i, '')
    .replace(/^Zone commerciale\s*:\s*/i, '')
    .trim();
}

function phraseCourteFlair(value = '', max = 118) {
  const texte = nettoyerPhrasePrioriteFlair(value);
  if (!texte) return '';
  if (texte.length <= max) return texte.endsWith('.') ? texte : `${texte}.`;
  const coupe = texte.slice(0, max).replace(/\s+\S*$/, '').trim();
  return `${coupe}…`;
}

function ajouterPrioriteFlair(liste, phrase, max = 118) {
  const propre = phraseCourteFlair(phrase, max);
  if (!propre) return;
  const cle = (normaliserTexteSimple ? normaliserTexteSimple(propre) : propre.toLowerCase()).replace(/\W+/g, ' ').trim();
  if (!cle || liste.some(item => item.cle === cle || cle.includes(item.cle) || item.cle.includes(cle))) return;
  liste.push({ texte: propre, cle });
}

function libelleProjetCourtFlair(s = {}) {
  const type = String(s.type_signal || s.famille_projet || '').replaceAll('_', ' ').trim();
  const titre = signalTitle(s);
  const texte = [type, titre, s.resume_brut].filter(Boolean).join(' ');
  const normalise = normaliserTexteSimple ? normaliserTexteSimple(texte) : texte.toLowerCase();

  if (/nouvelle ligne|ligne de production|ligne de fabrication|ligne de conditionnement|ligne automatisee|ligne automatisée/.test(normalise)) {
    return 'Nouvelle ligne identifiée.';
  }
  if (/extension|agrandissement|nouveau batiment|nouveau bâtiment|capacite|capacité/.test(normalise)) {
    return 'Extension ou montée en capacité.';
  }
  if (/automatisation|robotisation|convoyage|intralogistique|palettisation|agv/.test(normalise)) {
    return 'Projet d’automatisation à qualifier.';
  }
  if (/rachat|acquisition|fusion|nouvel actionnaire|reprise|nouvelle direction/.test(normalise)) {
    return 'Changement capitalistique ou directionnel.';
  }
  if (type) return `${type.charAt(0).toUpperCase()}${type.slice(1)}.`;
  return '';
}

function compatibiliteMetierCourteFlair(s = {}, copiloteJson = null) {
  const textes = [
    s.raison_score,
    s.angle_commercial,
    s.action_recommandee,
    copiloteJson?.angle,
    Array.isArray(copiloteJson?.pourquoi) ? copiloteJson.pourquoi.join(' ') : copiloteJson?.pourquoi
  ].filter(Boolean).join(' ');
  const normalise = normaliserTexteSimple ? normaliserTexteSimple(textes) : textes.toLowerCase();
  const profil = normaliserSlugProfilMetierFlair(currentProfil?.profil_metier || s.profil_metier || '');

  if (profil === 'detection' || /detecteur|detection|rayon x|rayons x|xray|inspection produit/.test(normalise)) {
    if (/rayon x|rayons x|xray/.test(normalise)) return 'Compatible Détection / Rayons X.';
    return 'Compatible Détection / inspection produit.';
  }
  if (profil === 'pesage' || /pesage|controle poids|contrôle poids|ponderal|pondéral|checkweigher|poids prix/.test(normalise)) {
    return 'Compatible Pesage / contrôle poids.';
  }
  if (profil === 'packaging' || /packaging|emballage|film|etiquette|étiquette|carton|impression|flexo|helio|hélio/.test(normalise)) {
    return 'Compatible Packaging / impression.';
  }
  if (profil === 'process' || /process|convoyage|conditionnement|automatisation|robotique|palettisation|fin de ligne/.test(normalise)) {
    return 'Compatible Process / fin de ligne.';
  }
  if (profil === 'vision' || /vision|inspection|controle aspect|contrôle aspect|ocr|lecture code/.test(normalise)) {
    return 'Compatible Vision / contrôle qualité.';
  }
  return '';
}

function timingCourtFlair(s = {}, copiloteJson = null) {
  const timing = copiloteJson?.timing || s.fenetre_contact || s.timing_commercial || '';
  if (!timing) return '';
  const normalise = normaliserTexteSimple ? normaliserTexteSimple(timing) : timing.toLowerCase();
  if (normalise.includes('0-3')) return 'Fenêtre courte : agir vite.';
  if (normalise.includes('3-6')) return 'Bon moment pour se positionner.';
  if (normalise.includes('6-12')) return 'Projet à qualifier en amont.';
  if (normalise.includes('12-24')) return 'Signal à suivre en veille active.';
  return timing;
}

function renderPrioritesSignalFlair(s = {}, copiloteJson = null) {
  const priorites = [];

  ajouterPrioriteFlair(priorites, libelleProjetCourtFlair(s), 96);
  ajouterPrioriteFlair(priorites, compatibiliteMetierCourteFlair(s, copiloteJson), 110);
  ajouterPrioriteFlair(priorites, timingCourtFlair(s, copiloteJson), 110);

  if (estSignalProjetSuivi(s)) {
    ajouterPrioriteFlair(priorites, 'Projet déjà confirmé dans FLAIR.', 100);
  }

  decouperPhrasesCourtesFlair(s.raison_score)
    .filter(phrase => {
      const n = normaliserTexteSimple ? normaliserTexteSimple(phrase) : phrase.toLowerCase();
      return !n.startsWith('zone commerciale') && !n.startsWith('timing') && !n.startsWith('prochaine action');
    })
    .slice(0, 5)
    .forEach(phrase => ajouterPrioriteFlair(priorites, phrase, 128));

  if (!priorites.length) return '';

  const analyseComplete = [s.raison_score, s.angle_commercial, s.action_recommandee].filter(Boolean).join('\n');

  return `
    <div class="signal-priorite-card">
      <div class="signal-priorite-title">Pourquoi ce signal est prioritaire</div>
      <ul class="signal-priorite-list">
        ${priorites.slice(0, 5).map(item => `<li>${managerEscape(item.texte)}</li>`).join('')}
      </ul>
      ${analyseComplete ? `
        <details class="signal-analyse-complete">
          <summary>Voir l’analyse complète</summary>
          ${s.raison_score ? `<small><b>Pourquoi c’est important :</b> ${managerEscape(s.raison_score)}</small><br>` : ''}
          ${s.angle_commercial ? `<small><b>Opportunité commerciale :</b> ${managerEscape(s.angle_commercial)}</small><br>` : ''}
          ${s.action_recommandee ? `<small><b>Action conseillée :</b> ${managerEscape(s.action_recommandee)}</small>` : ''}
        </details>` : ''}
    </div>
  `;
}

function renderProjetSuiviBloc(s = {}) {
  if (!estSignalProjetSuivi(s) || !s.commentaire_action) return '';

  const message = nettoyerMessageProjetSuivi(s.commentaire_action);
  const lignes = message
    .split(/\.\s+/)
    .map(ligne => ligne.trim())
    .filter(Boolean)
    .slice(0, 6);

  const corps = lignes.length
    ? lignes.map(ligne => `<small>${ligne}${ligne.endsWith('.') ? '' : '.'}</small>`).join('<br>')
    : `<small>${message}</small>`;

  return `
    <div style="margin:8px 0;padding:9px 11px;border:1px solid #f59e0b;background:rgba(245,158,11,0.12);border-radius:10px;">
      <b>📁 PROJET INDUSTRIEL SUIVI</b><br>
      ${corps}
    </div>
  `;
}

function renderSignalCard(s, options = {}) {
  const rank = options.rank ? `#${options.rank} — ` : '';
  const showStatus = options.showStatus !== false;
  const showButtons = options.buttons || '';
  const date = signalMetaDate(s);
  const region = signalRegion(s) || 'Non renseignée';
  const departement = signalDepartement(s);

  return `
    <div class="signal-card">
      <b>${rank}${signalTitle(s)}</b><br>
      ${signalCompanyLigne(s)}

      <div class="badge-row">
        ${badgeChaleur(s.chaleur)}
        ${badgeType(s.type_signal)}
        ${badgeProjetSuivi(s)}
        ${showStatus ? badgeStatut(s.statut) : ''}
      </div>

      <small><b>Région :</b> ${region}</small><br>
      ${departement ? `<small><b>Département :</b> ${departement}</small><br>` : ''}
      ${date ? `<small><b>Date :</b> ${date}</small><br>` : ''}
      Score : ${s.score_pertinence || '-'}<br>

      ${renderPrioritesSignalFlair(s, lireCopiloteCommercialJson(s))}
      ${renderBlocCopiloteCommercial(s)}
      ${renderProjetSuiviBloc(s)}
      ${s.commentaire_action && !estSignalProjetSuivi(s) ? `<small><b>Commentaire :</b> ${s.commentaire_action}</small><br>` : ''}
      ${s.feedback_commercial ? `<small><b>Feedback :</b> ${formatFeedback(s.feedback_commercial)}</small><br>` : ''}
      ${s.crm_cree ? `<small><b>CRM :</b> Opportunité créée</small><br>` : ''}

      ${showButtons ? `<div style="margin-top:8px;">${showButtons}</div>` : ''}
    </div>
    <hr>
  `;
}

function boutonsSignalActif(s) {
  return `
    <button onclick="changerStatut('${s.id}', 'a_contacter')">📞 À contacter</button>
    <button onclick="copierSignalPourCrm('${s.id}')">📋 Copier pour CRM</button>
    <button onclick="changerStatut('${s.id}', 'a_suivre')">⏳ À suivre</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

function boutonsAContacter(s) {
  const crmButton = s.crm_cree
    ? '<span class="badge badge-statut">↗ Opportunité CRM créée</span>'
    : `<button onclick="marquerOpportuniteCrm('${s.id}')">↗ Opportunité CRM créée</button>`;

  return `
    <button onclick="enregistrerFeedback('${s.id}', 'interet_confirme')">✅ Confirmé</button>
    <button onclick="enregistrerFeedback('${s.id}', 'interet_non_confirme')">❌ Non confirmé</button>
    <button onclick="copierSignalPourCrm('${s.id}')">📋 Copier pour CRM</button>
    <button onclick="exporterSignalPourCsv('${s.id}')">⬇️ Export CSV</button>
    ${crmButton}
    <button onclick="changerStatut('${s.id}', 'a_suivre')">⏳ À suivre</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

function boutonsSuivi(s) {
  return `
    <button onclick="changerStatut('${s.id}', 'a_contacter')">📞 À contacter</button>
    <button onclick="copierSignalPourCrm('${s.id}')">📋 Copier pour CRM</button>
    <button onclick="changerStatut('${s.id}', 'ignore')">❌ Ignorer</button>
  `;
}

function boutonsHistorique(s) {
  if (s.statut === 'a_suivre') return boutonsSuivi(s);
  return '';
}

// =========================
// SIGNAUX
// =========================

async function chargerSignaux() {
  if (!user) return;

  const filtreChaleur = document.getElementById('filtreChaleur')?.value || '';
  const filtreType = document.getElementById('filtreType')?.value || '';
  const filtreStatut = document.getElementById('filtreStatut')?.value || '';
  const filtreProjetSuivi = document.getElementById('filtreProjetSuivi')?.value || '';

  let signaux = [];

  const statutsDistribution = filtreStatut
    ? [filtreStatut]
    : ['nouveau', 'analyse'];

  const { data: distributions, error: distError } = await lireDistributionsCommerciales({
    statuts: statutsDistribution,
    limit: 30
  });

  if (distError) {
    console.warn('Lecture signaux_commerciaux indisponible, fallback signaux historique :', distError.message);
  }

  signaux = signaux.concat(distributions || []);
  const idsSignauxDistribues = await lireIdsSignauxDejaDistribuesPourCommercial();

  let query = appliquerFiltreCommercial(
   window.FLAIR_DATA_SERVICES.signaux()
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
  );

  if (!filtreStatut) {
    query = query.not('statut', 'in', '("top3","a_contacter","a_suivre","historique","traite","reserve_ia")');
  }

  if (filtreStatut) {
    query = query.eq('statut', filtreStatut);
  }

  const { data, error } = await query;

  if (error) {
    alert("Erreur chargement signaux : " + error.message);
    return;
  }

  signaux = signaux.concat(exclureSignauxSourcesDejaDistribues(data || [], idsSignauxDistribues));

  const container = document.getElementById('signaux');
  if (!container) return;

  container.innerHTML = "";

  const signauxFiltres = dedoublonnerSignauxPourAffichage(signaux).filter(signal => {
    if (filtreChaleur && signal.chaleur !== filtreChaleur) return false;
    if (filtreType && signal.type_signal !== filtreType) return false;
    if (filtreProjetSuivi === 'suivis') return estSignalProjetSuivi(signal);
    if (filtreProjetSuivi === 'simples') return !estSignalProjetSuivi(signal);
    return true;
  });

  if (!signauxFiltres.length) {
    container.innerHTML = "<p>Aucun signal actif pour ce filtre.</p>";
    return;
  }

  signauxFiltres.forEach(s => {
    const div = document.createElement('div');

    div.innerHTML = renderSignalCard(s, {
      showStatus: true,
      buttons: boutonsSignalActif(s)
    });

    container.appendChild(div);
  });
}

async function recupererTop3Actuel() {
  const distributions = await lireDistributionsCommerciales({
    statuts: ['top3'],
    limit: 3,
    orderTop3: true
  });

  if (distributions.error) {
    console.warn('Lecture Top 3 signaux_commerciaux indisponible :', distributions.error.message);
  }

  const idsSignauxDistribues = await lireIdsSignauxDejaDistribuesPourCommercial();

  let anciens = appliquerFiltreCommercial(
    window.FLAIR_DATA_SERVICES.signaux()
      .select('*')
      .eq('statut', 'top3')
  );

  const anciensResult = await anciens
    .order('score_pertinence', { ascending: false })
    .order('date_signal', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(3);

  if (anciensResult.error) return anciensResult;

  const anciensSansDistribution = exclureSignauxSourcesDejaDistribues(anciensResult.data || [], idsSignauxDistribues);

  return {
    data: dedoublonnerSignauxPourAffichage([...(distributions.data || []), ...anciensSansDistribution]).slice(0, 3),
    error: null
  };
}

async function recupererCandidatsTop3(nombrePlaces) {
  // Le Top 3 doit classer tous les signaux analysés du commercial,
  // qu'ils viennent du bouton IA (signaux_commerciaux) ou du bouton manuel
  // "Analyser et ajouter votre signal au radar". On ne privilégie jamais
  // la source d'entrée : seul le score personnalisé décide.
  const distributions = await lireDistributionsCommerciales({
    statuts: ['analyse'],
    limit: 50,
    orderTop3: true
  });

  let query = appliquerFiltreCommercial(
    window.FLAIR_DATA_SERVICES.signaux()
      .select('*')
      .eq('statut', 'analyse')
  );

  const result = await query
    .order('score_pertinence', { ascending: false })
    .order('date_signal', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50);

  if (distributions.error && result.error) return result;

  const idsSignauxDistribues = await lireIdsSignauxDejaDistribuesPourCommercial();
  const signauxHistoriques = result.error
    ? []
    : exclureSignauxSourcesDejaDistribues(result.data || [], idsSignauxDistribues);

  const candidats = dedoublonnerSignauxPourAffichage([
    ...(distributions.data || []),
    ...signauxHistoriques
  ]).sort((a, b) => {
    const scoreA = Number(a.score_pertinence) || 0;
    const scoreB = Number(b.score_pertinence) || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;

    const dateA = new Date(a.date_assignation || a.date_signal || a.created_at || 0).getTime();
    const dateB = new Date(b.date_assignation || b.date_signal || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  return {
    data: candidats.slice(0, nombrePlaces),
    error: null
  };
}

async function actualiserTop3() {
  if (!user) return;

  const { data: top3Actuel, error: top3Error } = await recupererTop3Actuel();

  if (top3Error) {
    alert("Erreur lecture Top 3 actuel : " + top3Error.message);
    return;
  }

  const placesDisponibles = Math.max(0, 3 - ((top3Actuel || []).length));

  if (placesDisponibles === 0) {
    await chargerTop3();
    return;
  }

  const { data: candidats, error: candidatsError } = await recupererCandidatsTop3(placesDisponibles);

  if (candidatsError) {
    alert("Erreur sélection candidats Top 3 : " + candidatsError.message);
    return;
  }

  if (candidats && candidats.length) {
    const nowIso = new Date().toISOString();
    const distributions = candidats.filter(estDistributionCommerciale);
    const signauxHistoriques = candidats.filter(signal => !estDistributionCommerciale(signal));

    if (distributions.length) {
      const { error: updateDistError } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
        .update({ statut: 'top3', updated_at: nowIso })
        .in('id', distributions.map(signal => signal.id));

      if (updateDistError) {
        alert("Erreur actualisation Top 3 : " + updateDistError.message);
        return;
      }
    }

    if (signauxHistoriques.length) {
      const { error: updateError } = await window.FLAIR_DATA_SERVICES.signaux()
        .update({
          statut: 'top3',
          date_derniere_action: nowIso
        })
        .in('id', signauxHistoriques.map(signal => signal.id));

      if (updateError) {
        alert("Erreur actualisation Top 3 : " + updateError.message);
        return;
      }
    }
  }

  await refreshCockpit();
}

async function chargerTop3() {
  if (!user) return;

  const container = document.getElementById('top3');
  if (!container) return;

  const { data, error } = await recupererTop3Actuel();

  if (error) {
    alert("Erreur chargement Top 3 : " + error.message);
    return;
  }

  container.innerHTML = "";

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Aucun signal dans le Top 3 pour le moment. Analysez des signaux actifs puis cliquez sur Actualiser le Top 3.</p>";
    return;
  }

  data.forEach((s, index) => {
    const div = document.createElement('div');

    div.innerHTML = renderSignalCard(s, {
      rank: index + 1,
      showStatus: false,
      buttons: boutonsSignalActif(s)
    });

    container.appendChild(div);
  });
}

async function chargerAContacter() {
  if (!user) return;

  const distributions = await lireDistributionsCommerciales({ statuts: ['a_contacter'], limit: 30, orderTop3: true });

   let query = appliquerFiltreCommercial(
    window.FLAIR_DATA_SERVICES.signaux()
      .select('*')
      .eq('statut', 'a_contacter')
  );

  const { data, error } = await query
    .order('score_pertinence', { ascending: false });

  if (error) {
    alert("Erreur chargement à contacter : " + error.message);
    return;
  }

  const container = document.getElementById('aContacter');
  if (!container) return;

  container.innerHTML = "";

  const idsSignauxDistribues = await lireIdsSignauxDejaDistribuesPourCommercial();
  const signauxHistoriques = exclureSignauxSourcesDejaDistribues(data || [], idsSignauxDistribues);
  const signaux = dedoublonnerSignauxPourAffichage([...(distributions.data || []), ...signauxHistoriques]);

  if (!signaux.length) {
    container.innerHTML = "<p>Aucun signal à contacter.</p>";
    return;
  }

  signaux.forEach(s => {
    const div = document.createElement('div');

    div.innerHTML = renderSignalCard(s, {
      showStatus: true,
      buttons: boutonsAContacter(s)
    });

    container.appendChild(div);
  });
}


function statutOpportuniteLabel(statut) {
  const labels = {
    top3: 'Top 3',
    analyse: 'À qualifier',
    nouveau: 'Nouveau',
    a_contacter: 'À contacter',
    a_suivre: 'À suivre',
    historique: 'Historique'
  };
  return labels[statut] || statut || '—';
}

function construireLigneTableOpportunite(s = {}, contexte = 'commercial') {
  const sourceUrl = s.lien_source || s.source_url || '';
  const sourceCell = sourceUrl
    ? `<a href="${managerEscape(sourceUrl)}" target="_blank" rel="noopener">Source</a>`
    : '—';

  return `
    <tr>
      <td><strong>${managerEscape(signalCompany(s) || 'Entreprise non renseignée')}</strong><br><small>${managerEscape(signalTitle(s))}</small></td>
      <td>${managerEscape(signalRegion(s) || '—')}<br><small>${managerEscape(signalDepartement(s) || '')}</small></td>
      <td>${managerEscape(s.fenetre_contact || s.timing_phase || '—')}</td>
      <td>${badgeChaleur(s.chaleur)}</td>
      <td>${managerEscape(statutOpportuniteLabel(s.statut))}</td>
      <td class="opportunites-coords-cell">
        <span title="Site web">🌐 ${managerEscape(signalSiteWeb(s) || '—')}</span>
        <span title="Téléphone standard">☎ ${managerEscape(signalTelephoneStandard(s) || '—')}</span>
        <span title="Email générique">✉ ${managerEscape(signalEmailGenerique(s) || '—')}</span>
      </td>
      <td>${sourceCell}</td>
    </tr>
  `;
}

function renderTableOpportunites(signaux = []) {
  if (!signaux.length) {
    return '<div class="manager-empty">Aucune opportunité disponible pour le moment.</div>';
  }

  return `
    <div class="opportunites-table-wrap-flair">
      <table class="manager-team-table opportunites-table-flair">
        <thead>
          <tr>
            <th>Entreprise / projet</th>
            <th>Zone</th>
            <th>Timing</th>
            <th>Chaleur</th>
            <th>Statut</th>
            <th>Coordonnées publiques</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>${signaux.map(construireLigneTableOpportunite).join('')}</tbody>
      </table>
    </div>
  `;
}

async function lireOpportunitesCommerciales(limit = 100) {
  const statuts = ['top3', 'analyse', 'nouveau', 'a_contacter', 'a_suivre'];
  const distributions = await lireDistributionsCommerciales({ statuts, limit, orderTop3: true });

  let query = appliquerFiltreCommercial(
    window.FLAIR_DATA_SERVICES.signaux()
      .select('*')
      .in('statut', statuts)
  );

  const { data, error } = await query
    .order('score_pertinence', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (distributions.error && error) return { data: [], error };

  const idsDistribues = await lireIdsSignauxDejaDistribuesPourCommercial();
  const historiques = error ? [] : exclureSignauxSourcesDejaDistribues(data || [], idsDistribues);
  const signaux = dedoublonnerSignauxPourAffichage([...(distributions.data || []), ...historiques])
    .sort((a, b) => (Number(b.score_pertinence) || 0) - (Number(a.score_pertinence) || 0));

  return { data: signaux, error: null };
}

async function chargerListeOpportunitesCommerciales() {
  const container = document.getElementById('cockpitOpportunitesList');
  if (!container) return;
  container.innerHTML = '<p>Chargement des opportunités…</p>';

  const { data, error } = await lireOpportunitesCommerciales(100);
  if (error) {
    container.innerHTML = '<p>Liste d’opportunités indisponible pour le moment.</p>';
    return;
  }

  container.innerHTML = renderTableOpportunites(data || []);
}


function nettoyerTexteExportFlair(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, '""')
    .trim();
}

function valeurExportSignalFlair(sig, cles = []) {
  for (const cle of cles) {
    const valeur = sig?.[cle] ?? sig?.signal?.[cle];
    if (valeur !== null && valeur !== undefined && String(valeur).trim() !== '') return valeur;
  }
  return '';
}

function formatDateExportFlair(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function exporterSignauxFlairFallback(signaux = [], nomFichier = 'Opportunites_FLAIR') {
  if (!Array.isArray(signaux) || signaux.length === 0) {
    alert("Aucune opportunité disponible pour l'export.");
    return;
  }

  const entetes = [
    'Date_Signal',
    'Entreprise_Cible',
    'Projet',
    'Site_Web_Public',
    'Telephone_Standard_Public',
    'Email_Generique_Public',
    'Score_Flair',
    'Chaleur',
    'Region',
    'Departement',
    'Timing',
    'Statut',
    'Source_Url'
  ];

  const lignes = [entetes.join(';')];

  signaux.forEach(sig => {
    const ligne = [
      formatDateExportFlair(valeurExportSignalFlair(sig, ['date_signal', 'created_at'])),
      signalCompany(sig),
      signalTitle(sig),
      signalSiteWeb(sig),
      signalTelephoneStandard(sig),
      signalEmailGenerique(sig),
      valeurExportSignalFlair(sig, ['score_distribution', 'score_pertinence', 'score_final_distribue']),
      valeurExportSignalFlair(sig, ['chaleur_distribution', 'chaleur']),
      signalRegion(sig),
      [signalDepartement(sig), valeurExportSignalFlair(sig, ['departement_code']) ? `(${valeurExportSignalFlair(sig, ['departement_code'])})` : ''].filter(Boolean).join(' '),
      valeurExportSignalFlair(sig, ['fenetre_contact', 'timing_phase']),
      statutOpportuniteLabel(sig.statut),
      valeurExportSignalFlair(sig, ['lien_source', 'source_url', 'url'])
    ];

    lignes.push(ligne.map(valeur => `"${nettoyerTexteExportFlair(valeur)}"`).join(';'));
  });

  const contenuCsv = '\uFEFF' + lignes.join('\n');
  const blob = new Blob([contenuCsv], { type: 'text/csv;charset=utf-8;' });
  const urlBlob = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  const dateExport = new Date().toISOString().slice(0, 10);
  lien.href = urlBlob;
  lien.download = `${nomFichier}_${dateExport}.csv`;
  lien.style.display = 'none';
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(urlBlob);
}

function exporterOpportunitesAvecFallback(signaux = [], nomFichier = 'Opportunites_FLAIR') {
  // FLAIR V2.4 — export direct robuste.
  // On ne dépend plus de flair-export-utils.js pour les listes d'opportunités :
  // le bouton déclenche toujours un CSV compatible Excel depuis app.js.
  exporterSignauxFlairFallback(Array.isArray(signaux) ? signaux : [], nomFichier);
}


async function exporterListeOpportunitesCommerciales() {
  const { data, error } = await lireOpportunitesCommerciales(250);
  if (error) {
    alert('Erreur export opportunités : ' + error.message);
    return;
  }

  const nomCommercial = currentProfil
    ? `${currentProfil.prenom || ''}_${currentProfil.nom || ''}`.replace(/[^a-zA-Z0-9_-]+/g, '_')
    : 'FLAIR';

  exporterOpportunitesAvecFallback(data || [], `Opportunites_${nomCommercial || 'FLAIR'}`);
}


async function renderManagerListeOpportunitesSolo(container) {
  const { data, error } = await lireOpportunitesCommerciales(250);
  if (error) {
    container.innerHTML = '<section class="manager-panel" style="grid-column:1 / -1;"><div class="manager-empty">Liste d’opportunités personnelle indisponible.</div></section>';
    return;
  }

  const signaux = dedoublonnerSignauxPourAffichage(data || [])
    .filter(s => ['top3', 'analyse', 'nouveau', 'a_contacter', 'a_suivre'].includes(String(s.statut || '')))
    .sort((a, b) => (Number(b.score_pertinence || b.score_distribution) || 0) - (Number(a.score_pertinence || a.score_distribution) || 0))
    .slice(0, 120);

  container.innerHTML = `
    <section class="manager-panel opportunites-panel-flair" style="grid-column:1 / -1;">
      <div class="manager-panel-head">
        <h4>Liste d’opportunités personnelle</h4>
        <button class="manager-mini-badge opportunites-export-mini-btn" type="button" onclick="exporterListeOpportunitesCommerciales()">Excel / CSV</button>
      </div>
      <p class="manager-panel-note">Liste de travail exportable : FLAIR reste le radar, le CRM ou Excel conserve le suivi commercial détaillé.</p>
      <button class="manager-menu-btn" type="button" onclick="exporterListeOpportunitesCommerciales()">⬇️ Exporter ma liste</button>
      ${renderTableOpportunites(signaux)}
    </section>
  `;
}

function renderManagerListeOpportunites(ctx, container) {
  const signaux = dedoublonnerSignauxPourAffichage([...(ctx.distributions || []), ...(ctx.allSignaux || [])])
    .filter(s => ['top3', 'analyse', 'nouveau', 'a_contacter', 'a_suivre'].includes(String(s.statut || '')))
    .sort((a, b) => (Number(b.score_pertinence || b.score_distribution) || 0) - (Number(a.score_pertinence || a.score_distribution) || 0))
    .slice(0, 120);

  container.innerHTML = `
    <section class="manager-panel opportunites-panel-flair" style="grid-column:1 / -1;">
      <div class="manager-panel-head">
        <h4>Liste d’opportunités équipe</h4>
        <button class="manager-mini-badge opportunites-export-mini-btn" type="button" onclick="exporterListeOpportunitesManager()">Excel / CSV</button>
      </div>
      <p class="manager-panel-note">Liste de travail exportable : FLAIR reste le radar, le CRM conserve le suivi commercial détaillé.</p>
      <button class="manager-menu-btn" type="button" onclick="exporterListeOpportunitesManager()">⬇️ Exporter la liste équipe</button>
      ${renderTableOpportunites(signaux)}
    </section>
  `;
}

async function exporterListeOpportunitesManager() {
  try {
    const ctx = await chargerContexteManagerRadar();
    if (!ctx) return;
    const signaux = dedoublonnerSignauxPourAffichage([...(ctx.distributions || []), ...(ctx.allSignaux || [])])
      .filter(s => ['top3', 'analyse', 'nouveau', 'a_contacter', 'a_suivre'].includes(String(s.statut || '')));

    exporterOpportunitesAvecFallback(signaux, 'Opportunites_Equipe_FLAIR');
  } catch (err) {
    alert('Erreur export opportunités manager : ' + (err?.message || err));
  }
}

async function chargerHistorique() {
  if (!user) return;

  const container = document.getElementById('historique');
  if (!container) return;

  const distributions = await lireDistributionsCommerciales({ statuts: ['a_suivre', 'historique'], limit: 30 });

    let query = appliquerFiltreCommercial(
    window.FLAIR_DATA_SERVICES.signaux()
      .select('*')
      .in('statut', ['a_suivre', 'historique'])
  );

  const { data, error } = await query
    .order('date_derniere_action', { ascending: false })
    .limit(20);

  if (error) {
    console.error("Erreur chargement historique :", error);
    container.innerHTML = "<p>Historique indisponible pour le moment.</p>";
    return;
  }

  container.innerHTML = "";

  const idsSignauxDistribues = await lireIdsSignauxDejaDistribuesPourCommercial();
  const signauxHistoriques = exclureSignauxSourcesDejaDistribues(data || [], idsSignauxDistribues);
  const signaux = dedoublonnerSignauxPourAffichage([...(distributions.data || []), ...signauxHistoriques]);

  if (!signaux.length) {
    container.innerHTML = "<p>Aucun signal historisé pour le moment.</p>";
    return;
  }

  signaux.forEach(s => {
    const div = document.createElement('div');

    div.innerHTML = renderSignalCard(s, {
      showStatus: true,
      buttons: boutonsHistorique(s)
    });

    container.appendChild(div);
  });
}



function normaliserDateSignalImport(value) {
  const brut = String(value || '').trim();
  if (!brut) return '';

  const iso = brut.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return brut;

  const fr = brut.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (fr) {
    const jour = fr[1].padStart(2, '0');
    const mois = fr[2].padStart(2, '0');
    return `${fr[3]}-${mois}-${jour}`;
  }

  return '';
}


function extraireScoreImport(texte) {
  const match = String(texte || '').match(/score\s*:\s*(\d{1,3})(?:\s*\/\s*100)?/i);
  if (!match) return null;
  const score = Math.max(0, Math.min(100, Number(match[1]) || 0));
  return score;
}

function chaleurDepuisScoreFlair(score) {
  const valeur = Number(score) || 0;
  if (valeur >= 80) return 'chaud';
  if (valeur >= 60) return 'tiede';
  return 'froid';
}


function normaliserTexteGuardrailFlair(value) {
  const fn = typeof normaliserTexteSimple === 'function'
    ? normaliserTexteSimple
    : (v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
  return fn(value || '');
}

function detecterGuardrailSemantiqueImportFlair(texteBrut = '') {
  const texte = normaliserTexteGuardrailFlair(texteBrut);
  const phrases = texte
    .split(/(?<=[\.\!\?;。])\s+|\n+/)
    .map(item => item.trim())
    .filter(Boolean);

  const contient = (phrase, mots) => mots.some(mot => phrase.includes(normaliserTexteGuardrailFlair(mot)));
  const negation = (phrase) => contient(phrase, [
    'aucun', 'aucune', 'pas de', 'pas d ', 'pas d\'', 'sans', 'n est pas', 'n est encore',
    'pas encore', 'non annonce', 'non annoncé', 'non lance', 'non lancé',
    'reste a definir', 'reste à définir', 'seront definis ulterieurement', 'seront définis ultérieurement',
    'a definir ulterieurement', 'à définir ultérieurement'
  ]);

  const appelOffresNie = phrases.some(phrase => negation(phrase) && contient(phrase, [
    'appel d offres', 'appel d offre', 'appel offres', 'dce', 'marche public', 'marché public'
  ]));

  const consultationNiee = phrases.some(phrase => negation(phrase) && contient(phrase, [
    'consultation', 'consultations', 'fournisseur', 'fournisseurs', 'demande de prix', 'demande de devis'
  ]));

  const chantierNie = phrases.some(phrase => negation(phrase) && contient(phrase, [
    'chantier', 'travaux', 'installation', 'mise en service', 'demarrage', 'démarrage'
  ]));

  const phaseAmontForte = phrases.some(phrase => contient(phrase, [
    'phase amont', 'encore en phase amont', 'projet encore amont',
    'necessite encore un suivi', 'nécessite encore un suivi',
    'suivi avant une action commerciale forte', 'futurs equipements', 'futurs équipements',
    'equipements devront etre definis ulterieurement', 'équipements devront être définis ultérieurement'
  ]));

  return {
    appel_offres_nie: appelOffresNie,
    consultation_niee: consultationNiee,
    chantier_nie: chantierNie,
    phase_amont_forte: phaseAmontForte,
    consultation_et_appel_offres_nies: appelOffresNie && consultationNiee,
    interdit_urgence: phaseAmontForte || chantierNie || (appelOffresNie && consultationNiee)
  };
}

function corrigerInferenceSemantiqueFlair(signal = {}, texteBrut = '') {
  const gardeFou = detecterGuardrailSemantiqueImportFlair(texteBrut || signal.texte_original || signal.resume_brut || signal.description || signal.contenu || '');
  if (!gardeFou.interdit_urgence) return signal;

  const scoreActuel = Number(signal.score_pertinence);
  const scoreCorrige = Number.isFinite(scoreActuel) ? Math.min(scoreActuel, 86) : scoreActuel;
  const raisonPrudence = 'Le texte mentionne une phase amont ou l’absence de consultation/appel d’offres : ne pas classer en urgence commerciale.';

  const nettoyerTexteUrgence = (value = '') => String(value || '')
    .replace(/0-3 mois\s*[—-]\s*agir vite/gi, '12-24 mois — veille active')
    .replace(/agir vite/gi, 'suivre le projet')
    .replace(/proposer un échange court sous 48 h/gi, 'rechercher un prochain jalon de maturité');

  return {
    ...signal,
    score_pertinence: scoreCorrige,
    chaleur: Number.isFinite(scoreCorrige) ? chaleurDepuisScoreFlair(scoreCorrige) : signal.chaleur,
    raison_score: ajouterPhraseMetier
      ? ajouterPhraseMetier(nettoyerTexteUrgence(signal.raison_score), raisonPrudence)
      : `${nettoyerTexteUrgence(signal.raison_score)} ${raisonPrudence}`.trim(),
    action_recommandee: 'Mettre le projet sous surveillance et rechercher un prochain jalon : consultation, travaux, choix techniques ou mise en service.',
    timing_commercial: '12-24 mois — veille active',
    timing_categorie: 'veille_active_12_24_mois',
    guardrail_semantique_applique: true
  };
}

function normaliserTypeSignalImport(typeLibre) {
  const type = normaliserTexteSimple(typeLibre);

  if (!type) return 'autre';
  if (type.includes('appel') || type.includes('consultation') || type.includes('devis')) return 'appel_offre';
  if (type.includes('rappel') || type.includes('contamination') || type.includes('qualite')) return 'qualite_rappel_conso';
  if (type.includes('ligne')) return 'nouvelle_ligne';
  if (type.includes('usine') || type.includes('investissement') || type.includes('extension') || type.includes('agrandissement') || type.includes('modernisation')) return 'investissement';
  if (type.includes('recrutement')) return 'recrutement';

  return 'autre';
}


// =========================
// ANTI-DOUBLON V1 — PROJET DÉJÀ DÉTECTÉ
// =========================
// Philosophie : FLAIR ne supprime jamais un signal.
// Il signale simplement qu'un projet similaire existe déjà dans le radar.

function normaliserTexteAntiDoublon(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function famillesProjetsFlair() {
  const familles =
    window.FLAIR_SOURCE_VEILLE?.familles_projets ||
    window.FLAIR_FAMILLES_PROJETS ||
    {};

  if (Object.keys(familles).length) return familles;

  // Filet de sécurité si source-veille-rules.js n'est pas encore chargé.
  return {
    extension: {
      label: 'Extension / capacité industrielle',
      keywords: ['extension', 'agrandissement', 'nouvelle usine', 'nouvelle ligne', 'augmentation capacite', 'capacite de production', 'augmentation de production', 'hausse de production', 'montee en cadence']
    },
    qualite: {
      label: 'Qualité / contamination / rappel',
      keywords: ['rappel produit', 'contamination', 'contaminant', 'corps etranger', 'particules metalliques', 'particules de metal', 'retrait de vente', 'retire de la vente']
    },
    logistique: {
      label: 'Logistique / entrepôt / distribution',
      keywords: ['entrepot', 'entrepôt', 'plateforme logistique', 'centre logistique', 'centre de distribution', 'stockage', 'preparation de commandes', 'flux logistique', 'logistique', 'distribution']
    },
    rh_recrutement: {
      label: 'RH / recrutement industriel',
      keywords: ['recrute', 'recrutement', 'embauche', 'creation d emplois', 'conducteur de ligne', 'technicien maintenance', 'responsable maintenance', 'equipe de nuit']
    },
    packaging: {
      label: 'Packaging / emballage',
      keywords: ['nouveau film', 'nouvel emballage', 'changement materiau', 'carton emballage', 'film barriere', 'eco conception', 'barquette', 'sachet', 'operculage']
    },
    process: {
      label: 'Process / flux / fin de ligne',
      keywords: ['convoyage', 'accumulation', 'palettisation', 'flux de transfert', 'dispatching', 'sequencage', 'fin de ligne', 'flux logistique', 'automatisation interne', 'transit produit']
    }
  };
}

function detecterFamilleProjetDepuisTexte(texte) {
  const contenu = normaliserTexteAntiDoublon(texte);
  if (!contenu) return null;

  // FLAIR V2.3 — utiliser le moteur officiel des familles quand il est chargé.
  // Cela garantit les priorités métier : LOGISTIQUE > PROCESS > EXTENSION > QUALITE
  // et évite que le bloc "Projet suivi" refasse un scoring simpliste historique.
  const moteurFamille = window.FLAIR_SOURCE_VEILLE?.detecterFamilleStrategiqueProjet || window.FLAIR_DETECTER_FAMILLE_STRATEGIQUE_PROJET;
  if (typeof moteurFamille === 'function') {
    const famille = moteurFamille({ titre: texte, description: texte, resume_brut: texte, texte_original: texte });
    if (famille?.id) return famille;
  }

  const familles = famillesProjetsFlair();
  let meilleureFamille = null;
  let meilleurScore = 0;
  const priorite = ['logistique', 'process', 'extension', 'qualite', 'rh_recrutement', 'packaging'];

  Object.entries(familles).forEach(([id, config]) => {
    const keywords = Array.isArray(config) ? config : (config.keywords || []);
    let score = 0;

    keywords.forEach(keyword => {
      const cle = normaliserTexteAntiDoublon(keyword);
      if (cle && contenu.includes(cle)) score += Math.max(1, cle.split(' ').length);
    });

    const rangActuel = priorite.indexOf(meilleureFamille?.id || '');
    const rangCandidat = priorite.indexOf(id);
    const meilleurRang = rangActuel === -1 ? 999 : rangActuel;
    const candidatRang = rangCandidat === -1 ? 999 : rangCandidat;

    if (
      score > meilleurScore ||
      (score > 0 && score === meilleurScore && candidatRang < meilleurRang)
    ) {
      meilleurScore = score;
      meilleureFamille = {
        id,
        label: config.label || managerLabel(id.replaceAll('_', ' '), id),
        score
      };
    }
  });

  return meilleureFamille;
}

function texteProjetPourAntiDoublon(signal = {}) {
  return [
    signal.titre,
    signal.entreprise_nom,
    signal.region_nom,
    signal.region,
    signal.type_signal,
    signal.raison_score,
    signal.angle_commercial,
    signal.action_recommandee,
    signal.resume_brut,
    signal.description,
    signal.texte_original
  ].filter(Boolean).join(' ');
}

function texteBrutProjetPourFamille(signal = {}) {
  // FLAIR V2.2 — la famille projet doit être déduite du signal brut,
  // pas des textes déjà générés par FLAIR. Sinon les anciens blocs
  // "Qualité / contamination / rappel" contaminent Projet suivi.
  return [
    signal.titre,
    signal.entreprise_nom,
    signal.resume_brut,
    signal.description,
    signal.texte_original,
    signal.contenu,
    signal.source_nom
  ].filter(Boolean).join(' ');
}

function normaliserNomEntrepriseProjet(nom) {
  // FLAIR 5.1 / 5.4 — normalisation prudente du nom d'entreprise.
  // Objectif : rapprocher "MONIN SAS", "Groupe MONIN" ou "MONIN France"
  // sans effacer les informations de site qui pourront devenir utiles en 5.4.
  return normaliserTexteAntiDoublon(nom)
    .replace(/\b(sas|sa|sarl|eurl|groupe|group|ets|etablissements|industrie|industries|france)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugProjetFlair(value) {
  return normaliserTexteAntiDoublon(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function construireProjetKeyFlair(entreprise, familleId) {
  const entrepriseKey = slugProjetFlair(normaliserNomEntrepriseProjet(entreprise));
  const familleKey = slugProjetFlair(familleId || 'projet');
  if (!entrepriseKey || !familleKey) return '';
  return `${entrepriseKey}_${familleKey}`;
}

function memeEntrepriseAntiDoublon(a, b) {
  const na = normaliserNomEntrepriseProjet(a);
  const nb = normaliserNomEntrepriseProjet(b);

  if (!na || !nb) return false;
  if (na === 'entreprise non renseignee' || nb === 'entreprise non renseignee') return false;

  // Exact prioritaire. Le includes reste volontairement prudent avec une longueur mini
  // pour éviter qu'un nom très court rapproche deux entreprises sans lien.
  if (na === nb) return true;
  if (na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))) return true;

  return false;
}

function dateSignalComparable(signal = {}) {
  return signal.date_signal || signal.created_at || null;
}

function trierSignauxProjetChronologie(signaux = []) {
  return [...signaux].sort((a, b) => {
    const da = new Date(dateSignalComparable(a) || 0).getTime();
    const db = new Date(dateSignalComparable(b) || 0).getTime();
    return da - db;
  });
}

function formatDateProjetFlair(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR');
}

function joursDepuisDateSignal(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

async function rechercherProjetDejaDetecte(signalImporte, contexteSignal) {
  const entreprise = signalImporte.entreprise_nom || '';
  if (!entreprise || normaliserTexteAntiDoublon(entreprise) === 'entreprise non renseignee') {
    return null;
  }

  const famille = detecterFamilleProjetDepuisTexte(texteBrutProjetPourFamille(signalImporte));
  if (!famille?.id) return null;

  const projetKey = construireProjetKeyFlair(entreprise, famille.id);

  const depuis = new Date();
  depuis.setDate(depuis.getDate() - 180);

  const { data, error } = await window.FLAIR_DATA_SERVICES.signaux()
    .select('id, titre, entreprise_nom, created_at, date_signal, type_signal, raison_score, angle_commercial, action_recommandee, resume_brut, region_nom')
    .eq('commercial_id', contexteSignal.commercial_id)
    .gte('created_at', depuis.toISOString())
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) {
    console.warn('Projet déjà détecté indisponible :', error.message);
    return null;
  }

  const signauxProjet = (data || []).filter(signalExistant => {
    const texteExistant = texteBrutProjetPourFamille(signalExistant);
    const memeEntreprise =
      memeEntrepriseAntiDoublon(signalExistant.entreprise_nom, entreprise) ||
      normaliserTexteAntiDoublon(texteExistant).includes(normaliserNomEntrepriseProjet(entreprise));

    if (!memeEntreprise) return false;

    const familleExistante = detecterFamilleProjetDepuisTexte(texteExistant);
    return familleExistante?.id === famille.id;
  });

  if (!signauxProjet.length) {
    return {
      famille,
      projetKey,
      projetLabel: `${entreprise} — ${famille.label}`,
      signal: null,
      signauxProjet: [],
      nbSignauxExistants: 0
    };
  }

  const chronologie = trierSignauxProjetChronologie(signauxProjet);
  const premierSignal = chronologie[0];
  const dernierSignal = chronologie[chronologie.length - 1];
  const dateReference = dateSignalComparable(dernierSignal);
  const ageJours = joursDepuisDateSignal(dateReference);

  return {
    famille,
    projetKey,
    projetLabel: `${entreprise} — ${famille.label}`,
    signal: dernierSignal,
    premierSignal,
    signauxProjet: chronologie,
    nbSignauxExistants: chronologie.length,
    ageJours
  };
}

function resumeChronologieProjetFlair(signaux = []) {
  return signaux
    .slice(-3)
    .map(signal => {
      const date = formatDateProjetFlair(dateSignalComparable(signal)) || 'date non précisée';
      const titre = signal.titre || 'signal précédent';
      return `${date} : ${titre}`;
    })
    .join(' · ');
}

function messageProjetDejaDetecte(doublon) {
  if (!doublon?.signal) return '';

  const titre = doublon.signal.titre || 'signal précédent';
  const familleLabel = doublon.famille?.label || 'Projet industriel similaire';
  const datePremier = formatDateProjetFlair(dateSignalComparable(doublon.premierSignal)) || 'date non précisée';
  const nbExistants = doublon.nbSignauxExistants || 1;
  const chronologie = resumeChronologieProjetFlair(doublon.signauxProjet || []);

  return [
    `⚠ Projet déjà détecté : ${familleLabel}.`,
    `Projet similaire identifié depuis le ${datePremier}.`,
    `Signal similaire déjà présent : ${titre}.`,
    nbExistants > 1 ? `Historique déjà repéré : ${nbExistants} signaux liés.` : '',
    chronologie ? `Repères : ${chronologie}.` : '',
    `Ne pas supprimer : ce nouveau signal pourra enrichir le suivi du projet.`
  ].filter(Boolean).join(' ');
}


function premiereLignePertinente(texte) {
  return String(texte || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .find(l => l && !l.includes(':')) || '';
}


function nettoyerNomEntrepriseExtraitFlair(nomBrut) {
  let nom = String(nomBrut || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:：,;\-–—]+|[\s:：,;\-–—]+$/g, '')
    .trim();

  if (!nom) return '';

  const stopPatterns = [
    /\s+(?:annonce|poursuit|confirme|investit|lance|pr[eé]voit|construit|agrandit|modernise|recrute|cr[eé]e|ouvre|inaugure|d[eé]ploie|installe|renforce|rappelle|retire)\b.*$/i,
    /\s+(?:va|souhaite|compte|projette)\s+.*$/i,
    /\s+(?:avec|afin|pour|dans|dans le cadre|sur son site|sur le site)\b.*$/i,
    /\s*[:：;,\.\(\)\[\]{}].*$/i,
    /\s+[–—-]\s+.*$/i
  ];

  for (const pattern of stopPatterns) {
    nom = nom.replace(pattern, '').trim();
  }

  nom = nom
    .replace(/^(?:le|la|les|l['’])\s+/i, '')
    .replace(/^(?:groupe|soci[eé]t[eé]|entreprise)\s+/i, '')
    .trim();

  // FLAIR V2.2 — dédoublonnage des noms extraits depuis des blocs copiés
  // avec titre + contenu ("Amazon Amazon", "Cooperl Cooperl", etc.).
  const motsNom = nom.split(/\s+/).filter(Boolean);
  if (motsNom.length >= 2 && motsNom.length % 2 === 0) {
    const moitie = motsNom.length / 2;
    const gauche = motsNom.slice(0, moitie).join(' ');
    const droite = motsNom.slice(moitie).join(' ');
    const normaliser = (v) => normaliserTexteSimple ? normaliserTexteSimple(v) : String(v || '').toLowerCase().trim();
    if (normaliser(gauche) && normaliser(gauche) === normaliser(droite)) {
      nom = gauche;
    }
  }

  const motsExclus = new Set([
    'rappel', 'extension', 'nouveau', 'nouvelle', 'projet', 'investissement',
    'signal', 'information', 'communique', 'article', 'alerte', 'construction',
    'modernisation', 'recrutement', 'contamination', 'presence', 'présence'
  ]);

  const cle = normaliserTexteSimple ? normaliserTexteSimple(nom) : nom.toLowerCase();
  if (!nom || nom.length < 3 || motsExclus.has(cle)) return '';

  return nettoyerValeurImport ? nettoyerValeurImport(nom) : nom;
}

function extraireEntrepriseDepuisTexteLibre(texteBrut) {
  const texte = String(texteBrut || '').replace(/\s+/g, ' ').trim();
  if (!texte) return '';

  // FLAIR V2.1 — Extraction sémantique générique par marqueurs linguistiques.
  // On extrait l'entreprise par grammaire de phrase, pas par dictionnaire sectoriel.
  const marqueurs = [
    String.raw`rappel\s+produit\s+chez`,
    String.raw`contamination\s+chez`,
    String.raw`incident\s+chez`,
    String.raw`investissement\s+(?:de|chez|pour)`,
    String.raw`extension\s+(?:de|chez|pour)`,
    String.raw`modernisation\s+(?:de|chez|pour)`,
    String.raw`(?:chez|par|pour)`,
    String.raw`(?:le\s+groupe|du\s+groupe|au\s+groupe)`,
    String.raw`(?:la\s+soci[eé]t[eé]|de\s+la\s+soci[eé]t[eé]|à\s+la\s+soci[eé]t[eé])`,
    String.raw`(?:l['’]entreprise|de\s+l['’]entreprise|à\s+l['’]entreprise)`,
    String.raw`(?:l['’]usine\s+de|l['’]usine)`
  ];

  for (const marqueur of marqueurs) {
    const regex = new RegExp(String.raw`\b${marqueur}\s+([^:：;,\.\(\)\[\]{}]{2,120})`, 'i');
    const match = texte.match(regex);
    const nom = nettoyerNomEntrepriseExtraitFlair(match?.[1]);
    if (nom) return nom;
  }

  // Formes fréquentes en titre : "XXX annonce/investit/agrandit...".
  const debutAction = texte.match(/^\s*([^:：;,\.\(\)\[\]{}]{2,120}?)\s+(?:annonce|poursuit|confirme|investit|lance|pr[eé]voit|construit|agrandit|modernise|recrute|cr[eé]e|ouvre|inaugure|d[eé]ploie|installe|renforce)\b/i);
  const nomAction = nettoyerNomEntrepriseExtraitFlair(debutAction?.[1]);
  if (nomAction) return nomAction;

  // Fallback intelligent : 1 à 4 premiers mots capitalisés au début du titre.
  const fallback = texte.match(/^\s*([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’\.\-]+(?:\s+(?:de|du|des|d['’]|la|le|les|l['’]|et|&|[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’\.\-]+)){0,4})\b/);
  const nomFallback = nettoyerNomEntrepriseExtraitFlair(fallback?.[1]);
  if (nomFallback) return nomFallback;

  return '';
}

function nettoyerMetaImportValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function lireMetaImportSignal() {
  const origineEl = document.getElementById('importOrigineSignal');
  const origine = origineEl?.value === 'terrain' ? 'terrain' : 'web_ia';

  return {
    origine,
    origine_label: origine === 'terrain' ? 'Terrain' : 'Web / IA',
    contact: nettoyerMetaImportValue(document.getElementById('importContactSignal')?.value),
    fonction_contact: nettoyerMetaImportValue(document.getElementById('importFonctionContactSignal')?.value),
    localisation: nettoyerMetaImportValue(document.getElementById('importLocalisationSignal')?.value)
  };
}

function synchroniserImportSignalMeta() {
  const meta = lireMetaImportSignal();
  document.querySelectorAll('[data-import-terrain]').forEach(el => {
    el.classList.toggle('is-hidden', meta.origine !== 'terrain');
  });
}

function construireTexteAnalyseImport(texteBrut = '', meta = {}) {
  const contexte = [];

  if (meta.origine) {
    contexte.push(`Origine du signal : ${meta.origine === 'terrain' ? 'Terrain' : 'Web / IA'}.`);
  }

  if (meta.origine === 'terrain') {
    contexte.push('Source terrain directe : information recueillie lors d’un échange commercial, visite client, salon, fournisseur ou partenaire.');
    if (meta.contact) contexte.push(`Contact rencontré : ${meta.contact}.`);
    if (meta.fonction_contact) contexte.push(`Fonction du contact : ${meta.fonction_contact}.`);
  }

  if (meta.localisation) {
    contexte.push(`Localisation connue : ${meta.localisation}.`);
  }

  return [...contexte, String(texteBrut || '').trim()].filter(Boolean).join('\n');
}

function enrichirSignalAvecMetaImport(signal = {}, meta = {}, texteOriginal = '') {
  const origine = meta.origine === 'terrain' ? 'terrain' : 'web_ia';
  const prefixeTerrain = 'Source terrain directe : information recueillie lors d’un échange terrain. La confiance de source est élevée, mais la maturité projet reste évaluée séparément.';

  const enrichi = {
    ...signal,
    origine_signal: origine,
    source_import_label: meta.origine_label || (origine === 'terrain' ? 'Terrain' : 'Web / IA'),
    source_confiance: origine === 'terrain' ? 'elevee_terrain_direct' : 'standard_web_ia',
    contact_terrain: origine === 'terrain' ? (meta.contact || '') : '',
    fonction_contact_terrain: origine === 'terrain' ? (meta.fonction_contact || '') : '',
    localisation_connue: meta.localisation || '',
    texte_original_utilisateur: texteOriginal || signal.texte_original || ''
  };

  if (origine === 'terrain') {
    enrichi.raison_score = [prefixeTerrain, signal.raison_score]
      .filter(Boolean)
      .join(' ');

    if (enrichi.contact_terrain) {
      const actionTerrain = construireActionContactTerrainFlair(enrichi.contact_terrain, enrichi.fonction_contact_terrain);
      if (actionTerrain) enrichi.action_recommandee = actionTerrain;
    }

    if (enrichi.copilote_commercial) {
      enrichi.copilote_commercial = enrichirCopiloteAvecContactTerrain(enrichi.copilote_commercial, enrichi, origine);
    }
  }

  return enrichi;
}

function extraireSignalDepuisArticle(texteBrut) {
  const texte = String(texteBrut || '').trim();
  let extractionFlair = window.FLAIR_EXTRACTION?.analyserTexteImporte
    ? window.FLAIR_EXTRACTION.analyserTexteImporte(texte)
    : null;

  const entreprise =
    extraireChampStructure(texte, ['Entreprise', 'Société', 'Societe']) ||
    extractionFlair?.entreprise_nom ||
    extraireEntrepriseDepuisTexteLibre(texte);

  const regionImportee = extraireRegionImportDepuisTexte(texte);
  // Géographie prudente : on ne transforme jamais tout le texte libre en région.
  // Si aucune région/département explicite n'est détecté, le signal reste géographiquement neutre.
  const geographieStandard = normaliserGeographieImport(regionImportee);
  const geographieExtraction = extractionFlair?.geographie || null;
  const geographie = geographieExtraction?.valide ? geographieExtraction : geographieStandard;
  const region = geographie.valide ? (geographie.region_nom || regionImportee) : 'Non déterminée';
  const typeLibre = extraireChampStructure(texte, ['Type', 'Nature du signal']) || extractionFlair?.type_signal || '';
  const pourquoi = extraireChampStructure(texte, [
    'Pourquoi c’est important',
    "Pourquoi c'est important",
    'Pourquoi',
    'Contexte'
  ]);
  const opportunite = extraireChampStructure(texte, [
    'Opportunité commerciale possible',
    'Opportunite commerciale possible',
    'Opportunité commerciale',
    'Opportunite commerciale',
    'Opportunité',
    'Opportunite'
  ]);
  const actionRapide = extraireChampStructure(texte, [
    'Action rapide conseillée',
    'Action rapide conseillee',
    'Action conseillée',
    'Action conseillee',
    'Action'
  ]);
  const quiContacter = extraireChampStructure(texte, ['Qui contacter', 'Contact cible', 'Contacts cibles']);
  const dateSignal = normaliserDateSignalImport(extraireChampStructure(texte, ['Date']));
  const scoreExplicite = extraireScoreImport(texte);

  const titre = nettoyerValeurImport(
    extraireChampStructure(texte, ['Titre', 'Signal']) ||
    extractionFlair?.titre ||
    premiereLignePertinente(texte) ||
    (entreprise ? `${entreprise} — signal importé` : 'Signal importé')
  );

  const texteScoring = [titre, entreprise, region, typeLibre, pourquoi, opportunite, actionRapide, quiContacter, texte]
    .filter(Boolean)
    .join(' ');

  let signalScoring = {
    titre,
    entreprise_nom: entreprise,
    region,
    region_nom: region,
    departement_nom: geographie.departement_nom,
    departement_code: geographie.departement_code,
    type_signal: typeLibre,
    description: texte,
    contenu: texte,
    resume: pourquoi,
    type_source: 'manuel'
  };

  if (window.FLAIR_EXTRACTION?.enrichirSignalScoring) {
    signalScoring = window.FLAIR_EXTRACTION.enrichirSignalScoring(signalScoring, extractionFlair);
  }

  if (window.FLAIR_SIGNAL_VALIDATOR?.validerSignal) {
    signalScoring = window.FLAIR_SIGNAL_VALIDATOR.validerSignal(signalScoring, texte, { mode: 'manuel_scoring' }).signal || signalScoring;
  }

  // Doctrine V2026.2 : la fraîcheur et les preuves minimales sont contrôlées
  // avant tout calcul de score. Un signal non conforme ne poursuit pas le pipeline.
  const controleDoctrineAvantScore = controlerDoctrineAvantScoring(signalScoring, texte);
  signalScoring = {
    ...signalScoring,
    doctrine_version: controleDoctrineAvantScore.doctrine_version,
    fraicheur_statut: controleDoctrineAvantScore.fraicheur.statut,
    fraicheur_date_verification: controleDoctrineAvantScore.fraicheur.date_verification,
    fraicheur_raison: controleDoctrineAvantScore.fraicheur.raison
  };

  const resultatInitial = scoringLocal(texteScoring, entreprise);
  let resultatEnrichi = enrichirScoringAvecSourceVeille(signalScoring, resultatInitial);
  const secteur = appliquerEthiqueClassificationFlair(signalScoring, detecterSecteurSousSecteur(signalScoring));
  let timing = calculerTimingCommercial(signalScoring, resultatEnrichi);
  // Pipeline unique FLAIR V2026.1 : l'extraction manuelle ne décide plus du timing.
  // Elle construit seulement un objet signal normalisé ; le timing est calculé par
  // le même moteur métier que les signaux issus de la collecte IA.
  const enrichissementMetier = window.FLAIR_SOURCE_VEILLE?.analyserSignalAvecRegles
    ? window.FLAIR_SOURCE_VEILLE.analyserSignalAvecRegles(signalScoring)
    : null;

  if (scoreExplicite === null && typeof calculerScoresSeparationFlair === 'function') {
    const scoreIndustriel = Math.max(0, Math.min(95, Math.round((Number(resultatEnrichi.score_pertinence) || 0) + (Number(timing.impact_score) || 0))));
    const separation = calculerScoresSeparationFlair({
      score_industriel: scoreIndustriel,
      signal: signalScoring,
      enrichissement: enrichissementMetier,
      timing,
      commercial: currentProfil || {},
      profil_commercial: profilCommercialActuel()
    });

    resultatEnrichi = normaliserResultatScoring({
      ...resultatEnrichi,
      score_intrinseque: scoreIndustriel,
      score_industriel: separation.score_industriel,
      score_metier: separation.score_metier,
      score_geographique: separation.score_geographique,
      score_timing: separation.score_timing,
      score_final_distribue: separation.score_final_distribue,
      scores_flair: {
        score_industriel: separation.score_industriel,
        score_metier: separation.score_metier,
        score_geographique: separation.score_geographique,
        score_timing: separation.score_timing,
        score_final_distribue: separation.score_final_distribue
      },
      score_pertinence: separation.score,
      chaleur: chaleurDepuisScoreMetier(separation.score)
    });
  }

  const scoreFinal = scoreExplicite !== null
    ? Math.max(0, Math.min(100, scoreExplicite))
    : resultatEnrichi.score_pertinence;

  const actionComplete = actionRapide || (quiContacter ? `Contacter : ${quiContacter}.` : resultatEnrichi.action_recommandee);
  const copilote = preparerCopiloteCommercial(signalScoring, resultatEnrichi, timing);

  const signalFinalImporte = {
    titre: signalScoring.titre || titre,
    entreprise_nom: signalScoring.entreprise_nom || entreprise,
    region: signalScoring.region || region,
    region_nom: signalScoring.region_nom || region,
    departement_nom: signalScoring.departement_nom || geographie.departement_nom,
    departement_code: signalScoring.departement_code || geographie.departement_code,
    date_signal: dateSignal,
    score_pertinence: scoreFinal,
    chaleur: scoreExplicite !== null
      ? chaleurDepuisScoreFlair(scoreFinal)
      : (resultatEnrichi.chaleur || chaleurDepuisScoreFlair(scoreFinal)),
    type_signal: normaliserTypeSignalImport(typeLibre) !== 'autre'
      ? normaliserTypeSignalImport(typeLibre)
      : resultatEnrichi.type_signal,
    raison_score: pourquoi || resultatEnrichi.raison_score,
    angle_commercial: opportunite || resultatEnrichi.angle_commercial,
    action_recommandee: actionComplete,
    copilote_commercial: copilote.copilote_commercial,
    texte_original: texte
  };

  let signalCorrige = corrigerInferenceSemantiqueFlair(signalFinalImporte, texte);

  if (window.FLAIR_SIGNAL_VALIDATOR?.validerSignal) {
    signalCorrige = window.FLAIR_SIGNAL_VALIDATOR.validerSignal(signalCorrige, texte, { mode: 'manuel_final' }).signal || signalCorrige;
  }

  return signalCorrige;
}

async function insererSignalAvecFallback(payload, options = {}) {
  const variantes = [];
  const ajouterVariante = (variante) => {
    const nettoyee = { ...variante };
    Object.keys(nettoyee).forEach(key => {
      if (nettoyee[key] === undefined) delete nettoyee[key];
    });

    const signature = JSON.stringify(Object.keys(nettoyee).sort());
    if (!variantes.some(v => JSON.stringify(Object.keys(v).sort()) === signature)) {
      variantes.push(nettoyee);
    }
  };

  const supprimerChamps = (source, champs) => {
    const variante = { ...source };
    champs.forEach(champ => delete variante[champ]);
    return variante;
  };

  // FLAIR V1.4.1 — compatibilité Supabase table signaux :
  // la colonne copilote_commercial n'existe pas dans la table signaux actuelle.
  // Le copilote reste calculé côté application / distribution, mais n'est plus envoyé
  // dans l'insert signaux pour éviter l'erreur schema cache.
  payload = supprimerChamps(payload, ['copilote_commercial']);

  ajouterVariante(payload);

  // Compatibilité progressive avec les bases Supabase qui n'ont pas encore
  // toutes les colonnes préparatoires. Important : on teste séparément region_nom,
  // region et region_signal pour conserver la région dès qu'une de ces colonnes existe.
  const champsOptionnels = [
    'texte_original',
    'description',
    'region_nom',
    'region',
    'region_signal',
    'departement_nom',
    'departement_code',
    'date_signal',
    'commentaire_action',
    'famille_projet',
    'famille_projet_label',
    'projet_key',
    'projet_label',
    'projet_detecte',
    'origine_signal',
    'source_confiance',
    'contact_terrain',
    'fonction_contact_terrain',
    'localisation_connue',
    'doctrine_version',
    'doctrine_conformite',
    'doctrine_certification_statut',
    'doctrine_date_certification',
    'doctrine_non_conformites',
    'fraicheur_statut',
    'fraicheur_date_verification',
    'fraicheur_raison'
  ];

  champsOptionnels.forEach(champ => {
    if (Object.prototype.hasOwnProperty.call(payload, champ)) {
      ajouterVariante(supprimerChamps(payload, [champ]));
    }
  });

  const champsMetaSourceOptionnels = ['source_confiance', 'contact_terrain', 'fonction_contact_terrain', 'localisation_connue'];
  ajouterVariante(supprimerChamps(payload, champsMetaSourceOptionnels));
  ajouterVariante(supprimerChamps(payload, [...champsMetaSourceOptionnels, 'origine_signal']));

  const champsProjetOptionnels = ['famille_projet', 'famille_projet_label', 'projet_key', 'projet_label', 'projet_detecte', 'entreprise_site_web', 'entreprise_telephone_standard', 'entreprise_email_generique'];
  ajouterVariante(supprimerChamps(payload, champsProjetOptionnels));
  ajouterVariante(supprimerChamps(payload, [...champsProjetOptionnels, 'commentaire_action']));

  if (payload.region_nom || payload.region || payload.region_signal) {
    ajouterVariante(supprimerChamps(payload, ['region_nom']));
    ajouterVariante(supprimerChamps(payload, ['region']));
    ajouterVariante(supprimerChamps(payload, ['region_signal']));
    ajouterVariante(supprimerChamps(payload, ['region', 'region_signal']));
    ajouterVariante(supprimerChamps(payload, ['region_nom', 'region_signal']));
    ajouterVariante(supprimerChamps(payload, ['region_nom', 'region']));
  }

  if (payload.departement_nom || payload.departement_code) {
    ajouterVariante(supprimerChamps(payload, ['departement_nom']));
    ajouterVariante(supprimerChamps(payload, ['departement_code']));
    ajouterVariante(supprimerChamps(payload, ['departement_nom', 'departement_code']));
  }

  if (payload.description && payload.texte_original) {
    ajouterVariante(supprimerChamps(payload, ['texte_original']));
    ajouterVariante(supprimerChamps(payload, ['description']));
  }

  // Combinaisons utiles les plus probables :
  // - region_nom absente mais region/region_signal existe
  // - region ou region_signal absentes mais region_nom existe
  // - texte_original absent mais description existe
  // - description absente mais texte_original existe
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_signal', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region_signal', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'description']));
  // V4.1 GEO FIX — schéma actuel Supabase :
  // la table signaux possède region_nom / departement_nom / departement_code / resume_brut,
  // mais pas forcément region, region_signal, description ou texte_original.
  // Cette variante garde donc region_nom tout en retirant les champs non supportés.
  ajouterVariante(supprimerChamps(payload, ['region', 'region_signal', 'description', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region', 'region_signal', 'description', 'texte_original', 'date_signal']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'description', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'description']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'description', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'description', 'texte_original', 'date_signal']));
  ajouterVariante(supprimerChamps(payload, ['region_nom', 'region', 'region_signal', 'description', 'texte_original', 'date_signal']));

  // Dernier filet de sécurité : si la base ne possède ni region_nom, ni region, ni region_signal,
  // ni description/texte_original, on conserve quand même la région dans un champ
  // déjà existant presque partout : entreprise_nom.
  // signalCompany() nettoie ensuite cet ajout à l'affichage, tandis que signalRegion()
  // peut le relire pour afficher la ligne Région.
  const regionFallback = payload.region_nom || payload.region || payload.region_signal || '';
  if (regionFallback && payload.entreprise_nom) {
    const entrepriseAvecRegion = {
      ...payload,
      entreprise_nom: `${nettoyerEntrepriseNomRegion(payload.entreprise_nom)} — Région : ${regionFallback}`
    };
    ajouterVariante(supprimerChamps(entrepriseAvecRegion, ['region_nom', 'region', 'region_signal']));
    ajouterVariante(supprimerChamps(entrepriseAvecRegion, ['region_nom', 'region', 'region_signal', 'texte_original']));
    ajouterVariante(supprimerChamps(entrepriseAvecRegion, ['region_nom', 'region', 'region_signal', 'description']));
    ajouterVariante(supprimerChamps(entrepriseAvecRegion, ['region_nom', 'region', 'region_signal', 'description', 'texte_original']));
  }

  ajouterVariante(supprimerChamps(payload, [...champsProjetOptionnels, 'region', 'region_signal', 'description', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, [...champsProjetOptionnels, 'region_nom', 'region', 'region_signal', 'description', 'texte_original']));
  ajouterVariante(supprimerChamps(payload, [...champsProjetOptionnels, 'region_nom', 'region', 'region_signal', 'departement_nom', 'departement_code', 'description', 'texte_original']));

  let derniereErreur = null;

  for (const variante of variantes) {
    let query = window.FLAIR_DATA_SERVICES.signaux()
      .insert([variante]);

    if (options.returnInserted) {
      query = query.select('*').single();
    }

    const { data, error } = await query;

    if (!error) {
      return options.returnInserted ? { data, error: null } : null;
    }
    derniereErreur = error;

    const message = String(error.message || '').toLowerCase();
    if (!message.includes('column') && !message.includes('schema cache')) {
      break;
    }
  }

  return options.returnInserted
    ? { data: null, error: derniereErreur }
    : derniereErreur;
}



function nettoyerMetaTerrainFlair(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function estOrigineTerrainFlair(signal = {}, sourceDistribution = '') {
  const origine = String(signal.origine_signal || sourceDistribution || '').toLowerCase();
  return origine === 'terrain' || origine.includes('terrain');
}

function construireActionContactTerrainFlair(contact, fonction = '') {
  const nom = nettoyerMetaTerrainFlair(contact);
  if (!nom) return '';
  const fonctionLabel = nettoyerMetaTerrainFlair(fonction);
  return [
    `Reprendre contact avec ${nom} afin de qualifier :`,
    'le planning,',
    'les équipements,',
    'les futurs points de contrôle qualité,',
    'les prochaines étapes du projet.'
  ].join('\n');
}

function normaliserCopiloteJsonFlair(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }
  return typeof value === 'object' ? { ...value } : {};
}

function enrichirCopiloteAvecContactTerrain(copiloteJson = {}, signal = {}, sourceDistribution = '') {
  const copilote = normaliserCopiloteJsonFlair(copiloteJson);
  if (!estOrigineTerrainFlair(signal, sourceDistribution)) return copilote;

  const contact = nettoyerMetaTerrainFlair(signal.contact_terrain || signal.contactTerrain || '');
  if (!contact) return copilote;

  const fonction = nettoyerMetaTerrainFlair(signal.fonction_contact_terrain || signal.fonctionContactTerrain || '');
  const label = fonction ? `${contact} — ${fonction}` : contact;
  const actionTerrain = construireActionContactTerrainFlair(contact, fonction);

  return {
    ...copilote,
    contact_terrain: {
      nom: contact,
      fonction,
      label
    },
    prochaine_action: actionTerrain || copilote.prochaine_action || copilote.action || ''
  };
}

function appliquerEthiqueClassificationFlair(signal = {}, secteur = {}) {
  const resultat = { ...(secteur || {}) };
  const texte = [
    signal.titre,
    signal.entreprise_nom,
    signal.description,
    signal.resume_brut,
    signal.texte_original,
    signal.contenu,
    signal.raison_score,
    signal.angle_commercial
  ].filter(Boolean).join(' ').toLowerCase();

  const contient = (mots) => mots.some(mot => texte.includes(String(mot).toLowerCase()));

  const indicesAlimentaires = contient([
    'alimentaire', 'agroalimentaire', 'ingrédient', 'ingredient',
    'produits alimentaires', 'produit alimentaire', 'déshydrat', 'deshydrat'
  ]);
  const indicesCosmetiquesFort = contient([
    'cosmétique', 'cosmetique', 'crème', 'creme', 'soin', 'maquillage',
    'parfum', 'flaconnage cosmétique', 'conditionnement cosmétique'
  ]);

  if (indicesAlimentaires && !indicesCosmetiquesFort) {
    return {
      ...resultat,
      secteur: 'Agroalimentaire',
      sous: contient(['déshydrat', 'deshydrat'])
        ? 'Ingrédients / produits déshydratés'
        : (resultat.sous && !String(resultat.sous).toLowerCase().includes('cosm') ? resultat.sous : 'Ingrédients / produits alimentaires')
    };
  }

  if (
    String(resultat.secteur || '').toLowerCase().includes('cosm') &&
    !indicesCosmetiquesFort
  ) {
    return {
      ...resultat,
      secteur: '',
      sous: ''
    };
  }

  return resultat;
}


function construireLigneDistributionDepuisAnalyse(signal, analyse, contexte, sourceDistribution = 'manuel') {
  const resultat = analyse?.resultat || {};
  const timing = analyse?.timing || {};
  const secteur = appliquerEthiqueClassificationFlair(signal, analyse?.secteur || {});
  const copilote = analyse?.copilote || {};
  const copiloteJson = enrichirCopiloteAvecContactTerrain(
    copilote.copilote_commercial || construireCopiloteCommercialJson(signal, resultat, timing, secteur, copilote),
    signal,
    sourceDistribution
  );

  return {
    signal_id: signal.id,
    commercial_id: contexte.commercial_id,
    statut: 'analyse',
    date_assignation: new Date().toISOString(),
    source_distribution: sourceDistribution,
    score_distribution: resultat.score_pertinence || null,
    chaleur_distribution: resultat.chaleur || null,
    type_signal_distribution: resultat.type_signal || signal.type_signal || null,
    raison_score_distribution: resultat.raison_score || signal.raison_score || null,
    angle_commercial_distribution: resultat.angle_commercial || signal.angle_commercial || null,
    action_recommandee_distribution: resultat.action_recommandee || signal.action_recommandee || null,
    timing_phase: timing.phase || null,
    timing_score: timing.score ?? null,
    fenetre_contact: timing.fenetre || null,
    raison_timing: timing.raison || null,
    interlocuteurs_cibles: copilote.interlocuteurs_cibles || null,
    angle_conseille: copilote.angle_conseille || null,
    message_linkedin: copilote.message_linkedin || null,
    email_prepare: copilote.email_prepare || null,
    plan_appel: copilote.plan_appel || null,
    copilote_commercial: copiloteJson,
    secteur_detecte_label: secteur.secteur || null,
    sous_secteur_detecte_label: secteur.sous || null,
    entreprise_site_web: signalSiteWeb(signal) || null,
    entreprise_telephone_standard: signalTelephoneStandard(signal) || null,
    entreprise_email_generique: signalEmailGenerique(signal) || null,
    doctrine_version: signal.doctrine_version || 'V2026.2',
    doctrine_conformite: signal.doctrine_conformite || null,
    doctrine_certification_statut: signal.doctrine_certification_statut || null,
    doctrine_date_certification: signal.doctrine_date_certification || null,
    doctrine_non_conformites: signal.doctrine_non_conformites || [],
    fraicheur_statut: signal.fraicheur_statut || null,
    fraicheur_date_verification: signal.fraicheur_date_verification || null,
    fraicheur_raison: signal.fraicheur_raison || null,
    raison_distribution: [
      sourceDistribution === 'terrain'
        ? 'Signal terrain ajouté par le commercial puis enrichi par le moteur FLAIR.'
        : (sourceDistribution === 'manuel' || sourceDistribution === 'web_ia'
          ? 'Signal ajouté manuellement par le commercial puis enrichi par le moteur FLAIR.'
          : 'Distribution IA selon métier, région principale et régions secondaires.'),
      timing.fenetre ? `Timing : ${timing.fenetre}.` : '',
      secteur.secteur ? `Secteur : ${secteur.secteur}${secteur.sous ? ' / ' + secteur.sous : ''}.` : ''
    ].filter(Boolean).join(' ')
  };
}


async function upserterDistributionsCommercialesAvecFallback(lignes = [], options = {}) {
  const baseOptions = {
    onConflict: 'signal_id,commercial_id',
    ignoreDuplicates: options.ignoreDuplicates ?? false
  };

  const permissionNonBloquante =
    options.nonBlockingOnPermissionDenied === true ||
    ['manuel', 'terrain', 'web_ia'].includes(options.sourceDistribution);

  const erreurPermissionSignauxCommerciaux = (error) => {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();

    return (
      code === '42501' ||
      message.includes('permission denied') ||
      message.includes('row-level security') ||
      message.includes('rls')
    );
  };

  const { error } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
    .upsert(lignes, baseOptions);

  if (!error) return null;

  // Import manuel : le signal source est déjà créé dans signaux.
  // Si la table de distribution personnalisée est interdite par RLS, on ne
  // bloque pas l'utilisateur : le cockpit retombera sur les signaux sources.
  // Les distributions IA restent strictes par défaut.
  if (permissionNonBloquante && erreurPermissionSignauxCommerciaux(error)) {
    console.warn('Distribution commerciale non bloquante ignorée :', error.message);
    return null;
  }

  const message = String(error.message || '').toLowerCase();
  if (!message.includes('copilote_commercial') && !message.includes('schema cache') && !message.includes('column')) {
    return error;
  }

  const lignesCompatibles = lignes.map(ligne => {
    const copie = { ...ligne };
    delete copie.copilote_commercial;
    delete copie.entreprise_site_web;
    delete copie.entreprise_telephone_standard;
    delete copie.entreprise_email_generique;
    delete copie.doctrine_version;
    delete copie.doctrine_conformite;
    delete copie.doctrine_certification_statut;
    delete copie.doctrine_date_certification;
    delete copie.doctrine_non_conformites;
    delete copie.fraicheur_statut;
    delete copie.fraicheur_date_verification;
    delete copie.fraicheur_raison;
    return copie;
  });

  const { error: fallbackError } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
    .upsert(lignesCompatibles, baseOptions);

  if (fallbackError && permissionNonBloquante && erreurPermissionSignauxCommerciaux(fallbackError)) {
    console.warn('Distribution commerciale fallback non bloquante ignorée :', fallbackError.message);
    return null;
  }

  return fallbackError || null;
}


async function enrichirSignalImporteAvecAnnuaire(signal = {}, texteSource = '', metaImport = {}) {
  if (!window.FLAIR_ANNUAIRE_ENRICHISSEMENT?.enrichirSignalAvecAnnuaire) {
    return signal;
  }

  return window.FLAIR_ANNUAIRE_ENRICHISSEMENT.enrichirSignalAvecAnnuaire(signal, {
    texte: texteSource,
    localisation: metaImport?.localisation || signal.localisation_connue || signal.departement_nom || signal.region_nom || signal.region || ''
  });
}

async function analyserArticleImporte() {
  if (!user) {
    alert('Tu dois être connecté.');
    return;
  }

  const textarea = document.getElementById('texteSignalImport');
  const status = document.getElementById('importSignalStatus');
  const texte = textarea?.value?.trim() || '';
  const metaImport = lireMetaImportSignal();
  const texteAnalyse = construireTexteAnalyseImport(texte, metaImport);

  if (!texte) {
    alert('Merci de coller un article ou un signal à analyser.');
    return;
  }

  const contexteSignal = await garantirContexteSignal();
  if (!contexteSignal) return;

  if (status) status.textContent = 'Analyse en cours…';

  let signalImporte;
  try {
    // FLAIR V2026.1 — séparation stricte des responsabilités :
    // - le texte utilisateur sert à extraire entreprise / titre / projet ;
    // - les métadonnées Source / Terrain / Localisation enrichissent ensuite le signal ;
    // - elles ne doivent jamais polluer l'extraction du nom d'entreprise.
    signalImporte = extraireSignalDepuisArticle(texte);
    signalImporte = enrichirSignalAvecMetaImport(signalImporte, metaImport, texte);
  } catch (err) {
    console.error('Erreur analyse signal importé :', err);
    if (status) status.textContent = '';
    alert("Erreur analyse signal : " + (err?.message || err));
    return;
  }

  signalImporte = corrigerInferenceSemantiqueFlair(signalImporte, texteAnalyse);
  if (window.FLAIR_SIGNAL_VALIDATOR?.validerSignal) {
    signalImporte = window.FLAIR_SIGNAL_VALIDATOR.validerSignal(signalImporte, texteAnalyse, { mode: 'manuel_payload' }).signal || signalImporte;
  }

  // FLAIR V2026.2 — Enrichissement Annuaire.
  // Second module séparé : coordonnées publiques uniquement.
  // Ne modifie jamais score, timing, type_signal ou crédibilité.
  signalImporte = await enrichirSignalImporteAvecAnnuaire(signalImporte, texte, metaImport);

  // Doctrine V2026.2 : certification explicite avant insertion et distribution.
  const certificationManuelle = certifierSignalFlair(signalImporte, texteAnalyse, signalImporte.origine_signal || metaImport.origine || 'manuel');
  if (!certificationManuelle.conforme) {
    if (status) status.textContent = 'Signal refusé par la Doctrine V2026.2.';
    alert(window.FLAIR_DOCTRINE_API?.messageBlocage(certificationManuelle) || 'Signal non conforme à la Doctrine V2026.2.');
    return;
  }
  signalImporte = certificationManuelle.signal;

  const regionFinale = signalImporte.region_nom || signalImporte.region || '';
  const projetDejaDetecte = await rechercherProjetDejaDetecte(signalImporte, contexteSignal);
  const commentaireAntiDoublon = messageProjetDejaDetecte(projetDejaDetecte);

  const payload = {
    commercial_id: contexteSignal.commercial_id,
    team_id: contexteSignal.team_id,
    titre: signalImporte.titre,
    entreprise_nom: signalImporte.entreprise_nom || 'Entreprise non renseignée',
    statut: 'analyse',
    type_source: 'manuel',
    origine_signal: signalImporte.origine_signal || metaImport.origine || 'web_ia',
    score_pertinence: signalImporte.score_pertinence,
    chaleur: signalImporte.chaleur,
    type_signal: signalImporte.type_signal,
    raison_score: signalImporte.raison_score,
    angle_commercial: signalImporte.angle_commercial,
    action_recommandee: signalImporte.action_recommandee,
    copilote_commercial: signalImporte.copilote_commercial || null,
    entreprise_site_web: signalImporte.entreprise_site_web || signalImporte.site_web || null,
    entreprise_telephone_standard: signalImporte.entreprise_telephone_standard || signalImporte.telephone_standard || null,
    entreprise_email_generique: signalImporte.entreprise_email_generique || signalImporte.email_generique || null,
    commentaire_action: commentaireAntiDoublon || null
  };

  Object.assign(payload, appliquerMetaDoctrinePayload(payload, certificationManuelle.certification));

  // FLAIR V2026.1 — Source terrain :
  // Les métadonnées détaillées (source_confiance, contact_terrain,
  // fonction_contact_terrain, localisation_connue) ne sont pas envoyées
  // dans signaux tant que les colonnes Supabase correspondantes n'existent pas.
  // On conserve uniquement origine_signal, déjà présente dans le schéma.
  // La confiance source reste exploitée en mémoire par le moteur d'analyse.
  // Si besoin, une migration SQL pourra ajouter ces colonnes plus tard.

  // FLAIR 5.1 / 5.4 — champs préparatoires non bloquants.
  // Si les colonnes n'existent pas encore dans Supabase, insererSignalAvecFallback()
  // retentera automatiquement sans ces champs.
  const familleProjet = projetDejaDetecte?.famille || detecterFamilleProjetDepuisTexte(texteBrutProjetPourFamille(signalImporte));
  if (familleProjet?.id) {
    payload.famille_projet = familleProjet.id;
    payload.famille_projet_label = familleProjet.label;
    payload.projet_key = projetDejaDetecte?.projetKey || construireProjetKeyFlair(payload.entreprise_nom, familleProjet.id);
    payload.projet_label = projetDejaDetecte?.projetLabel || `${payload.entreprise_nom} — ${familleProjet.label}`;
    payload.projet_detecte = Boolean(projetDejaDetecte?.signal);
    payload.origine_signal = signalImporte.origine_signal || metaImport.origine || payload.origine_signal || 'web_ia';
  }

  if (regionFinale) {
    // Compatibilité schéma Supabase :
    // - region_nom : colonne réelle de la table signaux
    // - region / region_signal : anciens noms ou variantes possibles
    payload.region_nom = regionFinale;
    payload.region = regionFinale;
    payload.region_signal = regionFinale;
  }
  if (signalImporte.departement_nom) payload.departement_nom = signalImporte.departement_nom;
  if (signalImporte.departement_code) payload.departement_code = signalImporte.departement_code;
  if (signalImporte.date_signal) payload.date_signal = signalImporte.date_signal;

  // On conserve le texte importé quand la colonne existe.
  // Cela permet aussi à signalRegion() de retrouver la région même si la colonne region
  // n'existe pas encore dans certaines bases Supabase.
  if (signalImporte.texte_original) {
    // La colonne stable de la table signaux est resume_brut.
    // description / texte_original sont conservés uniquement pour compatibilité éventuelle,
    // puis retirés automatiquement par insererSignalAvecFallback si absents du schéma.
    payload.resume_brut = signalImporte.texte_original;
    payload.description = signalImporte.texte_original;
    payload.texte_original = signalImporte.texte_original;
  }

  const insertion = await insererSignalAvecFallback(payload, { returnInserted: true });

  if (insertion?.error) {
    if (status) status.textContent = '';
    alert('Erreur import signal : ' + insertion.error.message);
    return;
  }

  let signalInsere = insertion?.data || payload;
  // Les métadonnées terrain ne sont pas encore toutes stockées dans Supabase.
  // On les réattache en mémoire au signal inséré pour alimenter la distribution
  // et le copilote commercial sans ajouter de colonne ni casser le schéma.
  signalInsere = {
    ...signalImporte,
    ...signalInsere,
    id: signalInsere.id || insertion?.data?.id || payload.id
  };
  if (window.FLAIR_SIGNAL_VALIDATOR?.validerSignal) {
    signalInsere = window.FLAIR_SIGNAL_VALIDATOR.validerSignal(signalInsere, texteAnalyse, { mode: 'manuel_distribution' }).signal || signalInsere;
  }
  const analyseDistribution = calculerScoreDistributionIA(signalInsere);
  const ligneDistribution = construireLigneDistributionDepuisAnalyse(
    signalInsere,
    analyseDistribution,
    contexteSignal,
    signalImporte.origine_signal || metaImport.origine || 'manuel'
  );

  const distributionError = await upserterDistributionsCommercialesAvecFallback([ligneDistribution], {
    ignoreDuplicates: false,
    sourceDistribution: 'manuel',
    nonBlockingOnPermissionDenied: true
  });

  if (distributionError) {
    if (status) status.textContent = '';
    alert('Signal source ajouté, mais erreur enrichissement cockpit : ' + distributionError.message);
    return;
  }

  if (textarea) textarea.value = '';
  if (status) {
    const resultat = analyseDistribution.resultat || {};
    status.textContent = commentaireAntiDoublon
      ? `Signal ajouté au radar · ⚠ Projet déjà détecté · score ${resultat.score_pertinence || signalImporte.score_pertinence}/100 · ${resultat.chaleur || signalImporte.chaleur}`
      : `Signal ajouté au radar · score ${resultat.score_pertinence || signalImporte.score_pertinence}/100 · ${resultat.chaleur || signalImporte.chaleur}`;
  }

  await refreshCockpit();
}

async function ajouterSignal() {
  // Compatibilité avec d'anciens boutons éventuels : la saisie manuelle simple reste possible si les champs existent encore.
  if (!user) {
    alert('Tu dois être connecté.');
    return;
  }

  const titre = document.getElementById('titre')?.value?.trim() || '';
  const entreprise = document.getElementById('entreprise')?.value?.trim() || '';

  if (!titre) {
    alert('Merci de saisir un titre.');
    return;
  }

  const contexteSignal = await garantirContexteSignal();
  if (!contexteSignal) return;

  const { error } = await window.FLAIR_DATA_SERVICES.signaux()
    .insert([{
      commercial_id: contexteSignal.commercial_id,
      team_id: contexteSignal.team_id,
      titre,
      entreprise_nom: entreprise,
      statut: 'nouveau',
      type_source: 'manuel'
    }]);

  if (error) {
    alert('Erreur insertion : ' + error.message);
    return;
  }

  const titreInput = document.getElementById('titre');
  const entrepriseInput = document.getElementById('entreprise');
  if (titreInput) titreInput.value = '';
  if (entrepriseInput) entrepriseInput.value = '';

  await refreshCockpit();
}

function formatValeurCrm(label, value) {
  const texte = String(value || '').trim();
  return texte ? `${label} : ${texte}` : '';
}

function construireBlocCrm(signal = {}) {
  const lignes = [
    'OPPORTUNITÉ À CRÉER DANS LE CRM',
    'Source : FLAIR — radar commercial industriel',
    '',
    formatValeurCrm('Entreprise', signalCompany(signal)),
    formatValeurCrm('Site web public', signalSiteWeb(signal)),
    formatValeurCrm('Téléphone standard public', signalTelephoneStandard(signal)),
    formatValeurCrm('Email générique public', signalEmailGenerique(signal)),
    formatValeurCrm('Signal / projet', signalTitle(signal)),
    formatValeurCrm('Famille projet', signal.famille_projet_label || signal.projet_label),
    formatValeurCrm('Région', signalRegion(signal) || 'Non renseignée'),
    formatValeurCrm('Département', signalDepartement(signal)),
    formatValeurCrm('Date signal', signalMetaDate(signal)),
    formatValeurCrm('Score FLAIR', signal.score_pertinence ? `${signal.score_pertinence}/100` : ''),
    formatValeurCrm('Priorité', signal.chaleur),
    '',
    formatValeurCrm('Pourquoi c’est important', signal.raison_score),
    formatValeurCrm('Opportunité commerciale', signal.angle_commercial),
    formatValeurCrm('Action conseillée', signal.action_recommandee),
    '',
    formatValeurCrm('Timing conseillé', signal.fenetre_contact),
    formatValeurCrm('Raison timing', signal.raison_timing),
    formatValeurCrm('Qui contacter', signal.interlocuteurs_cibles),
    formatValeurCrm('Angle conseillé', signal.angle_conseille),
    formatValeurCrm('Message LinkedIn préparé', signal.message_linkedin),
    formatValeurCrm('Email préparé', signal.email_prepare),
    formatValeurCrm('Plan d’appel', signal.plan_appel),
    estSignalProjetSuivi(signal) ? formatValeurCrm('Projet suivi', nettoyerMessageProjetSuivi(signal.commentaire_action)) : '',
    '',
    'À traiter dans le CRM client : qualification, rendez-vous, pipeline et relances.'
  ];

  return lignes.filter(ligne => ligne !== '').join('\n');
}

async function copierTexteDansPressePapier(texte) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texte);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = texte;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  return ok;
}

async function copierSignalPourCrm(signalId) {
  if (!signalId) return;

  const { data, error } = await lireSignalSourcePourCrm(signalId);

  if (error) {
    alert('Erreur lecture signal CRM : ' + error.message);
    return;
  }

  if (!data) {
    alert('Signal introuvable.');
    return;
  }

  const texte = construireBlocCrm(data);

  try {
    await copierTexteDansPressePapier(texte);
    alert('Bloc CRM copié. Tu peux maintenant le coller dans le CRM externe.');
  } catch (err) {
    console.error('Copie CRM impossible :', err);
    alert('Copie automatique impossible. Sélectionne le texte manuellement si besoin.');
  }
}


async function exporterSignalPourCsv(signalId) {
  if (!signalId) return;

  const { data, error } = await lireSignalSourcePourCrm(signalId);

  if (error) {
    alert('Erreur lecture signal CSV : ' + error.message);
    return;
  }

  if (!data) {
    alert('Signal introuvable.');
    return;
  }

  if (!window.FLAIR_EXPORT_UTILS?.exporterSignauxEnCSV) {
    alert('Module export CSV indisponible. Vérifie le chargement de flair-export-utils.js.');
    return;
  }

  const nomCommercial = currentProfil
    ? `${currentProfil.prenom || ''}_${currentProfil.nom || ''}`.replace(/[^a-zA-Z0-9_-]+/g, '_')
    : 'FLAIR';

  window.FLAIR_EXPORT_UTILS.exporterSignauxEnCSV([data], nomCommercial || 'FLAIR');
}


// FLAIR V1.7 : logique timing / secteurs / copilote déplacée dans flair-metier.js.

function renderBlocCopilotePremium(copiloteJson = {}) {
  const lignesQui = renderListeContactsCopilote(copiloteJson.qui_contacter);
  const resumeScores = typeof formaterResumeScoresFlair === 'function'
    ? formaterResumeScoresFlair(copiloteJson.scores_flair)
    : '';

  return `
    <div style="margin:10px 0;padding:13px 14px;border:1px solid rgba(59,130,246,0.45);background:linear-gradient(180deg,rgba(59,130,246,0.13),rgba(15,23,42,0.10));border-radius:14px;box-shadow:0 10px 26px rgba(15,23,42,0.12);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <b>🧭 Copilote commercial</b>
        ${copiloteJson.timing ? `<span class="badge badge-statut">${copiloteJson.timing}</span>` : ''}
      </div>

      ${copiloteJson.coordonnees_publiques ? renderCoordonneesEntreprise(copiloteJson.coordonnees_publiques, { titre: '📇 Coordonnées publiques', afficherVide: true }) : ''}

      ${resumeScores ? `
        <div style="margin:8px 0;padding:8px 10px;border:1px solid rgba(148,163,184,0.35);border-radius:10px;background:rgba(15,23,42,0.10);">
          <small><b>Scores FLAIR V1.4 :</b> ${resumeScores}</small>
        </div>` : ''}

      ${copiloteJson.contact_terrain ? `
        <div style="margin:8px 0;padding:8px 10px;border:1px solid rgba(34,197,94,0.35);border-radius:10px;background:rgba(34,197,94,0.08);">
          <small><b>🤝 Contact terrain</b></small><br>
          <small>${managerEscape(copiloteJson.contact_terrain.label || [copiloteJson.contact_terrain.nom, copiloteJson.contact_terrain.fonction].filter(Boolean).join(' — '))}</small>
        </div>` : ''}

      ${copiloteJson.pourquoi ? `
        <div style="margin:8px 0;">
          <small><b>Pourquoi ?</b></small><br>
          ${renderTexteOuPucesCopilote(copiloteJson.pourquoi)}
        </div>` : ''}

      <div style="margin:8px 0;">
        <small><b>Qui contacter ?</b></small>
        ${lignesQui}
      </div>

      ${copiloteJson.vigilance ? `<small><b>Vigilance :</b> ${copiloteJson.vigilance}</small><br>` : ''}
      ${copiloteJson.angle ? `<small><b>Angle :</b> ${copiloteJson.angle}</small><br>` : ''}
      ${copiloteJson.prochaine_action ? `<small><b>Action :</b> ${copiloteJson.prochaine_action}</small>` : ''}
    </div>
  `;
}

function renderBlocCopiloteCommercial(s = {}) {
  const copiloteJson = lireCopiloteCommercialJson(s);
  if (copiloteJson) {
    return renderBlocCopilotePremium({
      ...copiloteJson,
      coordonnees_publiques: copiloteJson.coordonnees_publiques || {
        entreprise_site_web: signalSiteWeb(s),
        entreprise_telephone_standard: signalTelephoneStandard(s),
        entreprise_email_generique: signalEmailGenerique(s)
      }
    });
  }

  const lignes = [];

  if (s.contact_terrain) {
    const contactLabel = [s.contact_terrain, s.fonction_contact_terrain].filter(Boolean).join(' — ');
    lignes.push(`<small><b>🤝 Contact terrain :</b> ${managerEscape(contactLabel)}</small>`);
  }

  if (s.fenetre_contact || s.raison_timing) {
    lignes.push(`<small><b>Pourquoi agir maintenant :</b> ${[s.fenetre_contact, s.raison_timing].filter(Boolean).join(' — ')}</small>`);
  }

  if (s.secteur_detecte_label || s.sous_secteur_detecte_label) {
    lignes.push(`<small><b>Secteur :</b> ${[s.secteur_detecte_label, s.sous_secteur_detecte_label].filter(Boolean).join(' / ')}</small>`);
  }

  if (s.interlocuteurs_cibles) {
    lignes.push(`<small><b>Qui contacter en priorité :</b></small>${renderListeContactsCopilote(s.interlocuteurs_cibles)}`);
  }

  if (s.angle_conseille) {
    lignes.push(`<small><b>Angle d’ouverture :</b> ${s.angle_conseille}</small>`);
  }

  if (s.plan_appel) {
    const prochaineAction = String(s.plan_appel || '').split('\n').find(ligne => ligne.toLowerCase().includes('prochaine action'));
    if (prochaineAction) {
      lignes.push(`<small><b>Prochaine action :</b> ${prochaineAction.replace(/^\s*\d+\.\s*Prochaine action\s*:\s*/i, '')}</small>`);
    }
  }

  const coordonnees = renderCoordonneesEntreprise(s, { titre: '📇 Coordonnées publiques', afficherVide: true });
  if (!lignes.length && !coordonnees) return '';

  return `
    <div style="margin:8px 0;padding:9px 11px;border:1px solid rgba(59,130,246,0.35);background:rgba(59,130,246,0.08);border-radius:10px;">
      <b>🧭 Copilote commercial</b><br>
      ${coordonnees}
      ${lignes.join('<br>')}
    </div>
  `;
}

async function chercherNouvellesOpportunitesIA() {
  const contexte = await garantirContexteSignal();
  if (!contexte) return;

  const bouton = document.getElementById('btnChercherOpportunitesIA');
  const texteInitial = bouton?.textContent || '';

  if (bouton) {
    bouton.disabled = true;
    bouton.textContent = '🔎 Recherche IA en cours...';
  }

  try {
    const debutJour = new Date();
    debutJour.setHours(0, 0, 0, 0);

    const { count, error: countError } = await window.FLAIR_DATA_SERVICES.recherchesIaCommerciaux()
      .select('id', { count: 'exact', head: true })
      .eq('commercial_id', contexte.commercial_id)
      .gte('created_at', debutJour.toISOString());

    if (countError) {
      alert('Erreur contrôle limite IA : ' + countError.message);
      return;
    }

    if ((count || 0) >= 3) {
      alert('Limite atteinte : 3 recherches IA maximum par jour pour ce commercial.');
      return;
    }

    // V bêta — FLAIR ne lance pas encore une vraie collecte web temps réel.
    // Le bouton distribue une courte sélection de signaux préparés en réserve IA
    // vers la table relationnelle signaux_commerciaux.
    const { data, error } = await window.FLAIR_DATA_SERVICES.signaux()
      .select('*')
      .eq('statut', 'reserve_ia')
      .order('score_pertinence', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      // La réserve reste volontairement limitée, mais doit être assez large pour
      // ne pas masquer les signaux récents derrière d'anciens scores élevés.
      .limit(200);

    if (error) {
      alert('Erreur recherche opportunités IA : ' + error.message);
      return;
    }

    const { data: dejaDistribues, error: dejaError } = await window.FLAIR_DATA_SERVICES.signauxCommerciaux()
      .select('signal_id')
      .eq('commercial_id', contexte.commercial_id);

    if (dejaError) {
      alert('Erreur lecture distributions existantes : ' + dejaError.message);
      return;
    }

    const idsDejaDistribues = new Set((dejaDistribues || []).map(row => row.signal_id));
    const opportunitesCompatibles = (data || [])
      .filter(signal => !idsDejaDistribues.has(signal.id))
      .filter(signalDansPerimetreRegionPrepare)
      .map(signal => {
        const sourceDoctrine = signal.resume_brut || signal.description || signal.texte_original || signal.raison_score || signal.titre || '';
        const certification = certifierSignalFlair(signal, sourceDoctrine, 'ia_reserve');
        if (!certification.conforme) {
          const nonConformites = certification.certification?.doctrine_non_conformites || [];
          console.warn(
            'Signal réserve IA exclu par la Doctrine V2026.2 :',
            signal.id,
            nonConformites.map(item => `${item.code || 'NON_CONFORMITE'} — ${item.message || ''}`)
          );
          return null;
        }
        const signalCertifie = certification.signal;
        return {
          signal: signalCertifie,
          analyse: calculerScoreDistributionIA(signalCertifie)
        };
      })
      .filter(Boolean)
      .filter(item => {
        const score = Number(item.analyse?.resultat?.score_pertinence) || 0;
        const profil = profilCommercialActuel();
        const enrichissement = window.FLAIR_SOURCE_VEILLE?.analyserSignalAvecRegles
          ? window.FLAIR_SOURCE_VEILLE.analyserSignalAvecRegles(item.signal)
          : null;
        const compatibilite = enrichissement ? compatibiliteMetierPourProfil(enrichissement, profil) : 0;

        // Si les règles métier ne détectent pas de profil précis, on conserve le signal :
        // FLAIR est encore en phase bêta et la réserve IA peut contenir des signaux transverses.
        const profilsDetectes = enrichissement ? profilsMetiersDetectes(enrichissement) : [];
        return !profilsDetectes.length || compatibilite > 0 || score >= 45;
      })
      .sort((a, b) => (Number(b.analyse?.resultat?.score_pertinence) || 0) - (Number(a.analyse?.resultat?.score_pertinence) || 0))
      // FLAIR V2.5 — 5 signaux maximum par clic IA, tout en conservant 3 clics/jour.
      // Objectif : donner suffisamment de matière sans transformer FLAIR en base de données à fouiller.
      .slice(0, 5);

    if (!opportunitesCompatibles.length) {
      alert('Aucune nouvelle opportunité IA certifiée V2026.2 n’est disponible pour ton profil actuellement.');
      return;
    }

    const lignesDistribution = opportunitesCompatibles.map(({ signal, analyse }) =>
      construireLigneDistributionDepuisAnalyse(signal, analyse, contexte, 'ia')
    );

    const insertError = await upserterDistributionsCommercialesAvecFallback(lignesDistribution, {
      ignoreDuplicates: true
    });

    if (insertError) {
      alert('Erreur distribution opportunités IA : ' + insertError.message);
      return;
    }

    const { error: traceError } = await window.FLAIR_DATA_SERVICES.recherchesIaCommerciaux()
      .insert([{
        commercial_id: contexte.commercial_id,
        nb_signaux_distribues: opportunitesCompatibles.length
      }]);

    if (traceError) {
      console.warn('Recherche IA distribuée mais non journalisée :', traceError.message);
    }

    await refreshCockpit();

    alert(`${opportunitesCompatibles.length} nouvelle${opportunitesCompatibles.length > 1 ? 's' : ''} opportunité${opportunitesCompatibles.length > 1 ? 's' : ''} IA ajoutée${opportunitesCompatibles.length > 1 ? 's' : ''} au radar.`);
  } finally {
    if (bouton) {
      bouton.disabled = false;
      bouton.textContent = texteInitial || '🔍 Chercher de nouvelles opportunités IA';
    }
  }
}

async function marquerOpportuniteCrm(signalId) {
  const nowIso = new Date().toISOString();

  const updateData = {
    crm_cree: true,
    date_crm_cree: nowIso,
    date_derniere_action: nowIso,
    relance_due_at: null
  };

  const error = await mettreAJourSignalOuDistribution(signalId, updateData);

  if (error) {
    alert("Erreur création opportunité CRM : " + error.message);
    return;
  }

  await refreshCockpit();
}

async function changerStatut(signalId, nouveauStatut) {
  const nowIso = new Date().toISOString();
  const updateData = {
    statut: nouveauStatut,
    date_derniere_action: nowIso
  };

  const signalAction = ['a_contacter', 'a_suivre'].includes(nouveauStatut)
    ? await lireChaleurSignalPourAction(signalId)
    : { table: 'signaux', chaleur: '' };

  const chaleurSignal = signalAction.chaleur;

  if (nouveauStatut === 'a_contacter') {
    updateData.date_a_contacter = nowIso;

    if (chaleurSignal === 'chaud') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      updateData.relance_due_at = d.toISOString();
    }

    if (chaleurSignal === 'tiede') {
      const d = new Date();
      d.setDate(d.getDate() + 15);
      updateData.relance_due_at = d.toISOString();
    }

    if (chaleurSignal === 'froid') {
      updateData.relance_due_at = null;
    }
  }

  if (nouveauStatut === 'a_suivre') {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    updateData.relance_due_at = d.toISOString();
  }

  if (nouveauStatut === 'ignore') {
    updateData.statut = 'historique';
    updateData.relance_due_at = null;
  }

  const error = await mettreAJourSignalOuDistribution(signalId, updateData);

  if (error) {
    alert("Erreur mise à jour statut : " + error.message);
    return;
  }

  await refreshCockpit();
}

async function enregistrerFeedback(signalId, feedback) {
  const error = await mettreAJourSignalOuDistribution(signalId, {
    feedback_commercial: feedback,
    date_derniere_action: new Date().toISOString()
  });

  if (error) {
    alert("Erreur feedback : " + error.message);
    return;
  }

  await refreshCockpit();
}


async function chargerStats() {
  try {
    const { data, error } = await window.FLAIR_DATA_SERVICES.signaux()
      .select('statut, chaleur')
      .eq('commercial_id', user.id);

    if (error) throw error;

    const signaux = data || [];

    const actifs = signaux.filter(s =>
      !['ignore', 'a_contacter', 'a_suivre', 'historique', 'traite'].includes(s.statut)
    ).length;

    const chauds = signaux.filter(s =>
      s.chaleur === 'chaud' &&
      !['ignore', 'a_contacter', 'a_suivre', 'historique', 'traite'].includes(s.statut)
    ).length;

    const aContacter = signaux.filter(s =>
      s.statut === 'a_contacter'
    ).length;

    const nouveaux = signaux.filter(s =>
      s.statut === 'nouveau'
    ).length;

    const statActifs = document.getElementById('statActifs');
    const statChauds = document.getElementById('statChauds');
    const statAContacter = document.getElementById('statAContacter');
    const statNouveaux = document.getElementById('statNouveaux');

    if (statActifs) statActifs.textContent = actifs;
    if (statChauds) statChauds.textContent = chauds;
    if (statAContacter) statAContacter.textContent = aContacter;
    if (statNouveaux) statNouveaux.textContent = nouveaux;

  } catch (err) {
    console.error('Erreur chargement statistiques :', err);
  }
}

// =========================
// DASHBOARD PRO MANAGER
// =========================

function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSignalDate(s) {
  return s.date_signal || s.created_at || null;
}

function isDateInManagerPeriod(value, period) {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d >= period.start && d <= period.end;
}

function isSignalCreatedInPeriod(s, period) {
  return isDateInManagerPeriod(getSignalDate(s), period);
}

function isSignalContactedInPeriod(s, period) {
  // V4.1 — compatible avec les anciens signaux qui n'ont pas encore date_a_contacter.
  if (isDateInManagerPeriod(s.date_a_contacter, period)) return true;
  if (s.statut === 'a_contacter' && isDateInManagerPeriod(s.date_derniere_action, period)) return true;
  return false;
}

function isSignalCrmCreatedInPeriod(s, period) {
  if (s.crm_cree !== true) return false;
  if (isDateInManagerPeriod(s.date_crm_cree, period)) return true;
  if (!s.date_crm_cree && isDateInManagerPeriod(s.date_derniere_action, period)) return true;
  return false;
}

function getFeedbackSignals(signaux) {
  // Le taux de pertinence doit rester lisible même avec peu de signaux :
  // il est donc calculé sur les feedbacks existants, pas uniquement sur les créations du jour.
  return signaux.filter(s =>
    ['interet_confirme', 'interet_non_confirme'].includes(s.feedback_commercial)
  );
}

function getManagerDateKey(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay() === 0 ? 6 : d.getDay() - 1;
}

function renderMiniSparkline(targetOrValues, valuesMaybe) {
  // FLAIR V2026.1 — compatibilité Dashboard Manager / Dashboard Solo.
  // Ancien usage : element.innerHTML = renderMiniSparkline([1,2,3])
  // Nouvel usage : renderMiniSparkline('elementId', [1,2,3])
  // La fonction accepte les deux signatures et neutralise les données invalides.
  const hasTarget = typeof targetOrValues === 'string';
  const rawValues = hasTarget ? valuesMaybe : targetOrValues;
  const values = Array.isArray(rawValues)
    ? rawValues.map(v => Number(v) || 0)
    : [];

  const safeValues = values.length ? values : [0];
  const max = Math.max(...safeValues, 1);
  const html = safeValues.map(v => {
    const height = Math.max(6, Math.round((v / max) * 26));
    return `<span style="height:${height}px" title="${v}"></span>`;
  }).join('');

  if (hasTarget) {
    const el = document.getElementById(targetOrValues);
    if (el) el.innerHTML = html;
  }

  return html;
}

function managerLabel(value, fallback = 'Non renseigné') {
  return String(value || '').trim() || fallback;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setWidth(id, value) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function safePercent(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function renderManagerEvolutionChart(values = []) {
  const container = document.getElementById('mgrEvolutionChart');
  if (!container) return;

  const nums = values.map(v => Number(v) || 0);
  const max = Math.max(...nums, 1);
  const width = 420;
  const height = 150;
  const padX = 24;
  const padY = 18;
  const step = nums.length > 1 ? (width - padX * 2) / (nums.length - 1) : 0;

  const points = nums.map((value, index) => {
    const x = padX + index * step;
    const y = height - padY - ((value / max) * (height - padY * 2));
    return { x, y, value };
  });

  const line = points.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="manager-v51-chart" preserveAspectRatio="none">
      <defs>
        <linearGradient id="flairChartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a855f7" stop-opacity="0.34"></stop>
          <stop offset="100%" stop-color="#a855f7" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <g class="manager-chart-grid">
        <line x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}"></line>
        <line x1="${padX}" y1="${height / 2}" x2="${width - padX}" y2="${height / 2}"></line>
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}"></line>
      </g>
      <polygon points="${area}" class="manager-chart-area"></polygon>
      <polyline points="${line}" class="manager-chart-line"></polyline>
      ${points.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="3.2" class="manager-chart-dot"><title>Jour ${i + 1} : ${p.value}</title></circle>`).join('')}
    </svg>
    <div class="manager-chart-axis">${nums.map((_, i) => `<span>${i + 1}</span>`).join('')}</div>
  `;
}

function renderManagerHeatDonut(signaux = []) {
  const container = document.getElementById('mgrHeatDonut');
  if (!container) return;

  const chaud = signaux.filter(s => s.chaleur === 'chaud').length;
  const tiede = signaux.filter(s => s.chaleur === 'tiede').length;
  const froid = signaux.filter(s => s.chaleur === 'froid').length;
  const total = Math.max(chaud + tiede + froid, 0);

  const pChaud = safePercent(chaud, total);
  const pTiede = safePercent(tiede, total);
  const pFroid = Math.max(0, 100 - pChaud - pTiede);

  container.innerHTML = `
    <div class="manager-heat-donut" style="background: conic-gradient(#e4574f 0 ${pChaud}%, #f2a93b ${pChaud}% ${pChaud + pTiede}%, #6ea8ff ${pChaud + pTiede}% 100%);">
      <div><strong>${total}</strong><small>total</small></div>
    </div>
    <div class="manager-heat-legend">
      <div><span class="heat-dot hot"></span>Chaud <strong>${chaud} (${pChaud}%)</strong></div>
      <div><span class="heat-dot warm"></span>Tiède <strong>${tiede} (${pTiede}%)</strong></div>
      <div><span class="heat-dot cold"></span>Froid <strong>${froid} (${pFroid}%)</strong></div>
    </div>
  `;
}

function renderManagerBars(containerId, entries = [], emptyText = 'Aucune donnée.') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `<div class="manager-empty">${emptyText}</div>`;
    return;
  }

  const max = Math.max(...entries.map(entry => entry.value), 1);

  container.innerHTML = entries.slice(0, 5).map((entry, index) => {
    const pct = Math.round((entry.value / max) * 100);
    return `
      <div class="manager-v51-bar-row">
        <div class="manager-v51-bar-head">
          <span>${index + 1}. ${entry.label}</span>
          <strong>${entry.value}${entry.detail ? ` ${entry.detail}` : ''}</strong>
        </div>
        <div class="manager-v51-bar"><i style="width:${pct}%"></i></div>
      </div>`;
  }).join('');
}

function formatManagerTypeLabel(type) {
  const labels = {
    appel_offre: 'Appel d’offre',
    investissement: 'Projet d’investissement',
    recrutement: 'Recrutement',
    nouvelle_ligne: 'Nouvelle ligne',
    qualite_rappel_conso: 'Qualité / rappel conso',
    autre: 'Surveillance / veille'
  };

  return labels[type] || managerLabel(type, 'Autre');
}


function normalizeManagerSource(s) {
  return managerLabel(s.type_source || s.source || s.source_nom || s.origine, 'Source non renseignée');
}

function commercialDisplayName(c) {
  return managerLabel(
    c.nom_complet ||
    [c.prenom, c.nom].filter(Boolean).join(' ') ||
    c.email,
    'Commercial'
  );
}

function renderManagerRows(containerId, rows, emptyText) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = `<div class="manager-empty">${emptyText}</div>`;
    return;
  }

  container.innerHTML = rows.join('');
}


function getManagerPeriodConfig() {
  const value = document.getElementById('managerPeriodFilter')?.value || '7';
  const now = new Date();
  const start = new Date(now);
  let label = '7 derniers jours';

  if (value === '30') {
    start.setDate(now.getDate() - 30);
    label = '30 derniers jours';
  } else if (value === '90') {
    start.setDate(now.getDate() - 90);
    label = '90 derniers jours';
  } else if (value === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    label = `Année ${now.getFullYear()}`;
  } else {
    start.setDate(now.getDate() - 7);
  }

  start.setHours(0, 0, 0, 0);
  now.setHours(23, 59, 59, 999);

  return { value, start, end: now, label };
}

function calculerTempsMoyenAvantAction(signaux) {
  const delais = signaux
    .filter(s => s.created_at && s.date_a_contacter)
    .map(s => {
      const created = new Date(s.created_at).getTime();
      const contacted = new Date(s.date_a_contacter).getTime();
      if (Number.isNaN(created) || Number.isNaN(contacted) || contacted < created) return null;
      return contacted - created;
    })
    .filter(v => v !== null);

  if (!delais.length) return '—';

  const moyenneMs = delais.reduce((total, v) => total + v, 0) / delais.length;
  const heures = moyenneMs / (1000 * 60 * 60);

  if (heures < 24) return `${Math.max(1, Math.round(heures))} h`;
  return `${Math.round(heures / 24)} j`;
}


async function chargerDashboardManagerSolo() {
  if (!user) return;

  try {
    const period = getManagerPeriodConfig();
    const now = period.end;

    setText('managerPeriodLabel', period.label);
    setText('managerPeriodSmall', period.label);

    const distributions = await lireDistributionsCommerciales({ limit: 300, orderTop3: true });
    const allSignaux = dedoublonnerSignauxPourAffichage(distributions.data || []);
    const signaux = allSignaux.filter(s =>
      isSignalCreatedInPeriod(s, period) ||
      isDistributionInManagerPeriod(s, period) ||
      isSignalContactedInPeriod(s, period) ||
      isSignalCrmCreatedInPeriod(s, period) ||
      isDateInManagerPeriod(s.date_derniere_action, period) ||
      isDateInManagerPeriod(s.relance_due_at, period)
    );

    const nomSolo = commercialDisplayName(currentProfil || {});
    setText('managerTeamName', currentProfil?.societe ? `Espace solo ${currentProfil.societe}` : 'Espace commercial solo');
    setText('managerTeamCount', '1 commercial solo');

    const teamMembersEl = document.getElementById('managerTeamMembers');
    if (teamMembersEl) {
      teamMembersEl.innerHTML = `
        <div class="manager-team-member">
          • ${managerEscape(nomSolo)}
          <br>
          <small>${currentProfil?.region ? labelRegionCommerciale(currentProfil.region) : 'Région non renseignée'}</small>
        </div>
      `;
    }

    const actifs = signaux.filter(s => !['ignore', 'historique', 'traite'].includes(s.statut));
    const leadsChauds = signaux.filter(s => s.chaleur === 'chaud' && !['ignore', 'historique', 'traite'].includes(s.statut));
    const signauxContactes = allSignaux.filter(s => s.statut === 'a_contacter' || Boolean(s.date_a_contacter));
    const opportunitesCrm = allSignaux.filter(s => s.crm_cree === true);
    const opportunitesCrmPeriode = allSignaux.filter(s => isSignalCrmCreatedInPeriod(s, period));
    const aContacter = signaux.filter(s => s.statut === 'a_contacter');
    const relancesRetard = allSignaux.filter(s => {
      if (!s.relance_due_at) return false;
      if (['historique', 'ignore', 'traite'].includes(s.statut)) return false;
      if (s.crm_cree === true) return false;
      return new Date(s.relance_due_at) < now;
    });

    setText('mgrSignauxActifs', actifs.length);
    setText('mgrSignauxActifsInfo', 'Signaux personnels');
    setText('mgrNouveauxSignaux', leadsChauds.length);
    setText('mgrNouveauxInfo', 'Signaux chauds');
    setText('mgrLeadsChauds', signauxContactes.length);
    setText('mgrLeadsChaudsInfo', 'Signaux contactés');
    setText('mgrAContacter', opportunitesCrmPeriode.length || opportunitesCrm.length);
    setText('mgrAContacterInfo', 'Créées dans le CRM');
    setText('mgrRelancesRetardKpi', relancesRetard.length);
    setText('mgrRelancesRetardInfo', relancesRetard.length ? 'À reprendre' : 'Situation maîtrisée');

    renderMiniSparkline('mgrSparklineActifs', [0,0,0,0,0,0,actifs.length]);
    renderMiniSparkline('mgrSparklineNouveaux', [0,0,0,0,0,0,leadsChauds.length]);
    renderMiniSparkline('mgrSparklineChauds', [0,0,0,0,0,0,signauxContactes.length]);
    renderMiniSparkline('mgrSparklineAContacter', [0,0,0,0,0,0,opportunitesCrm.length]);
    renderMiniSparkline('mgrSparklineRelances', [0,0,0,0,0,0,relancesRetard.length]);

    renderManagerEvolutionChart([0, 0, 0, 0, 0, 0, signaux.length]);
    renderManagerHeatDonut(signaux);

    const feedbackSignals = allSignaux.filter(s => s.feedback_commercial);
    const confirmes = feedbackSignals.filter(s => s.feedback_commercial === 'interet_confirme');
    const pertinence = feedbackSignals.length ? Math.round((confirmes.length / feedbackSignals.length) * 100) : 0;

    const activityRows = allSignaux.length ? [`
      <div class="manager-row">
        <div>
          <div class="manager-row-title">${managerEscape(nomSolo)}</div>
          <div class="manager-row-sub">${allSignaux.length} signal(aux) · ${leadsChauds.length} chaud(s) · ${signauxContactes.length} contacté(s)</div>
          <div class="manager-progress"><i style="width:100%"></i></div>
        </div>
        <div class="manager-row-score">${pertinence}%</div>
      </div>
    `] : [];

    renderManagerRows('mgrActiviteCommerciaux', activityRows, 'Aucune activité personnelle sur la période.');

    renderManagerBars(
      'mgrTopCrm',
      opportunitesCrm.length ? [{ label: nomSolo, value: opportunitesCrm.length }] : [],
      'Aucune opportunité CRM créée.'
    );

    const typeMap = new Map();
    signaux.forEach(s => {
      const label = formatManagerTypeLabel(s.type_signal || 'autre');
      typeMap.set(label, (typeMap.get(label) || 0) + 1);
    });

    const totalAngles = Math.max(signaux.length, 1);
    const angleEntries = Array.from(typeMap.entries())
      .map(([label, value]) => ({ label, value, detail: `(${safePercent(value, totalAngles)}%)` }))
      .sort((a, b) => b.value - a.value);

    renderManagerBars('mgrAngles', angleEntries, 'Aucun angle exploitable sur la période.');
  } catch (err) {
    console.error('Erreur Dashboard Solo :', err);
  }
}

async function chargerDashboardManager() {
  if (!user) return;

  if (estProfilManagerSolo(currentProfil)) {
    await chargerDashboardManagerSolo();
    return;
  }

  try {
    const teamId = currentProfil?.team_id;

    if (!teamId) {
      console.warn('Dashboard Manager : team_id manquant pour le profil courant.');
      return;
    }

    const period = getManagerPeriodConfig();
    const startWeek = period.start;
    const now = period.end;

    setText('managerPeriodLabel', period.label);
    setText('managerPeriodSmall', period.label);

    const { data, error } = await window.FLAIR_DATA_SERVICES.signaux()
      .select('*')
      .eq('team_id', teamId);

    if (error) throw error;

    const allSignaux = data || [];
    const signaux = allSignaux.filter(s =>
      isSignalCreatedInPeriod(s, period) ||
      isSignalContactedInPeriod(s, period) ||
      isSignalCrmCreatedInPeriod(s, period) ||
      isDateInManagerPeriod(s.date_derniere_action, period) ||
      isDateInManagerPeriod(s.relance_due_at, period)
    );

    const { data: commerciauxData, error: commerciauxError } = await window.FLAIR_DATA_SERVICES.commerciaux()
      .select('*')
      .eq('team_id', teamId);

    if (commerciauxError) {
      console.warn('Dashboard Manager : commerciaux indisponibles', commerciauxError);
    }

    const commerciaux = commerciauxData || [];
    const commerciauxMap = new Map(commerciaux.map(c => [c.id, commercialDisplayName(c)]));

    const teamNameEl = document.getElementById('managerTeamName');
    const teamCountEl = document.getElementById('managerTeamCount');
    const teamMembersEl = document.getElementById('managerTeamMembers');

    if (teamNameEl) {
      teamNameEl.textContent = currentProfil?.societe
        ? `Équipe ${currentProfil.societe}`
        : 'Équipe commerciale';
    }

    const commerciauxEquipe = commerciaux.filter(c => c.role !== 'manager');

    if (teamCountEl) {
      teamCountEl.textContent = `${commerciauxEquipe.length} commercial${commerciauxEquipe.length > 1 ? 'aux' : ''}`;
    }

    if (teamMembersEl) {
      if (!commerciauxEquipe.length) {
        teamMembersEl.innerHTML = '<small>Aucun commercial rattaché</small>';
      } else {
        teamMembersEl.innerHTML = commerciauxEquipe
          .map(c => `
            <div class="manager-team-member">
             • ${commercialDisplayName(c)}
             <br>
             <small>${c.region ? labelRegionCommerciale(c.region) : 'Région non renseignée'}</small>
           </div>
        `)
        .join('');
     }
   }

    const actifs = signaux.filter(s => !['ignore', 'historique', 'a_contacter', 'a_suivre', 'traite'].includes(s.statut));
    const nouveaux = signaux.filter(s => s.statut === 'nouveau');
    const leadsChauds = signaux.filter(s => s.chaleur === 'chaud' && !['ignore', 'historique', 'a_contacter', 'a_suivre', 'traite'].includes(s.statut));
    const aContacter = signaux.filter(s => s.statut === 'a_contacter');

    // V4.1 — KPI Signaux contactés : statut à contacter OU date de contact renseignée.
    const signauxContactes = allSignaux.filter(s =>
      s.statut === 'a_contacter' || Boolean(s.date_a_contacter)
    );

    const signauxContactesPeriode = allSignaux.filter(s =>
      isSignalContactedInPeriod(s, period)
    );

    // V4.1 — CRM = booléen léger, sans changement de statut.
    const opportunitesCrm = allSignaux.filter(s => s.crm_cree === true);
    const opportunitesCrmPeriode = allSignaux.filter(s => isSignalCrmCreatedInPeriod(s, period));

    const relancesRetard = allSignaux.filter(s => {
      if (!s.relance_due_at) return false;
      if (['historique', 'ignore', 'traite'].includes(s.statut)) return false;
      if (s.crm_cree === true) return false;
      return new Date(s.relance_due_at) < now;
    });

    const feedbackSignals = getFeedbackSignals(allSignaux);
    const confirmes = feedbackSignals.filter(s => s.feedback_commercial === 'interet_confirme');
    const nonConfirmes = feedbackSignals.filter(s => s.feedback_commercial === 'interet_non_confirme');
    const totalFeedback = feedbackSignals.length;
    const tauxPertinence = totalFeedback > 0 ? Math.round((confirmes.length / totalFeedback) * 100) : 0;
    const tempsMoyenAction = calculerTempsMoyenAvantAction(allSignaux);

    setText('mgrSignauxActifs', signaux.length);
    setText('mgrNouveauxSignaux', leadsChauds.length);
    setText('mgrLeadsChauds', signauxContactes.length);
    setText('mgrAContacter', opportunitesCrm.length);
    setText('mgrRelancesRetardKpi', relancesRetard.length);
    setText('mgrSignauxActifsInfo', 'Signaux détectés');
    setText('mgrNouveauxInfo', 'Signaux chauds');
    setText('mgrLeadsChaudsInfo', 'Signaux contactés');
    setText('mgrAContacterInfo', 'Créées dans le CRM');
    setText('mgrRelancesRetardInfo', relancesRetard.length ? 'Attention requise' : 'Situation maîtrisée');

    const dailyActifs = [0, 0, 0, 0, 0, 0, 0];
    const dailyNouveaux = [0, 0, 0, 0, 0, 0, 0];
    const dailyChauds = [0, 0, 0, 0, 0, 0, 0];
    const dailyAContacter = [0, 0, 0, 0, 0, 0, 0];
    const dailyRelances = [0, 0, 0, 0, 0, 0, 0];

    signaux.forEach(s => {
      const index = getManagerDateKey(getSignalDate(s));
      if (index === null) return;
      dailyActifs[index]++;
      if (s.statut === 'nouveau') dailyNouveaux[index]++;
      if (s.chaleur === 'chaud') dailyChauds[index]++;
    });

    allSignaux.forEach(s => {
      const contactDate = s.date_a_contacter || (s.statut === 'a_contacter' ? s.date_derniere_action : null);
      if (!isDateInManagerPeriod(contactDate, period)) return;
      const index = getManagerDateKey(contactDate);
      if (index !== null) dailyAContacter[index]++;
    });

    relancesRetard.forEach(s => {
      const index = getManagerDateKey(s.relance_due_at);
      if (index !== null) dailyRelances[index]++;
    });

    const sparkActifs = document.getElementById('mgrSparklineActifs');
    const sparkNouveaux = document.getElementById('mgrSparklineNouveaux');
    const sparkChauds = document.getElementById('mgrSparklineChauds');
    const sparkAContacter = document.getElementById('mgrSparklineAContacter');
    const sparkRelances = document.getElementById('mgrSparklineRelances');

    if (sparkActifs) sparkActifs.innerHTML = renderMiniSparkline(dailyActifs);
    if (sparkNouveaux) sparkNouveaux.innerHTML = renderMiniSparkline(dailyNouveaux);
    if (sparkChauds) sparkChauds.innerHTML = renderMiniSparkline(dailyChauds);
    if (sparkAContacter) sparkAContacter.innerHTML = renderMiniSparkline(dailyAContacter);
    if (sparkRelances) sparkRelances.innerHTML = renderMiniSparkline(dailyRelances);

    // V5.1 — rendu visuel manager premium, sans modifier la logique métier.
    renderManagerEvolutionChart(dailyActifs);
    renderManagerHeatDonut(signaux);

    setText('mgrConfirmes', confirmes.length);
    setText('mgrNonConfirmes', nonConfirmes.length);
    setText('mgrRequalifier', 0);
    setText('mgrTotalFeedback', totalFeedback);
    setText('mgrTauxConfirmation', `${tauxPertinence}%`);
    setText('mgrTauxConfirmationDetail', `${confirmes.length} confirmé(s) / ${totalFeedback} retour(s) · temps moyen action : ${tempsMoyenAction}`);
    setText('mgrQualityBadge', `${totalFeedback} retour${totalFeedback > 1 ? 's' : ''}`);
    setWidth('mgrTauxConfirmationBar', tauxPertinence);

    const pctConfirmes = totalFeedback ? (confirmes.length / totalFeedback) * 100 : 0;
    const pctNonConfirmes = totalFeedback ? (nonConfirmes.length / totalFeedback) * 100 : 0;

    const donutConfirmes = document.getElementById('donutConfirmes');
    const donutRequalifier = document.getElementById('donutRequalifier');
    const donutNonConfirmes = document.getElementById('donutNonConfirmes');

    if (donutConfirmes && donutRequalifier && donutNonConfirmes) {
      donutConfirmes.setAttribute('stroke-dasharray', `${pctConfirmes} 100`);
      donutConfirmes.setAttribute('stroke-dashoffset', '0');

      donutRequalifier.setAttribute('stroke-dasharray', `0 100`);
      donutRequalifier.setAttribute('stroke-dashoffset', `-${pctConfirmes}`);

      donutNonConfirmes.setAttribute('stroke-dasharray', `${pctNonConfirmes} 100`);
      donutNonConfirmes.setAttribute('stroke-dashoffset', `-${pctConfirmes}`);
    }

    const activityByCommercial = new Map();
    allSignaux.forEach(s => {
      const commercialId = s.assigne_a || s.commercial_id || 'non_assigne';
      const current = activityByCommercial.get(commercialId) || {
        id: commercialId,
        label: commerciauxMap.get(commercialId) || (commercialId === 'non_assigne' ? 'Non assigné' : 'Commercial'),
        total: 0,
        chauds: 0,
        contactes: 0,
        confirmes: 0,
        feedbacks: 0
      };
      current.total++;
      if (s.chaleur === 'chaud') current.chauds++;
      if (s.statut === 'a_contacter' || s.date_a_contacter) current.contactes++;
      if (s.feedback_commercial) current.feedbacks++;
      if (s.feedback_commercial === 'interet_confirme') current.confirmes++;
      activityByCommercial.set(commercialId, current);
    });

    const maxActivity = Math.max(...Array.from(activityByCommercial.values()).map(x => x.total), 1);
    const activityRows = Array.from(activityByCommercial.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(item => {
        const rate = item.feedbacks ? Math.round((item.confirmes / item.feedbacks) * 100) : 0;
        const width = Math.round((item.total / maxActivity) * 100);
        return `
          <div class="manager-row">
            <div>
              <div class="manager-row-title">${item.label}</div>
              <div class="manager-row-sub">${item.total} signaux · ${item.chauds} chaud(s) · ${item.contactes} contacté(s)</div>
              <div class="manager-progress"><i style="width:${width}%"></i></div>
            </div>
            <div class="manager-row-score">${rate}%</div>
          </div>`;
      });

    renderManagerRows('mgrActiviteCommerciaux', activityRows, 'Aucune activité équipe sur la période.');

    const sourcesMap = new Map();
    allSignaux.forEach(s => {
      const source = normalizeManagerSource(s);
      const current = sourcesMap.get(source) || { total: 0, confirmes: 0, feedbacks: 0 };
      current.total++;
      if (s.feedback_commercial) current.feedbacks++;
      if (s.feedback_commercial === 'interet_confirme') current.confirmes++;
      sourcesMap.set(source, current);
    });

    const maxSource = Math.max(...Array.from(sourcesMap.values()).map(x => x.total), 1);
    const sourceRows = Array.from(sourcesMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([source, item]) => {
        const width = Math.round((item.total / maxSource) * 100);
        const rate = item.feedbacks ? Math.round((item.confirmes / item.feedbacks) * 100) : 0;
        return `
          <div class="manager-source-row">
            <div>
              <div class="manager-source-title">${source}</div>
              <div class="manager-source-sub">${item.total} signal(aux) · ${rate}% pertinents</div>
              <div class="manager-progress"><i style="width:${width}%"></i></div>
            </div>
            <div class="manager-row-score">${item.total}</div>
          </div>`;
      });

    renderManagerRows('mgrSources', sourceRows, 'Aucune source exploitable sur la période.');

    const topCrmEntries = Array.from(activityByCommercial.values())
      .map(item => ({
        label: item.label,
        value: opportunitesCrm.filter(s => (s.assigne_a || s.commercial_id || 'non_assigne') === item.id).length
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);

    renderManagerBars('mgrTopCrm', topCrmEntries, 'Aucune opportunité CRM créée.');

    const typeMap = new Map();
    signaux.forEach(s => {
      const label = formatManagerTypeLabel(s.type_signal || 'autre');
      typeMap.set(label, (typeMap.get(label) || 0) + 1);
    });

    const totalAngles = Math.max(signaux.length, 1);
    const angleEntries = Array.from(typeMap.entries())
      .map(([label, value]) => ({
        label,
        value,
        detail: `(${safePercent(value, totalAngles)}%)`
      }))
      .sort((a, b) => b.value - a.value);

    renderManagerBars('mgrAngles', angleEntries, 'Aucun angle exploitable sur la période.');

    const suivis = allSignaux.filter(s => s.statut === 'a_suivre');
    const suivisRows = suivis
      .sort((a, b) => new Date(a.relance_due_at || a.date_derniere_action || a.created_at || 0) - new Date(b.relance_due_at || b.date_derniere_action || b.created_at || 0))
      .slice(0, 5)
      .map(s => {
        const prochaineAction = s.relance_due_at ? formatDate(s.relance_due_at) : 'à surveiller';
        return `
          <div class="manager-relance-row">
            <div>
              <div class="manager-relance-title">${managerLabel(s.titre, 'Signal sans titre')}</div>
              <div class="manager-relance-sub">${managerLabel(s.entreprise_nom, 'Entreprise non renseignée')}</div>
            </div>
            <div class="manager-delay">${prochaineAction}</div>
          </div>`;
      });

    setText('mgrASuivreBadge', suivis.length);
    renderManagerRows('mgrASuivre', suivisRows, 'Aucun signal à suivre.');

  } catch (err) {
    console.error('Erreur Dashboard Manager :', err);
  }
}

// =========================
// SCORING LOCAL FLAIR
// =========================

function escapeBackticks(value) {
  return String(value || '').replace(/`/g, "\\`");
}

function badge(label, type) {
  return `<span class="badge badge-${type}">${label}</span>`;
}

function badgeChaleur(chaleur) {
  if (chaleur === 'chaud') return badge('🔥 chaud', 'chaud');
  if (chaleur === 'tiede') return badge('🟠 tiède', 'tiede');
  return badge('❄️ froid', 'froid');
}

function badgeType(type) {
  if (!type) return badge('autre', 'type');

  const labels = {
    appel_offre: 'appel d’offre',
    investissement: 'investissement',
    recrutement: 'recrutement',
    nouvelle_ligne: 'nouvelle ligne',
    qualite_rappel_conso: 'qualité / rappel conso',
    autre: 'autre'
  };

  return badge(labels[type] || type, 'type');
}

function badgeStatut(statut) {
  if (!statut) return '';

  const labels = {
    nouveau: 'nouveau',
    analyse: 'analysé',
    top3: 'top 3',
    a_contacter: 'à contacter',
    a_suivre: 'à suivre',
    historique: 'ignoré',
    traite: 'traité',
    crm_cree: 'CRM créé'
  };

  return badge(labels[statut] || statut, 'statut');
}

function formatFeedback(feedback) {
  if (feedback === 'interet_confirme') {
    return '✅ Confirmé';
  }

  if (feedback === 'interet_non_confirme') {
    return '❌ Non confirmé';
  }

  return feedback || '';
}


function plafonnerScoreParChaleur(score, chaleur) {
  const valeur = Number(score) || 0;

  if (chaleur === 'froid') {
    return Math.min(valeur, 39);
  }

  if (chaleur === 'tiede') {
    return Math.min(valeur, 79);
  }

  if (chaleur === 'chaud') {
    return Math.min(valeur, 100);
  }

  return Math.min(valeur, 100);
}

// FLAIR V1.7 : scoring local et enrichissement source-veille déplacés dans flair-metier.js.

  async function analyserNouveauxSignaux(options = {}) {
    const { silent = false, refresh = true, max = null } = options || {};

    let query = appliquerFiltreCommercial(
      window.FLAIR_DATA_SERVICES.signaux()
        .select('*')
        .eq('statut', 'nouveau')
        .order('created_at', { ascending: false })
    );

    if (max) {
      query = query.limit(max);
    }

    const { data, error } = await query;

  if (error) {
    if (!silent) alert("Erreur chargement signaux : " + error.message);
    return 0;
  }

  if (!data || data.length === 0) {
    if (!silent) alert("Aucun signal nouveau à analyser.");
    return 0;
  }

  let nbAnalyses = 0;

  for (const signal of data) {
    const texteComplet = [
      signal.titre,
      signal.entreprise_nom,
      signal.description,
      signal.contenu,
      signal.resume,
      signal.source,
      signal.type_source
    ].filter(Boolean).join(' ');

    const resultatInitial = scoringLocal(texteComplet, '');

    const resultat = enrichirScoringAvecSourceVeille(
      signal,
      resultatInitial
    );

    const { error: updateError } = await window.FLAIR_DATA_SERVICES.signaux()
      .update({
        score_pertinence: resultat.score_pertinence,
        chaleur: resultat.chaleur,
        type_signal: resultat.type_signal,
        raison_score: resultat.raison_score,
        angle_commercial: resultat.angle_commercial,
        action_recommandee: resultat.action_recommandee,
        traite_par_ia: false,
        statut: 'analyse'
      })
      .eq('id', signal.id);

    if (updateError) {
      console.error("Erreur update signal :", signal.id, updateError);
    } else {
      nbAnalyses++;
    }
  }

  if (refresh) await refreshCockpit();
  if (!silent) alert("Analyse terminée.");
  return nbAnalyses;
}

// =========================
// INVITATIONS MANAGER
// =========================

function invitationStatusLabel(statut) {
  if (statut === 'acceptee') return 'Acceptée';
  if (statut === 'expiree') return 'Expirée';
  return 'En attente';
}

function formatManagerDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('fr-FR');
  } catch (err) {
    return '—';
  }
}
function construireLienInvitation(token) {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?invitation=${token}`;
}

async function copierLienInvitation(token) {
  const lien = construireLienInvitation(token);

  try {
    await navigator.clipboard.writeText(lien);
    alert("Lien d’invitation copié.");
  } catch (err) {
    prompt("Copie ce lien d’invitation :", lien);
  }
}


async function reconcilerInvitationsEquipe(teamId) {
  if (!teamId) return;

  const { data: invitations, error: invitationsError } = await supabaseClient
    .from('invitations')
    .select('*')
    .eq('team_id', teamId)
    .eq('statut', 'en_attente');

  if (invitationsError) {
    console.warn('Réconciliation invitations impossible :', invitationsError.message);
    return;
  }

  const invitationsEnAttente = invitations || [];
  if (!invitationsEnAttente.length) return;

  const emails = invitationsEnAttente
    .map(invitation => normaliserEmail(invitation.email))
    .filter(Boolean);

  if (!emails.length) return;

  const { data: profils, error: profilsError } = await window.FLAIR_DATA_SERVICES.commerciaux()
    .select('*')
    .in('email', emails);

  if (profilsError) {
    console.warn('Réconciliation profils impossible :', profilsError.message);
    return;
  }

  const profilsParEmail = new Map((profils || []).map(profil => [normaliserEmail(profil.email), profil]));

  for (const invitation of invitationsEnAttente) {
    const profil = profilsParEmail.get(normaliserEmail(invitation.email));
    if (!profil?.id || !profil.onboarding_done) continue;

    const payloadInvitation = construirePayloadInvitation(invitation);

    const doitRattacher =
      !profil.team_id ||
      profil.team_id !== invitation.team_id ||
      !profil.region ||
      JSON.stringify(normaliserListeRegionsSecondaires(profil.regions_secondaires)) !== JSON.stringify(normaliserListeRegionsSecondaires(invitation.regions_secondaires)) ||
      !profil.role;

    if (doitRattacher) {
      const { error: updateProfilError } = await window.FLAIR_DATA_SERVICES.commerciaux()
        .update(payloadInvitation)
        .eq('id', profil.id);

      if (updateProfilError) {
        console.warn('Profil non rattaché automatiquement :', updateProfilError.message);
        continue;
      }
    }

    await marquerInvitationAcceptee(invitation);
  }
}

async function chargerInvitations() {
  if (!user || currentProfil?.role !== 'manager') return;

  const teamId = currentProfil?.team_id;
  if (!teamId) {
    alert("Aucune équipe n'est rattachée à ce profil manager.");
    return;
  }

  const teamName = currentProfil?.societe ? `Équipe ${currentProfil.societe}` : 'Équipe commerciale';
  setText('inviteTeamName', teamName);

  await reconcilerInvitationsEquipe(teamId);

  const { data: invitationsData, error: invitationsError } = await supabaseClient
    .from('invitations')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (invitationsError) {
    alert("Erreur chargement invitations : " + invitationsError.message);
    return;
  }

  const { data: commerciauxData, error: commerciauxError } = await window.FLAIR_DATA_SERVICES.commerciaux()
    .select('*')
    .eq('team_id', teamId);

  if (commerciauxError) {
    alert("Erreur chargement équipe : " + commerciauxError.message);
    return;
  }

  // Sécurité UI : même si Supabase renvoie encore des invitations acceptées
  // après une réconciliation ou un cache, le bloc "Invitations en attente"
  // n'affiche que les invitations réellement en_attente.
  const invitations = (invitationsData || []).filter(invitation => invitation.statut === 'en_attente');
  const commerciaux = (commerciauxData || []).filter(c => c.role !== 'manager');

  setText('invitePendingCount', `${invitations.length} invitation${invitations.length > 1 ? 's' : ''}`);
  setText('inviteMembersCount', `${commerciaux.length} membre${commerciaux.length > 1 ? 's' : ''}`);

  const invitationsContainer = document.getElementById('invitePendingList');
  if (invitationsContainer) {
    if (!invitations.length) {
      invitationsContainer.innerHTML = '<div class="manager-empty">Aucune invitation en attente.</div>';
    } else {

  invitationsContainer.innerHTML = invitations.map(invitation => {
  const lienInvitation = construireLienInvitation(invitation.token);

  return `
    <div class="invite-row invite-row-with-link">

      <div>
        <strong>
          ${managerLabel(
            [invitation.prenom, invitation.nom].filter(Boolean).join(' '),
            invitation.email
          )}
        </strong>

        <small>${invitation.email}</small>
        ${invitation.profil_metier ? `<small>Métier : ${labelProfilMetier(invitation.profil_metier)}</small>` : ''}
      </div>

      <div>
        <span class="invite-status">
          ${invitationStatusLabel(invitation.statut)}
        </span>

        <small>
          ${formatManagerDateTime(invitation.created_at)}
        </small>
        ${labelRegionsSecondaires(invitation.regions_secondaires) ? `<small>Secondaires : ${labelRegionsSecondaires(invitation.regions_secondaires)}</small>` : ''}
      </div>

      <button
        class="invite-icon-btn danger"
        title="Supprimer l'invitation"
        onclick="supprimerInvitation('${invitation.id}')">
        ×
      </button>

      <div class="invite-copy-link">
        <span>Lien d’invitation</span>

        <input
          value="${lienInvitation}"
          readonly />
      </div>

    </div>
  `;
}).join('');
    }
  }
         
  const membersContainer = document.getElementById('inviteMembersList');
  if (membersContainer) {
    if (!commerciaux.length) {
      membersContainer.innerHTML = '<div class="manager-empty">Aucun commercial rattaché pour le moment.</div>';
    } else {
      membersContainer.innerHTML = commerciaux.map(commercial => `
        <div class="invite-row invite-member-row">
          <div>
            <strong>${commercialDisplayName(commercial)}</strong>
            <small>${commercial.email || 'Email non renseigné'}</small>
            ${commercial.profil_metier ? `<small>Métier : ${labelProfilMetier(commercial.profil_metier)}</small>` : ''}
          </div>
          <div style="justify-self:end;text-align:right;min-width:210px;">
            <span class="invite-status active">Actif</span>
            <small>${labelRegionCommerciale(commercial.region || '')}</small>
            ${labelRegionsSecondaires(commercial.regions_secondaires) ? `<small>Secondaires : ${labelRegionsSecondaires(commercial.regions_secondaires)}</small>` : ''}
          </div>
        </div>
      `).join('');
    }
  }
}

async function envoyerInvitation() {
  if (!user || currentProfil?.role !== 'manager') {
    alert("Seul un manager peut inviter un commercial.");
    return;
  }

  const teamId = currentProfil?.team_id;
  if (!teamId) {
    alert("Aucune équipe n'est rattachée à ce profil manager.");
    return;
  }

  const email = document.getElementById('inviteEmail')?.value.trim().toLowerCase();
  const prenom = document.getElementById('invitePrenom')?.value.trim();
  const nom = document.getElementById('inviteNom')?.value.trim();
  const fonction = document.getElementById('inviteFonction')?.value || 'commercial_industrie';
  const profilMetier = document.getElementById('inviteProfilMetier')?.value || '';
  const region = document.getElementById('inviteRegion')?.value || currentProfil?.region || '';
  const regionsSecondaires = Array.from(document.getElementById('inviteRegionsSecondaires')?.selectedOptions || [])
    .map(option => option.value)
    .filter(value => value && value !== region);

  if (!email) {
    alert("Merci d’indiquer l’email du commercial à inviter.");
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  const invitationToken = crypto.randomUUID();

  const { error } = await supabaseClient
    .from('invitations')
    .insert([{
      team_id: teamId,
      manager_id: user.id,
      email,
      prenom,
      nom,
      fonction,
      profil_metier: profilMetier,
      region,
      regions_secondaires: regionsSecondaires,
      role: roleDepuisFonction(fonction),
      token: invitationToken,
      statut: 'en_attente',
      expires_at: expiresAt.toISOString()
    }]);

  if (error) {
    alert("Erreur invitation : " + error.message);
    return;
  }

  ['inviteEmail', 'invitePrenom', 'inviteNom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const regionsSecondairesSelect = document.getElementById('inviteRegionsSecondaires');
  if (regionsSecondairesSelect) {
    Array.from(regionsSecondairesSelect.options).forEach(option => { option.selected = false; });
  }

  await chargerInvitations();
  alert("Invitation enregistrée.");
}

async function supprimerInvitation(invitationId) {
  if (!invitationId) return;

  const confirmation = confirm("Supprimer cette invitation ?");
  if (!confirmation) return;

  const { error } = await supabaseClient
    .from('invitations')
    .delete()
    .eq('id', invitationId);

  if (error) {
    alert("Erreur suppression invitation : " + error.message);
    return;
  }

  await chargerInvitations();
}


// =========================
// EXPOSER LES FONCTIONS AUX BOUTONS HTML
// =========================

async function initUserSousDoctrine(...args) {
  if (!window.FLAIR_DOCTRINE_READY) {
    throw new Error('Module flair-doctrine-loader.js absent.');
  }
  await window.FLAIR_DOCTRINE_READY;
  if (!window.FLAIR_DOCTRINE_STATUS?.valide || !window.FLAIR_DOCTRINE) {
    throw new Error('Doctrine FLAIR V2026.2 invalide.');
  }
  return initUser(...args);
}

if (window.FLAIR_CONFIG?.setAuthContext) {
  window.FLAIR_CONFIG.setAuthContext({
    getInvitationCourante: () => invitationCourante,
    setUser: (authUser) => { user = authUser; },
    initUser: initUserSousDoctrine,
    normaliserEmail,
    invitationCorrespondUtilisateur
  });
}

window.resetPassword = window.FLAIR_CONFIG?.resetPassword;
window.togglePasswordVisibility = window.FLAIR_CONFIG?.togglePasswordVisibility;
window.signUp = window.FLAIR_CONFIG?.signUp;
window.signIn = window.FLAIR_CONFIG?.signIn;
window.logout = window.FLAIR_CONFIG?.logout;
window.chargerSignaux = chargerSignaux;
window.chargerTop3 = chargerTop3;
window.chargerAContacter = chargerAContacter;
window.chargerHistorique = chargerHistorique;
window.ajouterSignal = ajouterSignal;
window.analyserNouveauxSignaux = analyserNouveauxSignaux;
window.changerStatut = changerStatut;
window.enregistrerFeedback = enregistrerFeedback;
window.marquerOpportuniteCrm = marquerOpportuniteCrm;
window.copierSignalPourCrm = copierSignalPourCrm;
window.exporterSignalPourCsv = exporterSignalPourCsv;
window.chargerListeOpportunitesCommerciales = chargerListeOpportunitesCommerciales;
window.exporterListeOpportunitesCommerciales = exporterListeOpportunitesCommerciales;
window.exporterListeOpportunitesManager = exporterListeOpportunitesManager;
window.copierCoordonneesPubliques = copierCoordonneesPubliques;
window.chercherNouvellesOpportunitesIA = chercherNouvellesOpportunitesIA;
window.afficherVue = afficherVue;
window.envoyerInvitation = envoyerInvitation;
window.supprimerInvitation = supprimerInvitation;
window.copierLienInvitation = copierLienInvitation;

// =========================
// SESSION AUTO AU CHARGEMENT
// =========================

async function initialiserFlairSousDoctrine() {
  try {
    if (!window.FLAIR_DOCTRINE_READY) {
      throw new Error('Module flair-doctrine-loader.js absent.');
    }
    await window.FLAIR_DOCTRINE_READY;

    if (!window.FLAIR_DOCTRINE_STATUS?.valide || !window.FLAIR_DOCTRINE) {
      throw new Error('Doctrine FLAIR V2026.2 invalide.');
    }

    if (window.FLAIR_CONFIG?.initFlairSession) {
      window.FLAIR_CONFIG.initFlairSession({
        chargerInvitationDepuisUrl,
        getInvitationCourante: () => invitationCourante,
        setUser: (authUser) => { user = authUser; },
        initUser: initUserSousDoctrine
      });
    }
  } catch (error) {
    console.error('Initialisation FLAIR bloquée par la doctrine :', error);
    const message = `FLAIR ne peut pas démarrer : ${error?.message || error}`;
    const auth = document.getElementById('auth');
    if (auth) {
      auth.style.display = 'block';
      const erreurDoctrine = document.createElement('p');
      erreurDoctrine.className = 'flair-doctrine-error';
      erreurDoctrine.textContent = message;
      auth.prepend(erreurDoctrine);
    } else {
      alert(message);
    }
  }
}

initialiserFlairSousDoctrine();


if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof synchroniserImportSignalMeta === 'function') synchroniserImportSignalMeta();
  });
}
