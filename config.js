// Paramètres de connexion à Supabase.
// Supabase > Project Settings > API (ou Data API) :
//   SUPABASE_URL      = "Project URL"
//   SUPABASE_ANON_KEY = clé publique ("anon" ou "publishable").
// Ces deux valeurs sont publiques par conception : la sécurité repose sur la base.
// Ne mettez JAMAIS ici la clé "service_role" ou "secret".
window.UNIS_CONFIG = {
  SUPABASE_URL: "https://VOTRE-PROJET.supabase.co",
  SUPABASE_ANON_KEY: "VOTRE-CLE-PUBLIQUE"
};
