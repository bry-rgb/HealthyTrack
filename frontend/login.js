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

    fetch("http://localhost:3000/api/login", {
        method: "POST",
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
        sessionStorage.setItem("token", dados.token);

      console.log("Avaliação concluída no servidor:", dados.usuario.avaliacao_inicial_concluida);
        if (dados.usuario.avaliacao_inicial_concluida) {
    window.location.href = "index.html";
        } else {
    window.location.href = "avaliacao-inicial.html";
    }
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

    fetch("http://localhost:3000/api/usuarios", {
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
