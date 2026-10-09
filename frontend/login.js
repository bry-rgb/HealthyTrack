
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
