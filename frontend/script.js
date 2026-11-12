const API_BASE_URL = window.WATERKRAFT_API_BASE_URL || "http://localhost:3000";

function verificarResposta(resposta) {
    if (resposta.status === 401) {
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
let mesCalendarioExibido = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let dadosCalendario = [];
let sequenciaAtualCalendario = 0;

const preferenciasAgua = window.WaterKraftPreferencias;
function formatarVolume(litros, casas = 2) { return preferenciasAgua.formatarVolume(litros, casas); }
function atualizarCampoMeta() {
    const emMililitros = preferenciasAgua.unidade === "mL";
    selecionarMeta.min = emMililitros ? "500" : "0.5";
    selecionarMeta.max = emMililitros ? "10000" : "10";
    selecionarMeta.step = emMililitros ? "100" : "0.1";
    selecionarMeta.value = String(emMililitros ? Math.round(metaAgua * 1000) : metaAgua);
    const idioma = preferenciasAgua.idioma;
    const rotulos = { pt: `Meta diária (${preferenciasAgua.unidade})`, en: `Daily goal (${preferenciasAgua.unidade})`, de: `Tagesziel (${preferenciasAgua.unidade})`, it: `Obiettivo giornaliero (${preferenciasAgua.unidade})`, fr: `Objectif quotidien (${preferenciasAgua.unidade})`, es: `Meta diaria (${preferenciasAgua.unidade})` };
    const botaoUnidade = { pt: preferenciasAgua.unidade === "mL" ? "➕ Registar 500 mL" : "➕ Registar 0,5 L", en: preferenciasAgua.unidade === "mL" ? "➕ Log 500 mL" : "➕ Log 0.5 L", de: preferenciasAgua.unidade === "mL" ? "➕ 500 mL eintragen" : "➕ 0,5 L eintragen", it: preferenciasAgua.unidade === "mL" ? "➕ Registra 500 mL" : "➕ Registra 0,5 L", fr: preferenciasAgua.unidade === "mL" ? "➕ Ajouter 500 mL" : "➕ Ajouter 0,5 L", es: preferenciasAgua.unidade === "mL" ? "➕ Registrar 500 mL" : "➕ Registrar 0,5 L" };
    document.querySelector("label[for=meta]").textContent = rotulos[idioma];
    botao.textContent = botaoUnidade[idioma];
}
function atualizarIdiomaDatas() {
    const locale = preferenciasAgua.locale;
    const titulo = document.querySelector(".marca-sub");
    if (titulo) {
        const frases = { pt: "Água é vida · Mantenha-se hidratado!", en: "Water is life · Stay hydrated!", de: "Wasser ist Leben · Bleib hydriert!", it: "L'acqua è vita · Rimani idratato!", fr: "L'eau, c'est la vie · Restez hydraté !", es: "El agua es vida · ¡Mantente hidratado!" };
        titulo.textContent = frases[preferenciasAgua.idioma];
    }
    const agora = new Date();
    const data = document.getElementById("dataHoje");
    const hora = document.getElementById("horaAgora");
    if (data) data.textContent = agora.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    if (hora) hora.textContent = agora.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const mascoteAgua = document.getElementById("mascoteAgua");

const etapasMascote = [
    { min: 100, src: "assets/mascotes/hidratacao-15/sapo-100-super-hidratado.png", alt: "Guerreiro Sapo super hidratado a celebrar a meta diária" },
    { min: 90, src: "assets/mascotes/hidratacao-15/sapo-90-quase-super.png", alt: "Guerreiro Sapo quase super hidratado, com uma aura de água" },
    { min: 75, src: "assets/mascotes/hidratacao-15/sapo-75-energia.png", alt: "Guerreiro Sapo cheio de energia e rodeado por água" },
    { min: 60, src: "assets/mascotes/hidratacao-15/sapo-60-hidratado.png", alt: "Guerreiro Sapo hidratado e sorridente" },
    { min: 45, src: "assets/mascotes/hidratacao-15/sapo-45-despertar.png", alt: "Guerreiro Sapo mais confiante, com a garrafa quase a meio" },
    { min: 30, src: "assets/mascotes/hidratacao-15/sapo-30-recuperando.png", alt: "Guerreiro Sapo de pé, a recuperar energia" },
    { min: 15, src: "assets/mascotes/hidratacao-15/sapo-15-primeiro-gole.png", alt: "Guerreiro Sapo a dar o primeiro gole" },
    { min: 0, src: "assets/mascotes/hidratacao-15/sapo-00-sedento.png", alt: "Guerreiro Sapo sedento, sentado com a garrafa vazia" }
];

function atualizarMascote() {
    const progresso = metaAgua > 0 ? (agua / metaAgua) * 100 : 0;
    const etapa = etapasMascote.find(e => progresso >= e.min) || etapasMascote[etapasMascote.length - 1];

    if (mascoteAgua.getAttribute("src") !== etapa.src) {
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
    quantidadeAgua.textContent = formatarVolume(agua);

    falta = Math.max(0, Number((metaAgua - agua).toFixed(2)));

    if (agua >= metaAgua) {
        mensagemMeta.textContent = ({ pt: "Meta atingida 🎉", en: "Goal reached 🎉", de: "Tagesziel erreicht 🎉", it: "Obiettivo raggiunto 🎉", fr: "Objectif atteint 🎉", es: "Meta alcanzada 🎉" })[preferenciasAgua.idioma];
        mensagemFalta.textContent = "";
    } else {
        mensagemMeta.textContent = "";
        const faltam = { pt: "Ainda faltam", en: "Still to go:", de: "Noch offen:", it: "Mancano", fr: "Il reste", es: "Faltan" }[preferenciasAgua.idioma];
        mensagemFalta.textContent = `${faltam} ${formatarVolume(falta)}`;
    }

    atualizarMascote();

    const elementoConsumoHoje = document.getElementById("consumoHoje");
    const elementoProgressoMeta = document.getElementById("progressoMeta");
    const preenchimentoMeta = document.getElementById("preenchimentoMeta");
    const progresso = metaAgua > 0
        ? Math.min((agua / metaAgua) * 100, 100)
        : 0;

    if (elementoConsumoHoje) {
        elementoConsumoHoje.textContent = formatarVolume(agua);
    }
    if (elementoProgressoMeta) {
        const textos = { pt: "da meta diária atingida", en: "of daily goal reached", de: "des Tagesziels erreicht", it: "dell'obiettivo giornaliero raggiunto", fr: "de l'objectif quotidien atteint", es: "de la meta diaria alcanzada" };
        elementoProgressoMeta.textContent = `${Math.floor(progresso)}% ${textos[preferenciasAgua.idioma]}`;
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
        const resposta = await fetch(`${API_BASE_URL}/api/avaliacao-inicial`, {
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
            const resposta = await fetch(`${API_BASE_URL}/api/avaliacao-inicial/ocultar-aviso`, {
                method: "PUT",
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
            `${API_BASE_URL}/api/meta-diaria`,
            {
                headers: {
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
        atualizarCampoMeta();

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
            `${API_BASE_URL}/api/estatisticas-diarias`,
            {
                headers: {
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

function formatarChaveMesCalendario(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function criarDataCalendario(anoMesDia) {
    const [ano, mes, dia] = anoMesDia.split("-").map(Number);
    return new Date(ano, mes - 1, dia);
}

function renderizarCalendario() {
    const root = document.getElementById("calendarioTarot");
    if (!root || !window.EstiloTarot) return;
    const mes = formatarChaveMesCalendario(mesCalendarioExibido);
    window.EstiloTarot.renderCalendario(root, mes, dadosCalendario, {
        sapo: "assets/estilo-tarot/sapo.png", locale: preferenciasAgua.locale,
        onMudarMes: function (delta) {
            const proximo = new Date(mesCalendarioExibido.getFullYear(), mesCalendarioExibido.getMonth() + delta, 1);
            const hoje = new Date();
            if (proximo > new Date(hoje.getFullYear(), hoje.getMonth(), 1) || proximo.getFullYear() < 2000) return;
            mesCalendarioExibido = proximo;
            carregarCalendario();
        }
    });
    const botoes = root.querySelectorAll(".tt-month button");
    const hoje = new Date();
    if (botoes[0]) botoes[0].disabled = mesCalendarioExibido.getFullYear() <= 2000 && mesCalendarioExibido.getMonth() === 0;
    if (botoes[1]) botoes[1].disabled = mesCalendarioExibido >= new Date(hoje.getFullYear(), hoje.getMonth(), 1);
}

async function carregarCalendario() {
    const root = document.getElementById("calendarioTarot");
    if (!root) return;
    try {
        const mes = formatarChaveMesCalendario(mesCalendarioExibido);
        const resposta = await fetch(`${API_BASE_URL}/api/calendario-hidratacao?mes=${encodeURIComponent(mes)}`, {
        });
        verificarResposta(resposta);
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem || "Não foi possível carregar o calendário.");
        dadosCalendario = dados;
        renderizarCalendario();
    } catch (erro) {
        console.error("Erro ao carregar o calendário de hidratação:", erro);
        root.innerHTML = '<p class="tt-error">Não foi possível carregar o calendário. Tenta novamente mais tarde.</p>';
    }
}

window.addEventListener("preferencias-waterkraft-alteradas", function () {
    atualizarCampoMeta();
    atualizarTela();
    atualizarIdiomaDatas();
    if (window.aplicarIdiomaWaterKraft) window.aplicarIdiomaWaterKraft();
    carregarEstatisticas();
    carregarCalendario();
});
window.addEventListener("storage", function (evento) {
    if (evento.key === "waterkraft-unidade-agua" || evento.key === "waterkraft-idioma") {
        atualizarCampoMeta(); atualizarTela(); atualizarIdiomaDatas();
        if (window.aplicarIdiomaWaterKraft) window.aplicarIdiomaWaterKraft();
        carregarEstatisticas(); carregarCalendario();
    }
});
atualizarCampoMeta();
atualizarIdiomaDatas();


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
        barra.title = formatarVolume(litros);

        const data = new Date(`${String(dia.data).slice(0, 10)}T12:00:00`);

        // Dia da semana (ex.: "Qua") + data (ex.: "04/11")
        let diaSemana = data.toLocaleDateString(preferenciasAgua.locale, { weekday: "short" })
            .replace(".", "");
        diaSemana = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

        const diaMes = data.toLocaleDateString(preferenciasAgua.locale, {
            day: "2-digit",
            month: "2-digit"
        });

        const eHoje = String(dia.data).slice(0, 10) === new Date().toLocaleDateString("en-CA");

        const hojeTexto = ({ pt: "Hoje", en: "Today", de: "Heute", it: "Oggi", fr: "Aujourd’hui", es: "Hoy" })[preferenciasAgua.idioma];
        legenda.innerHTML = `<strong>${eHoje ? hojeTexto : diaSemana}</strong><br>${diaMes}`;
        if (eHoje) coluna.classList.add("coluna-hoje");

        valor.textContent = formatarVolume(litros);

        coluna.appendChild(valor);
        coluna.appendChild(barra);
        coluna.appendChild(legenda);

        grafico.appendChild(coluna);
    }
}



// Guardar uma nova meta no PostgreSQL
botaoMeta.addEventListener("click", async function () {
    const valorDigitado = Number(selecionarMeta.value);
    const novaMeta = preferenciasAgua.unidade === "mL" ? valorDigitado / 1000 : valorDigitado;

    if (
        selecionarMeta.value === "" ||
        !Number.isFinite(novaMeta) ||
        novaMeta < 0.5 ||
        novaMeta > 10
    ) {
        mensagemMeta.textContent = preferenciasAgua.unidade === "mL"
            ? "Escolhe uma meta entre 500 e 10000 mL."
            : "Escolhe uma meta entre 0,5 e 10 L.";
        return;
    }

    try {
        const resposta = await fetch(
            `${API_BASE_URL}/api/meta-diaria`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
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
        atualizarCampoMeta();

        atualizarTela();

        await carregarEstatisticas();
        await carregarPerfil();
        await carregarCalendario();

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

        const hora = data.toLocaleTimeString(preferenciasAgua.locale, {
            hour: "2-digit",
            minute: "2-digit"
        });

        item.textContent = `💧 ${formatarVolume(Number(registro.quantidade))} - ${hora}`;

        listaAgua.appendChild(item);
    }
}

const botaoHistorico = document.getElementById("botaoHistorico");
const conteudoHistorico = document.getElementById("conteudoHistorico");

botaoHistorico.addEventListener("click", function () {
    if (conteudoHistorico.hidden) {
        conteudoHistorico.hidden = false;
        botaoHistorico.textContent = ({ pt: "Ocultar histórico", en: "Hide history", de: "Verlauf ausblenden", it: "Nascondi cronologia", fr: "Masquer l'historique", es: "Ocultar historial" })[preferenciasAgua.idioma];
    } else {
        conteudoHistorico.hidden = true;
        botaoHistorico.textContent = ({ pt: "Ver histórico", en: "View history", de: "Verlauf anzeigen", it: "Mostra cronologia", fr: "Voir l'historique", es: "Ver historial" })[preferenciasAgua.idioma];
    }
});

// Carregar os registos de água do utilizador
async function carregarRegistrosAgua() {
    try {
        const resposta = await fetch(
            `${API_BASE_URL}/api/registros-agua?${parametrosDiaAtual()}`,
            {
                headers: {
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
            `${API_BASE_URL}/api/registros-agua`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
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
        await carregarPerfil();
        await carregarCalendario();
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
            `${API_BASE_URL}/api/registros-agua`,
            {
                method: "DELETE",
                headers: {
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
        await carregarPerfil();
        await carregarEstatisticas();
        await carregarCalendario();
    } catch (erro) {
        console.error("Erro ao limpar o histórico:", erro);
    }
}

// Terminar sessão
botaoLogout.addEventListener("click", async function () {
    botaoLogout.disabled = true;
    try {
        await fetch(`${API_BASE_URL}/api/logout`, {
            method: "POST",
            credentials: "same-origin"
        });
    } catch (erro) {
        console.error("Não foi possível confirmar o fim da sessão:", erro);
    } finally {
        window.location.href = "login.html";
    }
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
    let texto = agora.toLocaleDateString(preferenciasAgua.locale, {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    texto = texto.charAt(0).toUpperCase() + texto.slice(1);

    const dataHoje = document.getElementById("dataHoje");
    const horaAgora = document.getElementById("horaAgora");
    const seloHoje = document.getElementById("seloHoje");

    if (dataHoje) dataHoje.textContent = texto;
    if (horaAgora) horaAgora.textContent = agora.toLocaleTimeString(preferenciasAgua.locale, {
        hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
    if (seloHoje) {
        const curto = agora.toLocaleDateString(preferenciasAgua.locale, { weekday: "short", day: "2-digit", month: "2-digit" })
            .replace(".", "");
        seloHoje.textContent = ({ pt: "Hoje", en: "Today", de: "Heute", it: "Oggi", fr: "Aujourd’hui", es: "Hoy" })[preferenciasAgua.idioma] + " · " + curto.charAt(0).toUpperCase() + curto.slice(1);
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
        carregarPerfil();
        carregarCalendario();
    }
}
atualizarRelogio();
setInterval(atualizarRelogio, 1000);


// Carregar os dados ao abrir a página
carregarRegistrosAgua();
carregarMetaDiaria();
carregarEstatisticas();
carregarCalendario();
verificarAvisoMetaMedica();

// Marcos da jornada mágica: os valores em dias representam dias seguidos a atingir a meta.
const selosDaJornada = [
    { dias: 1, marco: "1 dia", nome: "Aprendiz da Primeira Gota", titulo: "Aprendiz", icone: "💧", descricao: "Uma gota e a tua aventura mágica começou.", pixel: '<path d="M47 27h8v8h7v9h7v16h-7v8H38v-8h-7V44h7v-9h9z" fill="#40bfd0" stroke="#285c62" stroke-width="3"/><path d="M43 43h5v11h-5z" fill="#e9ffff"/><path d="M70 32h5v5h-5zM75 37h5v5h-5zM65 37h5v5h-5zM70 42h5v5h-5z" fill="#f8d85c"/>' },
    { dias: 3, marco: "3 dias", nome: "Guardião do Cálice", titulo: "Acólito da Maré", icone: "🏆", descricao: "Três dias e o cálice já reconhece a tua coragem.", pixel: '<path d="M35 31h30v7h6v16h-6v7H55v8h9v6H36v-6h9v-8h-9v-7h-6V38h5z" fill="#ebbd4d" stroke="#604a2d" stroke-width="3"/><path d="M40 38h20v11H40z" fill="#46bdc4"/><path d="M28 39h8v6h5v7h-8v-5h-5zM64 45h5v-6h8v8h-5v5h-8z" fill="#f3d372" stroke="#604a2d" stroke-width="2"/>' },
    { dias: 7, marco: "1 semana", nome: "Feiticeiro das Sete Fontes", titulo: "Conjurador da Semana", icone: "✨", descricao: "Sete dias e os teus feitiços seguem a rotina.", pixel: '<path d="M47 26h7v12h7v7h12v7H61v7h-7v12h-7V59h-7v-7H28v-7h12v-7h7z" fill="#69d2cf" stroke="#285c62" stroke-width="3"/><path d="M50 38h3v7h7v3h-7v7h-3v-7h-7v-3h7z" fill="#fff4a3"/><path d="M32 31h4v4h-4zM66 61h5v5h-5z" fill="#f5d66a"/>' },
    { dias: 14, marco: "2 semanas", nome: "Mago da Lua Crescente", titulo: "Sentinela das Duas Semanas", icone: "🌙", descricao: "Até a lua testemunha a tua disciplina.", pixel: '<path d="M57 26h7v7h-5v8h-5v7h-5v7h-5v7h-7v-7h6v-7h5v-7h5v-7h4z" fill="#bd8750" stroke="#604a2d" stroke-width="2"/><path d="M50 27h8v8h-5v7h-7v7h-7v-7h7v-7h4z" fill="#a8e2dd"/><path d="M63 46h7v4h-5v5h-6v-5h4z" fill="#f2d26c" stroke="#604a2d" stroke-width="2"/>' },
    { dias: 30, marco: "1 mês", nome: "Alquimista da Fonte Viva", titulo: "Mestre da Rotina", icone: "⚗️", descricao: "Transformas pequenas gotas em poder.", pixel: '<path d="M43 26h14v5h-4v11h8v5h6v16h-6v7H39v-7h-6V47h6v-5h8V31h-4z" fill="#e8c45b" stroke="#604a2d" stroke-width="3"/><path d="M39 50h26v12H39z" fill="#45bbc2"/><path d="M42 54h5v4h-5zM55 52h5v4h-5z" fill="#c9f3dc"/><path d="M47 31h6v10h-6z" fill="#fff0bb"/>' },
    { dias: 60, marco: "2 meses", nome: "Sábio do Orvalho", titulo: "Especial · Sábio", icone: "💎", descricao: "Aprendeste os antigos encantamentos da constância.", pixel: '<path d="M42 28h16v6h8v8h6v9h-6v9h-8v8H42v-8h-8v-9h-6v-9h6v-8h8z" fill="#54c7ce" stroke="#285c62" stroke-width="3"/><path d="M45 34h10v7h7v8h-7v9h-5v-9h-8v-8h3z" fill="#d8fbeb"/><path d="M50 42h5v15h-5z" fill="#fff8ca"/>' },
    { dias: 90, marco: "3 meses", nome: "Arquimago das Marés", titulo: "Especial · Arquimago", icone: "🪄", descricao: "As marés atendem ao teu chamado.", pixel: '<path d="M47 25h7v7h-7zM42 32h7v7h-7zM37 39h7v7h-7zM32 46h7v7h-7zM27 53h7v7h-7zM22 60h7v7h-7z" fill="#bb8050" stroke="#604a2d" stroke-width="2"/><path d="M43 27h13v5H43zM39 32h13v5H39z" fill="#f4d463"/><path d="M62 47h7v5h-7zM55 52h7v5h-7zM48 57h7v5h-7zM41 62h7v5h-7z" fill="#49bdc2"/>' },
    { dias: 180, marco: "6 meses", nome: "Lenda dos Seis Rios", titulo: "Incrível · Lenda", icone: "👑", descricao: "Os rios já guardam a tua lenda.", pixel: '<path d="M31 37h8v9h8v-8h7v8h8v-9h8v9h5v17H28V46h3z" fill="#edc64e" stroke="#604a2d" stroke-width="3"/><path d="M35 50h5v7h-5zM48 46h6v10h-6zM62 50h5v7h-5z" fill="#51c4c6"/><path d="M33 65h38v6H33zM36 74h32v4H36z" fill="#4aaeb4"/>' },
    { dias: 270, marco: "9 meses", nome: "Grão-mago do Oceano", titulo: "Insano · Grão-mago", icone: "🌊", descricao: "Dominas correntes que ninguém consegue ver.", pixel: '<path d="M34 31h29v6h-7v6h-7v6h-7v6h-6v7h8v-6h8v-6h8v-7h7v-6h5v6h-5v7h-7v6h-8v6h-8v6H29v-6h8v-6h-8v-6h5v-7h7v-6h7v-6h7v-6H34z" fill="#44bdc4" stroke="#285c62" stroke-width="2"/><path d="M37 37h9v5h-6v6h-5v7h-5v-8h5v-6z" fill="#d8fbeb"/>' },
    { dias: 365, marco: "1 ano", nome: "Mago das Águas Eternas", titulo: "Insano · Mago", icone: "🧙", descricao: "A magia da água já corre contigo.", pixel: '<path d="M31 50h38v6h7v6h-7v6H31v-6h-7v-6h7z" fill="#43b9c2" stroke="#285c62" stroke-width="3"/><path d="M38 44h7v-7h7v-7h7v7h7v7h7v6H38z" fill="#365e42" stroke="#283f31" stroke-width="3"/><path d="M49 31h7v6h-7zM52 42h8v5h-8z" fill="#f2d367"/><path d="M48 55h7v7h-7z" fill="#fff5cb"/>' }
];

const molduraPixelSelo = '<path d="M39 5h22v6h12v7h9v10h7v13h6v28h-6v13h-7v10h-9v7H61v6H39v-6H27v-7h-9V82h-7V69H5V41h6V28h7V18h9v-7h12z" fill="#57432d"/><path d="M41 10h18v5h12v7h8v10h6v12h6v23h-6v12h-6v8h-8v7H59v5H41v-5H29v-7h-8v-8h-6V67H9V44h6V32h6v-10h8v-7h12z" fill="#eac457"/><path d="M43 17h14v4h11v6h8v8h5v10h5v18h-5v10h-5v8h-8v6H57v4H43v-4H32v-6h-8v-8h-5V63h-5V45h5V35h5v-8h8v-6h11z" fill="#fff4d5"/><path d="M46 4h10v4H46z" fill="#4dbbc1" stroke="#57432d" stroke-width="2"/><path d="M10 47h7v5h-7zM83 47h7v5h-7zM10 59h7v5h-7zM83 59h7v5h-7z" fill="#57904e"/><path d="M34 85h12v17h-6v-4h-6zM54 85h12v13h-6v4h-6z" fill="#3f7651" stroke="#57432d" stroke-width="2"/>';

const imagensSelos = [
    "aprendiz-gota.png", "guardiao-calice.png", "feiticeiro-sete-fontes.png",
    "mago-lua.png", "alquimista-fonte.png", "sabio-orvalho.png",
    "arquimago-mares.png", "lenda-seis-rios.png", "grao-mago-oceano.png",
    "mago-aguas-eternas.png"
];

function desenharSeloPixel(selo) {
    const imagem = imagensSelos[selosDaJornada.indexOf(selo)];
    return `<img src="assets/selos/${imagem}" alt="" loading="lazy">`;
}

function mostrarSelosDaJornada(sequenciaAtual, maiorSequencia, perfil = {}) {
    const lista = document.getElementById("listaSelos");
    if (!lista) return;

    const seloAtual = selosDaJornada.reduce((ultimo, selo, indice) =>
        sequenciaAtual >= selo.dias ? indice : ultimo, -1);
    lista.replaceChildren();

    if (window.EstiloTarot) {
        const romanos = ["I", "III", "VII", "XIV", "XXX", "LX", "XC", "CLXXX", "CCLXX", "CCCLXV"];
        const selosTarot = selosDaJornada.map((selo, indice) => ({ ...selo, romano: romanos[indice], imagem: imagensSelos[indice], indice }));
        window.EstiloTarot.renderSelos(lista, { ...perfil, sequencia_atual: sequenciaAtual, maior_sequencia: maiorSequencia }, selosTarot, {
            sapo: "assets/estilo-tarot/sapo.png",
            onSeloClick: function (selo, alcancado, botao) {
                abrirDetalhesSelo(selosDaJornada[selo.indice], alcancado, selo.indice === seloAtual, botao, maiorSequencia, sequenciaAtual);
            }
        });
        return;
    }

    selosDaJornada.forEach((selo, indice) => {
        const alcancado = maiorSequencia >= selo.dias;
        const atual = indice === seloAtual;
        const cartao = document.createElement("button");
        cartao.type = "button";
        cartao.className = `selo-jornada${alcancado ? " alcancado" : " por-alcancar"}${atual ? " selo-atual" : ""}`;
        cartao.setAttribute("aria-label", alcancado
            ? `${selo.nome}, marco de ${selo.marco}, conquistado. Ver detalhes.`
            : "Selo mágico ainda fechado. Ver quantos dias faltam para o abrir.");
        if (atual) cartao.setAttribute("aria-current", "step");

        const emblema = document.createElement("div");
        emblema.className = "selo-emblema";
        emblema.setAttribute("aria-hidden", "true");
        emblema.innerHTML = desenharSeloPixel(selo);
        cartao.appendChild(emblema);

        if (!alcancado) {
            const pano = document.createElement("span");
            pano.className = "selo-bloqueio";
            pano.setAttribute("aria-hidden", "true");
            cartao.appendChild(pano);
        }

        cartao.addEventListener("click", function () {
            abrirDetalhesSelo(selo, alcancado, atual, cartao, maiorSequencia, sequenciaAtual);
        });
        lista.appendChild(cartao);
    });
}

let focoAnteriorModalSelo = null;

function abrirDetalhesSelo(selo, alcancado, atual, botao, recorde, sequenciaAtual) {
    const modal = document.getElementById("modalSelo");
    const marco = document.getElementById("modalSeloMarco");
    const nome = document.getElementById("modalSeloNome");
    const titulo = document.getElementById("modalSeloTitulo");
    const descricao = document.getElementById("modalSeloDescricao");
    const emblema = document.getElementById("modalSeloEmblema");
    const diasEmFalta = Math.max(1, selo.dias - sequenciaAtual);

    modal.classList.toggle("bloqueado", !alcancado);
    emblema.classList.toggle("emblema-bloqueado", !alcancado);
    emblema.innerHTML = alcancado
        ? desenharSeloPixel(selo)
        : "🔒";
    marco.hidden = !alcancado;
    titulo.hidden = !alcancado;
    descricao.hidden = !alcancado;

    if (alcancado) {
        marco.textContent = `Marco: ${selo.marco} de sequência`;
        nome.textContent = selo.nome;
        titulo.textContent = selo.titulo;
        descricao.textContent = selo.descricao;
        document.getElementById("modalSeloEstado").textContent = atual
            ? "Selo da tua sequência atual. Continua a hidratar-te para manter a magia!"
            : `Selo conquistado! O teu recorde é de ${recorde} dias seguidos.`;
    } else {
        nome.textContent = "Alto lá, guerreiro!";
        document.getElementById("modalSeloEstado").textContent =
            `Mantém-te hidratado durante ${diasEmFalta} ${diasEmFalta === 1 ? "dia" : "dias"} para prosseguir com a jornada.`;
    }

    focoAnteriorModalSelo = botao;
    modal.hidden = false;
    requestAnimationFrame(function () {
        modal.classList.add("aberto");
        document.getElementById("fecharModalSelo").focus();
    });
}

function fecharDetalhesSelo() {
    const modal = document.getElementById("modalSelo");
    if (modal.hidden) return;
    modal.classList.remove("aberto");
    window.setTimeout(function () {
        modal.hidden = true;
        if (focoAnteriorModalSelo && document.contains(focoAnteriorModalSelo)) {
            focoAnteriorModalSelo.focus();
        }
    }, 220);
}

document.getElementById("fecharModalSelo").addEventListener("click", fecharDetalhesSelo);
document.querySelector("[data-fechar-selo]").addEventListener("click", fecharDetalhesSelo);
document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape") fecharDetalhesSelo();
});

// Mini perfil: nome, dias totais hidratados e sequência atual de metas diárias atingidas.
async function carregarPerfil() {
    try {
        const resposta = await fetch(`${API_BASE_URL}/api/perfil`, {
        });
        verificarResposta(resposta);
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.mensagem);

        const nome = dados.nome || "";
        const primeiroNome = nome.trim().split(/\s+/)[0] || "";
        const boasVindas = { pt: "Bem-vindo(a)", en: "Welcome", de: "Willkommen", it: "Benvenuto/a", fr: "Bienvenue", es: "Te damos la bienvenida" }[preferenciasAgua.idioma];
        document.getElementById("boasVindas").textContent = primeiroNome ? `${boasVindas}, ${primeiroNome} :)` : `${boasVindas}! :)`;
        document.getElementById("perfilNome").textContent = nome || "—";
        document.getElementById("diasHidratado").textContent =
            String(dados.dias_hidratado ?? 0);
        const sequenciaAtual = Number(dados.sequencia_atual ?? 0);
        sequenciaAtualCalendario = sequenciaAtual;
        renderizarCalendario();
        const maiorSequencia = Number(dados.maior_sequencia ?? sequenciaAtual);
        document.getElementById("sequenciaAtual").textContent = String(sequenciaAtual);
        mostrarSelosDaJornada(sequenciaAtual, maiorSequencia, dados);
    } catch (erro) {
        console.error("Erro ao carregar perfil:", erro);
    }
}

carregarPerfil();
