const API_DESAFIOS = window.WATERKRAFT_API_BASE_URL || "http://localhost:3000";
const formularioDesafio = document.getElementById("formularioDesafio");
const painelGestor = document.getElementById("painelGestor");
const listaDesafios = document.getElementById("listaDesafios");
const mensagemDesafios = document.getElementById("mensagemDesafios");
const tituloFormularioDesafio = document.getElementById("tituloFormularioDesafio");
const guardarDesafio = document.getElementById("guardarDesafio");
const cancelarEdicaoDesafio = document.getElementById("cancelarEdicaoDesafio");

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

function limparFormulario() {
    desafioEmEdicao = null;
    formularioDesafio.reset();
    tituloFormularioDesafio.textContent = "Criar desafio";
    guardarDesafio.textContent = "Criar desafio";
    cancelarEdicaoDesafio.hidden = true;
}

function elemento(tag, texto, classe) {
    const item = document.createElement(tag);
    if (texto) item.textContent = texto;
    if (classe) item.className = classe;
    return item;
}

function iniciarEdicao(desafio) {
    desafioEmEdicao = desafio.id;
    formularioDesafio.elements.titulo.value = desafio.titulo;
    formularioDesafio.elements.descricao.value = desafio.descricao;
    formularioDesafio.elements.data_inicio.value = String(desafio.data_inicio).slice(0, 10);
    formularioDesafio.elements.data_fim.value = String(desafio.data_fim).slice(0, 10);
    tituloFormularioDesafio.textContent = "Editar desafio";
    guardarDesafio.textContent = "Guardar alterações";
    cancelarEdicaoDesafio.hidden = false;
    formularioDesafio.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderizarDesafios(desafios) {
    listaDesafios.replaceChildren();
    if (desafios.length === 0) {
        listaDesafios.appendChild(elemento("p", "Ainda não existem desafios."));
        return;
    }

    desafios.forEach((desafio) => {
        const cartao = elemento("article", null, "card desafio-cartao");
        cartao.appendChild(elemento("h3", desafio.titulo));
        cartao.appendChild(elemento("p", desafio.descricao));
        cartao.appendChild(elemento(
            "p",
            "De " + String(desafio.data_inicio).slice(0, 10) + " até " + String(desafio.data_fim).slice(0, 10),
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
            const participacao = elemento("button", desafio.participa ? "Sair do desafio" : "Participar");
            participacao.type = "button";
            if (desafio.participa) participacao.className = "botao-secundario";
            participacao.addEventListener("click", async () => {
                participacao.disabled = true;
                try {
                    await pedidoAPI("/api/desafios/" + desafio.id + "/participacao", {
                        method: desafio.participa ? "DELETE" : "POST"
                    });
                    mostrarMensagem(desafio.participa ? "Saíste do desafio." : "Estás a participar no desafio.");
                    await carregarDesafios();
                } catch (erro) {
                    participacao.disabled = false;
                    mostrarMensagem(erro.message, true);
                }
            });
            acoesParticipacao.appendChild(participacao);
            cartao.appendChild(acoesParticipacao);
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
        }
        listaDesafios.appendChild(cartao);
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
        data_fim: formularioDesafio.elements.data_fim.value
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

cancelarEdicaoDesafio.addEventListener("click", limparFormulario);
carregarDesafios();
