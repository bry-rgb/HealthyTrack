
let token = sessionStorage.getItem("token");

if (!token) {
    window.location.href = "login.html";
}

function verificarResposta(resposta) {
    if (resposta.status === 401) {
        sessionStorage.removeItem("token");
        window.location.href = "sessao-expirada.html";
        throw new Error("Sessão expirada. Inicia sessão novamente.");
    }

    return resposta;
}

// Elementos HTML
let selecionarMeta = document.getElementById("meta");
let botaoMeta = document.getElementById("salvarMeta");
let botao = document.getElementById("botaoAgua");
let botaoLogout = document.getElementById("botaoLogout");

let mensagemMeta = document.getElementById("mensagemMeta");
let mensagemFalta = document.getElementById("mensagemFalta");
let quantidadeAgua = document.getElementById("agua");
let listaAgua = document.getElementById("listaAgua");

// Estado inicial
let agua = 0;
let metaAgua = 2.5;
let falta = metaAgua - agua;

// Atualizar a interface
function atualizarTela() {
    quantidadeAgua.textContent = `${Number(agua.toFixed(2))} L`;

    falta = Math.max(0, Number((metaAgua - agua).toFixed(2)));

    if (agua >= metaAgua) {
        mensagemMeta.textContent = "Meta Atingida 🎉";
        mensagemFalta.textContent = "";
    } else {
        mensagemMeta.textContent = "";
        mensagemFalta.textContent = `Ainda faltam ${falta} L`;
    }
}

// Carregar a meta guardada no PostgreSQL
async function carregarMetaDiaria() {
    try {
        const resposta = await fetch(
            "http://localhost:3000/api/meta-diaria",
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        verificarResposta(resposta);

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem || "Não foi possível carregar a meta."
            );
        }

        const metaRecebida = Number(dados.meta_diaria);

        if (!Number.isFinite(metaRecebida)) {
            throw new Error("A API não devolveu uma meta válida.");
        }

        metaAgua = metaRecebida;
        selecionarMeta.value = String(metaAgua);

        atualizarTela();
    } catch (erro) {
        console.error("Erro ao carregar a meta diária:", erro);
        mensagemMeta.textContent = "Não foi possível carregar a meta diária.";
    }
}

// Guardar uma nova meta no PostgreSQL
botaoMeta.addEventListener("click", async function () {
    const novaMeta = Number(selecionarMeta.value);

    if (
        selecionarMeta.value === "" ||
        !Number.isFinite(novaMeta) ||
        novaMeta < 0.5 ||
        novaMeta > 10
    ) {
        mensagemMeta.textContent =
            "Escolhe uma meta entre 0,5 e 10 litros.";
        return;
    }

    try {
        const resposta = await fetch(
            "http://localhost:3000/api/meta-diaria",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    meta_diaria: novaMeta
                })
            }
        );

        verificarResposta(resposta);

        const dados = await resposta.json();

        if (!resposta.ok) {
            mensagemMeta.textContent =
                dados.mensagem || "Não foi possível guardar a meta.";
            return;
        }

        metaAgua = Number(dados.meta_diaria);
        selecionarMeta.value = String(metaAgua);

        atualizarTela();

        mensagemMeta.textContent =
            "Meta diária guardada com sucesso!";
    } catch (erro) {
        console.error("Erro ao guardar a meta diária:", erro);

        if (erro.message !== "Sessão expirada. Inicia sessão novamente.") {
            mensagemMeta.textContent =
                "Não foi possível guardar a meta diária.";
        }
    }
});

// Mostrar o histórico de água
function mostrarHistorico(registros) {
    listaAgua.innerHTML = "";

    for (let i = 0; i < registros.length; i++) {
        const registro = registros[i];
        const item = document.createElement("p");
        const data = new Date(registro.horario);

        const hora = data.toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit"
        });

        item.textContent =
            "💧 " + registro.quantidade + " L - " + hora;

        listaAgua.appendChild(item);
    }
}

// Carregar os registos de água do utilizador
async function carregarRegistrosAgua() {
    try {
        const resposta = await fetch(
            "http://localhost:3000/api/registros-agua",
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        verificarResposta(resposta);

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error("Não foi possível carregar os registos.");
        }

        let total = 0;

        for (let i = 0; i < dados.length; i++) {
            total += Number(dados[i].quantidade);
        }

        agua = Number(total.toFixed(2));

        atualizarTela();
        mostrarHistorico(dados);
    } catch (erro) {
        console.error("Erro ao carregar os registos de água:", erro);
    }
}

// Registar água
async function adicionarAgua(quantidade) {
    const registro = {
        quantidade: quantidade,
        horario: new Date().toISOString()
    };

    try {
        const resposta = await fetch(
            "http://localhost:3000/api/registros-agua",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(registro)
            }
        );

        verificarResposta(resposta);

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem || "Não foi possível registar a água."
            );
        }

        await carregarRegistrosAgua();
    } catch (erro) {
        console.error("Erro ao registar água:", erro);
    }
}

// Botão para adicionar 0,5 L
botao.addEventListener("click", function () {
    adicionarAgua(0.5);
});

// Limpar o histórico
async function limparHistorico() {
    const confirmar = confirm(
        "Tem certeza que deseja limpar o histórico?"
    );

    if (!confirmar) {
        return;
    }

    try {
        const resposta = await fetch(
            "http://localhost:3000/api/registros-agua",
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        verificarResposta(resposta);

        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                dados.mensagem || "Não foi possível limpar o histórico."
            );
        }

        agua = 0;

        atualizarTela();
        mostrarHistorico([]);
    } catch (erro) {
        console.error("Erro ao limpar o histórico:", erro);
    }
}

// Terminar sessão
botaoLogout.addEventListener("click", function () {
    sessionStorage.removeItem("token");
    window.location.href = "login.html";
});

// Carregar os dados ao abrir a página
carregarRegistrosAgua();
carregarMetaDiaria();
