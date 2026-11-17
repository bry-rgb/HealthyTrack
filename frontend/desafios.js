const API_DESAFIOS = window.WATERKRAFT_API_BASE_URL || "http://localhost:3000";
const formularioDesafio = document.getElementById("formularioDesafio");
const painelGestor = document.getElementById("painelGestor");
const listaDesafios = document.getElementById("listaDesafios");
const mensagemDesafios = document.getElementById("mensagemDesafios");
const tituloFormularioDesafio = document.getElementById("tituloFormularioDesafio");
const guardarDesafio = document.getElementById("guardarDesafio");
const cancelarEdicaoDesafio = document.getElementById("cancelarEdicaoDesafio");
const emblemaRaroDesafio = document.getElementById("emblemaRaroDesafio");
const dataInicioDesafio = document.getElementById("dataInicioDesafio");
const dataFimDesafio = document.getElementById("dataFimDesafio");

const ASSET_MEDALHA_RESISTENCIA = "assets/selos/semana-resistencia-rara.png";
const ASSET_PLAQUETA_PARTICIPACAO = "assets/selos/plaqueta-participacao.png";

let perfilAtual = "utilizador";
let utilizadorIdAtual = null;
let desafioEmEdicao = null;

async function pedidoAPI(caminho, opcoes = {}) {
    const resposta = await fetch(API_DESAFIOS + caminho, {
        ...opcoes,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(opcoes.headers || {}) }
    });
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.status === 401) {
        window.location.replace("login.html");
        throw new Error("Inicia sessão para consultar os desafios.");
    }
    if (!resposta.ok) throw new Error(dados.mensagem || "Não foi possível concluir o pedido.");
    return dados;
}

function mostrarMensagem(texto, erro = false) {
    mensagemDesafios.textContent = texto;
    mensagemDesafios.setAttribute("role", erro ? "alert" : "status");
}

function elemento(tag, texto, classe) {
    const item = document.createElement(tag);
    if (texto !== undefined && texto !== null && texto !== "") item.textContent = texto;
    if (classe) item.className = classe;
    return item;
}

function dataCurta(valor) {
    return String(valor).slice(0, 10);
}

function limparFormulario() {
    desafioEmEdicao = null;
    formularioDesafio.reset();
    emblemaRaroDesafio.value = "";
    tituloFormularioDesafio.textContent = "Criar desafio";
    guardarDesafio.textContent = "Criar desafio";
    cancelarEdicaoDesafio.hidden = true;
}

function iniciarEdicao(desafio) {
    desafioEmEdicao = desafio.id;
    formularioDesafio.elements.titulo.value = desafio.titulo;
    formularioDesafio.elements.descricao.value = desafio.descricao;
    formularioDesafio.elements.data_inicio.value = dataCurta(desafio.data_inicio);
    formularioDesafio.elements.data_fim.value = dataCurta(desafio.data_fim);
    emblemaRaroDesafio.value = desafio.emblema_raro || "";
    tituloFormularioDesafio.textContent = "Editar desafio";
    guardarDesafio.textContent = "Guardar alterações";
    cancelarEdicaoDesafio.hidden = false;
    formularioDesafio.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ajustarFimDaSemana() {
    if (emblemaRaroDesafio.value !== "semana-resistencia" || !dataInicioDesafio.value) return;
    const fim = new Date(dataInicioDesafio.value + "T00:00:00");
    fim.setDate(fim.getDate() + 6);
    dataFimDesafio.value = [
        fim.getFullYear(),
        String(fim.getMonth() + 1).padStart(2, "0"),
        String(fim.getDate()).padStart(2, "0")
    ].join("-");
}

function adicionarEmblema(container, config) {
    const classes = "emblema-desafio" + (config.raro ? " raro" : "") + (config.bloqueado ? " bloqueado" : "");
    const cartao = elemento("div", null, classes);
    const figura = document.createElement("img");
    figura.src = config.imagem;
    figura.alt = config.alt;
    figura.loading = "lazy";
    const texto = elemento("div", null);
    texto.appendChild(elemento("strong", config.titulo));
    texto.appendChild(elemento("small", config.detalhe));
    cartao.append(figura, texto);
    container.appendChild(cartao);
    return texto;
}

async function carregarEmblemasDoDesafio(desafio, cartao) {
    try {
        const dados = await pedidoAPI("/api/desafios/" + desafio.id + "/emblemas");
        if (!dados.tem_plaqueta && !dados.emblema_raro) return;

        const secao = elemento("section", null, "emblemas-do-desafio");
        secao.setAttribute("aria-label", "Emblemas do desafio");
        secao.appendChild(elemento("h4", "Emblemas de desafios"));
        const grelha = elemento("div", null, "emblemas-grelha");

        if (dados.tem_plaqueta) {
            adicionarEmblema(grelha, {
                imagem: ASSET_PLAQUETA_PARTICIPACAO,
                alt: "Plaqueta de participação",
                titulo: "Plaqueta de participação",
                detalhe: dados.participa ? "Conquistada ao inscrever-te" : "Participação registada"
            });
        }

        if (dados.emblema_raro === "semana-resistencia") {
            const conquistada = Boolean(dados.medalha_rara_conquistada);
            let detalhe = "Bloqueada · atingir a meta diária nos 7 dias";
            if (conquistada) detalhe = "Conquistada · Semana da Resistência";
            else if (dados.estado_emblema_raro === "nao_conquistado") detalhe = "Não conquistada nesta semana";

            const textoMedalha = adicionarEmblema(grelha, {
                imagem: ASSET_MEDALHA_RESISTENCIA,
                alt: "Medalha rara brilhante Semana da Resistência",
                titulo: desafio.titulo || "Semana da Resistência",
                detalhe,
                raro: true,
                bloqueado: !conquistada
            });

            if (!conquistada && dados.participa && dados.dias.length) {
                textoMedalha.appendChild(elemento("small", "Progresso: " + dados.dias_meta_cumprida + "/7 dias"));
                const dias = elemento("div", null, "progresso-dias-desafio");
                dias.setAttribute("aria-label", dados.dias_meta_cumprida + " de 7 dias com a meta atingida");
                dados.dias.forEach((dia, indice) => {
                    dias.appendChild(elemento("span", "D" + (indice + 1), dia.meta_cumprida ? "atingido" : ""));
                });
                textoMedalha.appendChild(dias);
            }
        }

        secao.appendChild(grelha);
        cartao.appendChild(secao);
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
}

async function avaliarEmblema(desafio, participante, estado) {
    try {
        await pedidoAPI(
            "/api/desafios/" + desafio.id + "/participantes/" + participante.usuario_id + "/emblema",
            { method: "PUT", body: JSON.stringify({ estado }) }
        );
        mostrarMensagem(estado === "conquistado" ? "Medalha concedida." : "Resultado registado.");
        await carregarDesafios();
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
}

async function carregarPainelParticipantes(desafio, cartao) {
    try {
        const dados = await pedidoAPI("/api/desafios/" + desafio.id + "/participantes");
        const secao = elemento("section", null, "emblemas-do-desafio");
        secao.appendChild(elemento("h4", "Avaliar medalhas raras"));
        const lista = elemento("div", null, "participantes-desafio");
        const hoje = new Date();
        const fim = new Date(dataCurta(desafio.data_fim) + "T00:00:00");
        const desafioTerminou = fim < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

        if (dados.participantes.length === 0) {
            lista.appendChild(elemento("p", "Ainda não há participantes inscritos."));
        }

        dados.participantes.forEach((participante) => {
            const linha = elemento("div", null, "participante-desafio");
            linha.appendChild(elemento("strong", participante.nome));
            linha.appendChild(elemento("span", participante.dias_meta_cumprida + "/7 dias"));
            const estado = participante.emblema_raro_estado;
            const textoEstado = estado === "conquistado"
                ? "Medalha concedida"
                : estado === "nao_conquistado"
                    ? "Não conquistada"
                    : "À espera de avaliação";
            linha.appendChild(elemento("span", textoEstado, "estado-avaliacao"));

            const acoes = elemento("div", null, "acoes-avaliacao-emblema");
            if (!desafioTerminou) {
                acoes.appendChild(elemento("span", "Disponível após o último dia"));
            } else {
                if (participante.dias_no_desafio === 7 &&
                    participante.dias_meta_cumprida === 7 &&
                    estado !== "conquistado") {
                    const conceder = elemento("button", "Conceder medalha");
                    conceder.type = "button";
                    conceder.addEventListener("click", () => avaliarEmblema(desafio, participante, "conquistado"));
                    acoes.appendChild(conceder);
                }
                if (estado !== "nao_conquistado") {
                    const naoConquistada = elemento("button", "Marcar não conquistada", "botao-secundario");
                    naoConquistada.type = "button";
                    naoConquistada.addEventListener("click", () => avaliarEmblema(desafio, participante, "nao_conquistado"));
                    acoes.appendChild(naoConquistada);
                }
            }
            linha.appendChild(acoes);
            lista.appendChild(linha);
        });

        secao.appendChild(lista);
        cartao.appendChild(secao);
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
}

function renderizarDesafios(desafios) {
    listaDesafios.replaceChildren();
    if (desafios.length === 0) {
        listaDesafios.appendChild(elemento("p", "Ainda não existem desafios."));
        return;
    }

    desafios.forEach((desafio) => {
        const cartao = elemento("article", null, "card desafio-cartao");
        if (perfilAtual === "utilizador" && !desafio.participa && !desafio.tem_plaqueta) {
            const novo = elemento("span", "NEW", "selo-novo");
            novo.setAttribute("aria-label", "Desafio novo para ti");
            cartao.appendChild(novo);
        }
        cartao.appendChild(elemento("h3", desafio.titulo));
        cartao.appendChild(elemento("p", desafio.descricao));
        cartao.appendChild(elemento(
            "p",
            "De " + dataCurta(desafio.data_inicio) + " até " + dataCurta(desafio.data_fim),
            "desafio-datas"
        ));
        cartao.appendChild(elemento("p", "Gestor: " + desafio.gestor_nome, "desafio-gestor"));
        cartao.appendChild(elemento(
            "p",
            desafio.total_participantes + (desafio.total_participantes === 1 ? " participante" : " participantes"),
            "desafio-participantes"
        ));

        if (perfilAtual === "utilizador") {
            const acoesParticipacao = elemento("div", null, "acoes-desafio");
            const textoBotao = desafio.participa
                ? "Sair do desafio"
                : desafio.tem_plaqueta
                    ? "Participar novamente"
                    : "Inscrever-se";
            const participacao = elemento("button", textoBotao);
            participacao.type = "button";
            if (desafio.participa) participacao.className = "botao-secundario";
            participacao.addEventListener("click", async () => {
                participacao.disabled = true;
                try {
                    await pedidoAPI("/api/desafios/" + desafio.id + "/participacao", {
                        method: desafio.participa ? "DELETE" : "POST"
                    });
                    mostrarMensagem(desafio.participa
                        ? "Saíste do desafio. A tua plaqueta de participação fica guardada."
                        : "Estás inscrito e recebeste a plaqueta de participação.");
                    await carregarDesafios();
                } catch (erro) {
                    participacao.disabled = false;
                    mostrarMensagem(erro.message, true);
                }
            });
            acoesParticipacao.appendChild(participacao);
            cartao.appendChild(acoesParticipacao);
        }

        if (desafio.emblema_raro === "semana-resistencia") {
            cartao.appendChild(elemento(
                "p",
                "Medalha rara: atingir a meta diária em 7 dias consecutivos.",
                "desafio-criterio-raro"
            ));
        }

        if (perfilAtual === "gestor_desafios" && desafio.gestor_id === utilizadorIdAtual) {
            const acoes = elemento("div", null, "acoes-desafio");
            const editar = elemento("button", "Editar");
            editar.type = "button";
            editar.addEventListener("click", () => iniciarEdicao(desafio));

            const apagar = elemento("button", "Apagar");
            apagar.type = "button";
            apagar.className = "botao-secundario";
            apagar.addEventListener("click", async () => {
                if (!window.confirm("Apagar este desafio?")) return;
                try {
                    await pedidoAPI("/api/desafios/" + desafio.id, { method: "DELETE" });
                    mostrarMensagem("Desafio apagado.");
                    await carregarDesafios();
                } catch (erro) {
                    mostrarMensagem(erro.message, true);
                }
            });
            acoes.append(editar, apagar);
            cartao.appendChild(acoes);

            if (desafio.emblema_raro === "semana-resistencia") {
                carregarPainelParticipantes(desafio, cartao);
            }
        }

        listaDesafios.appendChild(cartao);
        if (perfilAtual === "utilizador" && (desafio.participa || desafio.tem_plaqueta)) {
            carregarEmblemasDoDesafio(desafio, cartao);
        }
    });
}

async function carregarDesafios() {
    try {
        const dados = await pedidoAPI("/api/desafios");
        perfilAtual = dados.perfil;
        utilizadorIdAtual = dados.utilizador_id;
        painelGestor.hidden = perfilAtual !== "gestor_desafios";
        renderizarDesafios(dados.desafios);
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
}

formularioDesafio.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = {
        titulo: formularioDesafio.elements.titulo.value,
        descricao: formularioDesafio.elements.descricao.value,
        data_inicio: formularioDesafio.elements.data_inicio.value,
        data_fim: formularioDesafio.elements.data_fim.value,
        emblema_raro: emblemaRaroDesafio.value || null
    };
    try {
        await pedidoAPI(
            desafioEmEdicao ? "/api/desafios/" + desafioEmEdicao : "/api/desafios",
            { method: desafioEmEdicao ? "PUT" : "POST", body: JSON.stringify(dados) }
        );
        mostrarMensagem(desafioEmEdicao ? "Desafio atualizado." : "Desafio criado.");
        limparFormulario();
        await carregarDesafios();
    } catch (erro) {
        mostrarMensagem(erro.message, true);
    }
});

emblemaRaroDesafio.addEventListener("change", ajustarFimDaSemana);
dataInicioDesafio.addEventListener("change", ajustarFimDaSemana);
cancelarEdicaoDesafio.addEventListener("click", limparFormulario);
carregarDesafios();
