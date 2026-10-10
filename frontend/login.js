
let botaoLogin = document.getElementById("botaoLogin");
let mensagemAutenticacao = document.getElementById("mensagemAutenticacao");

botaoLogin.addEventListener("click", function () {
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
                throw new Error(dados.mensagem || "Erro ao iniciar sessão");
            }

            return dados;
        });
    })
    .then(function (dados) {
        sessionStorage.setItem("token", dados.token);
        window.location.href = "index.html";
    })
    .catch(function (erro) {
        mensagemAutenticacao.textContent = erro.message;
    });
});


let botaoRegisto = document.getElementById("botaoRegisto");

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
                throw new Error(dados.mensagem || "Erro ao criar conta");
            }

            return dados;
        });
    })
    .then(function (dados) {
        mensagemAutenticacao.textContent = dados.mensagem;
    })
    .catch(function (erro) {
        mensagemAutenticacao.textContent = erro.message;
    });
});

