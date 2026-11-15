(function () {
  "use strict";
  var config = window.WATERKRAFT_LOGIN || {};
  var formulario = document.getElementById("formulario-login");
  var formularioRegisto = document.getElementById("formulario-registo");
  var moldura = document.querySelector(".login-moldura");
  var titulo = moldura.querySelector(".login-cabecalho h2");
  var subtitulo = moldura.querySelector(".login-cabecalho p");
  var erroLogin = document.getElementById("erro-login");
  var erroRegisto = document.getElementById("erro-registo");
  function mostrarRegisto(evento) {
    if (evento) evento.preventDefault();
    formulario.hidden = true;
    formularioRegisto.hidden = false;
    titulo.textContent = "Uma nova aventura";
    subtitulo.textContent = "Cria a tua conta WaterKraft.";
    erroLogin.hidden = true;
    erroRegisto.hidden = true;
    document.getElementById("nome-registo").focus();
  }
  function mostrarLogin(evento) {
    if (evento) evento.preventDefault();
    formularioRegisto.hidden = true;
    formulario.hidden = false;
    titulo.textContent = "Bem-vindo de volta";
    subtitulo.textContent = "A tua lagoa esperou por ti.";
    erroLogin.hidden = true;
    erroRegisto.hidden = true;
    document.getElementById("email").focus();
  }
  document.querySelectorAll("[data-mostrar-registo]").forEach(function (link) { link.addEventListener("click", mostrarRegisto); });
  document.querySelectorAll("[data-mostrar-login]").forEach(function (link) { link.addEventListener("click", mostrarLogin); });

  var senha = document.getElementById("senha");
  var mostrarSenha = document.querySelector(".mostrar-senha");
  mostrarSenha.addEventListener("click", function () {
    var mostrar = senha.type === "password";
    senha.type = mostrar ? "text" : "password";
    mostrarSenha.setAttribute("aria-pressed", String(mostrar));
    mostrarSenha.setAttribute("aria-label", mostrar ? "Esconder palavra-passe" : "Mostrar palavra-passe");
  });

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    erroLogin.hidden = true;
    if (!formulario.checkValidity()) { formulario.reportValidity(); return; }
    var botao = formulario.querySelector("button[type='submit']");
    botao.disabled = true;
    botao.classList.add("a-carregar");
    botao.querySelector("span").textContent = "A abrir a tua jornada…";
    try {
      var resposta = await fetch(config.endpoint || `${window.WATERKRAFT_API_BASE_URL || "http://localhost:3000"}/api/login`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formulario.email.value.trim(), senha: senha.value })
      });
      var dados = await resposta.json().catch(function () { return {}; });
      if (!resposta.ok) throw new Error(dados.mensagem || "Não foi possível entrar. Tenta novamente.");
      window.location.assign(config.redirectAfterLogin || "index.html");
    } catch (erro) {
      erroLogin.textContent = erro.message || "Não foi possível ligar ao servidor. Tenta novamente.";
      erroLogin.hidden = false;
      botao.disabled = false;
      botao.classList.remove("a-carregar");
      botao.querySelector("span").textContent = "Entrar na minha jornada";
    }
  });

  formularioRegisto.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    erroRegisto.hidden = true;
    if (!formularioRegisto.checkValidity()) { formularioRegisto.reportValidity(); return; }
    var botao = formularioRegisto.querySelector("button[type='submit']");
    botao.disabled = true;
    try {
      var resposta = await fetch(config.registerEndpoint || `${window.WATERKRAFT_API_BASE_URL || "http://localhost:3000"}/api/usuarios`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: formularioRegisto.nome.value.trim(), email: formularioRegisto.email.value.trim(), senha: formularioRegisto.senha.value })
      });
      var dados = await resposta.json().catch(function () { return {}; });
      if (!resposta.ok) throw new Error(dados.mensagem || "Não foi possível criar a conta.");
      formulario.email.value = formularioRegisto.email.value.trim();
      formularioRegisto.reset();
      mostrarLogin();
      erroLogin.textContent = dados.mensagem || "Conta criada com sucesso! Já podes entrar.";
      erroLogin.hidden = false;
    } catch (erro) {
      erroRegisto.textContent = erro.message || "Não foi possível ligar ao servidor. Tenta novamente.";
      erroRegisto.hidden = false;
    } finally { botao.disabled = false; }
  });

  // Virar as cartas da demonstração.
  document.querySelectorAll(".carta-tarot").forEach(function (carta) {
    carta.addEventListener("click", function () {
      var virada = carta.classList.toggle("virada");
      carta.setAttribute("aria-pressed", String(virada));
      carta.setAttribute("aria-label", (virada ? "Esconder " : "Revelar ") + carta.dataset.nome);
      carta.parentElement.querySelector("p").textContent = virada ? carta.dataset.nome.toUpperCase() : "TOCA PARA REVELAR";
    });
  });

  // Entrada suave das secções. Sem IntersectionObserver, todo o conteúdo fica visível.
  var seccoes = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add("visivel");
          observador.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    seccoes.forEach(function (seccao) { observador.observe(seccao); });
  } else {
    seccoes.forEach(function (seccao) { seccao.classList.add("visivel"); });
  }
})();
