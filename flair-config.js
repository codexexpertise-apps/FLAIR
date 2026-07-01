// =========================================================================
// FLAIR — CONFIGURATION & AUTH V1.6
// =========================================================================
// Rôle : centraliser la configuration Supabase, les constantes globales et
// les fonctions d'authentification simples.
// =========================================================================
(function () {
  "use strict";

  const SUPABASE_URL = "https://viafuquomtshuzuldwpq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYWZ1cXVvbXRzaHV6dWxkd3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTkyODUsImV4cCI6MjA5MzQ3NTI4NX0.KtUZPsG04HF0AtdTCwYLyaH8IFBI2BBELIageV2xiM8";

  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("FLAIR_CONFIG : librairie Supabase non chargée.");
  }

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabaseClient = supabaseClient;
  window.__FLAIR_SUPABASE_CLIENT__ = supabaseClient;

  const authContext = {
    getInvitationCourante: () => null,
    setUser: () => {},
    initUser: async () => {},
    normaliserEmail: (email) => String(email || "").trim().toLowerCase(),
    invitationCorrespondUtilisateur: () => true
  };

  function setAuthContext(context) {
    Object.assign(authContext, context || {});
  }

  async function resetPassword() {
    const emailInput = document.getElementById("email");
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
      alert("Veuillez saisir votre email avant de réinitialiser le mot de passe.");
      return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });

    if (error) {
      alert("Erreur réinitialisation : " + error.message);
      return;
    }

    alert("Un email de réinitialisation vient d’être envoyé.");
  }

  function togglePasswordVisibility() {
    const input = document.getElementById("password");
    const btn = document.querySelector(".toggle-password-btn");
    if (!input) return;

    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";

    if (btn) {
      btn.classList.toggle("is-visible", isHidden);
      btn.setAttribute("aria-label", isHidden ? "Masquer le mot de passe" : "Afficher le mot de passe");
      btn.setAttribute("title", isHidden ? "Masquer le mot de passe" : "Afficher le mot de passe");
    }
  }

  async function signUp() {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const email = authContext.normaliserEmail(emailInput ? emailInput.value : "");
    const password = passwordInput ? passwordInput.value.trim() : "";
    const invitationCourante = authContext.getInvitationCourante();

    if (!email) {
      alert("Merci de saisir votre adresse email.");
      emailInput?.focus();
      return;
    }

    if (!password) {
      alert("Merci de choisir un mot de passe.");
      passwordInput?.focus();
      return;
    }

    if (password.length < 6) {
      alert("Le mot de passe doit contenir au moins 6 caractères.");
      passwordInput?.focus();
      return;
    }

    if (invitationCourante && authContext.normaliserEmail(invitationCourante.email) !== email) {
      alert("Merci d'utiliser l'email associé à cette invitation.");
      emailInput?.focus();
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      const message = String(error.message || "").toLowerCase();

      if (message.includes("anonymous sign-ins are disabled")) {
        alert("Création impossible : merci de vérifier que l’email et le mot de passe sont bien renseignés.");
        return;
      }

      if (message.includes("user already registered") || message.includes("already registered") || message.includes("already exists")) {
        alert("Un espace FLAIR existe déjà avec cette adresse. Cliquez sur “Se connecter”.");
        return;
      }

      if (message.includes("password")) {
        alert("Création impossible : le mot de passe doit contenir au moins 6 caractères.");
        return;
      }

      if (message.includes("email")) {
        alert("Création impossible : merci de vérifier le format de votre adresse email.");
        return;
      }

      alert("Création impossible. Merci de vérifier votre email et votre mot de passe.");
      return;
    }

    if (data?.user && data?.session) {
      authContext.setUser(data.user);
      await authContext.initUser();
      return;
    }

    alert("Compte créé. Vous pouvez maintenant vous connecter.");
  }

  async function signIn() {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const email = authContext.normaliserEmail(emailInput ? emailInput.value : "");
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (!email) {
      alert("Merci de saisir votre adresse email.");
      emailInput?.focus();
      return;
    }

    if (!password) {
      alert("Merci de saisir votre mot de passe.");
      passwordInput?.focus();
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      const message = String(error.message || "").toLowerCase();

      if (message.includes("invalid login credentials")) {
        alert("Connexion impossible : aucun compte n’existe avec cette adresse ou le mot de passe est incorrect. Si c’est votre première connexion, cliquez sur “Créer mon espace FLAIR”.");
        return;
      }

      if (message.includes("anonymous sign-ins are disabled")) {
        alert("Connexion impossible : merci de saisir votre email et votre mot de passe. Si c’est votre première connexion, cliquez sur “Créer mon espace FLAIR”.");
        return;
      }

      if (message.includes("email")) {
        alert("Connexion impossible : merci de vérifier le format de votre adresse email.");
        return;
      }

      alert("Connexion impossible. Merci de vérifier votre email et votre mot de passe.");
      return;
    }

    authContext.setUser(data.user);
    await authContext.initUser();
  }

  async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
  }

  async function initFlairSession(context) {
    const sessionContext = { ...authContext, ...(context || {}) };

    await sessionContext.chargerInvitationDepuisUrl?.();

    if (sessionContext.getInvitationCourante?.()) {
      return;
    }

    const { data } = await supabaseClient.auth.getSession();

    if (data?.session) {
      sessionContext.setUser(data.session.user);
      await sessionContext.initUser();
    }
  }

  window.FLAIR_CONFIG = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    supabaseClient,
    setAuthContext,
    resetPassword,
    togglePasswordVisibility,
    signUp,
    signIn,
    logout,
    initFlairSession
  };
})();
