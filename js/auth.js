
(function () {
  const client = window.ecoClient;
  const message = document.getElementById("auth-message");

  function showMessage(text, isError = false) {
    if (!message) return;

    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function validateClient() {
    if (!client) {
      showMessage(
        "Configure o Supabase em js/config.js e execute supabase/schema.sql.",
        true
      );
      return false;
    }

    return true;
  }

  const formularioCadastro = document.getElementById("cadastro-form");

  async function cadastrarUsuario(evento) {
    evento.preventDefault();

    if (!validateClient()) return;

    const nomeCompleto = document
      .getElementById("full-name")
      .value
      .trim()
      .replace(/\s+/g, " ");

    const email = document
      .getElementById("email")
      .value
      .trim()
      .toLowerCase();

    const senha = document.getElementById("password").value;

    const confirmacaoSenha = document
      .getElementById("password-confirm")
      .value;

  
    if (nomeCompleto.length < 3 || nomeCompleto.length > 100) {
      showMessage(
        "Informe um nome com pelo menos 3 caracteres.",
        true
      );
      return;
    }

   
    if (senha.length < 5) {
      showMessage(
        "A senha precisa ter no mínimo 5 caracteres.",
        true
      );
      return;
    }

   
    if (senha !== confirmacaoSenha) {
      showMessage("As duas senhas não são iguais.", true);
      return;
    }

    const botaoCadastro = document.getElementById("cadastro-submit");

    botaoCadastro.disabled = true;
    botaoCadastro.textContent = "Criando conta...";

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password: senha,
        options: {
          data: {
            full_name: nomeCompleto
          }
        }
      });

      if (error) throw error;

      if (!data.session) {
        showMessage(
          "A conta foi criada, mas exige confirmação. Verifique as configurações de confirmação de e-mail.",
          true
        );
        return;
      }

      showMessage("Sua conta foi criada com sucesso.");

      window.setTimeout(() => {
        window.location.href = "index.html";
      }, 900);

    } catch (error) {
      showMessage(
        "Não foi possível criar sua conta. Confira o e-mail antes da próxima tentativa. " +
        (error.message || ""),
        true
      );

    } finally {
      botaoCadastro.disabled = false;
      botaoCadastro.textContent = "Criar conta";
    }
  }

  if (formularioCadastro) {
    formularioCadastro.addEventListener(
      "submit",
      cadastrarUsuario
    );
  }

  const loginForm = document.getElementById("login-form");
  const adminLoginForm = document.getElementById("admin-login-form");

  
  async function authenticateUser(email, password, isAdmin) {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("full_name, is_admin")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      await client.auth.signOut();

      throw new Error(
        "Não foi possível carregar seu perfil."
      );
    }

    
    if (isAdmin && !profile.is_admin) {
      await client.auth.signOut();

      throw new Error(
        "Esta conta não possui a permissão necessária."
      );
    }



    window.location.href = isAdmin
      ? "painel.html"
      : "index.html";
  }

 
  function setupLoginForm(form, isAdmin = false) {
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!validateClient()) return;

      const email = document
        .getElementById("email")
        .value
        .trim()
        .toLowerCase();

      const password = document
        .getElementById("password")
        .value;

      const button = form.querySelector(
        "button[type='submit']"
      );

      button.disabled = true;
      button.textContent = "Verificando...";

      try {
        await authenticateUser(email, password, isAdmin);

      } catch (error) {
        showMessage(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message || "Não foi possível entrar.",
          true
        );

      } finally {
        button.disabled = false;
        button.textContent = isAdmin
          ? "Acessar painel"
          : "Entrar";
      }
    });
  }

  
  setupLoginForm(loginForm);
  setupLoginForm(adminLoginForm, true);

})();



