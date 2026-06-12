
async function resetPassword() {
  const email = document.getElementById('email').value.trim();
  if (!email) {
    alert('Veuillez saisir votre email avant de réinitialiser le mot de passe.');
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (error) {
    alert('Erreur réinitialisation : ' + error.message);
    return;
  }

  alert("Un email de réinitialisation vient d’être envoyé.");
}

function togglePasswordVisibility() {
  const input = document.getElementById('password');
  const btn = document.querySelector('.toggle-password-btn');
  if (!input) return;

  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';

  if (btn) {
    btn.classList.toggle('is-visible', isHidden);
    btn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    btn.setAttribute('title', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  }
}
const SUPABASE_URL = "https://viafuquomtshuzuldwpq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYWZ1cXVvbXRzaHV6dWxkd3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTkyODUsImV4cCI6MjA5MzQ3NTI4NX0.KtUZPsG04HF0AtdTCwYLyaH8IFBI2BBELIageV2xiM8";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let user = null;
let currentProfil = null;
let invitationCourante = null;

// =========================
// DOCTRINE MÉTIER FLAIR
// =========================
// FLAIR détecte, score, priorise et déclenche l'action.
// Le CRM gère ensuite la relation commerciale.
// Objectif : gestion de l'attention commerciale, sans logique CRM lourde.
// Feedback discret uniquement après passage en À contacter : confirme, non_confirme.
// Le CRM reste externe ; FLAIR peut seulement marquer qu'une opportunité CRM a été créée.

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
    'responsable_grands_comptes',
    'direction_commerciale'
  ].includes(fonction) ? 'manager' : 'commercial';
}

function roleDepuisInvitation(invitation) {
  if (!invitation) return null;
  return invitation.role || roleDepuisFonction(invitation.fonction || 'commercial_industrie');
}

function normaliserListeRegionsSecondaires(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean);
  }

  return String(value || '')
    .split(/[,;|]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function labelRegionCommerciale(value) {
  const labels = {
    grand_est: 'Grand Est',
    ile_de_france: 'Île-de-France',
    hauts_de_france: 'Hauts-de-France',
    bourgogne_franche_comte: 'Bourgogne-Franche-Comté',
    auvergne_rhone_alpes: 'Auvergne-Rhône-Alpes',
    nouvelle_aquitaine: 'Nouvelle-Aquitaine',
    occitanie: 'Occitanie',
    paca: 'PACA',
    bretagne: 'Bretagne',
    normandie: 'Normandie',
    pays_de_la_loire: 'Pays de la Loire',
    centre_val_de_loire: 'Centre-Val de Loire',
    corse: 'Corse',
    france: 'France entière'
  };

  return labels[value] || managerLabel(String(value || '').replaceAll('_', ' '), 'Non renseignée');
}

function labelRegionsSecondaires(value) {
  const regions = normaliserListeRegionsSecondaires(value);
  if (!regions.length) return '';
  return regions.map(labelRegionCommerciale).join(', ');
}

function labelProfilMetier(value) {
  const labels = {
    pesage: 'Pesage / étiquetage industriel',
    detection: 'Détection / contrôle qualité',
    vision: 'Vision industrielle / contrôle qualité',
    packaging: 'Packaging / films / étiquettes',
    process: 'Process agroalimentaire',
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

    packaging: 'packaging',
    emballage: 'packaging',
    conditionnement: 'packaging',

    vision: 'vision',
    vision_industrielle: 'vision',
    controle_vision: 'vision',

    process: 'process',
    convoyage: 'process',
    fin_de_ligne: 'process',
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
// AUTH
// =========================

async function signUp() {
  const email = normaliserEmail(document.getElementById('email').value);
  const password = document.getElementById('password').value.trim();

  if (invitationCourante && normaliserEmail(invitationCourante.email) !== email) {
    alert("Merci d'utiliser l'email associé à cette invitation.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({ email, password });

  if (error) {
    alert("Erreur création compte : " + error.message);
    return;
  }

  if (data?.user && data?.session) {
    user = data.user;
    await initUser();
    return;
  }

  alert("Compte créé. Vous pouvez maintenant vous connecter.");
}

async function signIn() {
  const email = normaliserEmail(document.getElementById('email').value);
  const password = document.getElementById('password').value.trim();

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    alert("Erreur connexion : " + error.message);
    return;
  }

  user = data.user;
  await initUser();
}

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

async function initUser() {
  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "none";
  document.getElementById('onboardingMetier').style.display = "none";

  const { data, error } = await supabaseClient
    .from('commerciaux')
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
    const { data: insertedProfil, error: insertError } = await supabaseClient
      .from('commerciaux')
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
      const { data: updatedProfil, error: updateError } = await supabaseClient
        .from('commerciaux')
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
    afficherOnboardingMetier(profil);
    return;
  }

  currentProfil = await reparerEquipeManagerSiNecessaire(profil);
  chargerProfilMetier(currentProfil.profil_metier || 'pesage');
  afficherApplication();
}

function afficherOnboardingMetier(profil = {}) {
  document.body.classList.add('onboarding-mode');
  document.body.classList.remove('cockpit-mode', 'manager-mode');

  document.getElementById('auth').style.display = "none";
  document.getElementById('app').style.display = "none";
  document.getElementById('onboardingMetier').style.display = "flex";

  const invitationLanding = document.getElementById('invitationLanding');
  if (invitationLanding) invitationLanding.style.display = 'none';

  document.getElementById('onboardingPrenom').value = profil.prenom || invitationCourante?.prenom || '';
  document.getElementById('onboardingNom').value = profil.nom || invitationCourante?.nom || '';
  document.getElementById('onboardingSociete').value = profil.societe || invitationCourante?.societe || invitationCourante?.team_nom || '';
  document.getElementById('onboardingProfilMetier').value = profil.profil_metier || invitationCourante?.profil_metier || 'pesage';
  document.getElementById('onboardingFonction').value = profil.fonction || invitationCourante?.fonction || 'commercial_industrie';

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
      onboardingText.textContent =
        `Configurez votre environnement métier afin que FLAIR détecte les signaux les plus pertinents pour votre activité dans la région : ${labelRegionCommerciale(regionValue)}`;
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

  document.querySelectorAll('[data-manager-only]').forEach(el => {
  el.style.display = isManager ? '' : 'none';
});

if (isManager) {
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

  const { data: profilMaj, error: updateError } = await supabaseClient
    .from('commerciaux')
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

  const { data: profilActuel } = await supabaseClient
    .from('commerciaux')
    .select('team_id, role')
    .eq('id', user.id)
    .maybeSingle();

  const payloadInvitation = construirePayloadInvitation(invitationCourante);

  // Sécurité : si le profil existe déjà en base avec un team_id, on le conserve.
  if (!payloadInvitation.team_id && profilActuel?.team_id) {
    payloadInvitation.team_id = profilActuel.team_id;
  }

  console.log("Invitation onboarding :", invitationCourante);
  console.log("Payload invitation :", payloadInvitation);

  if (role === 'commercial' && !payloadInvitation.team_id) {
    alert("Invitation introuvable ou équipe non rattachée. Merci de demander une nouvelle invitation à votre manager.");
    return;
  }

  const profilPayload = {
    prenom,
    nom,
    societe,
    profil_metier,
    fonction,
    region,
    role,
    onboarding_done: true,
    ...payloadInvitation
  };

  if (role === 'manager' && !profilPayload.team_id) {
    const teamId = await garantirEquipeManagerPourProfil(profilPayload);
    if (!teamId) return;
    profilPayload.team_id = teamId;
  }

  const { data: updatedProfil, error } = await supabaseClient
    .from('commerciaux')
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
  const sectionValide = ['main', 'actifs', 'historique'].includes(section) ? section : 'main';

  document.querySelectorAll('[data-cockpit-section]').forEach(el => {
    el.style.display = el.dataset.cockpitSection === sectionValide ? '' : 'none';
  });

  document.querySelectorAll('[data-cockpit-section-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cockpitSectionBtn === sectionValide);
  });

  if (sectionValide === 'actifs') {
    chargerSignaux();
  }

  if (sectionValide === 'historique') {
    chargerHistorique();
  }
}

async function afficherVue(vue) {
  const cockpitView = document.getElementById('cockpitView');
  const managerView = document.getElementById('managerView');
  const invitationsView = document.getElementById('invitationsView');
  const btnCockpit = document.getElementById('btnCockpit');
  const btnManager = document.getElementById('btnManager');

  if (!cockpitView || !managerView) return;

  const isManagerView = vue === 'manager';
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

  document.body.classList.toggle('manager-mode', !isCockpitView);
  document.body.classList.toggle('cockpit-mode', isCockpitView);

  if (isCockpitView) {
    afficherSectionCockpit('main');
  }

  if (isManagerView) {
    await chargerDashboardManager();
  }

  if (isInvitationsView) {
    await chargerInvitations();
  }
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

  let query = supabaseClient
    .from('signaux_commerciaux')
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

  const { data, error } = await supabaseClient
    .from('signaux_commerciaux')
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

  const { data: distribution, error: distError } = await supabaseClient
    .from('signaux_commerciaux')
    .select('*, signal:signaux(*)')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  if (!distError && distribution?.signal) {
    return { data: normaliserDistributionSignal(distribution), error: null };
  }

  const { data, error } = await supabaseClient
    .from('signaux')
    .select('*')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  return { data, error };
}

async function lireChaleurSignalPourAction(signalIdOuDistributionId) {
  const { data: distribution, error: distError } = await supabaseClient
    .from('signaux_commerciaux')
    .select('id, signal:signaux(chaleur)')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  if (!distError && distribution?.id) {
    return {
      table: 'signaux_commerciaux',
      chaleur: distribution.signal?.chaleur || ''
    };
  }

  const { data, error } = await supabaseClient
    .from('signaux')
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
  const { data: distribution, error: distReadError } = await supabaseClient
    .from('signaux_commerciaux')
    .select('id')
    .eq('id', signalIdOuDistributionId)
    .maybeSingle();

  if (!distReadError && distribution?.id) {
    const { error } = await supabaseClient
      .from('signaux_commerciaux')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', signalIdOuDistributionId);
    return error;
  }

  const { error } = await supabaseClient
    .from('signaux')
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
    const { data, error } = await supabaseClient
      .from('commerciaux')
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

    const { data: profilRepare, error: repairError } = await supabaseClient
      .from('commerciaux')
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

function extraireRegionDepuisSignalTexte(s = {}) {
  const texte = [
    s.titre,
    s.entreprise_nom,
    s.description,
    s.contenu,
    s.resume,
    s.texte_original
  ].filter(Boolean).join('\n');

  const match = String(texte || '').match(
    /(?:^|[\n\r])\s*(?:r[eé]gion|region|zone)\s*[:：]\s*([^\n\r|]+)/i
  );

  if (!match) return '';

  return normaliserRegionImport(match[1]);
}

function signalRegion(s) {
  const regionDirecte = s.region_nom || s.region || s.region_signal || s.zone || extraireRegionDepuisSignalTexte(s) || '';
  if (regionDirecte) return normaliserRegionImport(regionDirecte);

  const texteLibre = [
    s.titre,
    s.entreprise_nom,
    s.description,
    s.texte_original,
    s.raison_score,
    s.angle_commercial,
    s.action_recommandee
  ].filter(Boolean).join(' ');

  const regionInferree = extraireRegionImportDepuisTexte(texteLibre);
  const geographie = normaliserGeographieImport(regionInferree);
  return geographie.region_nom || regionInferree || '';
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
      ${signalCompany(s)}<br>

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

      ${s.raison_score ? `<small><b>Pourquoi c’est important :</b> ${s.raison_score}</small><br>` : ''}
      ${s.angle_commercial ? `<small><b>Opportunité commerciale :</b> ${s.angle_commercial}</small><br>` : ''}
      ${s.action_recommandee ? `<small><b>Action conseillée :</b> ${s.action_recommandee}</small><br>` : ''}
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
   supabaseClient
      .from('signaux')
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
    supabaseClient
      .from('signaux')
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
    supabaseClient
      .from('signaux')
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
      const { error: updateDistError } = await supabaseClient
        .from('signaux_commerciaux')
        .update({ statut: 'top3', updated_at: nowIso })
        .in('id', distributions.map(signal => signal.id));

      if (updateDistError) {
        alert("Erreur actualisation Top 3 : " + updateDistError.message);
        return;
      }
    }

    if (signauxHistoriques.length) {
      const { error: updateError } = await supabaseClient
        .from('signaux')
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
    supabaseClient
      .from('signaux')
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

async function chargerHistorique() {
  if (!user) return;

  const container = document.getElementById('historique');
  if (!container) return;

  const distributions = await lireDistributionsCommerciales({ statuts: ['a_suivre', 'historique'], limit: 30 });

    let query = appliquerFiltreCommercial(
    supabaseClient
      .from('signaux')
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

function normaliserTexteSimple(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-–—]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function nettoyerValeurImport(value) {
  return String(value || '')
    .replace(/^[-•\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraireChampStructure(texte, libelles) {
  const lignes = String(texte || '').split(/\r?\n/);
  const labels = libelles.map(normaliserTexteSimple);

  for (const ligne of lignes) {
    const index = ligne.search(/[:：]/);
    if (index === -1) continue;

    const label = normaliserTexteSimple(ligne.slice(0, index));
    const valeur = nettoyerValeurImport(ligne.slice(index + 1));

    if (labels.some(l => label === l || label.startsWith(l))) {
      return valeur;
    }
  }

  return '';
}

function normaliserRegionImport(value) {
  let region = nettoyerValeurImport(value);

  // Sécurité import FLAIR :
  // Si le texte collé est sur une seule ligne, la valeur après "Région :"
  // peut embarquer la suite du diagnostic métier. On coupe uniquement l'excédent
  // pour conserver une région courte et laisser Pourquoi / Opportunité / Action
  // dans leurs champs dédiés.
  const separateursMetier = [
    /\s+pourquoi\s+c['’]est\s+important\s*[:：-]?/i,
    /\s+opportunit[eé]\s+commerciale\s*[:：-]?/i,
    /\s+action\s+(?:rapide\s+)?conseill[eé]e\s*[:：-]?/i,
    /\s+l['’]entreprise\s+/i,
    /\s+projet\s+industriel\s+/i,
    /\s+signal\s+(?:directement\s+)?/i,
    /\s+se\s+positionner\s+/i,
    /\s+identifier\s+/i,
    /\s+contacter\s+/i,
    /\s+date\s*[:：-]/i,
    /\s+score\s*[:：-]/i,
    /\s+type\s*[:：-]/i,
    /\s+entreprise\s*[:：-]/i
  ];

  let coupeIndex = -1;
  separateursMetier.forEach(regex => {
    const match = region.match(regex);
    if (match && match.index !== undefined) {
      coupeIndex = coupeIndex === -1 ? match.index : Math.min(coupeIndex, match.index);
    }
  });

  if (coupeIndex > 0) {
    region = region.slice(0, coupeIndex);
  }

  return region
    .replace(/\s*[.;,]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Référentiel léger côté client pour normaliser les zones prioritaires FLAIR.
// La table Supabase departements reste la référence base ; ce tableau permet
// de structurer immédiatement les imports sans appel supplémentaire.
const FLAIR_DEPARTEMENTS_REFERENCE = [
  { region: 'Bretagne', nom: 'Côtes-d\'Armor', code: '22', alias: ['cotes d armor', 'cotes-d armor', 'côtes d armor'] },
  { region: 'Bretagne', nom: 'Finistère', code: '29', alias: ['finistere'] },
  { region: 'Bretagne', nom: 'Ille-et-Vilaine', code: '35', alias: ['ille et vilaine'] },
  { region: 'Bretagne', nom: 'Morbihan', code: '56', alias: [] },

  { region: 'Normandie', nom: 'Calvados', code: '14', alias: [] },
  { region: 'Normandie', nom: 'Eure', code: '27', alias: [] },
  { region: 'Normandie', nom: 'Manche', code: '50', alias: ['la manche'] },
  { region: 'Normandie', nom: 'Orne', code: '61', alias: [] },
  { region: 'Normandie', nom: 'Seine-Maritime', code: '76', alias: ['seine maritime'] },

  { region: 'Pays de la Loire', nom: 'Loire-Atlantique', code: '44', alias: ['loire atlantique'] },
  { region: 'Pays de la Loire', nom: 'Maine-et-Loire', code: '49', alias: ['maine et loire'] },
  { region: 'Pays de la Loire', nom: 'Mayenne', code: '53', alias: [] },
  { region: 'Pays de la Loire', nom: 'Sarthe', code: '72', alias: [] },
  { region: 'Pays de la Loire', nom: 'Vendée', code: '85', alias: ['vendee'] },

  { region: 'Hauts-de-France', nom: 'Aisne', code: '02', alias: [] },
  { region: 'Hauts-de-France', nom: 'Nord', code: '59', alias: [] },
  { region: 'Hauts-de-France', nom: 'Oise', code: '60', alias: [] },
  { region: 'Hauts-de-France', nom: 'Pas-de-Calais', code: '62', alias: ['pas de calais'] },
  { region: 'Hauts-de-France', nom: 'Somme', code: '80', alias: [] },

  { region: 'Grand Est', nom: 'Ardennes', code: '08', alias: [] },
  { region: 'Grand Est', nom: 'Aube', code: '10', alias: [] },
  { region: 'Grand Est', nom: 'Marne', code: '51', alias: [] },
  { region: 'Grand Est', nom: 'Haute-Marne', code: '52', alias: ['haute marne'] },
  { region: 'Grand Est', nom: 'Meurthe-et-Moselle', code: '54', alias: ['meurthe et moselle'] },
  { region: 'Grand Est', nom: 'Meuse', code: '55', alias: [] },
  { region: 'Grand Est', nom: 'Moselle', code: '57', alias: [] },
  { region: 'Grand Est', nom: 'Bas-Rhin', code: '67', alias: ['bas rhin'] },
  { region: 'Grand Est', nom: 'Haut-Rhin', code: '68', alias: ['haut rhin'] },
  { region: 'Grand Est', nom: 'Vosges', code: '88', alias: [] },

  { region: 'Occitanie', nom: 'Ariège', code: '09', alias: ['ariege'] },
  { region: 'Occitanie', nom: 'Aude', code: '11', alias: [] },
  { region: 'Occitanie', nom: 'Aveyron', code: '12', alias: [] },
  { region: 'Occitanie', nom: 'Gard', code: '30', alias: [] },
  { region: 'Occitanie', nom: 'Haute-Garonne', code: '31', alias: ['haute garonne'] },
  { region: 'Occitanie', nom: 'Gers', code: '32', alias: [] },
  { region: 'Occitanie', nom: 'Hérault', code: '34', alias: ['herault'] },
  { region: 'Occitanie', nom: 'Lot', code: '46', alias: [] },
  { region: 'Occitanie', nom: 'Lozère', code: '48', alias: ['lozere'] },
  { region: 'Occitanie', nom: 'Hautes-Pyrénées', code: '65', alias: ['hautes pyrenees'] },
  { region: 'Occitanie', nom: 'Pyrénées-Orientales', code: '66', alias: ['pyrenees orientales'] },
  { region: 'Occitanie', nom: 'Tarn', code: '81', alias: [] },
  { region: 'Occitanie', nom: 'Tarn-et-Garonne', code: '82', alias: ['tarn et garonne'] }
];

const FLAIR_REGIONS_REFERENCE = [
  'Bretagne',
  'Normandie',
  'Pays de la Loire',
  'Hauts-de-France',
  'Grand Est',
  'Occitanie'
];

function normaliserCleGeographie(value) {
  return normaliserTexteSimple(value)
    .replace(/['’]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trouverRegionReference(value) {
  const cle = normaliserCleGeographie(value);
  if (!cle) return '';

  const aliasRegions = [
    { region: 'Grand Est', alias: ['alsace', 'lorraine', 'champagne ardenne', 'champagne-ardenne'] },
    { region: 'Bretagne', alias: ['vannes', 'lorient', 'rennes', 'brest', 'quimper', 'saint brieuc', 'saint-brieuc'] },
    { region: 'Hauts-de-France', alias: ['hauts de france', 'nord pas de calais', 'nord-pas-de-calais', 'picardie'] },
    { region: 'Pays de la Loire', alias: ['pays de loire', 'nantes', 'angers', 'le mans', 'laval', 'la roche sur yon'] },
    { region: 'Normandie', alias: ['rouen', 'caen', 'le havre', 'evreux', 'évreux'] },
    { region: 'Occitanie', alias: ['toulouse', 'montpellier', 'perpignan', 'nimes', 'nîmes'] }
  ];

  const aliasMatch = aliasRegions.find(item =>
    item.alias.some(alias => {
      const aliasCle = normaliserCleGeographie(alias);
      return cle === aliasCle || cle.includes(aliasCle);
    })
  );

  if (aliasMatch) return aliasMatch.region;

  return FLAIR_REGIONS_REFERENCE.find(region => {
    const regionCle = normaliserCleGeographie(region);
    return cle === regionCle || cle.includes(regionCle) || regionCle.includes(cle);
  }) || '';
}

function trouverDepartementReference(value) {
  const cle = normaliserCleGeographie(value);
  if (!cle) return null;

  return FLAIR_DEPARTEMENTS_REFERENCE.find(dep => {
    const noms = [dep.nom, dep.code, ...(dep.alias || [])];
    return noms.some(nom => {
      const depCle = normaliserCleGeographie(nom);
      return cle === depCle || cle.includes(depCle) || depCle.includes(cle);
    });
  }) || null;
}

function contientTermeGeographiqueStrict(texteNormalise, terme) {
  const cle = normaliserCleGeographie(terme);
  const texte = ` ${normaliserCleGeographie(texteNormalise)} `;
  if (!cle) return false;

  // Les codes départements doivent être isolés, pour éviter de détecter 27 dans 2027.
  if (/^\d{2,3}$/.test(cle)) {
    return new RegExp(`(?:^|\\D)${cle}(?:\\D|$)`).test(texte);
  }

  // Les départements courts comme Eure, Lot, Gard ou Nord doivent être des mots complets.
  // Cela évite les faux positifs du type "heure" => Eure ou "copilote" => Lot.
  return new RegExp(`(^|\\s)${cle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`).test(texte);
}


function contientDepartementFiableDepuisTexte(texteNormalise, dep = {}) {
  const texte = ` ${normaliserCleGeographie(texteNormalise)} `;
  const noms = [dep.nom, ...(dep.alias || [])].map(normaliserCleGeographie).filter(Boolean);
  const code = String(dep.code || '').trim();

  if (code && new RegExp(`(?:^|\\D)${code}(?:\\D|$)`).test(texte)) {
    return true;
  }

  return noms.some(nom => {
    const escaped = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const motComplet = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`).test(texte);
    if (!motComplet) return false;

    // Les noms courts ou ambigus doivent être accompagnés d'un contexte géographique.
    // Exemples acceptés : "dans l'Eure", "département du Lot", "(Tarn)", "Tarn (81)".
    const courtOuAmbigu = nom.length <= 5;
    if (!courtOuAmbigu) return true;

    const contexteAvant = new RegExp(`(?:dans|en|du|de|d|departement|département|dept|dep|\\(|,|/)\\s+(?:l\\s+|le\\s+|la\\s+|les\\s+)?${escaped}(?=\\s|\\)|,|\\.|$)`).test(texte);
    const contexteApresCode = code ? new RegExp(`${escaped}\\s*\\(?\\s*${code}\\s*\\)?`).test(texte) : false;
    return contexteAvant || contexteApresCode;
  });
}

function normaliserGeographieImport(value) {
  // Sécurité FLAIR V3.2 : une géographie absente ou non textuelle doit rester neutre.
  // On évite toute déduction hasardeuse et tout crash sur split/trim/toLowerCase.
  if (!value || typeof value !== 'string') {
    return {
      region_nom: 'Non déterminée',
      departement_nom: '',
      departement_code: '',
      valide: false
    };
  }

  const brut = normaliserRegionImport(value);
  if (!brut) {
    return {
      region_nom: 'Non déterminée',
      departement_nom: '',
      departement_code: '',
      valide: false
    };
  }

  const morceaux = brut
    .split(/\s*(?:\/|\||;|,|\bet\b|\(|\)|-)\s*/i)
    .map(part => nettoyerValeurImport(part))
    .filter(Boolean);

  const regionDirecte = trouverRegionReference(brut);
  const departementDirect = trouverDepartementReference(brut);
  let regionNom = regionDirecte || departementDirect?.region || '';
  let departementNom = departementDirect?.nom || '';
  let departementCode = departementDirect?.code || '';

  morceaux.forEach(part => {
    const region = trouverRegionReference(part);
    const departement = trouverDepartementReference(part);

    if (!regionNom && region) regionNom = region;
    if (!departementNom && departement) {
      departementNom = departement.nom;
      departementCode = departement.code;
      if (!regionNom) regionNom = departement.region;
    }
  });

  // Sécurité FLAIR V2 : si aucune région/département fiable n'est détecté,
  // on ne transforme pas le texte libre en région. La géographie restera neutre.

  return {
    region_nom: regionNom || 'Non déterminée',
    departement_nom: departementNom,
    departement_code: departementCode,
    valide: Boolean(regionNom || departementNom || departementCode)
  };
}

function signalDepartement(s) {
  const region = normaliserTexteSimple(signalRegion(s) || s.region_nom || s.region || '');

  // Un signal national / France entière ne doit pas hériter par erreur d'un département
  // détecté dans un mot parasite (ex : "copilote" pouvant contenir "lot").
  if (estRegionNationaleFlair(region)) {
    return '';
  }

  let nom = s.departement_nom || s.departement || '';
  let code = s.departement_code || '';

  if (!nom && !code) {
    const texteLibre = [
      s.titre,
      s.entreprise_nom,
      s.description,
      s.texte_original
    ].filter(Boolean).join(' ');

    const regionInferree = extraireRegionImportDepuisTexte(texteLibre);
    const geographie = normaliserGeographieImport(regionInferree);
    nom = geographie.departement_nom || '';
    code = geographie.departement_code || '';
  }

  if (nom && code) return `${nom} (${code})`;
  return nom || code || '';
}

function extraireRegionImportDepuisTexte(texte) {
  const contenu = String(texte || '');

  const regionStructuree = extraireChampStructure(contenu, [
    'Région',
    'Region',
    'Zone',
    'Localisation',
    'Territoire'
  ]);

  if (regionStructuree) return normaliserRegionImport(regionStructuree);

  const match = contenu.match(/(?:^|\n|\r)\s*(?:r[eé]gion|region|zone)\s*[:：-]\s*([^\n\r]+)/i);
  if (match) return normaliserRegionImport(match[1]);

  // Déduction automatique STRICTE depuis le texte libre.
  // Pas de dictionnaire de sites : FLAIR ne doit pas maintenir des milliers d'usines.
  // On ne retient que les régions et départements explicitement écrits dans le signal.
  const texteNormalise = normaliserCleGeographie(contenu);

  const departementTrouve = FLAIR_DEPARTEMENTS_REFERENCE.find(dep =>
    contientDepartementFiableDepuisTexte(texteNormalise, dep)
  );

  if (departementTrouve) return departementTrouve.nom;

  const regionTrouvee = FLAIR_REGIONS_REFERENCE.find(region =>
    contientTermeGeographiqueStrict(texteNormalise, region)
  );

  return regionTrouvee || '';
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

function regionsCommercialesPreparees() {
  const regionPrincipale = currentProfil?.region || '';
  const regionsSecondaires = currentProfil?.regions_secondaires || currentProfil?.regionsSecondaires || [];
  const listeSecondaire = Array.isArray(regionsSecondaires)
    ? regionsSecondaires
    : String(regionsSecondaires || '').split(/[,;|]/);

  return [regionPrincipale, ...listeSecondaire]
    .map(r => normaliserTexteSimple(r))
    .filter(Boolean);
}

function estRegionNationaleFlair(value) {
  const region = normaliserTexteSimple(value);
  if (!region) return false;

  return [
    'france',
    'france entiere',
    'toute france',
    'national',
    'nationale',
    'multi sites',
    'multisites',
    'multi site',
    'toutes regions',
    'toutes les regions'
  ].includes(region);
}

function signalDansPerimetreRegionPrepare(signal) {
  const regions = regionsCommercialesPreparees();
  if (!regions.length) return true;

  const regionSignal = normaliserTexteSimple(signalRegion(signal));
  if (!regionSignal || regionSignal === 'non determinee' || regionSignal === 'non renseignee') return true;

  // FLAIR : un signal national ou multi-sites doit pouvoir être proposé
  // à tous les commerciaux, quelle que soit leur région.
  if (estRegionNationaleFlair(regionSignal)) return true;

  // Sécurité symétrique : si un commercial est paramétré "France entière",
  // il peut recevoir les signaux de toutes les régions.
  if (regions.some(estRegionNationaleFlair)) return true;

  return regions.some(regionCommerciale =>
    regionSignal.includes(regionCommerciale) || regionCommerciale.includes(regionSignal)
  );
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

  const familles = famillesProjetsFlair();
  let meilleureFamille = null;
  let meilleurScore = 0;

  Object.entries(familles).forEach(([id, config]) => {
    const keywords = Array.isArray(config) ? config : (config.keywords || []);
    let score = 0;

    keywords.forEach(keyword => {
      const cle = normaliserTexteAntiDoublon(keyword);
      if (cle && contenu.includes(cle)) score += Math.max(1, cle.split(' ').length);
    });

    if (score > meilleurScore) {
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

  const famille = detecterFamilleProjetDepuisTexte(texteProjetPourAntiDoublon(signalImporte));
  if (!famille?.id) return null;

  const projetKey = construireProjetKeyFlair(entreprise, famille.id);

  const depuis = new Date();
  depuis.setDate(depuis.getDate() - 180);

  const { data, error } = await supabaseClient
    .from('signaux')
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
    const texteExistant = texteProjetPourAntiDoublon(signalExistant);
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


function extraireEntrepriseDepuisTexteLibre(texteBrut) {
  const texte = String(texteBrut || '').replace(/\s+/g, ' ').trim();
  if (!texte) return '';

  const patterns = [
    /\b(?:le\s+groupe|la\s+soci[eé]t[eé]|l['’]entreprise)\s+([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’\-. ]{2,80}?)\s+(?:annonce|poursuit|confirme|investit|lance|prévoit|prevoit|construit|agrandit|modernise)\b/i,
    /^\s*([A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ0-9&'’\-. ]{2,80}?)\s+(?:annonce|poursuit|confirme|investit|lance|prévoit|prevoit|construit|agrandit|modernise)\b/i
  ];

  for (const regex of patterns) {
    const match = texte.match(regex);
    if (match?.[1]) {
      return nettoyerValeurImport(match[1])
        .replace(/^groupe\s+/i, '')
        .replace(/\s+(?:annonce|poursuit|confirme|investit|lance|prévoit|prevoit|construit|agrandit|modernise).*$/i, '')
        .trim();
    }
  }

  return '';
}

function extraireSignalDepuisArticle(texteBrut) {
  const texte = String(texteBrut || '').trim();
  const entreprise = extraireChampStructure(texte, ['Entreprise', 'Société', 'Societe']) || extraireEntrepriseDepuisTexteLibre(texte);
  const regionImportee = extraireRegionImportDepuisTexte(texte);
  // Géographie prudente : on ne transforme jamais tout le texte libre en région.
  // Si aucune région/département explicite n'est détecté, le signal reste géographiquement neutre.
  const geographie = normaliserGeographieImport(regionImportee);
  const region = geographie.valide ? (geographie.region_nom || regionImportee) : 'Non déterminée';
  const typeLibre = extraireChampStructure(texte, ['Type', 'Nature du signal']);
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
    premiereLignePertinente(texte) ||
    (entreprise ? `${entreprise} — signal importé` : 'Signal importé')
  );

  const texteScoring = [titre, entreprise, region, typeLibre, pourquoi, opportunite, actionRapide, quiContacter, texte]
    .filter(Boolean)
    .join(' ');

  const resultatInitial = scoringLocal(texteScoring, entreprise);
  const resultatEnrichi = enrichirScoringAvecSourceVeille({
    titre,
    entreprise_nom: entreprise,
    region,
    type_signal: typeLibre,
    description: texte,
    contenu: texte,
    resume: pourquoi,
    type_source: 'manuel'
  }, resultatInitial);

  const scoreFinal = scoreExplicite !== null
    ? Math.max(0, Math.min(100, scoreExplicite))
    : resultatEnrichi.score_pertinence;

  const actionComplete = actionRapide || (quiContacter ? `Contacter : ${quiContacter}.` : resultatEnrichi.action_recommandee);

  return {
    titre,
    entreprise_nom: entreprise,
    region,
    region_nom: region,
    departement_nom: geographie.departement_nom,
    departement_code: geographie.departement_code,
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
    texte_original: texte
  };
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
    'copilote_commercial'
  ];

  champsOptionnels.forEach(champ => {
    if (Object.prototype.hasOwnProperty.call(payload, champ)) {
      ajouterVariante(supprimerChamps(payload, [champ]));
    }
  });

  const champsProjetOptionnels = ['famille_projet', 'famille_projet_label', 'projet_key', 'projet_label', 'projet_detecte'];
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
    let query = supabaseClient
      .from('signaux')
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


function construireLigneDistributionDepuisAnalyse(signal, analyse, contexte, sourceDistribution = 'manuel') {
  const resultat = analyse?.resultat || {};
  const timing = analyse?.timing || {};
  const secteur = analyse?.secteur || {};
  const copilote = analyse?.copilote || {};

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
    copilote_commercial: copilote.copilote_commercial || construireCopiloteCommercialJson(signal, resultat, timing, secteur, copilote),
    secteur_detecte_label: secteur.secteur || null,
    sous_secteur_detecte_label: secteur.sous || null,
    raison_distribution: [
      sourceDistribution === 'manuel'
        ? 'Signal ajouté manuellement par le commercial puis enrichi par le moteur FLAIR.'
        : 'Distribution IA selon métier, région principale et régions secondaires.',
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

  const { error } = await supabaseClient
    .from('signaux_commerciaux')
    .upsert(lignes, baseOptions);

  if (!error) return null;

  const message = String(error.message || '').toLowerCase();
  if (!message.includes('copilote_commercial') && !message.includes('schema cache') && !message.includes('column')) {
    return error;
  }

  const lignesCompatibles = lignes.map(ligne => {
    const copie = { ...ligne };
    delete copie.copilote_commercial;
    return copie;
  });

  const { error: fallbackError } = await supabaseClient
    .from('signaux_commerciaux')
    .upsert(lignesCompatibles, baseOptions);

  return fallbackError || null;
}

async function analyserArticleImporte() {
  if (!user) {
    alert('Tu dois être connecté.');
    return;
  }

  const textarea = document.getElementById('texteSignalImport');
  const status = document.getElementById('importSignalStatus');
  const texte = textarea?.value?.trim() || '';

  if (!texte) {
    alert('Merci de coller un article ou un signal à analyser.');
    return;
  }

  const contexteSignal = await garantirContexteSignal();
  if (!contexteSignal) return;

  if (status) status.textContent = 'Analyse en cours…';

  let signalImporte;
  try {
    signalImporte = extraireSignalDepuisArticle(texte);
  } catch (err) {
    console.error('Erreur analyse signal importé :', err);
    if (status) status.textContent = '';
    alert("Erreur analyse signal : " + (err?.message || err));
    return;
  }
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
    score_pertinence: signalImporte.score_pertinence,
    chaleur: signalImporte.chaleur,
    type_signal: signalImporte.type_signal,
    raison_score: signalImporte.raison_score,
    angle_commercial: signalImporte.angle_commercial,
    action_recommandee: signalImporte.action_recommandee,
    commentaire_action: commentaireAntiDoublon || null
  };

  // FLAIR 5.1 / 5.4 — champs préparatoires non bloquants.
  // Si les colonnes n'existent pas encore dans Supabase, insererSignalAvecFallback()
  // retentera automatiquement sans ces champs.
  const familleProjet = projetDejaDetecte?.famille || detecterFamilleProjetDepuisTexte(texteProjetPourAntiDoublon(signalImporte));
  if (familleProjet?.id) {
    payload.famille_projet = familleProjet.id;
    payload.famille_projet_label = familleProjet.label;
    payload.projet_key = projetDejaDetecte?.projetKey || construireProjetKeyFlair(payload.entreprise_nom, familleProjet.id);
    payload.projet_label = projetDejaDetecte?.projetLabel || `${payload.entreprise_nom} — ${familleProjet.label}`;
    payload.projet_detecte = Boolean(projetDejaDetecte?.signal);
    payload.origine_signal = 'manuel';
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

  const signalInsere = insertion?.data || payload;
  const analyseDistribution = calculerScoreDistributionIA(signalInsere);
  const ligneDistribution = construireLigneDistributionDepuisAnalyse(
    signalInsere,
    analyseDistribution,
    contexteSignal,
    'manuel'
  );

  const distributionError = await upserterDistributionsCommercialesAvecFallback([ligneDistribution], {
    ignoreDuplicates: false
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

  const { error } = await supabaseClient
    .from('signaux')
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


function texteCompletSignalFlair(signal = {}) {
  return [
    signal.titre,
    signal.entreprise_nom,
    signal.resume_brut,
    signal.resume,
    signal.description,
    signal.contenu,
    signal.raison_score,
    signal.angle_commercial,
    signal.action_recommandee,
    signal.secteur_estime,
    signal.source_nom,
    signal.type_source,
    signal.region_nom,
    signal.departement_nom,
    signal.famille_projet,
    signal.projet_label
  ].filter(Boolean).join(' ');
}

function calculerTimingCommercial(signal = {}, resultat = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));

  const contient = (mots) => mots.some(mot => motCleFlairPresent(texte, mot));
  const contientExpression = (expressions) => expressions.some(exp => texte.includes(normaliserTexteSimple(exp)));

  // Timing V2.1 — fenêtre commerciale fine.
  // Objectif : ne pas confondre "projet annoncé" avec "consultation en cours".
  // Le score timing mesure la qualité du moment commercial, pas l'intérêt métier du projet.
  let phase = 'a_qualifier';
  let score = 50;
  let impact_score = 0;
  let fenetre = 'À qualifier';
  let raison = 'Timing non explicite : qualifier la maturité du projet avant d’engager une action commerciale.';
  let prochaine_action = 'Qualifier le calendrier projet, les décideurs et les équipements encore ouverts.';

  const tropTard = [
    'inaugure', 'inauguree', 'inauguration', 'a inaugure', 'vient d inaugurer',
    'mise en service realisee', 'mise en service réalisée', 'mis en service',
    'est desormais operationnel', 'est désormais opérationnel',
    'site operationnel', 'site opérationnel',
    'ligne operationnelle', 'ligne opérationnelle',
    'deja operationnel', 'déjà opérationnel', 'deja en service', 'déjà en service',
    'fournisseur retenu', 'fournisseurs retenus',
    'attribution du marche', 'attribution du marché',
    'marche attribue', 'marché attribué', 'contrat attribue', 'contrat attribué',
    'equipements installes', 'équipements installés'
  ];

  const urgence03 = [
    'appel d offres en cours', 'appel d offre en cours', 'appel offres en cours',
    'appel d offres publie', 'appel d offre publié', 'appel offres publie',
    'consultation en cours', 'consultations en cours',
    'consultation fournisseurs lancee', 'consultation fournisseurs lancée',
    'consultations fournisseurs lancees', 'consultations fournisseurs lancées',
    'dce publie', 'dce publié', 'cahier des charges publie', 'cahier des charges publié',
    'demande de prix en cours', 'demande de devis en cours',
    'travaux demarres', 'travaux démarrés', 'chantier demarre', 'chantier démarré',
    'chantier lance', 'chantier lancé', 'installation en cours',
    'mise en service imminente', 'mise en service prochaine',
    'demarrage imminent', 'démarrage imminent', 'lancement imminent',
    'mise en conformite urgente', 'mise en conformité urgente',
    'rappel produit', 'rappel de lot', 'contamination', 'corps etranger', 'corps étrangers',
    'retrait de vente', 'incident qualite', 'incident qualité'
  ];

  const ideal36 = [
    'lancement prochain des consultations', 'consultations fournisseurs seraient en preparation',
    'consultations fournisseurs en preparation', 'consultations fournisseurs en préparation',
    'consultation fournisseurs en preparation', 'consultation fournisseurs en préparation',
    'consultations prevues', 'consultations prévues',
    'fournisseurs seront consultes', 'fournisseurs seront consultés',
    'plusieurs fournisseurs seront consultes', 'plusieurs fournisseurs seront consultés',
    'choix techniques dans les prochains mois',
    'choix techniques devraient etre arretes', 'choix techniques devraient être arrêtés',
    'choix des equipements', 'choix des équipements',
    'selection fournisseurs', 'sélection fournisseurs',
    'preparation consultation', 'préparation consultation',
    'budget valide', 'budget validé',
    'investissement valide', 'investissement validé',
    'permis accepte', 'permis accepté', 'permis obtenu', 'permis de construire obtenu',
    'travaux prevus', 'travaux prévus', 'lancement des travaux', 'debut des travaux', 'début des travaux',
    'prochains mois', 'dans les prochains mois'
  ];

  const amont612 = [
    'investissement annonce', 'investissement annoncé', 'annonce un investissement',
    'extension annoncee', 'extension annoncée', 'agrandissement annonce',
    'nouvelle ligne prevue', 'nouvelle ligne prévue', 'nouvelles lignes prevues',
    'nouveau site prevu', 'nouveau site prévu', 'nouvelle usine prevue',
    'nouvelle usine prévue', 'construction prevue', 'construction prévue',
    'augmentation capacite', 'augmentation capacité', 'modernisation',
    'plan d investissement', 'plan investissement',
    'premier semestre 2027', 'second semestre 2027', 'fin 2027'
  ];

  const veille1224 = [
    'etude de faisabilite', 'étude de faisabilité', 'projet a l etude', 'projet à l’étude',
    'projet envisage', 'projet envisagé', 'reflexion strategique', 'réflexion stratégique',
    'plan industriel', 'feuille de route industrielle', 'horizon 2027', 'horizon 2028',
    'strategie industrielle', 'stratégie industrielle'
  ];

  const veilleLongue = [
    'horizon 2029', 'horizon 2030', 'horizon 2031', 'horizon 2032',
    'plan 2030', 'strategie 2030', 'stratégie 2030',
    'objectif 2030', 'ambition 2030'
  ];

  if (contient(tropTard)) {
    phase = 'probablement_trop_tard';
    score = 8;
    impact_score = -18;
    fenetre = 'Déjà trop tard';
    raison = 'Le projet semble déjà attribué, inauguré ou opérationnel : action commerciale probablement tardive.';
    prochaine_action = 'Ne pas ouvrir d’action prioritaire ; vérifier uniquement s’il existe un besoin complémentaire ou un nouveau site.';
  } else if (contientExpression(urgence03)) {
    phase = 'urgence_0_3_mois';
    score = 95;
    impact_score = 18;
    fenetre = '0-3 mois — agir vite';
    raison = 'Fenêtre courte : appel d’offres, consultation en cours, chantier lancé, mise en service imminente ou urgence qualité.';
    prochaine_action = 'Identifier immédiatement le bon interlocuteur et proposer un échange court sous 48 h.';
  } else if (contientExpression(ideal36)) {
    phase = 'contact_ideal_3_6_mois';
    score = 88;
    impact_score = 14;
    fenetre = '3-6 mois — prise de contact idéale';
    raison = 'Projet validé ou préparation de consultation : bon moment pour se positionner avant les choix finaux.';
    prochaine_action = 'Prendre contact maintenant pour comprendre le cahier des charges avant consultation ou figement technique.';
  } else if (contient(amont612)) {
    phase = 'amont_6_12_mois';
    score = 72;
    impact_score = 8;
    fenetre = '6-12 mois — se positionner en amont';
    raison = 'Projet industriel annoncé : fenêtre favorable pour qualifier le besoin et se faire identifier tôt.';
    prochaine_action = 'Qualifier le périmètre, le calendrier et les décideurs, puis programmer une relance structurée.';
  } else if (contient(veille1224)) {
    phase = 'veille_active_12_24_mois';
    score = 45;
    impact_score = -4;
    fenetre = '12-24 mois — veille active';
    raison = 'Projet encore amont : signal intéressant, mais à suivre avant une action commerciale directe.';
    prochaine_action = 'Mettre le projet sous surveillance et rechercher les prochains signaux de maturité.';
  } else if (contient(veilleLongue)) {
    phase = 'veille_longue_plus_24_mois';
    score = 20;
    impact_score = -10;
    fenetre = '>24 mois — veille lointaine';
    raison = 'Horizon long : signal stratégique à conserver, mais priorité commerciale faible à court terme.';
    prochaine_action = 'Conserver en veille et attendre un signal plus concret : budget, travaux, consultation ou recrutement.';
  }

  // Projet suivi : si FLAIR détecte plusieurs signaux reliés, le timing devient plus crédible.
  // On ne transforme pas automatiquement en urgence, mais on valorise la maturité du projet.
  if (signal.projet_detecte && phase === 'a_qualifier') {
    phase = 'veille_active_12_24_mois';
    score = Math.max(score, 45);
    impact_score = Math.max(impact_score, -2);
    fenetre = '12-24 mois — veille active';
    raison = 'Projet déjà observé dans FLAIR : suivre l’évolution et rechercher un signal de consultation, travaux ou choix techniques.';
    prochaine_action = 'Consulter l’historique du projet puis qualifier le prochain jalon commercial.';
  } else if (signal.projet_detecte && ['amont_6_12_mois', 'contact_ideal_3_6_mois'].includes(phase)) {
    score = Math.min(98, score + 4);
    impact_score = Math.min(18, impact_score + 2);
    raison += ' Le projet est déjà suivi dans FLAIR, ce qui renforce sa crédibilité commerciale.';
  }

  return { phase, score, impact_score, fenetre, raison, prochaine_action };
}

function motCleFlairPresent(texteNormalise = '', motCle = '') {
  const mot = normaliserTexteSimple(motCle);
  if (!mot) return false;

  // Les mots courts ou ambigus ne doivent pas matcher à l'intérieur d'un autre mot.
  // Exemple : "Lot" ne doit pas matcher dans "copilote", "soin" ne doit pas matcher dans "besoin".
  if (mot.length <= 4 || ['soin', 'lot', 'os', 'map'].includes(mot)) {
    const escaped = mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(texteNormalise);
  }

  return texteNormalise.includes(mot);
}

function detecterSecteurSousSecteur(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));

  const rules = [
    // Agroalimentaire — D.1 enrichi
    { secteur: 'Agroalimentaire', sous: 'Fruits transformés / compotes / confitures', poids: 108, mots: ['andros', 'compote', 'compotes', 'confiture', 'confitures', 'dessert fruitier', 'desserts fruitiers', 'purée de fruits', 'puree de fruits', 'fruits transformes', 'fruits transformés'] },
    { secteur: 'Agroalimentaire', sous: 'Produits de la mer / poisson', poids: 106, mots: ['cite marine', 'cité marine', 'poisson', 'poissons', 'produits de la mer', 'surimi', 'panes de poisson', 'panés de poisson', 'filets de poisson', 'saumon', 'thon'] },
    { secteur: 'Agroalimentaire', sous: 'Snacking / sandwichs / salades', poids: 104, mots: ['daunat', 'sodebo', 'sandwich', 'sandwichs', 'wrap', 'wraps', 'snacking', 'salades composees', 'salades composées', 'traiteur frais'] },
    { secteur: 'Agroalimentaire', sous: 'Boissons / sirops / liquides alimentaires', poids: 102, mots: ['monin', 'boisson', 'boissons', 'sirop', 'sirops', 'jus', 'brasserie', 'embouteillage', 'ligne embouteillage'] },
    { secteur: 'Agroalimentaire', sous: 'Produits végétaux / alternatives', poids: 100, mots: ['vegetal', 'végétal', 'proteines vegetales', 'protéines végétales', 'alternative vegetale', 'alternative végétale', 'tofu', 'legumineuses', 'légumineuses'] },

    // Santé / cosmétique — D.1 enrichi
    { secteur: 'Pharmaceutique', sous: 'CDMO / sous-traitance pharma', poids: 105, mots: ['cdmo', 'sous-traitance pharma', 'sous traitance pharma', 'façonnier pharma', 'faconnier pharma', 'production pharmaceutique'] },
    { secteur: 'Pharmaceutique', sous: 'Dispositifs médicaux / conditionnement stérile', poids: 101, mots: ['dispositif medical', 'dispositif médical', 'salle blanche', 'sterile', 'stérile', 'conditionnement sterile', 'conditionnement stérile'] },
    { secteur: 'Cosmétique', sous: 'Parfums / flacons / remplissage', poids: 102, mots: ['parfum', 'parfums', 'flaconnage', 'remplissage flacon', 'ligne de remplissage', 'cosmetique liquide', 'cosmétique liquide'] },
    { secteur: 'Cosmétique', sous: 'Crèmes / soins / maquillage', poids: 101, mots: ['creme', 'crème', 'soin visage', 'soins visage', 'maquillage', 'rouge a levres', 'rouge à lèvres', 'tube cosmetique', 'tube cosmétique'] },

    // Plasturgie / packaging industriel — D.1 enrichi
    { secteur: 'Plasturgie', sous: 'Recyclage plastique / tri matière', poids: 104, mots: ['recyclage plastique', 'rpet', 'pet recyclé', 'pet recycle', 'broyage plastique', 'tri plastique', 'granulation'] },
    { secteur: 'Plasturgie', sous: 'Films techniques / extrusion', poids: 103, mots: ['film technique', 'film barriere', 'film barrière', 'extrusion film', 'ligne cast', 'film multicouche', 'evoh'] },
    { secteur: 'Packaging', sous: 'Étiquettes / sleeves / traçabilité', poids: 82, mots: ['etiquettes packaging', 'étiquettes packaging', 'sleeves', 'manchons', 'étiquettes sleeves'] },

    // Agroalimentaire
    { secteur: 'Agroalimentaire', sous: 'Viande / salaison', poids: 95, mots: ['viande', 'charcuterie', 'salaison', 'abattoir', 'volaille', 'boucherie', 'découpe viande', 'decoupe viande'] },
    { secteur: 'Agroalimentaire', sous: 'Fromage / produits laitiers', poids: 95, mots: ['fromage', 'fromagerie', 'laiterie', 'produits laitiers', 'affinage', 'yaourt', 'beurre'] },
    { secteur: 'Agroalimentaire', sous: 'Plats cuisinés / traiteur', poids: 95, mots: ['pierre martinet', 'traiteur', 'plats cuisines', 'plats cuisinés', 'snacking', 'pret a manger', 'prêt à manger', 'salades composees', 'salades composées', 'barquettes alimentaires'] },
    { secteur: 'Agroalimentaire', sous: 'Boulangerie / biscuiterie', poids: 90, mots: ['boulangerie', 'biscuiterie', 'patisserie', 'pâtisserie', 'viennoiserie', 'pain', 'biscuits'] },
    { secteur: 'Agroalimentaire', sous: 'Fruits et légumes', poids: 90, mots: ['fruits', 'legumes', 'légumes', 'station de conditionnement', 'calibrage', 'maraicher', 'maraîcher'] },

    // Pharma / cosmétique
    { secteur: 'Pharmaceutique', sous: 'Formes sèches / comprimés', poids: 95, mots: ['forme seche', 'formes seches', 'forme sèche', 'formes sèches', 'comprime', 'comprimé', 'gelule', 'gélule', 'blister'] },
    { secteur: 'Pharmaceutique', sous: 'Formes liquides / injectables', poids: 95, mots: ['injectable', 'ampoule', 'flacon pharma', 'solution injectable', 'formes liquides', 'forme liquide'] },
    { secteur: 'Pharmaceutique', sous: 'Conditionnement pharma', poids: 90, mots: ['pharma', 'pharmaceutique', 'médicament', 'medicament', 'laboratoire pharmaceutique', 'conditionnement pharma'] },
    { secteur: 'Cosmétique', sous: 'Fabrication cosmétique', poids: 92, mots: ['fabrication cosmetique', 'fabrication cosmétique', 'creme cosmetique', 'crème cosmétique', 'soin visage', 'maquillage'] },
    { secteur: 'Cosmétique', sous: 'Conditionnement cosmétique', poids: 88, mots: ['cosmetique', 'cosmétique', 'parfum', 'parfumerie', 'beaute', 'beauté', 'flacon', 'tube cosmetique', 'tube cosmétique'] },

    // Plasturgie / packaging
    { secteur: 'Plasturgie', sous: 'Extrusion / film plastique', poids: 94, mots: ['plasturgie', 'extrusion', 'ligne extrusion', 'ligne d extrusion', 'film plastique', 'compound', 'granules', 'granulés', 'film barriere', 'film barrière'] },
    { secteur: 'Plasturgie', sous: 'Thermoformage / injection', poids: 92, mots: ['thermoformage', 'thermoformeuse', 'injection plastique', 'presse a injecter', 'presse à injecter', 'soufflage plastique'] },
    { secteur: 'Packaging', sous: 'Film / flowpack / operculage', poids: 98, mots: ['flowpack', 'flow pack', 'operculage', 'opercule', 'barquette', 'skin pack', 'emballage flexible', 'film technique', 'film alimentaire'] },
    { secteur: 'Packaging', sous: 'Carton / étuis / conditionnement secondaire', poids: 92, mots: ['carton', 'cartonnage', 'etui', 'étui', 'encartonnage', 'conditionnement secondaire', 'caisse carton', 'mise en carton'] },
    { secteur: 'Packaging', sous: 'Étiquettes / sleeves / traçabilité', poids: 90, mots: ['etiquette', 'étiquette', 'sleeve', 'manchon', 'tracabilite', 'traçabilité', 'marquage', 'code barre', 'qr code'] },

    // Industrie transverse
    { secteur: 'Bois', sous: 'Scierie / panneaux / palettes', poids: 92, mots: ['scierie', 'bois', 'panneaux bois', 'palettes', 'sciage', 'rabotage', 'menuiserie industrielle'] },
    { secteur: 'Textile', sous: 'Textile technique / non-tissé', poids: 90, mots: ['textile', 'non tisse', 'non-tissé', 'fibres', 'recyclage textile', 'textile technique'] },
    { secteur: 'Chimie', sous: 'Process chimique / conditionnement', poids: 90, mots: ['chimie', 'chimique', 'poudres chimiques', 'conditionnement chimique', 'process chimique'] },
    { secteur: 'Logistique', sous: 'Plateforme / flux internes', poids: 85, mots: ['plateforme logistique', 'logistique interne', 'entrepot', 'entrepôt', 'flux logistique'] }
  ];

  const matches = rules
    .map(rule => {
      const nb = rule.mots.filter(mot => motCleFlairPresent(texte, mot)).length;
      return { ...rule, nb, score: nb * (rule.poids || 80) };
    })
    .filter(rule => rule.nb > 0)
    .sort((a, b) => b.score - a.score || (b.poids || 0) - (a.poids || 0));

  if (matches.length) {
    return {
      secteur: matches[0].secteur,
      sous: matches[0].sous,
      confiance: Math.min(100, matches[0].score),
      indices: matches[0].mots.filter(mot => motCleFlairPresent(texte, mot)).slice(0, 4)
    };
  }

  if (signal.secteur_estime) return { secteur: signal.secteur_estime, sous: '', confiance: 40, indices: [] };
  return { secteur: '', sous: '', confiance: 0, indices: [] };
}

function dedoublonnerListeTexte(items = []) {
  const vus = new Set();
  return items
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter(item => {
      const cle = normaliserTexteSimple(item);
      if (!cle || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
}

function signalSemblePME(signal = {}) {
  const texte = normaliserTexteSimple(texteCompletSignalFlair(signal));
  return ['pme', 'eti', 'familial', 'familiale', 'independant', 'indépendant', 'artisan', 'petite entreprise', 'site regional', 'site régional']
    .some(mot => motCleFlairPresent(texte, mot));
}

function interlocuteursPourProfil(profil = '', signal = {}) {
  const type = signal.type_signal || '';
  const secteur = String(signal.secteur_detecte_label || signal.secteur || '').toLowerCase();
  const sous = String(signal.sous_secteur_detecte_label || signal.sous || '').toLowerCase();

  let interlocuteurs = [];

  const ajouter = (role, angle) => {
    interlocuteurs.push(angle ? `${role} — ${angle}` : role);
  };

  if (type === 'appel_offre') {
    ajouter('Responsable achats', 'cadre de consultation et fournisseurs');
    ajouter('Acheteur industriel', 'conditions d’achat et planning');
    ajouter('Chef de projet industriel', 'coordination technique du projet');
  }

  if (profil === 'detection') {
    ajouter('Responsable qualité', 'risque contaminants, audit, CCP');
    ajouter('Responsable production', 'intégration sur ligne et cadence');
    ajouter('Responsable maintenance', 'implantation, essais et disponibilité');
    ajouter('Directeur industriel', 'arbitrage projet et CAPEX');
    ajouter('Directeur de site', 'priorité opérationnelle du site');
  } else if (profil === 'packaging') {
    ajouter('Responsable conditionnement', 'formats, cadence et contraintes ligne');
    ajouter('Responsable packaging', 'matériaux, essais et spécifications');
    ajouter('Achats packaging', 'consultation fournisseurs et consommables');
    ajouter('Responsable production', 'faisabilité industrielle');
    ajouter('Responsable achats', 'budget et contractualisation');
    ajouter('Directeur industriel', 'arbitrage projet');
  } else if (profil === 'pesage') {
    ajouter('Responsable qualité', 'conformité poids et traçabilité');
    ajouter('Responsable production', 'cadence et contrôle en ligne');
    ajouter('Responsable méthodes', 'standardisation et intégration');
    ajouter('Responsable maintenance', 'fiabilité équipements');
    ajouter('Responsable amélioration continue', 'pertes, écarts et performance');
  } else if (profil === 'vision') {
    ajouter('Responsable qualité', 'défauts visibles et preuves de contrôle');
    ajouter('Responsable production', 'contrôle en ligne et cadence');
    ajouter('Responsable automatisme', 'intégration caméra / lecture');
    ajouter('Responsable maintenance', 'stabilité système');
    ajouter('Responsable méthodes', 'standards de contrôle');
  } else if (profil === 'process') {
    ajouter('Responsable production', 'flux, cadence et contraintes terrain');
    ajouter('Responsable maintenance', 'fiabilité et intégration');
    ajouter('Responsable travaux neufs', 'implantation et planning projet');
    ajouter('Responsable méthodes', 'industrialisation');
    ajouter('Directeur industriel', 'arbitrage CAPEX');
    ajouter('Directeur de site', 'priorité opérationnelle');
  } else {
    ajouter('Responsable qualité', 'qualification du besoin');
    ajouter('Responsable production', 'contexte ligne');
    ajouter('Responsable maintenance', 'faisabilité technique');
    ajouter('Directeur industriel', 'arbitrage projet');
  }

  if (secteur.includes('bois') || sous.includes('scierie')) {
    ajouter('Directeur de scierie', 'priorités production bois');
  }

  if (secteur.includes('plasturgie') || sous.includes('extrusion') || sous.includes('injection')) {
    ajouter('Responsable extrusion', 'ligne matière et cadence');
    ajouter('Responsable injection', 'contrôle process et qualité');
    ajouter('Responsable industrialisation', 'mise au point projet');
  }

  if (secteur.includes('packaging') || sous.includes('conditionnement')) {
    ajouter('Responsable conditionnement', 'formats et contraintes emballage');
    ajouter('Responsable packaging', 'matériaux et essais');
    ajouter('Responsable achats', 'fournisseurs et budget');
  }

  if (secteur.includes('pharmaceutique')) {
    ajouter('Responsable assurance qualité', 'exigences qualité et validation');
    ajouter('Responsable validation', 'qualification équipements');
  }

  if (signalSemblePME(signal)) {
    ajouter('Dirigeant', 'décision directe PME');
    ajouter('Gérant', 'arbitrage opérationnel');
    ajouter('Président', 'vision stratégique');
    ajouter('Directeur général', 'budget et priorité');
  }

  return dedoublonnerListeTexte(interlocuteurs).slice(0, 6).join('; ');
}

function questionAnglePourProfil(profil = '', signal = {}) {
  const secteur = String(signal.secteur_detecte_label || signal.secteur || '').toLowerCase();
  const sous = String(signal.sous_secteur_detecte_label || signal.sous || '').toLowerCase();

  if (profil === 'detection') {
    if (secteur.includes('plasturgie')) return 'Comment maîtrisez-vous le risque de contamination métallique ou corps étrangers dans vos flux matière, recyclage ou extrusion ?';
    if (secteur.includes('pharmaceutique')) return 'Quels points de contrôle contaminants ou inspection produit devront être qualifiés sur cette future ligne ?';
    return 'Comment sécurisez-vous aujourd’hui le contrôle contaminants de cette future ligne ?';
  }
  if (profil === 'packaging') return 'Avez-vous déjà défini les matériaux, formats et contraintes de conditionnement pour ce projet ?';
  if (profil === 'pesage') return 'Comment allez-vous maîtriser le contrôle poids, l’étiquetage ou la traçabilité sur cette ligne ?';
  if (profil === 'vision') return 'Quels contrôles visuels, marquages ou lectures codes devront être sécurisés sur la ligne ?';
  if (profil === 'process') return 'Quels sont les points sensibles de flux, convoyage et fin de ligne dans ce projet ?';

  if (secteur.includes('plasturgie') || sous.includes('extrusion')) return 'Quels points de contrôle, de flux ou de qualité sont critiques sur cette ligne plastique ?';
  if (secteur.includes('bois')) return 'Quels sont les points sensibles de flux, contrôle ou manutention sur votre ligne bois ?';

  return 'Où en est le projet et quels équipements de ligne sont encore à définir ?';
}

function prochaineActionCopilote(signal = {}, timing = {}, interlocuteurs = '') {
  const premierContact = String(interlocuteurs || '').split(';')[0]?.trim() || 'le bon interlocuteur';
  if (timing.phase === 'urgence_0_3_mois') {
    return `Agir vite : identifier ${premierContact} et proposer un échange court sous 48 h.`;
  }
  if (timing.phase === 'contact_ideal_3_6_mois') {
    return `Prendre contact maintenant avec ${premierContact} avant le figement des choix techniques.`;
  }
  if (timing.phase === 'amont_6_12_mois') {
    return `Qualifier le projet avec ${premierContact}, puis prévoir une relance structurée.`;
  }
  if (timing.phase === 'veille_active_12_24_mois') {
    return 'Mettre le projet sous surveillance et chercher un prochain signal de maturité.';
  }
  if (timing.phase === 'probablement_trop_tard') {
    return 'Ne pas prioriser sauf besoin complémentaire, extension ou nouveau site.';
  }
  return timing.prochaine_action || 'Qualifier le calendrier, les décideurs et le périmètre technique.';
}

function preparerCopiloteCommercial(signal = {}, resultat = {}, timing = {}) {
  const profil = profilCommercialActuel();
  const entreprise = signalCompany(signal) || signal.entreprise_nom || 'votre entreprise';
  const titre = signalTitle(signal);
  const contexteCopilote = { ...signal, ...resultat };
  const angle = questionAnglePourProfil(profil, contexteCopilote);
  const interlocuteurs = interlocuteursPourProfil(profil, contexteCopilote);
  const prochaineAction = prochaineActionCopilote(contexteCopilote, timing, interlocuteurs);
  const pourquoiMaintenant = timing.fenetre
    ? `${timing.fenetre} : ${timing.raison}`
    : 'Timing à qualifier : vérifier si les choix techniques sont encore ouverts.';

  const copiloteBase = {
    interlocuteurs_cibles: interlocuteurs,
    angle_conseille: angle,
    message_linkedin:
      `Bonjour, j’ai vu passer une information concernant ${entreprise} (${titre}). ` +
      `${angle} Je serais intéressé d’échanger brièvement avec la personne qui pilote ce sujet.`,
    email_prepare:
      `Bonjour,\n\nJ’ai identifié une information récente concernant ${entreprise} : ${titre}.\n\n` +
      `${pourquoiMaintenant}\n\n${angle}\n\n` +
      `L’objectif serait simplement de comprendre où vous en êtes et si un échange technique court peut être utile.\n\nCordialement,`,
    plan_appel:
      `1. Vérifier le bon interlocuteur : ${interlocuteurs}.\n` +
      `2. Confirmer le contexte : ${titre}.\n` +
      `3. Timing : ${timing.fenetre || 'à qualifier'}.\n` +
      `4. Question d’ouverture : ${angle}\n` +
      `5. Prochaine action : ${prochaineAction}\n` +
      `6. Si intérêt confirmé : créer l’opportunité dans le CRM externe.`,
    prochaine_action: prochaineAction,
    pourquoi_maintenant: pourquoiMaintenant
  };

  copiloteBase.copilote_commercial = construireCopiloteCommercialJson(
    contexteCopilote,
    resultat,
    timing,
    {
      secteur: contexteCopilote.secteur_detecte_label,
      sous: contexteCopilote.sous_secteur_detecte_label
    },
    copiloteBase
  );

  return copiloteBase;
}

function calculerScoreDistributionIA(signal = {}) {
  const texteComplet = texteCompletSignalFlair(signal);
  const resultatInitial = scoringLocal(texteComplet, signal.entreprise_nom || '');

  let resultat = enrichirScoringAvecSourceVeille(signal, resultatInitial);
  const secteur = detecterSecteurSousSecteur(signal);
  const signalContexte = {
    ...signal,
    secteur_detecte_label: secteur.secteur,
    sous_secteur_detecte_label: secteur.sous
  };
  const timing = calculerTimingCommercial(signalContexte, resultat);
  const copilote = preparerCopiloteCommercial(signalContexte, {
    ...resultat,
    secteur_detecte_label: secteur.secteur,
    sous_secteur_detecte_label: secteur.sous
  }, timing);

  const scoreBase = Number(resultat.score_pertinence) || 0;
  const impactTiming = Number(timing.impact_score ?? 0) || 0;
  let scoreFinal = Math.max(0, Math.min(95, scoreBase + impactTiming));

  const enrichissementMetier = window.FLAIR_SOURCE_VEILLE?.analyserSignalAvecRegles
    ? window.FLAIR_SOURCE_VEILLE.analyserSignalAvecRegles(signalContexte)
    : null;

  if (enrichissementMetier) {
    const profilCommercial = profilCommercialActuel();
    const profilsDetectes = profilsMetiersDetectes(enrichissementMetier);
    const profilPrincipal = enrichissementMetier.profil_metier_principal || '';
    const compatibilite = compatibiliteMetierPourProfil(enrichissementMetier, profilCommercial);
    const capMetier = capScoreSelonCompatibilite(
      100,
      compatibilite,
      profilCommercial,
      profilPrincipal,
      profilsDetectes,
      enrichissementMetier,
      signalContexte
    );

    if (capMetier < 100) {
      scoreFinal = Math.min(scoreFinal, capMetier);
    }
  }

  scoreFinal = appliquerPlancherTimingStrategique(
    scoreFinal,
    signalContexte,
    resultat,
    timing,
    enrichissementMetier
  );

  const scoreIntrinseque = Math.max(0, Math.min(95, Math.round(scoreFinal)));
  const affinity = appliquerAffinityScoring(scoreIntrinseque, signalContexte, enrichissementMetier);
  const scoreDistribution = affinity.score;
  const phraseGeographiqueDistribution = construirePhraseGeographique(affinity.geo);

  resultat = normaliserResultatScoring({
    ...resultat,
    score_intrinseque: scoreIntrinseque,
    affinite_geographique: affinity.geo.coefficient,
    affinite_metier: affinity.metier.coefficient,
    score_pertinence: scoreDistribution,
    chaleur: chaleurDepuisScoreMetier(scoreDistribution),
    raison_score: ajouterPhraseMetier(
      ajouterPhraseMetier(
        resultat.raison_score,
        `Timing : ${timing.fenetre}. ${timing.raison}`
      ),
      phraseGeographiqueDistribution
    ),
    action_recommandee: ajouterPhraseMetier(
      ajouterPhraseMetier(
        resultat.action_recommandee,
        `Interlocuteurs à rechercher : ${copilote.interlocuteurs_cibles}.`
      ),
      `Prochaine action : ${String(copilote.prochaine_action || '').replace(/[.。]\s*$/, '')}.`
    )
  });

  return {
    resultat,
    timing,
    secteur,
    copilote
  };
}


function normaliserListeCopilote(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap(item => normaliserListeCopilote(item))
      .map(item => String(item || '').trim())
      .filter(Boolean);
  }

  const texte = String(value || '').trim();
  if (!texte) return [];

  // UX Copilote Premium V2 : les virgules font souvent partie du contexte métier.
  // Exemple : "Responsable qualité — risque contaminants, audit, CCP" doit rester un seul contact
  // puis être séparé ensuite entre PERSONA et THEMES métier.
  const separateurFort = texte.includes(';') || /\n/.test(texte);
  const pattern = separateurFort ? /;|\n/ : (texte.includes('—') ? /;|\n/ : /,/);

  return texte
    .split(pattern)
    .map(item => item.trim())
    .filter(Boolean);
}

function dedoublonnerListeCopilote(items = []) {
  const vus = new Set();
  return (items || [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter(item => {
      const cle = normaliserTexteSimple(item);
      if (!cle || vus.has(cle)) return false;
      vus.add(cle);
      return true;
    });
}

function estPersonaCopilote(value = '') {
  const texte = normaliserTexteSimple(value);
  if (!texte) return false;

  const debutsPersonas = /^(responsable|directeur|directrice|dirigeant|dirigeante|gerant|gerante|chef|cheffe|acheteur|acheteuse|achats|service|coordinateur|coordinatrice|ingenieur|ingenieure|manager)\b/;
  const fonctionsCourtes = /^(qualite|production|maintenance|achats|conditionnement|packaging|travaux neufs|methodes|process|hse|r&d|r d|industrialisation)$/;

  return debutsPersonas.test(texte) || fonctionsCourtes.test(texte);
}

function parserContactCopilote(item = '') {
  const texte = String(item || '').trim();
  if (!texte) return { role: '', themes: [] };

  const parts = texte.split(/\s+[—-]\s+/);
  const role = (parts[0] || '').trim();
  const details = parts.length >= 2 ? parts.slice(1).join(' — ').trim() : '';
  const themes = details
    ? details.split(/,|\||\//).map(item => item.trim()).filter(Boolean)
    : [];

  return { role, themes };
}

function extraireContactsEtThemesCopilote(value) {
  const contacts = [];
  const themes = [];

  normaliserListeCopilote(value).forEach(item => {
    const parsed = parserContactCopilote(item);
    if (!parsed.role) return;

    if (estPersonaCopilote(parsed.role)) {
      contacts.push(parsed.role);
      themes.push(...parsed.themes);
    } else {
      themes.push(parsed.role, ...parsed.themes);
    }
  });

  return {
    contacts: dedoublonnerListeCopilote(contacts).slice(0, 6),
    themes: dedoublonnerListeCopilote(themes).slice(0, 10)
  };
}

function renderListeContactsCopilote(contacts = []) {
  const extraction = extraireContactsEtThemesCopilote(contacts);
  const items = extraction.contacts.slice(0, 6);
  if (!items.length) return '<small>À qualifier.</small>';

  return `
    <div style="display:grid;gap:6px;margin:7px 0 8px 0;">
      ${items.map(role => `
        <div style="padding:7px 8px;border:1px solid rgba(148,163,184,0.22);border-radius:9px;background:rgba(15,23,42,0.12);">
          <div style="font-weight:700;font-size:12px;">• ${role}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTexteOuPucesCopilote(value = '') {
  const items = Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : String(value || '')
        .split(/\.\s+/)
        .map(item => item.trim())
        .filter(Boolean);

  const morceaux = items.slice(0, 8);
  if (!morceaux.length) return '';

  if (morceaux.length === 1) {
    return `<small>${morceaux[0]}</small>`;
  }

  return `<ul style="margin:6px 0 0 16px;padding:0;">${morceaux.map(item => `<li><small>${item}${item.endsWith('.') ? '' : '.'}</small></li>`).join('')}</ul>`;
}

function construirePourquoiCopilote(signal = {}, resultat = {}, timing = {}, secteur = {}, themes = []) {
  const phrases = [];

  if (timing?.fenetre) {
    phrases.push(`${timing.fenetre} — ${timing.raison || ''}`.trim());
  }

  const raison = resultat?.raison_score || signal?.raison_score || '';
  if (raison) {
    phrases.push(...String(raison)
      .split(/\.\s+/)
      .map(item => item.trim())
      .filter(Boolean));
  }

  if (secteur?.secteur) {
    phrases.push(secteur.sous ? `${secteur.secteur} / ${secteur.sous}` : secteur.secteur);
  }

  phrases.push(...themes);

  return dedoublonnerListeCopilote(phrases).slice(0, 8);
}

function construireCopiloteCommercialJson(signal = {}, resultat = {}, timing = {}, secteur = {}, copilote = {}) {
  const extraction = extraireContactsEtThemesCopilote(copilote?.interlocuteurs_cibles || signal?.interlocuteurs_cibles);
  const pourquoi = construirePourquoiCopilote(signal, resultat, timing, secteur, extraction.themes);
  const vigilance = determinerVigilanceCopilote(signal, resultat, timing, secteur);

  return {
    pourquoi: pourquoi.length ? pourquoi : ['Signal industriel à qualifier.'],
    qui_contacter: extraction.contacts,
    vigilance,
    timing: timing?.fenetre || signal?.fenetre_contact || 'Timing à qualifier',
    angle: copilote?.angle_conseille || signal?.angle_conseille || resultat?.angle_commercial || signal?.angle_commercial || '',
    prochaine_action: copilote?.prochaine_action || ''
  };
}

function determinerVigilanceCopilote(signal = {}, resultat = {}, timing = {}, secteur = {}) {
  const region = signalRegion(signal) || signal.region_nom || signal.region || '';
  const texte = normaliserTexteSimple([
    signal.titre,
    signal.resume_brut,
    signal.texte_original,
    resultat.raison_score,
    resultat.angle_commercial,
    signal.raison_score,
    signal.angle_commercial
  ].filter(Boolean).join(' '));

  if (!region || ['non determinee', 'non renseignee'].includes(normaliserTexteSimple(region))) {
    return 'Géographie non déterminée : vérifier le site concerné avant d’engager une action terrain.';
  }
  if (timing?.phase === 'veille_active_12_24_mois' || timing?.phase === 'veille_longue_plus_24_mois') {
    return 'Projet encore amont : surveiller les prochains jalons avant action commerciale forte.';
  }
  if (timing?.phase === 'probablement_trop_tard') {
    return 'Projet possiblement déjà attribué : chercher une extension, un lot complémentaire ou un besoin de remplacement.';
  }
  if (texte.includes('annonce') && !texte.includes('consultation') && !texte.includes('appel d offre') && !texte.includes('appel d offres')) {
    return 'Projet au stade annonce : vérifier budget, calendrier, décideurs et ouverture fournisseurs.';
  }
  if (!secteur?.secteur) {
    return 'Secteur à confirmer : qualifier le contexte métier avant de prioriser fortement.';
  }
  return 'Vérifier le calendrier réel, le périmètre technique et le bon interlocuteur avant contact.';
}

function lireCopiloteCommercialJson(signal = {}) {
  const brut = signal?.copilote_commercial;
  if (!brut) return null;
  if (typeof brut === 'object') return brut;
  try {
    return JSON.parse(brut);
  } catch (err) {
    console.warn('Copilote commercial JSON illisible :', err);
    return null;
  }
}

function renderBlocCopilotePremium(copiloteJson = {}) {
  const lignesQui = renderListeContactsCopilote(copiloteJson.qui_contacter);

  return `
    <div style="margin:10px 0;padding:13px 14px;border:1px solid rgba(59,130,246,0.45);background:linear-gradient(180deg,rgba(59,130,246,0.13),rgba(15,23,42,0.10));border-radius:14px;box-shadow:0 10px 26px rgba(15,23,42,0.12);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <b>🧭 Copilote commercial</b>
        ${copiloteJson.timing ? `<span class="badge badge-statut">${copiloteJson.timing}</span>` : ''}
      </div>

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
    return renderBlocCopilotePremium(copiloteJson);
  }

  const lignes = [];

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

  if (!lignes.length) return '';

  return `
    <div style="margin:8px 0;padding:9px 11px;border:1px solid rgba(59,130,246,0.35);background:rgba(59,130,246,0.08);border-radius:10px;">
      <b>🧭 Copilote commercial</b><br>
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

    const { count, error: countError } = await supabaseClient
      .from('recherches_ia_commerciaux')
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
    const { data, error } = await supabaseClient
      .from('signaux')
      .select('*')
      .eq('statut', 'reserve_ia')
      .order('score_pertinence', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      alert('Erreur recherche opportunités IA : ' + error.message);
      return;
    }

    const { data: dejaDistribues, error: dejaError } = await supabaseClient
      .from('signaux_commerciaux')
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
      .map(signal => ({
        signal,
        analyse: calculerScoreDistributionIA(signal)
      }))
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
      .slice(0, 3);

    if (!opportunitesCompatibles.length) {
      alert('Aucune nouvelle opportunité IA disponible pour ton profil actuellement.');
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

    const { error: traceError } = await supabaseClient
      .from('recherches_ia_commerciaux')
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
    const { data, error } = await supabaseClient
      .from('signaux')
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

function renderMiniSparkline(values) {
  const max = Math.max(...values, 1);
  return values.map(v => {
    const height = Math.max(6, Math.round((v / max) * 26));
    return `<span style="height:${height}px" title="${v}"></span>`;
  }).join('');
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

async function chargerDashboardManager() {
  if (!user) return;

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

    const { data, error } = await supabaseClient
      .from('signaux')
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

    const { data: commerciauxData, error: commerciauxError } = await supabaseClient
      .from('commerciaux')
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

function normaliserResultatScoring(resultat) {
  const scorePlafonne = plafonnerScoreParChaleur(resultat.score_pertinence, resultat.chaleur);
  return {
    ...resultat,
    score_pertinence: scorePlafonne
  };
}

function scoringLocal(titre, entreprise) {
  const texte = `${titre || ''} ${entreprise || ''}`.toLowerCase();

  let score = 30;
  let type_signal = 'autre';
  let raison_score = "Signal peu qualifié.";
  let angle_commercial = "Approche découverte.";
  let action_recommandee = "Surveiller.";

  const hasAny = (mots) => mots.some(mot => texte.includes(mot));

  // =========================
  // 0. LISTES DE MOTS-CLÉS MÉTIER
  // =========================

  const intentionAchat = [
    "consultation",
    "appel d'offre",
    "appel d’offres",
    "appel offre",
    "marché public",
    "marche public",
    "boamp",
    "cahier des charges",
    "recherche fournisseur",
    "demande de prix",
    "demande de devis",
    "consultation fournisseurs",
    "benchmark équipement",
    "benchmark equipement",
    "mise en conformité",
    "mise en conformite",
    "remplacement",
    "renouvellement équipement",
    "renouvellement equipement"
  ];

  const projetInvestissement = [
    "investissement",
    "millions",
    "projet",
    "construction",
    "nouveau",
    "nouvelle usine",
    "nouveau projet",
    "usine",
    "ultramoderne",
    "modernisation",
    "extension",
    "agrandissement",
    "agrandit",
    "agrandir",
    "augmentation de capacité",
    "augmentation de capacite",
    "nouveau site",
    "augmentation capacité",
    "augmentation capacite",
    "augmentation production",
    "montée en cadence",
    "montee en cadence",
    "atelier",
    "site de production",
    "investissement industriel",
    "modernisation usine"
  ];

  const recrutementIndustriel = [
    "recrutement",
    "embauche",
    "directeur de production",
    "directeur production",
    "responsable production",
    "responsable maintenance",
    "responsable qualité",
    "responsable qualite",
    "technicien maintenance",
    "ingénieur process",
    "ingenieur process",
    "travaux neufs",
    "responsable industrialisation",
    "responsable amélioration continue",
    "responsable amelioration continue"
  ];

  const qualiteCorpsEtrangers = [
    "rappel produit",
    "rappel conso",
    "retrait rappel",
    "corps étranger",
    "corps etranger",
    "morceau de verre",
    "verre",
    "métal",
    "metal",
    "plastique dur",
    "détecteur de métaux",
    "detecteur de metaux",
    "rayon x",
    "xray",
    "contamination",
    "urgence",
    "non conformité",
    "non conformite",
    "incident qualité",
    "incident qualite",
  ];

  const qualiteCertification = [
    "certification ifs",
    "certification brc",
    "certification brcgs",
    "ifs food",
    "ifs",
    "brc",
    "brcgs",
    "haccp",
    "audit ifs",
    "audit brc",
    "audit brcgs",
    "sécurité alimentaire",
    "securite alimentaire",
    "contrôle qualité",
    "controle qualite",
    "plan de contrôle",
    "plan de controle"
  ];

  const pesageControle = [
    "pesage",
    "contrôle poids",
    "controle poids",
    "contrôle pondéral",
    "controle ponderal",
    "trieuse pondérale",
    "trieuse ponderale",
    "checkweigher",
    "peseuse",
    "pesage dynamique",
    "balance industrielle",
    "poids prix",
    "étiquetage",
    "etiquetage",
    "traçabilité",
    "tracabilite"
  ];

  const ligneConditionnement = [
    "ligne",
    "nouvelles lignes",
    "nouvelle ligne",
    "plusieurs lignes",
    "lignes de production",
    "ligne automatisée",
    "ligne automatisee",
    "ligne de conditionnement",
    "ligne de production",
    "fabrication",
    "conditionnement",
    "emballage",
    "découpe",
    "decoupe",
    "ensachage",
    "tranchage",
    "thermoformage",
    "mise en barquette",
    "fin de ligne",
    "palettisation"
  ];

  const secteurAgro = [
    "abattoir",
    "viande",
    "volaille",
    "salaison",
    "charcuterie",
    "fromage",
    "laiterie",
    "fruits",
    "légumes",
    "legumes",
    "traiteur",
    "plats cuisinés",
    "plats cuisines",
    "conserverie",
    "boulangerie",
    "pâtisserie",
    "patisserie"
  ];

  // =========================
  // 1. INTENTION D'ACHAT / APPEL D'OFFRE
  // =========================

  if (hasAny(intentionAchat)) {
    score += 25;
    type_signal = 'appel_offre';
    raison_score = "Intention d'achat détectée : consultation, appel d'offre, demande de prix ou recherche fournisseur.";
    angle_commercial = "Approche rapide avec proposition de solution adaptée.";
    action_recommandee = "Identifier le décideur et prendre contact rapidement.";
  }

  // =========================
  // 2. MOTS CLÉS FORTS — INVESTISSEMENT / PROJET
  // =========================

  if (hasAny(projetInvestissement)) {
    score += 25;
    type_signal = type_signal === 'autre' ? 'investissement' : type_signal;
    raison_score += " Projet industriel détecté : investissement, construction, modernisation, extension ou nouvelle usine.";
  }

  // =========================
  // 3. RECRUTEMENT INDUSTRIEL
  // =========================

  if (hasAny(recrutementIndustriel)) {
    score += 18;
    type_signal = type_signal === 'autre' ? 'recrutement' : type_signal;
    raison_score += " Recrutement industriel pouvant révéler une évolution d'organisation, une montée en charge ou un projet de ligne.";
  }

  if (
    texte.includes("directeur") ||
    texte.includes("responsable")
  ) {
    score += 5;
  }

  // =========================
  // 4. RAPPEL CONSO / QUALITÉ / CORPS ÉTRANGERS
  // =========================

  if (hasAny(qualiteCorpsEtrangers)) {
    score += 35;
    type_signal = 'qualite_rappel_conso';
    raison_score = "Contexte qualité sensible détecté : rappel conso, contamination, corps étranger ou sécurité alimentaire.";
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Identifier responsable qualité ou maintenance et proposer un échange rapide.";
  }

  // =========================
  // 4B. QUALITÉ / CERTIFICATION SANS INCIDENT
  // =========================

  if (hasAny(qualiteCertification) && !hasAny(qualiteCorpsEtrangers)) {
    score += 12;
    type_signal = type_signal === 'autre' ? 'qualite_rappel_conso' : type_signal;
    raison_score = "Contexte qualité ou certification détecté, sans incident produit explicite.";
    angle_commercial = "Approche conseil autour des contrôles, audits et preuves qualité.";
    action_recommandee = "Identifier le responsable qualité et qualifier les contrôles en place.";
  }

  // =========================
  // 5. PESAGE / CONTRÔLE POIDS / ÉTIQUETAGE
  // =========================

  if (hasAny(pesageControle)) {
    score += 25;
    type_signal = type_signal === 'autre' ? 'investissement' : type_signal;
    raison_score += " Besoin potentiel autour du pesage, contrôle poids, étiquetage ou traçabilité.";
    angle_commercial = "Positionnement pesage, contrôle poids, étiquetage et automatisation.";
    action_recommandee = "Préparer un angle pesage / contrôle poids / ligne.";
  }

  // =========================
  // 6. CAPACITÉ / PRODUCTION
  // =========================

  if (
    texte.includes("capacité") ||
    texte.includes("capacite") ||
    texte.includes("production") ||
    texte.includes("augmentation") ||
    texte.includes("cadence")
  ) {
    score += 15;
    raison_score += " Impact potentiel sur la capacité de production.";
  }

  // =========================
  // 7. LIGNE / CONDITIONNEMENT
  // =========================

  if (hasAny(ligneConditionnement)) {
    score += 20;
    type_signal = 'nouvelle_ligne';
    raison_score += " Présence de ligne, fabrication, conditionnement ou fin de ligne.";
    angle_commercial = "Projet ligne ou conditionnement : opportunité équipement.";
    action_recommandee = "Identifier production / maintenance / travaux neufs.";
  }

  // =========================
  // 8. SECTEUR AGROALIMENTAIRE
  // =========================

  if (hasAny(secteurAgro)) {
    score += 5;
    raison_score += " Secteur agroalimentaire identifié.";
  }

  // =========================
  // 9. BONUS COMBINÉS — SIGNAUX PLUS FIABLES
  // =========================

  if (hasAny(["consultation", "demande de prix", "demande de devis", "appel d'offre", "appel d’offres"]) && hasAny(pesageControle)) {
    score += 25;
    type_signal = 'appel_offre';
    raison_score += " Combinaison forte : intention d'achat + pesage / contrôle poids.";
    angle_commercial = "Opportunité directe : répondre rapidement avec une approche solution.";
    action_recommandee = "Contacter rapidement avec un message ciblé pesage / contrôle poids.";
  }

  if (
    hasAny(["rappel produit", "rappel conso", "contamination", "corps étranger", "corps etranger"]) &&
    hasAny(["métal", "metal", "verre", "plastique dur", "rayon x", "détecteur de métaux", "detecteur de metaux"])
  ) {
    score += 25;
    type_signal = 'qualite_rappel_conso';
    raison_score += " Combinaison critique : rappel ou contamination + corps étranger.";
    angle_commercial = "Approche conseil qualité, audit de ligne et sécurisation détection.";
    action_recommandee = "Priorité haute : contacter le responsable qualité.";
  }

  if (
    hasAny(["nouvelle usine", "nouveau site", "extension", "agrandissement", "usine"]) &&
    hasAny(ligneConditionnement)
  ) {
    score += 20;
    type_signal = 'nouvelle_ligne';
    raison_score += " Combinaison forte : site industriel ou extension + ligne / conditionnement.";
    angle_commercial = "Projet industriel structurant : opportunité équipement ligne.";
    action_recommandee = "Identifier travaux neufs, production ou maintenance.";
  }

  if (
    hasAny(["responsable maintenance", "technicien maintenance", "travaux neufs"]) &&
    hasAny(["ligne", "automatisée", "automatisee", "contrôle qualité", "controle qualite", "conditionnement"])
  ) {
    score += 12;
    raison_score += " Recrutement technique lié à ligne ou contrôle qualité.";
  }

  // =========================
  // 10. SUPER SIGNATURES — OPPORTUNITÉS TRÈS FORTES
  // =========================

  if (
    hasAny(["consultation", "appel d'offre", "appel d’offres", "demande de prix", "demande de devis"]) &&
    hasAny(["pesage", "contrôle poids", "controle poids", "trieuse pondérale", "trieuse ponderale", "pesage dynamique"])
  ) {
    score = Math.max(score, 88);
    type_signal = 'appel_offre';
    raison_score = "Signal très fort : consultation ou demande commerciale explicite autour du pesage / contrôle poids.";
    angle_commercial = "Approche commerciale directe et rapide.";
    action_recommandee = "Contacter en priorité avec une réponse ciblée.";
  }

  if (
    hasAny(["rappel produit", "rappel conso", "contamination", "corps étranger", "corps etranger"]) &&
    hasAny(["sécurité alimentaire", "securite alimentaire", "incident qualité", "incident qualite", "rayon x", "détecteur de métaux", "detecteur de metaux"])
  ) {
    score = Math.max(score, 90);
    type_signal = 'qualite_rappel_conso';
    raison_score = "Signal critique qualité : contexte de rappel, contamination ou sécurité alimentaire.";
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Priorité haute : prise de contact rapide avec qualité / maintenance.";
  }

  // =========================
  // 11. NORMALISATION
  // =========================

  if (type_signal === 'appel_offre') {
  score = Math.min(score, 95);
} else if (type_signal === 'qualite_rappel_conso') {
  score = Math.min(score, 95);
} else {
  score = Math.min(score, 92);
}

  let chaleur = 'froid';
  if (score >= 80) chaleur = 'chaud';
  else if (score >= 60) chaleur = 'tiede';

  // =========================
  // 12. ANGLE + ACTION PAR DÉFAUT
  // =========================

  if (type_signal === 'qualite_rappel_conso') {
    angle_commercial = "Approche conseil qualité et sécurisation de ligne.";
    action_recommandee = "Identifier responsable qualité ou maintenance et proposer un échange rapide.";
    } else if (score >= 80) {
    if (angle_commercial === "Approche découverte.") {
      angle_commercial = "Projet en cours : positionnement rapide sur équipements.";
    }
    if (action_recommandee === "Surveiller.") {
      action_recommandee = "Identifier décideur production / maintenance et prendre contact rapidement.";
    }
  } else if (score >= 60) {
    if (angle_commercial === "Approche découverte.") {
      angle_commercial = "Opportunité probable à moyen terme.";
    }
    if (action_recommandee === "Surveiller.") {
      action_recommandee = "Surveiller + identifier contact.";
    }
  }

  // =========================
  // 13. RETOUR STANDARD FLAIR
  // =========================

return normaliserResultatScoring({
  score_pertinence: score,
  chaleur,
  type_signal,
  raison_score,
  angle_commercial,
  action_recommandee
});
}

 // =========================
 // ENRICHISSEMENT SOURCE-VEILLE
 // =========================
 // Objectif V2.5 :
 // exploiter réellement la taxonomie métier fournie par source-veille-rules.js :
 // profils_metiers_detectes, profil_metier_principal, sous_profils_metiers_detectes,
 // compatibilite_metier et matched_rules.
 // Important : aucune nouvelle colonne Supabase n'est nécessaire à ce stade.
 // L'information métier est intégrée dans les champs déjà affichés :
 // raison_score, angle_commercial et action_recommandee.

const FLAIR_LABELS_PROFILS_METIERS = {
  detection: "Détection",
  pesage: "Pesage",
  packaging: "Packaging",
  vision: "Vision",
  process: "Process"
};

const FLAIR_LABELS_SOUS_PROFILS_METIERS = {
  detecteur_metaux: "détecteur de métaux",
  rayon_x: "rayon X",

  balance: "balance",
  tri_ponderal: "tri pondéral",
  etiquetage: "étiquetage",
  poids_prix: "poids/prix",

  films: "films",
  thermoformage: "thermoformage",
  flowpack: "flowpack",
  operculage: "operculage",
  sachet: "sachet",
  boite: "boîte",
  etui: "étui",
  etiquettes: "étiquettes",
  sleeves: "sleeves",
  carton: "carton",
  conditionnement_secondaire: "conditionnement secondaire",

  presence_absence: "présence/absence",
  controle_etiquette: "contrôle étiquette",
  ocr: "OCR",
  lecture_code: "lecture code",
  controle_aspect: "contrôle aspect",

  convoyage: "convoyage",
  manutention: "manutention",
  guidage_produit: "guidage produit",
  automatisme: "automatisme",
  encaissage: "encaissage",
  palettisation: "palettisation",
  robotique: "robotique",
  logistique_interne: "logistique interne"
};

function labelProfilMetierRadar(value) {
  return FLAIR_LABELS_PROFILS_METIERS[value] || labelProfilMetier(value || '');
}

function labelSousProfilMetierRadar(value) {
  return FLAIR_LABELS_SOUS_PROFILS_METIERS[value] || String(value || '').replaceAll('_', ' ');
}

function profilsMetiersDetectes(enrichissement = {}) {
  return Array.isArray(enrichissement.profils_metiers_detectes)
    ? enrichissement.profils_metiers_detectes.filter(Boolean)
    : [];
}

function profilCommercialActuel() {
  return normaliserSlugProfilMetierFlair(currentProfil?.profil_metier || window.FLairProfilMetier || '');
}

function compatibiliteMetierPourProfil(enrichissement = {}, profilCommercial = '') {
  const profilNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  if (!profilNormalise) return 0;

  const compatibilites = enrichissement.compatibilite_metier || {};
  const valeurDirecte = Number(compatibilites[profilNormalise] || 0);

  if (valeurDirecte > 0) return valeurDirecte;

  return profilsMetiersDetectes(enrichissement).map(normaliserSlugProfilMetierFlair).includes(profilNormalise) ? 0.5 : 0;
}

function facteurBonusSelonCompatibilite(compatibilite, profilsDetectes = [], profilCommercial = '', profilPrincipal = '', enrichissement = {}) {
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);
  const profilsDetectesNormalises = (profilsDetectes || []).map(normaliserSlugProfilMetierFlair);

  // Pas de profil détecté : comportement historique, sans pénalisation.
  if (!profilsDetectesNormalises.length) return 1;

  const regles = reglesMetierDetectees(enrichissement);
  const aRegleOffreDirecte = regles.some(rule =>
    rule?.couche === 'compatibilite_offre' &&
    Array.isArray(rule.profils_metiers) &&
    rule.profils_metiers.map(normaliserSlugProfilMetierFlair).includes(profilCommercialNormalise)
  );

  const aRegleBonusForte = regles.some(rule =>
    rule?.couche === 'bonus_metier' &&
    Number(rule?.intensite_metier?.[profilCommercialNormalise] || 0) >= 0.8
  );

  // Si une règle métier directe existe, on garde la force du signal.
  if (aRegleOffreDirecte || profilCommercialNormalise === profilPrincipalNormalise || compatibilite >= 0.85) return 1;

  // Bonus métier fort mais signal pas principal : utile, sans surclasser le métier principal.
  if (aRegleBonusForte) return 0.85;

  // Compatible mais pas forcément profil principal : signal utile, mais lecture métier à nuancer.
  if (compatibilite >= 0.6) return 0.72;

  // Compatibilité indirecte : on conserve l'information, sans la pousser aussi fort.
  if (compatibilite > 0) return 0.55;

  // Signal non compatible avec le profil du commercial connecté.
  // Il reste visible si le commercial l'importe, mais il ne doit pas dominer son radar.
  return 0.35;
}

function texteSignalPourAjustementMetier(signal = {}) {
  return normaliserTexteSimple([
    signal.titre,
    signal.entreprise_nom,
    signal.description,
    signal.contenu,
    signal.resume,
    signal.raison_score,
    signal.angle_commercial,
    signal.action_recommandee,
    signal.texte_original,
    signal.type_signal
  ].filter(Boolean).join(' '));
}

function signalDetectionMetallique(signal = {}, enrichissement = {}) {
  const texte = texteSignalPourAjustementMetier(signal);
  const motsDetectionMetal = [
    'metallique',
    'metal',
    'particule metallique',
    'particules metalliques',
    'particule de metal',
    'particules de metal',
    'corps etranger',
    'corps etrangers',
    'contaminant',
    'contamination',
    'detecteur de metaux',
    'detection de metaux',
    'rayon x',
    'rayons x',
    'rappel produit metallique'
  ];

  if (motsDetectionMetal.some(mot => texte.includes(mot))) return true;

  return hasRegleMetier(enrichissement, rule =>
    ['detection_metaux_corps_etrangers', 'inspection_rayons_x_qualite'].includes(rule?.id)
  );
}

function normaliserCleRegionFlair(value) {
  const label = labelRegionCommerciale(value || '');
  return normaliserCleGeographie(label).replace(/_/g, ' ').trim();
}

function regionsSecondairesProfilNormalisees() {
  const regionsSecondaires = currentProfil?.regions_secondaires || currentProfil?.regionsSecondaires || [];
  const liste = Array.isArray(regionsSecondaires)
    ? regionsSecondaires
    : String(regionsSecondaires || '').split(/[,;|]/);

  return liste
    .map(region => normaliserCleRegionFlair(region))
    .filter(Boolean);
}

const GeoAffinityEngine = {
  calculate(commercial = {}, signal = {}) {
    const regionSignalBrute = signalRegion(signal) || signal.region_nom || signal.region || signal.region_signal || '';
    const regionCommercialeBrute = commercial?.region || '';
    const regionSignalCle = normaliserCleRegionFlair(regionSignalBrute);
    const regionCommercialeCle = normaliserCleRegionFlair(regionCommercialeBrute);

    if (!regionSignalCle || regionSignalCle === 'non determinee' || regionSignalCle === 'non renseignee') {
      return { coefficient: 1, niveau: 'geo_inconnue' };
    }

    if (estRegionNationaleFlair(regionSignalCle)) {
      return { coefficient: 1, niveau: 'national_signal' };
    }

    if (!regionCommercialeCle || estRegionNationaleFlair(regionCommercialeCle)) {
      return { coefficient: 1, niveau: regionCommercialeCle ? 'national_commercial' : 'commercial_non_renseigne' };
    }

    if (regionSignalCle === regionCommercialeCle) {
      return { coefficient: 1, niveau: 'principale' };
    }

    const regionsSecondaires = regionsSecondairesProfilNormalisees();
    if (regionsSecondaires.includes(regionSignalCle)) {
      return { coefficient: 0.9, niveau: 'secondaire' };
    }

    return { coefficient: 0.4, niveau: 'hors_secteur' };
  }
};

function coefficientGeographiqueSignal(signal = {}) {
  return GeoAffinityEngine.calculate(currentProfil || {}, signal);
}

function calculerAffiniteMetierCommerciale(enrichissement = null, profilCommercial = '') {
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  if (!enrichissement || !profilCommercialNormalise) return { coefficient: 1, niveau: 'metier_non_determine' };

  const profilsDetectes = profilsMetiersDetectes(enrichissement).map(normaliserSlugProfilMetierFlair);
  const profilPrincipal = normaliserSlugProfilMetierFlair(enrichissement.profil_metier_principal || '');
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise);

  if (!profilsDetectes.length) return { coefficient: 1, niveau: 'metier_transverse' };
  if (profilPrincipal === profilCommercialNormalise) return { coefficient: 1, niveau: 'metier_principal' };
  if (compatibilite >= 0.75) return { coefficient: 0.9, niveau: 'metier_secondaire_fort' };
  if (compatibilite >= 0.45) return { coefficient: 0.75, niveau: 'metier_compatible' };
  if (compatibilite > 0) return { coefficient: 0.6, niveau: 'metier_indirect' };

  return { coefficient: 0.35, niveau: 'metier_hors_cible' };
}

function appliquerAffinityScoring(scoreIntrinseque, signal = {}, enrichissement = null) {
  const scoreBase = Math.max(0, Math.min(95, Math.round(Number(scoreIntrinseque) || 0)));
  const geo = coefficientGeographiqueSignal(signal);
  const metier = calculerAffiniteMetierCommerciale(enrichissement, profilCommercialActuel());
  const scoreDistribution = Math.max(0, Math.min(95, Math.round(scoreBase * geo.coefficient * metier.coefficient)));

  return {
    score_intrinseque: scoreBase,
    score: scoreDistribution,
    geo,
    metier,
    coefficient_total: Number((geo.coefficient * metier.coefficient).toFixed(3))
  };
}

function appliquerCoefficientGeographique(score, signal = {}) {
  const affinity = appliquerAffinityScoring(score, signal, null);
  return {
    score: affinity.score,
    coefficient: affinity.geo.coefficient,
    niveau: affinity.geo.niveau
  };
}

function appliquerPlancherTimingStrategique(score, signal = {}, resultat = {}, timing = {}, enrichissement = null) {
  const phase = timing?.phase || '';
  if (!['urgence_0_3_mois', 'contact_ideal_3_6_mois'].includes(phase)) {
    return score;
  }

  const texte = texteSignalPourAjustementMetier(signal);
  const entrepriseIdentifiee = Boolean(signalCompany(signal) || signal.entreprise_nom);
  const projetIndustriel = [
    'consultation', 'appel d offre', 'appel d offres', 'fournisseur', 'fournisseurs',
    'travaux', 'mise en service', 'nouvelle ligne', 'ligne automatisee', 'ligne automatisée',
    'modernisation', 'extension', 'investissement', 'conditionnement', 'controle qualite',
    'contrôle qualité', 'inspection', 'detection', 'détection'
  ].some(mot => motCleFlairPresent(texte, mot));

  if (!entrepriseIdentifiee || !projetIndustriel) {
    return score;
  }

  const profil = profilCommercialActuel();
  const geo = coefficientGeographiqueSignal(signal);
  const qualiteInspection = signalAQualiteOuInspection(signal, enrichissement || {});

  let plancher = 0;

  if (phase === 'urgence_0_3_mois') {
    plancher = geo.niveau === 'principale' ? 85 : geo.niveau === 'secondaire' ? 78 : geo.niveau === 'hors_secteur' ? 68 : 82;
  } else if (phase === 'contact_ideal_3_6_mois') {
    plancher = geo.niveau === 'principale' ? 80 : geo.niveau === 'secondaire' ? 74 : geo.niveau === 'hors_secteur' ? 64 : 76;
  }

  // Pour un profil Détection, un projet de ligne avec contrôle qualité / inspection
  // reste commercialement exploitable même hors région, sans devenir prioritaire absolu.
  if (profil === 'detection' && qualiteInspection) {
    plancher += geo.niveau === 'hors_secteur' ? 4 : 2;
  }

  return Math.max(score, Math.min(plancher, 88));
}


function construirePhraseGeographique(ajustement = {}) {
  if (!ajustement || ['non_renseigne', 'geo_inconnue', 'commercial_non_renseigne'].includes(ajustement.niveau)) return '';

  if (ajustement.niveau === 'national_signal') {
    return 'Zone commerciale : projet national ou multi-sites, compatible avec plusieurs territoires.';
  }

  if (ajustement.niveau === 'national_commercial') {
    return 'Zone commerciale : commercial positionné France entière.';
  }

  if (ajustement.niveau === 'principale') {
    return 'Zone commerciale : même région que le commercial.';
  }

  if (ajustement.niveau === 'secondaire') {
    return 'Zone commerciale : région secondaire du commercial, priorité légèrement réduite.';
  }

  if (ajustement.niveau === 'hors_secteur' || ajustement.niveau === 'eloignee') {
    return 'Zone commerciale : région clairement hors secteur du commercial, priorité réduite.';
  }

  return '';
}

function hasSousProfilMetier(enrichissement = {}, profil = '', sousProfil = '') {
  const sousProfils = enrichissement.sous_profils_metiers_detectes || {};
  return Array.isArray(sousProfils[profil]) && sousProfils[profil].includes(sousProfil);
}

function hasRegleMetier(enrichissement = {}, predicate) {
  return reglesMetierDetectees(enrichissement).some(predicate);
}

function signalAQualiteOuInspection(signal = {}, enrichissement = {}) {
  const texte = texteSignalPourAjustementMetier(signal);
  const motsQualite = [
    'controle qualite', 'qualite', 'inspection', 'haccp', 'ifs', 'brc', 'brcgs',
    'tracabilite', 'corps etranger', 'contamination', 'securite alimentaire',
    'detecteur', 'detection', 'rayon x', 'rayons x', 'x ray', 'xray'
  ];

  if (motsQualite.some(mot => texte.includes(mot))) return true;

  return hasRegleMetier(enrichissement, rule =>
    ['detection_metaux_corps_etrangers', 'inspection_rayons_x_qualite', 'agro_qualite_certification'].includes(rule?.id)
  );
}

function scorePlancherMetier(score, plancher) {
  return Math.max(Number(score) || 0, plancher);
}

function capScoreSelonCompatibilite(score, compatibilite, profilCommercial, profilPrincipal, profilsDetectes = [], enrichissement = {}, signal = {}) {
  if (!profilsDetectes.length || !profilCommercial) return score;

  // Sécurité FLAIR V3.2 : normalisation locale systématique des slugs métier.
  // Évite les ReferenceError et les écarts de casse / libellés lors du scoring personnalisé.
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);

  const regleOffreDirecte = hasRegleMetier(enrichissement, rule =>
    rule?.couche === 'compatibilite_offre' &&
    Array.isArray(rule.profils_metiers) &&
    rule.profils_metiers.map(normaliserSlugProfilMetierFlair).includes(profilCommercialNormalise)
  );

  const regleBonusForte = hasRegleMetier(enrichissement, rule =>
    rule?.couche === 'bonus_metier' &&
    Number(rule?.intensite_metier?.[profilCommercialNormalise] || 0) >= 0.8
  );

  // 1) Cas très alignés : pas de pénalisation, et plancher métier pour éviter les vrais signaux sous-notés.
  if (regleOffreDirecte || profilCommercialNormalise === profilPrincipalNormalise || compatibilite >= 0.85) {
    if (profilCommercialNormalise === 'detection' && hasSousProfilMetier(enrichissement, 'detection', 'rayon_x')) {
      return Math.min(scorePlancherMetier(score, 88), 95);
    }
    if (profilCommercialNormalise === 'detection' && hasSousProfilMetier(enrichissement, 'detection', 'detecteur_metaux')) {
      return Math.min(scorePlancherMetier(score, 85), 95);
    }
    return Math.min(score, 95);
  }

  // 2) Cas semi-directs : le signal intéresse le commercial, mais n'est pas son métier principal.
  // Exemple : nouvelle ligne pharma avec contrôle qualité -> Détection utile, mais besoin pas encore explicite.
  if (regleBonusForte) {
    return Math.min(score, 88);
  }

  // 3) Compatibilités secondaires contrôlées par matrice métier.
  const capsSecondaires = {
    // Scoring métier fin V3 :
    // le métier principal conserve la priorité haute ;
    // les métiers compatibles restent visibles, mais ne doivent pas dépasser le profil naturellement concerné.
    detection: { process: 78, packaging: 76, pesage: 50, vision: 70 },
    pesage: { process: 72, packaging: 68, detection: 48, vision: 58 },
    packaging: { process: 78, pesage: 64, detection: 48, vision: 62 },
    vision: { process: 70, packaging: 70, detection: 62, pesage: 58 },
    process: { packaging: 76, detection: 64, pesage: 66, vision: 64 }
  };

  let cap = capsSecondaires[profilCommercialNormalise]?.[profilPrincipalNormalise];

  // Réglage fin FLAIR 4.1 : un rappel métallique / corps étranger est un vrai sujet Détection,
  // mais doit rester froid pour un profil Process si aucun besoin convoyage / flux / fin de ligne n'est explicite.
  if (profilCommercialNormalise === 'process' && profilPrincipalNormalise === 'detection' && signalDetectionMetallique(signal, enrichissement)) {
    cap = 49;
  }

  // Nuance importante : Process + indice qualité / inspection reste plus fort pour un commercial Détection.
  // Exemple : extension pharma avec nouvelles lignes + contrôle qualité.
  if (profilCommercialNormalise === 'detection' && profilPrincipalNormalise === 'process' && signalAQualiteOuInspection(signal, enrichissement)) {
    cap = 85;
  }

  if (typeof cap === 'number') {
    return Math.min(score, cap);
  }

  // 4) Compatibilité chiffrée mais sans règle de matrice explicite.
  if (compatibilite >= 0.6) return Math.min(score, 75);
  if (compatibilite > 0) return Math.min(score, 55);

  // 5) Non compatible.
  return Math.min(score, 45);
}

function chaleurDepuisScoreMetier(score) {
  if (score >= 80) return 'chaud';
  if (score >= 60) return 'tiede';
  return 'froid';
}

function reglesMetierDetectees(enrichissement = {}) {
  return Array.isArray(enrichissement.matched_rules)
    ? enrichissement.matched_rules.filter(Boolean)
    : [];
}

function construireResumeReglesMetier(enrichissement = {}) {
  const regles = reglesMetierDetectees(enrichissement)
    .map(rule => rule.label)
    .filter(Boolean);

  return Array.from(new Set(regles)).slice(0, 3).join(', ');
}

function construireResumeSousProfils(enrichissement = {}, limite = 5) {
  const sousProfils = enrichissement.sous_profils_metiers_detectes || {};
  const valeurs = [];

  Object.entries(sousProfils).forEach(([profil, liste]) => {
    (liste || []).forEach(sousProfil => {
      valeurs.push(`${labelProfilMetierRadar(profil)} / ${labelSousProfilMetierRadar(sousProfil)}`);
    });
  });

  return Array.from(new Set(valeurs)).slice(0, limite).join(', ');
}

function construireSousProfilsPourProfil(enrichissement = {}, profil = '', limite = 3) {
  const sousProfils = enrichissement.sous_profils_metiers_detectes || {};
  const liste = sousProfils[profil] || [];

  return Array.from(new Set(liste))
    .slice(0, limite)
    .map(labelSousProfilMetierRadar)
    .join(', ');
}

function construireResumeMetierCourt(enrichissement = {}, profilCommercial = '') {
  const profils = profilsMetiersDetectes(enrichissement);
  const profilPrincipal = enrichissement.profil_metier_principal || profils[0] || '';
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise);

  if (!profils.length) return '';

  const principalLabel = profilPrincipal ? labelProfilMetierRadar(profilPrincipal) : 'industrielle';
  const commercialLabel = profilCommercial ? labelProfilMetierRadar(profilCommercial) : '';
  const sousProfilsPrincipal = construireSousProfilsPourProfil(enrichissement, profilPrincipal, 3);
  const sousProfilsCommercial = profilCommercial
    ? construireSousProfilsPourProfil(enrichissement, profilCommercial, 3)
    : '';

  if (!profilCommercial) {
    return sousProfilsPrincipal
      ? `Lecture principale ${principalLabel} : ${sousProfilsPrincipal}.`
      : `Lecture principale ${principalLabel}.`;
  }

  if (profilCommercialNormalise === profilPrincipalNormalise || compatibilite >= 0.85) {
    return sousProfilsCommercial
      ? `Signal fortement aligné avec ton profil ${commercialLabel} : ${sousProfilsCommercial}.`
      : `Signal fortement aligné avec ton profil ${commercialLabel}.`;
  }

  if (compatibilite >= 0.6) {
    return sousProfilsCommercial
      ? `Projet principalement ${principalLabel}, mais compatible avec ton profil ${commercialLabel} : ${sousProfilsCommercial}.`
      : `Projet principalement ${principalLabel}, mais compatible avec ton profil ${commercialLabel}.`;
  }

  if (compatibilite > 0) {
    return `Projet principalement ${principalLabel}. Intérêt indirect pour ton profil ${commercialLabel}.`;
  }

  return `Projet principalement ${principalLabel}. Compatibilité faible avec ton profil ${commercialLabel}.`;
}

function construireLectureMetier(enrichissement = {}, profilCommercial = '') {
  return construireResumeMetierCourt(enrichissement, profilCommercial);
}

function nettoyerPhraseMetierBase(texte = '') {
  return String(texte || '')
    .replace(/Lecture métier\s*:[^.]+\.?\s*/gi, '')
    .replace(/Profils concernés\s*:[^.]+\.?\s*/gi, '')
    .replace(/Sous-profils\s*:[^.]+\.?\s*/gi, '')
    .replace(/Règles détectées\s*:[^.]+\.?\s*/gi, '')
    .replace(/Angle métier\s*:[^.]+\.?\s*/gi, '')
    .replace(/Technologies repérées\s*:[^.]+\.?\s*/gi, '')
    .replace(/Priorité métier\s*:[^.]+\.?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function ajouterPhraseMetier(texte, lectureMetier) {
  const resume = String(lectureMetier || '').trim();
  const base = nettoyerPhraseMetierBase(texte);

  if (!resume) return base;
  if (!base) return resume;

  return `${resume} ${base}`;
}

function construireAngleMetier(enrichissement = {}, profilCommercial = '') {
  const profilPrincipal = enrichissement.profil_metier_principal || '';
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise);
  const principalLabel = profilPrincipalNormalise ? labelProfilMetierRadar(profilPrincipalNormalise) : 'industrielle';
  const commercialLabel = profilCommercialNormalise ? labelProfilMetierRadar(profilCommercialNormalise) : '';

  if (!profilCommercialNormalise) {
    return `Qualifier les besoins liés au projet ${principalLabel}.`;
  }

  if (profilCommercialNormalise === 'detection') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins de détection de métaux, rayons X ou contrôle corps étrangers.";
    }
    if (compatibilite > 0) {
      return "Vérifier si la nouvelle ligne intègre un point de contrôle qualité, détecteur de métaux ou inspection rayons X.";
    }
  }

  if (profilCommercialNormalise === 'pesage') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins de balance, trieuse pondérale, contrôle poids ou étiquetage poids/prix.";
    }
    if (compatibilite > 0) {
      return "Vérifier si la ligne prévoit un contrôle poids, une trieuse pondérale ou un étiquetage automatique.";
    }
  }

  if (profilCommercialNormalise === 'packaging') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins d'emballage, films, carton, étiquettes, sleeves ou conditionnement secondaire.";
    }
    if (compatibilite > 0) {
      return "Vérifier les besoins packaging associés : carton, étuis, étiquettes, marquage ou traçabilité.";
    }
  }

  if (profilCommercialNormalise === 'vision') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins de contrôle caméra, présence/absence, lecture code, OCR ou contrôle étiquette.";
    }
    if (compatibilite > 0) {
      return "Vérifier si le projet prévoit un contrôle visuel, une lecture code ou un contrôle étiquette.";
    }
  }

  if (profilCommercialNormalise === 'process') {
    if (compatibilite >= 0.85) {
      return "Qualifier les besoins de convoyage, manutention, automatisme, encaisseuse ou palettisation.";
    }
    if (compatibilite > 0) {
      return "Vérifier les besoins process associés à la ligne : flux produit, convoyage ou fin de ligne.";
    }
  }

  if (compatibilite > 0) {
    return `Qualifier l'opportunité sous l'angle ${commercialLabel}, même si la lecture principale reste ${principalLabel}.`;
  }

  return `Signal plutôt orienté ${principalLabel} ; à conserver en veille si l'entreprise est stratégique.`;
}

function construirePrioriteMetier(enrichissement = {}, profilCommercial = '') {
  const profilPrincipal = enrichissement.profil_metier_principal || '';
  const profilCommercialNormalise = normaliserSlugProfilMetierFlair(profilCommercial);
  const profilPrincipalNormalise = normaliserSlugProfilMetierFlair(profilPrincipal);
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercialNormalise);
  const commercialLabel = profilCommercialNormalise ? labelProfilMetierRadar(profilCommercialNormalise) : '';
  const principalLabel = profilPrincipalNormalise ? labelProfilMetierRadar(profilPrincipalNormalise) : 'industrielle';

  if (!profilCommercialNormalise) return '';

  if (profilCommercialNormalise === profilPrincipalNormalise || compatibilite >= 0.85) {
    return `Priorité haute pour ${commercialLabel}. Identifier rapidement le bon interlocuteur production, qualité, maintenance ou travaux neufs.`;
  }

  if (compatibilite >= 0.6) {
    return `Priorité utile mais secondaire pour ${commercialLabel}. Qualifier avant contact direct.`;
  }

  if (compatibilite > 0) {
    return `Signal indirect pour ${commercialLabel}. À surveiller ou à traiter si l'entreprise est dans la cible.`;
  }

  return `Faible priorité pour ${commercialLabel}. Lecture principale ${principalLabel}.`;
}


function enrichirScoringAvecSourceVeille(signal, resultatInitial) {

  if (
    !window.FLAIR_SOURCE_VEILLE ||
    typeof window.FLAIR_SOURCE_VEILLE.analyserSignalAvecRegles !== 'function'
  ) {
    return resultatInitial;
  }

  const enrichissement = window.FLAIR_SOURCE_VEILLE
    .analyserSignalAvecRegles(signal);

  if (!enrichissement) {
    return resultatInitial;
  }

  const profilCommercial = profilCommercialActuel();
  const profilsDetectes = profilsMetiersDetectes(enrichissement);
  const profilPrincipal = enrichissement.profil_metier_principal || '';
  const compatibilite = compatibiliteMetierPourProfil(enrichissement, profilCommercial);
  const facteurBonus = facteurBonusSelonCompatibilite(
    compatibilite,
    profilsDetectes,
    profilCommercial,
    profilPrincipal,
    enrichissement
  );
  const bonusMetier = Math.round((Number(enrichissement.score_bonus) || 0) * facteurBonus);

  let scoreFinal = Math.min(
    (resultatInitial.score_pertinence || 0) + bonusMetier,
    95
  );

  scoreFinal = capScoreSelonCompatibilite(
    scoreFinal,
    compatibilite,
    profilCommercial,
    profilPrincipal,
    profilsDetectes,
    enrichissement,
    signal
  );

  // Le score calculé ici reste le score intrinsèque / métier du signal.
  // L'affinité géographique est appliquée plus tard, lors de la distribution personnalisée
  // dans signaux_commerciaux, afin d'éviter qu'une géographie inconnue casse la valeur du signal.

  const chaleurRank = { froid: 1, tiede: 2, chaud: 3 };

  function garderChaleurLaPlusForte(...valeurs) {
    return valeurs
      .filter(Boolean)
      .sort((a, b) => (chaleurRank[b] || 0) - (chaleurRank[a] || 0))[0] || 'froid';
  }

  const chaleurScore = chaleurDepuisScoreMetier(scoreFinal);
  const chaleurSource = enrichissement.chaleur || resultatInitial.chaleur;

  // La chaleur finale reste cohérente avec le score personnalisé.
  // On évite qu'un signal métier indirect reste "chaud" uniquement parce qu'une règle générique l'a détecté.
  const chaleurFinale = profilsDetectes.length && profilCommercial
    ? chaleurScore
    : garderChaleurLaPlusForte(resultatInitial.chaleur, chaleurSource, chaleurScore);

  const lectureMetier = construireLectureMetier(enrichissement, profilCommercial);

  const phraseGeographique = '';

  const raisonMetier = ajouterPhraseMetier(
    ajouterPhraseMetier(enrichissement.raison || resultatInitial.raison_score, lectureMetier),
    phraseGeographique
  );

  const angleMetier = ajouterPhraseMetier(
    enrichissement.opportunite || resultatInitial.angle_commercial,
    construireAngleMetier(enrichissement, profilCommercial)
  );

  const actionMetier = ajouterPhraseMetier(
    enrichissement.action || resultatInitial.action_recommandee,
    construirePrioriteMetier(enrichissement, profilCommercial)
  );

  return normaliserResultatScoring({
    ...resultatInitial,

    score_pertinence: scoreFinal,

    chaleur: chaleurFinale,

    type_signal:
      enrichissement.type_signal ||
      resultatInitial.type_signal,

    raison_score: raisonMetier,

    angle_commercial: angleMetier,

    action_recommandee: actionMetier,

    profils_metiers_detectes: profilsDetectes,
    profil_metier_principal: profilPrincipal,
    sous_profils_metiers_detectes: enrichissement.sous_profils_metiers_detectes || {},
    compatibilite_metier: enrichissement.compatibilite_metier || {},
    matched_rules: reglesMetierDetectees(enrichissement)
  });
}

  async function analyserNouveauxSignaux(options = {}) {
    const { silent = false, refresh = true, max = null } = options || {};

    let query = appliquerFiltreCommercial(
      supabaseClient
        .from('signaux')
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

    const { error: updateError } = await supabaseClient
      .from('signaux')
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

  const { data: profils, error: profilsError } = await supabaseClient
    .from('commerciaux')
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
      const { error: updateProfilError } = await supabaseClient
        .from('commerciaux')
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

  const { data: commerciauxData, error: commerciauxError } = await supabaseClient
    .from('commerciaux')
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

window.resetPassword = resetPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.signUp = signUp;
window.signIn = signIn;
window.logout = logout;
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
window.chercherNouvellesOpportunitesIA = chercherNouvellesOpportunitesIA;
window.afficherVue = afficherVue;
window.envoyerInvitation = envoyerInvitation;
window.supprimerInvitation = supprimerInvitation;
window.copierLienInvitation = copierLienInvitation;

// =========================
// SESSION AUTO AU CHARGEMENT
// =========================

(async function initFlair() {
  await chargerInvitationDepuisUrl();

  if (invitationCourante) {
    return;
  }

  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    user = data.session.user;
    initUser();
  }
})();
