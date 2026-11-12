const API_BASE_URL = window.WATERKRAFT_API_BASE_URL || "http://localhost:3000";

let botaoLogin = document.getElementById("botaoLogin");
let formLogin = document.getElementById("formLogin");
let botaoRegisto = document.getElementById("botaoRegisto");
let mensagemAutenticacao = document.getElementById("mensagemAutenticacao");

// Separadores e painéis
let tabEntrar = document.getElementById("tabEntrar");
let tabCriarConta = document.getElementById("tabCriarConta");

let painelLogin = document.getElementById("painelLogin");
let painelRegisto = document.getElementById("painelRegisto");

// Alternar para o login
tabEntrar.addEventListener("click", function () {
    painelLogin.hidden = false;
    painelRegisto.hidden = true;

    tabEntrar.classList.add("tab-ativa");
    tabCriarConta.classList.remove("tab-ativa");

    mensagemAutenticacao.textContent = "";
});

// Alternar para o registo
tabCriarConta.addEventListener("click", function () {
    painelLogin.hidden = true;
    painelRegisto.hidden = false;

    tabCriarConta.classList.add("tab-ativa");
    tabEntrar.classList.remove("tab-ativa");

    mensagemAutenticacao.textContent = "";
});

// Iniciar sessão
formLogin.addEventListener("submit", function (evento) {
    evento.preventDefault();
    console.log("O formulário recebeu o submit");
    let email = document.getElementById("emailLogin").value;
    let senha = document.getElementById("senhaLogin").value;

    fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: email,
            senha: senha
        })
    })
    .then(function (resposta) {
        return resposta.json().then(function (dados) {
            if (!resposta.ok) {
                throw new Error(
                    dados.mensagem || "Erro ao iniciar sessão"
                );
            }

            return dados;
        });
    })
    .then(function (dados) {
      console.log("Avaliação concluída no servidor:", dados.usuario.avaliacao_inicial_concluida);
        // A avaliação inicial agora abre como pop-up no painel (index.html)
        window.location.href = "index.html";
    })
    .catch(function (erro) {
        mensagemAutenticacao.textContent = erro.message;
    });
});

// Criar conta
botaoRegisto.addEventListener("click", function () {
    let nome = document.getElementById("nomeRegisto").value;
    let email = document.getElementById("emailRegisto").value;
    let senha = document.getElementById("senhaRegisto").value;

    fetch(`${API_BASE_URL}/api/usuarios`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nome: nome,
            email: email,
            senha: senha
        })
    })
    .then(function (resposta) {
        return resposta.json().then(function (dados) {
            if (!resposta.ok) {
                throw new Error(
                    dados.mensagem || "Erro ao criar conta"
                );
            }

            mensagemAutenticacao.textContent =
                dados.mensagem || "Conta criada com sucesso!";
        });
    })
    .catch(function (erro) {
        mensagemAutenticacao.textContent = erro.message;
    });
});
