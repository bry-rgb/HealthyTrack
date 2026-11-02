
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

// Consultar a avaliação e mostrar o aviso, se necessário
async function verificarAvisoMetaMedica() {
    const avisoMetaMedica = document.getElementById("avisoMetaMedica");
    const fecharAvisoMeta = document.getElementById("fecharAvisoMeta");

    try {
        const resposta = await fetch(
            "http://localhost:3000/api/avaliacao-inicial",
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        verificarResposta(resposta);

        if (!resposta.ok) {
            throw new Error("Não foi possível consultar a avaliação inicial.");
        }

        const dados = await resposta.json();

        if (
            dados.limite_liquidos === "sim" ||
            dados.limite_liquidos === "nao-sei"
        ) {
            avisoMetaMedica.hidden = false;
        }

        fecharAvisoMeta.addEventListener("click", function () {
            avisoMetaMedica.hidden = true;
        });
    } catch (erro) {
        console.error("Erro ao verificar a avaliação inicial:", erro);
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

        console.log("Estatísticas recebidas:", dados);

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


 // Carregar as estatísticas de hidratação
async function carregarEstatisticas() {
    try {
        const resposta = await fetch(
            "http://localhost:3000/api/estatisticas-diarias",
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        verificarResposta(resposta);

        const dados = await resposta.json();
        
        console.log("Estatísticas recebidas:", dados);
        console.log("URL chamada:", resposta.url);

        if (!resposta.ok) {
            throw new Error(
                "Não foi possível carregar as estatísticas."
            );
        }

        const hoje = new Date().toLocaleDateString("en-CA");

        console.log("Data de hoje:", hoje);
        console.log("Data recebida pela API:", dados.map(dia => dia.data));
        console.log("Meta diária atual:", metaAgua);
        console.table(dados);

        let consumoHoje = 0;

      for (let i = 0; i < dados.length; i++) {
    const dataRegisto = new Date(dados[i].data)
        .toLocaleDateString("en-CA");

    if (dataRegisto === hoje) {
        consumoHoje = Number(dados[i].total_litros);
        break;
    }
}

        document.getElementById("consumoHoje").textContent =
            `${consumoHoje.toFixed(2)} L`;
            
                    const progresso = metaAgua > 0
            ? Math.min((consumoHoje / metaAgua) * 100, 100)
            : 0;

        document.getElementById("progressoMeta").textContent =
            `${Math.round(progresso)}% da meta diária atingida`;
        const preenchimentoMeta = document.getElementById("preenchimentoMeta");

        preenchimentoMeta.style.width = `${progresso}%`;

        mostrarGraficoEstatisticas(dados);

    } catch (erro) {
        console.error("Erro ao carregar estatísticas:", erro);
        document.getElementById("consumoHoje").textContent =
            "Não foi possível carregar.";
    }
}


function mostrarGraficoEstatisticas(dados) {
    const grafico = document.getElementById("graficoEstatisticas");

    grafico.innerHTML = "";

    for (let i = 0; i < dados.length; i++) {
        const dia = dados[i];
        const litros = Number(dia.total_litros);

        const coluna = document.createElement("div");
        const barra = document.createElement("div");
        const legenda = document.createElement("p");
        const valor = document.createElement("span");

        coluna.className = "coluna-grafico";
        barra.className = "barra-grafico";

        barra.style.height = `${Math.max(litros * 40, 4)}px`;
        barra.title = `${litros} L`;

        const data = new Date(`${dia.data}T12:00:00`);

        legenda.textContent = data.toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit"
        });

        valor.textContent = `${litros} L`;

        coluna.appendChild(valor);
        coluna.appendChild(barra);
        coluna.appendChild(legenda);

        grafico.appendChild(coluna);
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

        await carregarEstatisticas();

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

const botaoHistorico = document.getElementById("botaoHistorico");
const conteudoHistorico = document.getElementById("conteudoHistorico");

botaoHistorico.addEventListener("click", function () {
    if (conteudoHistorico.hidden) {
        conteudoHistorico.hidden = false;
        botaoHistorico.textContent = "Ocultar histórico";
    } else {
        conteudoHistorico.hidden = true;
        botaoHistorico.textContent = "Ver histórico";
    }
});

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
        await carregarEstatisticas();
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
carregarEstatisticas();
verificarAvisoMetaMedica();