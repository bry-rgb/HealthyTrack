const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const loginScript = fs.readFileSync(
    path.join(__dirname, "login.js"),
    "utf8"
);

function criarAmbiente({ fetch } = {}) {
    const ids = [
        "botaoLogin",
        "formLogin",
        "botaoRegisto",
        "mensagemAutenticacao",
        "tabEntrar",
        "tabCriarConta",
        "painelLogin",
        "painelRegisto",
        "emailLogin",
        "senhaLogin",
        "nomeRegisto",
        "emailRegisto",
        "senhaRegisto"
    ];

    const elementos = Object.fromEntries(ids.map((id) => [id, {
        value: "",
        hidden: id === "painelRegisto",
        textContent: "",
        listeners: {},
        classList: {
            classes: new Set(),
            add(classe) {
                this.classes.add(classe);
            },
            remove(classe) {
                this.classes.delete(classe);
            }
        },
        addEventListener(evento, callback) {
            this.listeners[evento] = callback;
        }
    }]));

    const armazenamento = new Map();
    const chamadasFetch = fetch || (() =>
        Promise.reject(new Error("fetch não configurado"))
    );

    const contexto = {
        document: {
            getElementById: (id) => elementos[id]
        },
        fetch: chamadasFetch,
        sessionStorage: {
            setItem: (chave, valor) => armazenamento.set(chave, valor),
            getItem: (chave) => armazenamento.get(chave)
        },
        window: {
            location: { href: "" }
        },
        console: {
            log() {},
            error() {}
        },
        JSON,
        Error
    };

    vm.runInNewContext(loginScript, contexto, {
        filename: "login.js"
    });

    return { elementos, armazenamento, contexto };
}

function respostaJson(dados, ok = true) {
    return {
        ok,
        json: async () => dados
    };
}

async function aguardarAtualizacao() {
    await new Promise((resolve) => setImmediate(resolve));
}

test("alternar separadores mostra o painel de registo e limpa a mensagem", () => {
    const { elementos } = criarAmbiente();
    elementos.mensagemAutenticacao.textContent = "Erro anterior";

    elementos.tabCriarConta.listeners.click();

    assert.equal(elementos.painelLogin.hidden, true);
    assert.equal(elementos.painelRegisto.hidden, false);
    assert.equal(elementos.mensagemAutenticacao.textContent, "");
    assert.equal(
        elementos.tabCriarConta.classList.classes.has("tab-ativa"),
        true
    );
});

test("login envia credenciais com cookie e encaminha para o painel (avaliação em pop-up)", async () => {
    let pedido;

    const { elementos, armazenamento, contexto } = criarAmbiente({
        fetch: async (url, opcoes) => {
            pedido = { url, opcoes };
            return respostaJson({
                usuario: { avaliacao_inicial_concluida: false }
            });
        }
    });

    elementos.emailLogin.value = "ana@example.com";
    elementos.senhaLogin.value = "senha-segura";

    elementos.formLogin.listeners.submit({
        preventDefault() {}
    });
    await aguardarAtualizacao();

    assert.equal(pedido.url, "http://localhost:3000/api/login");
    assert.deepEqual(JSON.parse(pedido.opcoes.body), {
        email: "ana@example.com",
        senha: "senha-segura"
    });
    assert.equal(pedido.opcoes.credentials, "same-origin");
    assert.equal(armazenamento.get("token"), undefined);
    assert.equal(
        contexto.window.location.href,
        "index.html"
    );
});

test("login mostra a mensagem quando a API rejeita as credenciais", async () => {
    const { elementos } = criarAmbiente({
        fetch: async () =>
            respostaJson(
                { mensagem: "Email ou senha incorretos" },
                false
            )
    });

    elementos.formLogin.listeners.submit({
        preventDefault() {}
    });
    await aguardarAtualizacao();

    assert.equal(
        elementos.mensagemAutenticacao.textContent,
        "Email ou senha incorretos"
    );
});

test("registo envia os dados e apresenta a confirmação da API", async () => {
    let pedido;

    const { elementos } = criarAmbiente({
        fetch: async (url, opcoes) => {
            pedido = { url, opcoes };
            return respostaJson({
                mensagem: "Conta criada com sucesso!"
            });
        }
    });

    elementos.nomeRegisto.value = "Ana";
    elementos.emailRegisto.value = "ana@example.com";
    elementos.senhaRegisto.value = "senha-segura";

    elementos.botaoRegisto.listeners.click();
    await aguardarAtualizacao();

    assert.equal(pedido.url, "http://localhost:3000/api/usuarios");
    assert.deepEqual(JSON.parse(pedido.opcoes.body), {
        nome: "Ana",
        email: "ana@example.com",
        senha: "senha-segura"
    });
    assert.equal(
        elementos.mensagemAutenticacao.textContent,
        "Conta criada com sucesso!"
    );
});