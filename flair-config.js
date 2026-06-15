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

    if (invitationCourante && authContext.normaliserEmail(invitationCourante.email) !== email) {
      alert("Merci d'utiliser l'email associé à cette invitation.");
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({ email, password });

    if (error) {
      alert("Erreur création compte : " + error.message);
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

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      alert("Erreur connexion : " + error.message);
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
