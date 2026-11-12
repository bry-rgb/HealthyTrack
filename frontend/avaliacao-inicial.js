// Pop-up de avaliação inicial: boas-vindas -> uma pergunta de cada vez ->
// a carregar -> meta diária sugerida (aceitar ou não).
// Uso: window.abrirAvaliacaoInicial(aoConcluir)

(function () {
    const API = window.WATERKRAFT_API_BASE_URL || "http://localhost:3000";

    const MASCOTE_BOAS_VINDAS = "assets/mascotes/Winking Frog Adventurer with Water Bottle.png";
    const MASCOTE_PERGUNTAS = "assets/mascotes/StandingMascot.png";
    const MASCOTE_META = "assets/mascotes/100_meta_atingida_v2 1.png";

    const perguntas = [
        {
            campo: "faixa_etaria",
            titulo: "Qual é a tua faixa etária?",
            opcoes: [
                ["13-17", "13 a 17 anos"],
                ["18-64", "18 a 64 anos"],
                ["65+", "65 anos ou mais"]
            ]
        },
        {
            campo: "peso",
            titulo: "Qual é o teu peso aproximado?",
            texto: "Em kg. Esta pergunta é opcional.",
            tipo: "numero",
            opcional: true
        },
        {
            campo: "atividade",
            titulo: "Qual é o teu nível de atividade habitual?",
            opcoes: [
                ["baixa", "Baixo"],
                ["moderada", "Moderado"],
                ["alta", "Elevado"]
            ]
        },
        {
            campo: "exercicio_calor",
            titulo: "Com que frequência fazes exercício intenso ou estás exposto a calor?",
            opcoes: [
                ["raramente", "Raramente"],
                ["algumas-vezes", "Algumas vezes por semana"],
                ["frequentemente", "Frequentemente"]
            ]
        },
        {
            campo: "limite_liquidos",
            titulo: "Tens alguma condição ou indicação médica que limite a ingestão de líquidos?",
            opcoes: [
                ["nao", "Não"],
                ["sim", "Sim"],
                ["nao-sei", "Não sei"]
            ]
        },
        {
            campo: "unidade",
            titulo: "Que unidade preferes?",
            opcoes: [
                ["L", "Litros (L)"],
                ["mL", "Mililitros (mL)"]
            ]
        }
    ];

    // Meta sugerida (litros), entre 0,5 e 10
    function calcularMeta(r) {
        const peso = Number(r.peso);
        let meta;
        if (Number.isFinite(peso) && peso > 0) {
            meta = peso * 0.035;
        } else {
            meta = r.faixa_etaria === "18-64" ? 2.5 : 2.0;
        }
        meta += { baixa: 0, moderada: 0.3, alta: 0.6 }[r.atividade] || 0;
        meta += { raramente: 0, "algumas-vezes": 0.3, frequentemente: 0.6 }[r.exercicio_calor] || 0;
        meta = Math.min(10, Math.max(0.5, meta));
        return Math.round(meta * 10) / 10;
    }

    function formatarMeta(litros, unidade) {
        return unidade === "mL"
            ? `${Math.round(litros * 1000)} mL`
            : `${litros.toLocaleString("pt-PT")} L`;
    }

    let modal, el, respostas, aoConcluir;

    function obterElementos() {
        modal = document.getElementById("modalAvaliacao");
        el = {
            barra: document.getElementById("avaliacaoBarra"),
            passo: document.getElementById("avaliacaoPasso"),
            mascote: document.getElementById("avaliacaoMascote"),
            titulo: document.getElementById("tituloAvaliacao"),
            texto: document.getElementById("avaliacaoTexto"),
            corpo: document.getElementById("avaliacaoCorpo"),
            erro: document.getElementById("avaliacaoErro"),
            botoes: document.getElementById("avaliacaoBotoes")
        };
    }

    function criarBotao(texto, aoClicar, classe) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = texto;
        if (classe) b.className = classe;
        b.addEventListener("click", aoClicar);
        return b;
    }

    function ecra({ passo = "", progresso = 0, mascote, titulo, texto = "" }) {
        el.passo.textContent = passo;
        el.barra.style.width = `${progresso}%`;
        el.mascote.src = mascote;
        el.titulo.textContent = titulo;
        el.texto.textContent = texto;
        el.texto.hidden = !texto;
        el.corpo.innerHTML = "";
        el.botoes.innerHTML = "";
        el.erro.textContent = "";
    }

    function mostrarBoasVindas() {
        ecra({
            mascote: MASCOTE_BOAS_VINDAS,
            titulo: "Bem-vindo ao WaterKraft! 👋",
            texto: "Que bom ter-te por cá! Vamos fazer algumas perguntas rápidas para criar uma meta de hidratação à tua medida. Demora menos de um minuto."
        });
        el.botoes.append(criarBotao("Começar", () => mostrarPergunta(0)));
    }

    function mostrarPergunta(i) {
        const p = perguntas[i];
        ecra({
            passo: `Pergunta ${i + 1} de ${perguntas.length}`,
            progresso: (i / perguntas.length) * 100,
            mascote: MASCOTE_PERGUNTAS,
            titulo: p.titulo,
            texto: p.texto || ""
        });

        const seguinte = () =>
            i + 1 < perguntas.length ? mostrarPergunta(i + 1) : mostrarCarregar();

        if (p.tipo === "numero") {
            const input = document.createElement("input");
            input.type = "number";
            input.min = "1";
            input.step = "0.1";
            input.placeholder = "Ex.: 70";
            input.value = respostas[p.campo] || "";
            el.corpo.append(input);
            setTimeout(() => input.focus(), 50);

            const continuar = () => {
                const v = input.value.trim();
                if (v && !(Number(v) > 0 && Number(v) < 500)) {
                    el.erro.textContent = "Indica um peso válido ou salta esta pergunta.";
                    return;
                }
                respostas[p.campo] = v || null;
                seguinte();
            };
            input.addEventListener("keydown", (e) => { if (e.key === "Enter") continuar(); });
            el.botoes.append(
                criarBotao("Saltar", () => { respostas[p.campo] = null; seguinte(); }, "botao-secundario"),
                criarBotao("Continuar", continuar)
            );
        } else {
            p.opcoes.forEach(([valor, rotulo]) => {
                const b = criarBotao(rotulo, () => {
                    respostas[p.campo] = valor;
                    seguinte();
                }, "opcao-avaliacao" + (respostas[p.campo] === valor ? " selecionada" : ""));
                el.corpo.append(b);
            });
        }

        if (i > 0) {
            el.botoes.prepend(criarBotao("Voltar", () => mostrarPergunta(i - 1), "botao-secundario"));
        }
    }

    async function mostrarCarregar() {
        ecra({
            progresso: 100,
            mascote: MASCOTE_PERGUNTAS,
            titulo: "A calcular a tua meta…",
            texto: "Estamos a analisar as tuas respostas."
        });
        const spinner = document.createElement("div");
        spinner.className = "avaliacao-carregar";
        el.corpo.append(spinner);

        try {
            const [resposta] = await Promise.all([
                fetch(`${API}/api/avaliacao-inicial`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(respostas)
                }),
                new Promise((r) => setTimeout(r, 1500))
            ]);
            if (resposta.status === 401) {
                window.location.href = "sessao-expirada.html";
                return;
            }
            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(dados.mensagem || "Não foi possível guardar a avaliação.");
            sessionStorage.setItem("avaliacaoInicialConcluida", "true");
            mostrarMeta();
        } catch (erro) {
            console.error("Erro ao concluir avaliação:", erro);
            el.corpo.innerHTML = "";
            el.erro.textContent = erro.message;
            el.botoes.append(
                criarBotao("Voltar", () => mostrarPergunta(perguntas.length - 1), "botao-secundario"),
                criarBotao("Tentar de novo", mostrarCarregar)
            );
        }
    }

    function mostrarMeta() {
        const meta = calcularMeta(respostas);
        ecra({
            progresso: 100,
            mascote: MASCOTE_META,
            titulo: "A tua meta diária sugerida",
            texto: "Com base nas tuas respostas, recomendamos beber por dia:"
        });
        const valor = document.createElement("p");
        valor.className = "meta-sugerida";
        valor.textContent = formatarMeta(meta, respostas.unidade);
        el.corpo.append(valor);

        el.botoes.append(
            criarBotao("Agora não", () => fechar(), "botao-secundario"),
            criarBotao("Aceitar meta", () => aceitarMeta(meta))
        );
    }

    async function aceitarMeta(meta) {
        el.erro.textContent = "";
        try {
            const resposta = await fetch(`${API}/api/meta-diaria`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ meta_diaria: meta })
            });
            const dados = await resposta.json().catch(() => ({}));
            if (!resposta.ok) throw new Error(dados.mensagem || "Não foi possível guardar a meta.");
            fechar();
        } catch (erro) {
            console.error("Erro ao guardar a meta:", erro);
            el.erro.textContent = erro.message;
        }
    }

    function fechar() {
        modal.hidden = true;
        modal.style.display = "none";
        if (typeof aoConcluir === "function") aoConcluir();
    }

    window.abrirAvaliacaoInicial = function (callback) {
        obterElementos();
        if (!modal) return;
        respostas = { unidade: "L" };
        aoConcluir = callback;
        modal.hidden = false;
        modal.style.display = "";
        mostrarBoasVindas();
    };

    // Exposto para testes
    window.calcularMetaSugerida = calcularMeta;
})();
