(function () {
  const client = window.ecoClient;
  const categories = [
    "Descarte irregular de lixo", "Poluição da água", "Queimada"
  ];

  const form = document.getElementById("form-denuncia");
  const prompt = document.getElementById("report-login-prompt");
  const accountActions = document.getElementById("account-actions");
  const reportMessage = document.getElementById("report-message");

  let currentUser = null;

  function updateTotal(total) {
    const target = document.getElementById("hero-total");

    if (target) {
      target.textContent = String(total);
    }
  }

  function showReportMessage(text, error = false) {
    if (!reportMessage) return;

    reportMessage.textContent = text;
    reportMessage.classList.toggle("error", error);
  }

  async function loadReports() {
    if (!client || !window.EcoMapa) {
      console.warn("Cliente ou mapa não encontrado.");
      return;
    }

    try {
      const { data: reports, error } = await client
        .from("reports")
        .select(
          "id, category, latitude, longitude, status, reporter_name, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      window.EcoMapa.clearReports();

      for (const report of reports ?? []) {
        window.EcoMapa.addOrUpdateReport(report);
      }

      updateTotal(reports?.length ?? 0);

    } catch (error) {
      console.error("Erro ao carregar denúncias:", error.message);
    }
  }

  function renderAccountActions(profile) {
    if (!accountActions) return;

    accountActions.replaceChildren();

    const greeting = document.createElement("span");
    greeting.className = "signed-user";
    greeting.textContent = `Olá, ${profile?.full_name || "morador"}`;

    const logout = document.createElement("button");
    logout.id = "logout-public";
    logout.className = "btn btn-outline btn-small";
    logout.textContent = "Sair";
    logout.type = "button";

    logout.addEventListener("click", async () => {
      await client.auth.signOut();
      window.location.reload();
    });

    accountActions.append(greeting, logout);
  }

  async function updateAccount() {
    if (!client) {
      if (prompt) {
        prompt.querySelector("p").textContent =
          "A conexão com o banco de dados nao está configurada.";
      }

      return;
    }

    const {
      data: { session }
    } = await client.auth.getSession();

    currentUser = session?.user || null;

    if (currentUser) {
      const { data: profile } = await client
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser.id)
        .single();

      if (prompt) {
        prompt.classList.add("hidden");
      }

      if (form) {
        form.classList.remove("hidden");
      }

      const signed = document.getElementById("signed-user");

      if (signed) {
        signed.textContent = profile?.full_name || "Conectado";
      }

      renderAccountActions(profile);

    } else {
      if (prompt) {
        prompt.classList.remove("hidden");
      }

      if (form) {
        form.classList.add("hidden");
      }

      if (accountActions) {
        accountActions.innerHTML =
          '<a class="btn btn-outline btn-small" href="login.html">Entrar</a>' +
          '<a class="btn btn-primary btn-small" href="cadastro.html">Criar conta</a>';
      }
    }
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!client) {
        showReportMessage(
          "A conexão com o banco de dados não está configurada.",
          true
        );
        return;
      }

      if (!currentUser) {
        showReportMessage(
          "Entre na sua conta para conseguir registrar sua denúncia.",
          true
        );
        return;
      }

      const location = window.EcoMapa?.selectedLocation;

      if (!location) {
        showReportMessage(
          "Clique no mapa para selecionar o local da sua ocorrência.",
          true
        );

        document
          .getElementById("mapa-paulina")
          ?.scrollIntoView({ behavior: "smooth" });

        return;
      }

      const category = document.getElementById("categoria").value;

      if (!categories.includes(category)) {
        showReportMessage(
          "Selecione o tipo da ocorreência.",
          true
        );
        return;
      }

      const button = document.getElementById("btn-enviar");

      button.disabled = true;
      button.textContent = "Enviando...";

      try {
        const { data, error } = await client
          .from("reports")
          .insert({
            user_id: currentUser.id,
            category,
            latitude: location.latitude,
            longitude: location.longitude
          })
          .select(
            "id, category, latitude, longitude, status, reporter_name, created_at"
          )
          .single();

        if (error) {
          throw error;
        }

        window.EcoMapa.addOrUpdateReport(data);
        window.EcoMapa.clearSelection();

        form.reset();

        showReportMessage("Denúncia recebida");

        await loadReports();

      } catch (error) {
        showReportMessage(
          "Não foi possível registrat a sua denúncia. Tente novamente mais tarde. " +
          (error.message || ""),
          true
        );

      } finally {
        button.disabled = false;
        button.textContent = "Enviar a denúncia";
      }
    });
  }

  document
    .getElementById("limpar-local")
    ?.addEventListener("click", () => {
      window.EcoMapa?.clearSelection();
    });


  const year = document.getElementById("ano");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  async function initializeApp() {
    await updateAccount();
    await loadReports();

    if (!client) return;

    initializeRealtime();
    initializeAuthListener();
  }

  function initializeRealtime() {
    client
      .channel("public-reports-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reports"
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            window.EcoMapa?.removeReport(payload.old.id);

          } else {
            window.EcoMapa?.addOrUpdateReport(payload.new);
          }

          loadReports();
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn(
            "Não foi possível conectar às atualizações em tempo real."
          );
        }
      });
  }

  function initializeAuthListener() {
    client.auth.onAuthStateChange(() => {
      updateAccount();
    });
  }

  initializeApp();

})();


