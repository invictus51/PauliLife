
(function () {
  const client = window.ecoClient;
  const list = document.getElementById("reports-admin-list");
  const message = document.getElementById("admin-message");
  const emailDialog = document.getElementById("email-review-dialog");

  let reports = [];

  function setMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }

  function escapeHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, (caractere) => {
      switch (caractere) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        case "'":
          return "&#39;";
        default:
          return caractere;
      }
    });
  }

  function dateLabel(value) {
    return value
      ? new Date(value).toLocaleString("pt-BR")
      : "Data não foi informada";
  }

  function statusClass(status) {
    return status === "Concluída" ? "concluida" : "recebida";
  }

  function updateStats() {
    let abertas = 0;
    let concluidas = 0;

    for (const report of reports) {
      if (report.status === "Concluída") {
        concluidas++;
      } else {
        abertas++;
      }
    }

    document.getElementById("stat-total").textContent = reports.length;
    document.getElementById("stat-open").textContent = abertas;
    document.getElementById("stat-done").textContent = concluidas;
  }

  function renderReports() {
    if (!reports.length) {
      list.innerHTML =
        '<div class="empty-state">Não há nenhuma denúncia.</div>';
      return;
    }

    list.innerHTML = reports
      .map((report) => {
        const isDone = report.status === "Concluída";

        const mapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(report.latitude)}&mlon=${encodeURIComponent(report.longitude)}#map=17/${encodeURIComponent(report.latitude)}/${encodeURIComponent(report.longitude)}`;

        return `
          <article class="report-admin-card" data-id="${escapeHTML(report.id)}">
            <div class="report-card-top">
              <div>
                <h3>${escapeHTML(report.category)}</h3>
                <div class="report-meta">
                  Registrada por
                  <strong>${escapeHTML(report.reporter_name || "Morador")}</strong>
                  · ${escapeHTML(dateLabel(report.created_at))}
                </div>
              </div>

              <span class="status-pill ${statusClass(report.status)}">
                ${isDone ? "Concluída" : "Recebida"}
              </span>
            </div>

            <div class="report-location">
              Localização aproximada:
              ${Number(report.latitude).toFixed(4)},
              ${Number(report.longitude).toFixed(4)}
              ·
              <a href="${mapUrl}" target="_blank" rel="noopener noreferrer">
                Abrir no mapa ↗
              </a>
            </div>

            <div class="admin-actions">
              <button class="btn btn-primary" data-action="prepare-email">
                Revisar e preparar e-mail
              </button>

              <button
                class="btn ${isDone ? "btn-outline" : "btn-primary"}"
                data-action="toggle"
              >
                ${isDone ? "Reabrir denúncia" : "Marcar como concluída"}
              </button>

              <button class="btn btn-danger" data-action="delete">
                Excluir
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function buildEmailBody(report) {
    const latitude = Number(report.latitude).toFixed(4);
    const longitude = Number(report.longitude).toFixed(4);

    const mapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(latitude)}&mlon=${encodeURIComponent(longitude)}#map=17/${encodeURIComponent(latitude)}/${encodeURIComponent(longitude)}`;

    return [
      "Prezados(as),",
      "",
      "Análise de uma denúncia ambiental registrada na plataforma PauliLife:",
      "",
      `Tipo de ocorrência: ${report.category || "Não informado"}`,
      `Registrada por: ${report.reporter_name || "Morador"}`,
      `Data do registro: ${dateLabel(report.created_at)}`,
      `Identificação da denúncia: ${report.id}`,
      `Longitude: ${longitude}`,
      `Latitude: ${latitude}`,
      `Localização no mapa: ${mapUrl}`,
      `Status no PauliLife: ${report.status || "Recebida"}`,
      "",
      "Peço, por gentileza, uma análise sobre esta ocorrência e a tomada das devidas ações necessárias.",
      "",
      "Att.te,",
      "Adm da plataforma PauliLife"
    ].join("\n");
  }

  function openEmailReview(report) {
    if (!emailDialog?.showModal) {
      setMessage(
        "Seu navegador não possui suporte à janela de revisão.",
        true
      );
      return;
    }

    document.getElementById("email-report-summary").textContent =
      `${report.category} · ${report.reporter_name || "Morador"} · ${dateLabel(report.created_at)}`;

    document.getElementById("email-to").value =
      "seddema@paulinia.sp.gov.br";

    document.getElementById("email-subject").value =
      `Denúncia ambiental PauliLife – ${report.category} – ${report.id.slice(0, 8)}`;

    document.getElementById("email-body").value =
      buildEmailBody(report);

    document.getElementById("email-draft-message").textContent = "";

    emailDialog.querySelector(".email-copy-fallback")?.remove();
    emailDialog.showModal();
  }

  function getEmailDraft() {
    return {
      to: document.getElementById("email-to").value.trim(),
      subject: document.getElementById("email-subject").value.trim(),
      body: document.getElementById("email-body").value.trim()
    };
  }

  async function copyEmailDraft() {
    const draft = getEmailDraft();
    const draftMessage = document.getElementById("email-draft-message");

    if (
      !draft.to ||
      !draft.subject ||
      !draft.body ||
      !document.getElementById("email-to").checkValidity()
    ) {
      draftMessage.textContent =
        "Confira o destinatário e a mensagem.";
      return;
    }

    const emailText =
      `Para: ${draft.to}\n` +
      `Assunto: ${draft.subject}\n\n` +
      draft.body;

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Área de transferência indisponível");
      }

      await navigator.clipboard.writeText(emailText);

      draftMessage.textContent =
        "Destinatário e mensagem copiados. Agora você pode colá-los no seu e-mail.";
    } catch (erro) {
      emailDialog.querySelector(".email-copy-fallback")?.remove();

      const campoCopia = document.createElement("textarea");

      campoCopia.className = "email-copy-fallback";
      campoCopia.setAttribute(
        "aria-label",
        "Conteúdo completo do e-mail para copiar"
      );

      campoCopia.readOnly = true;
      campoCopia.value = emailText;

      emailDialog.append(campoCopia);

      campoCopia.focus();
      campoCopia.select();

      draftMessage.textContent =
        "Copie o texto selecionado e cole no seu e-mail.";
    }
  }

  function openMailApplication() {
    const draft = getEmailDraft();
    const toField = document.getElementById("email-to");

    if (
      !draft.to ||
      !draft.subject ||
      !draft.body ||
      !toField.checkValidity()
    ) {
      document.getElementById("email-draft-message").textContent =
        "Confira o destinatário e a mensagem antes de abrir o e-mail.";
      return;
    }

    const mailto = `mailto:${draft.to}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;

    window.location.href = mailto;
    emailDialog.close();

    setMessage("Rascunho preparado no aplicativo de e-mail.");
  }

  async function loadReports() {
    if (!client) {
      list.innerHTML =
        '<div class="empty-state">Configure o Supabase em js/config.js.</div>';
      return;
    }

    list.innerHTML =
      '<div class="loading-state">Carregando denúncias...</div>';

    const { data, error } = await client
      .from("reports")
      .select(
        "id, reporter_name, category, latitude, longitude, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      list.innerHTML =
        '<div class="empty-state">Não foi possível carregar as denúncias.</div>';

      setMessage(error.message, true);
      return;
    }

    reports = data || [];

    updateStats();
    renderReports();
    setMessage("");
  }

  async function ensureAdmin() {
    if (!client) {
      window.location.href = "login.html";
      return false;
    }

    const {
      data: { session }
    } = await client.auth.getSession();

    if (!session) {
      window.location.href = "login.html";
      return false;
    }

    const { data: profile, error } = await client
      .from("profiles")
      .select("full_name, is_admin")
      .eq("id", session.user.id)
      .single();

    if (error || !profile?.is_admin) {
      await client.auth.signOut();
      window.location.href = "login.html";
      return false;
    }

    document.getElementById("admin-username").textContent =
      profile.full_name || "Administrador";

    return true;
  }

  list.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const card = button.closest(".report-admin-card");
    const id = card?.dataset.id;
    const report = reports.find((item) => item.id === id);

    if (!id || !report) return;

    const action = button.dataset.action;

    if (action === "prepare-email") {
      openEmailReview(report);
      return;
    }

    button.disabled = true;

    try {
      if (action === "toggle") {
        const nextStatus =
          report.status === "Concluída" ? "Recebida" : "Concluída";

        const { error } = await client
          .from("reports")
          .update({ status: nextStatus })
          .eq("id", id);

        if (error) throw error;

        setMessage(
          nextStatus === "Concluída"
            ? "Denúncia marcada como concluída."
            : "Denúncia reaberta."
        );

        await loadReports();
      }

      if (action === "delete") {
        if (
          !confirm(
            "Tem certeza de que deseja excluir esta denúncia? Esta ação não pode ser desfeita."
          )
        ) {
          return;
        }

        const { error } = await client
          .from("reports")
          .delete()
          .eq("id", id);

        if (error) throw error;

        setMessage("Denúncia excluída.");
        await loadReports();
      }
    } catch (error) {
      setMessage(
        error.message || "Ocorreu um erro ao executar a ação.",
        true
      );
    } finally {
      button.disabled = false;
    }
  });

  document
    .getElementById("close-email-dialog")
    .addEventListener("click", () => emailDialog.close());

  document
    .getElementById("copy-email-button")
    .addEventListener("click", copyEmailDraft);

  document
    .getElementById("open-email-button")
    .addEventListener("click", openMailApplication);

  emailDialog.addEventListener("click", (event) => {
    if (event.target === emailDialog) {
      emailDialog.close();
    }
  });

  document
    .getElementById("refresh-button")
    .addEventListener("click", loadReports);

  document
    .getElementById("logout-button")
    .addEventListener("click", async () => {
      await client?.auth.signOut();
      window.location.href = "login.html";
    });

  (async function start() {
    const allowed = await ensureAdmin();

    if (allowed) {
      await loadReports();

      client
        .channel("admin-reports-feed")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reports" },
          loadReports
        )
        .subscribe();
    }
  })();
})();
