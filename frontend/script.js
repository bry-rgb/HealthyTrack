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

const mascoteAgua = document.getElementById("mascoteAgua");

const etapasMascote = [
    { min: 100, src: "assets/mascotes/100_meta_atingida_v2 1.png", alt: "Sapinho a celebrar a meta atingida" },
    { min: 80, src: "assets/mascotes/75_quase_meta_v2 1.png", alt: "Sapinho quase na meta" },
    { min: 60, src: "assets/mascotes/65_progresso_v1.png", alt: "Sapinho a hidratar-se" },
    { min: 40, src: "assets/mascotes/50_meio_caminho_v2.png", alt: "Sapinho a hidratar-se" },
    { min: 20, src: "assets/mascotes/25_inicio_hidratacao_v2.png", alt: "Sapinho a começar a hidratar-se" },
    { min: 0, src: "assets/mascotes/sapo_desidratado_10.png", alt: "Sapinho com sede" }
];

function atualizarMascote() {
    const progresso = metaAgua > 0 ? (agua / metaAgua) * 100 : 0;
    const etapa = etapasMascote.find(e => progresso >= e.min);

    if (!mascoteAgua.src.endsWith(etapa.src)) {
        mascoteAgua.src = etapa.src;
        mascoteAgua.alt = etapa.alt;
        mascoteAgua.classList.remove("trocou");
        void mascoteAgua.offsetWidth; // reinicia a animação
        mascoteAgua.classList.add("trocou");
    }
}
    atualizarMascote();


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

    atualizarMascote();

    const elementoConsumoHoje = document.getElementById("consumoHoje");
    const elementoProgressoMeta = document.getElementById("progressoMeta");
    const preenchimentoMeta = document.getElementById("preenchimentoMeta");
    const progresso = metaAgua > 0
        ? Math.min((agua / metaAgua) * 100, 100)
        : 0;

    if (elementoConsumoHoje) {
        elementoConsumoHoje.textContent = `${agua.toFixed(2)} L`;
    }
    if (elementoProgressoMeta) {
        elementoProgressoMeta.textContent =
            `${Math.round(progresso)}% da meta diária atingida`;
    }
    if (preenchimentoMeta) {
        preenchimentoMeta.style.width = `${progresso}%`;
    }
}



function fecharAviso() {
    const aviso = document.getElementById("avisoMetaMedica");
    aviso.hidden = true;
    aviso.style.display = "none";
}

async function verificarAvisoMetaMedica() {
    const aviso = document.getElementById("avisoMetaMedica");

    try {
        const resposta = await fetch("http://localhost:3000/api/avaliacao-inicial", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        verificarResposta(resposta);

        // Ainda não fez a avaliação: abre o pop-up de boas-vindas + perguntas
        if (resposta.status === 404) {
            window.abrirAvaliacaoInicial(async function () {
                await carregarMetaDiaria();
                verificarAvisoMetaMedica();
            });
            return;
        }

        if (!resposta.ok) throw new Error("Não foi possível consultar a avaliação inicial.");

        const dados = await resposta.json();

        const precisaAviso =
            (dados.limite_liquidos === "sim" || dados.limite_liquidos === "nao-sei") &&
            !dados.ocultar_aviso_meta;

        if (precisaAviso) {
            aviso.hidden = false;
            aviso.style.display = "";
        } else {
            fecharAviso();
        }
    } catch (erro) {
        console.error("Erro ao verificar a avaliação inicial:", erro);
    }
}

// Cliques nos botões do aviso
document.addEventListener("click", async function (evento) {
    if (evento.target.closest("#fecharAvisoMeta")) {
        fecharAviso(); // volta a aparecer no próximo login
    }

    if (evento.target.closest("#naoMostrarAvisoMeta")) {
        fecharAviso();
        try {
            const resposta = await fetch("http://localhost:3000/api/avaliacao-inicial/ocultar-aviso", {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!resposta.ok) throw new Error("Falha ao guardar");
        } catch (erro) {
            console.error("Não foi possível guardar a preferência do aviso:", erro);
        }
    }
});



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

        if (!resposta.ok) {
            throw new Error(
                "Não foi possível carregar as estatísticas."
            );
        }

        mostrarGraficoEstatisticas(dados);
    } catch (erro) {
        console.error("Erro ao carregar estatísticas:", erro);
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

        const data = new Date(`${String(dia.data).slice(0, 10)}T12:00:00`);

        // Dia da semana (ex.: "Qua") + data (ex.: "04/11")
        let diaSemana = data.toLocaleDateString("pt-PT", { weekday: "short" })
            .replace(".", "");
        diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

        const diaMes = data.toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "2-digit"
        });

        const eHoje = String(dia.data).slice(0, 10) === new Date().toLocaleDateString("en-CA");

        legenda.innerHTML = `<strong>${eHoje ? "Hoje" : diaSemana}</strong><br>${diaMes}`;
        if (eHoje) coluna.classList.add("coluna-hoje");

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
            `http://localhost:3000/api/registros-agua?${parametrosDiaAtual()}`,
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

// ===== DATA, HORA E RECOMEÇO DIÁRIO =====
const dataHoje = document.getElementById("dataHoje");
const horaAgora = document.getElementById("horaAgora");

// Chave do dia local (AAAA-MM-DD)
function chaveDia(data = new Date()) {
    return data.toLocaleDateString("en-CA");
}

let diaAtual = chaveDia();

// Início e fim do dia local, enviados ao servidor
function parametrosDiaAtual() {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);
    return new URLSearchParams({
        inicio: inicio.toISOString(),
        fim: fim.toISOString()
    }).toString();
}



// Ao voltar à aba (ex.: telemóvel acordou), verifica logo o dia
document.addEventListener("visibilitychange", function () {
    if (!document.hidden) atualizarRelogio();
});

// Relógio, data de hoje e destaque do dia
function atualizarRelogio() {
    const agora = new Date();
    let texto = agora.toLocaleDateString("pt-PT", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    texto = texto.charAt(0).toUpperCase() + texto.slice(1);

    const dataHoje = document.getElementById("dataHoje");
    const horaAgora = document.getElementById("horaAgora");
    const seloHoje = document.getElementById("seloHoje");

    if (dataHoje) dataHoje.textContent = texto;
    if (horaAgora) horaAgora.textContent = agora.toLocaleTimeString("pt-PT", {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    if (seloHoje) {
        const curto = agora.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit" })
            .replace(".", "");
        seloHoje.textContent = "Hoje · " + curto.charAt(0).toUpperCase() + curto.slice(1);
    }

    // Ao mudar o dia local, recomeça o contador sem apagar os registos guardados.
    const novoDia = chaveDia(agora);
    if (novoDia !== diaAtual) {
        diaAtual = novoDia;
        agua = 0;
        atualizarTela();
        mostrarHistorico([]);
        carregarRegistrosAgua();
        carregarEstatisticas();
    }
}
atualizarRelogio();
setInterval(atualizarRelogio, 1000);


// Carregar os dados ao abrir a página
carregarRegistrosAgua();
carregarMetaDiaria();
carregarEstatisticas();
verificarAvisoMetaMedica();