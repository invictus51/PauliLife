(function () {
  const config = window.ECO_CONFIG || {};
  function validateConfig() {
    const { supabaseUrl, supabaseAnonKey } = config;

    if (!supabaseUrl || !supabaseAnonKey) {
      return false;
    }

    if (
      !supabaseUrl.startsWith("https://") ||
      supabaseUrl.includes("COLE_A_") ||
      supabaseAnonKey.includes("COLE_A_")
    ) {
      return false;
    }
    return true;
  }
  function initializeSupabase() {
    if (!window.supabase || !validateConfig()) {
      window.ecoClient = null;

      console.warn(
        "Configure a URL e a chave do Supabase em js/config.js."
      );

      return;
    }

    window.ecoClient = window.supabase.createClient(
      config.supabaseUrl,
      config.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }
  initializeSupabase();
})();


