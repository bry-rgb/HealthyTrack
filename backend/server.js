const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { senhaValida } = require("./validacoes");
const { agendarLimpezaDiariaLogin } = require("./jobs/limpeza-contadores-login");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = "healthytrack";
const JWT_AUDIENCE = "healthytrack-api";

if (!JWT_SECRET) {
    console.error("Erro: JWT_SECRET não está definido no ficheiro .env");
    process.exit(1);
}

const pool = new Pool(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || "healthytrack",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "healthytrack"
    }
);


if (require.main === module) {
    pool.query("SELECT NOW()", function (erro, resultado) {
        if (erro) {
            console.error("Erro ao conectar ao banco de dados:", erro);
            return;
        }

        console.log(
            "Conectado ao Postgres com sucesso! Hora atual:",
            resultado.rows[0].now
        );
    });
}

const app = express();

app.use(express.json());

const origensCorsPermitidas = new Set([
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    ...(process.env.CORS_ORIGINS || "")
        .split(",")
        .map((origem) => origem.trim())
        .filter(Boolean)
]);

app.use(cors({
    origin: (origem, callback) => {
        if (!origem || origensCorsPermitidas.has(origem)) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    credentials: true
}));

// A Vercel encaminha os pedidos através da sua infraestrutura de proxy.
// Mantemos um único salto de confiança para obter o IP do cliente em req.ip.
app.set("trust proxy", 1);

// Adiciona cabeçalhos HTTP de segurança às respostas da API.
// O HSTS é aplicado pelo Helmet apenas em ligações HTTPS.
app.use(helmet());

// Limita tentativas por conta e por IP com armazenamento partilhado no PostgreSQL.
// Os identificadores são HMACs: não guardamos IPs nem emails nesta tabela.
const JANELA_LOGIN_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS_CONTA = 5;
const MAX_TENTATIVAS_IP = 30;
const INTERVALO_LIMPEZA_LOGIN_MS = 24 * 60 * 60 * 1000;
let ultimaLimpezaLogin = 0;

async function limitarTentativasLogin(req, res, next) {
    // Pedidos sem corpo JSON (ou com JSON null) não devem interromper o login.
    const dadosLogin = req.body && typeof req.body === "object"
        ? req.body
        : {};

    // Mantém os erros de validação fora dos contadores.
    if (
        typeof dadosLogin.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dadosLogin.email) ||
        typeof dadosLogin.senha !== "string" ||
        !dadosLogin.senha
    ) {
        next();
        return;
    }

    const ip = req.ip || req.socket.remoteAddress || "desconhecido";
    const emailNormalizado = dadosLogin.email.trim().toLowerCase();
    const hashIp = crypto.createHmac("sha256", JWT_SECRET)
        .update(ip)
        .digest("hex");
    const hashConta = crypto.createHmac("sha256", JWT_SECRET)
        .update(emailNormalizado)
        .digest("hex");

    try {
        // Remove registos inactivos há mais de 24 horas, no máximo uma vez
        // por dia e por instância da aplicação. Os índices tornam a limpeza eficiente.
        if (Date.now() - ultimaLimpezaLogin >= INTERVALO_LIMPEZA_LOGIN_MS) {
            try {
                await pool.query(
                    "DELETE FROM login_rate_limits WHERE updated_at < NOW() - INTERVAL '24 hours'"
                );
                await pool.query(
                    "DELETE FROM login_rate_limits_accounts WHERE updated_at < NOW() - INTERVAL '24 hours'"
                );
                ultimaLimpezaLogin = Date.now();
            } catch (erroLimpeza) {
                // A limpeza é manutenção: uma falha não desactiva os limites de segurança.
                console.error("Aviso: não foi possível limpar contadores antigos:", erroLimpeza);
            }
        }

        const [resultadoIp, resultadoConta] = await Promise.all([
            pool.query(
                `INSERT INTO login_rate_limits
                    (ip_hash, window_started_at, attempts, updated_at)
                 VALUES ($1, NOW(), 1, NOW())
                 ON CONFLICT (ip_hash)
                 DO UPDATE SET
                    window_started_at = CASE
                        WHEN login_rate_limits.window_started_at <= NOW() - ($2 * INTERVAL '1 millisecond')
                        THEN NOW()
                        ELSE login_rate_limits.window_started_at
                    END,
                    attempts = CASE
                        WHEN login_rate_limits.window_started_at <= NOW() - ($2 * INTERVAL '1 millisecond')
                        THEN 1
                        ELSE LEAST(login_rate_limits.attempts + 1, $3 + 1)
                    END,
                    updated_at = NOW()
                 RETURNING attempts,
                    GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
                        window_started_at + ($2 * INTERVAL '1 millisecond') - NOW()
                    ))))::integer AS segundos_restantes`,
                [hashIp, JANELA_LOGIN_MS, MAX_TENTATIVAS_IP]
            ),
            pool.query(
                `INSERT INTO login_rate_limits_accounts
                    (account_hash, window_started_at, attempts, updated_at)
                 VALUES ($1, NOW(), 1, NOW())
                 ON CONFLICT (account_hash)
                 DO UPDATE SET
                    window_started_at = CASE
                        WHEN login_rate_limits_accounts.window_started_at <= NOW() - ($2 * INTERVAL '1 millisecond')
                        THEN NOW()
                        ELSE login_rate_limits_accounts.window_started_at
                    END,
                    attempts = CASE
                        WHEN login_rate_limits_accounts.window_started_at <= NOW() - ($2 * INTERVAL '1 millisecond')
                        THEN 1
                        ELSE LEAST(login_rate_limits_accounts.attempts + 1, $3 + 1)
                    END,
                    updated_at = NOW()
                 RETURNING attempts,
                    GREATEST(1, CEIL(EXTRACT(EPOCH FROM (
                        window_started_at + ($2 * INTERVAL '1 millisecond') - NOW()
                    ))))::integer AS segundos_restantes`,
                [hashConta, JANELA_LOGIN_MS, MAX_TENTATIVAS_CONTA]
            )
        ]);

        const estadoIp = resultadoIp.rows[0];
        const estadoConta = resultadoConta.rows[0];
        if (!estadoIp || !estadoConta) {
            throw new Error("Não foi possível obter os contadores de tentativas.");
        }

        req.loginRateLimitHashIp = hashIp;
        req.loginRateLimitHashConta = hashConta;

        if (
            estadoConta.attempts > MAX_TENTATIVAS_CONTA ||
            estadoIp.attempts > MAX_TENTATIVAS_IP
        ) {
            const segundosRestantes = Math.max(
                estadoConta.attempts > MAX_TENTATIVAS_CONTA ? estadoConta.segundos_restantes : 0,
                estadoIp.attempts > MAX_TENTATIVAS_IP ? estadoIp.segundos_restantes : 0
            );
            res.set("Retry-After", String(segundosRestantes));
            res.status(429).json({
                mensagem: "Demasiadas tentativas de login. Tenta novamente dentro de alguns minutos."
            });
            return;
        }

        next();
    } catch (erro) {
        console.error("Erro ao verificar limite de tentativas de login:", erro);
        res.status(503).json({
            mensagem: "Não foi possível validar o limite de tentativas. Tenta novamente."
        });
    }
}
const PORT = Number(process.env.PORT || 3000);

// Cookie de sessão inacessível a JavaScript no navegador.
const NOME_COOKIE_SESSAO = "waterkraft_session";
const DURACAO_SESSAO_SEGUNDOS = 60 * 60;

function obterCookie(req, nome) {
    const cabecalho = req.headers.cookie || "";
    const item = cabecalho.split(";").map(parte => parte.trim())
        .find(parte => parte.startsWith(nome + "="));
    return item ? decodeURIComponent(item.slice(nome.length + 1)) : null;
}

function definirCookieSessao(res, token) {
    res.append("Set-Cookie",
        NOME_COOKIE_SESSAO + "=" + encodeURIComponent(token) +
        "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" + DURACAO_SESSAO_SEGUNDOS
    );
}

function limparCookieSessao(res) {
    res.append("Set-Cookie",
        NOME_COOKIE_SESSAO + "=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );
}

function origemPermitida(req) {
    const origem = req.get("Origin");
    return Boolean(origem && origensCorsPermitidas.has(origem));
}

// Todos os pedidos protegidos exigem cookie HttpOnly e sessão ativa na base de dados.
async function verificarToken(req, res, next) {
    const token = obterCookie(req, NOME_COOKIE_SESSAO);

    if (!token) {
        res.status(401).json({ mensagem: "Sessão não fornecida ou formato inválido" });
        return;
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !origemPermitida(req)) {
        res.status(403).json({ mensagem: "Origem não autorizada" });
        return;
    }

    try {
        const usuario = jwt.verify(token, JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        });

        if (!usuario.jti) {
            res.status(401).json({ mensagem: "Sessão inválida ou expirada" });
            return;
        }

        const sessao = await pool.query(
            "SELECT jti FROM sessoes_utilizador WHERE jti = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()",
            [usuario.jti, usuario.id]
        );

        if (sessao.rows.length === 0) {
            res.status(401).json({ mensagem: "Sessão inválida ou expirada" });
            return;
        }

        req.sessaoJti = usuario.jti;
        req.usuario = usuario;
        next();
    } catch (erro) {
        if (erro && erro.name !== "JsonWebTokenError" && erro.name !== "TokenExpiredError" && erro.name !== "NotBeforeError") {
            console.error("Erro ao validar sessão:", erro);
            res.status(503).json({ mensagem: "Não foi possível validar a sessão" });
            return;
        }
        res.status(401).json({ mensagem: "Token inválido ou expirado" });
    }
}

// O perfil é consultado na base de dados para aplicar imediatamente alterações
// de permissões, sem depender do tempo restante do JWT.
async function exigirGestorDesafios(req, res, next) {
    try {
        const resultado = await pool.query(
            "SELECT perfil FROM usuarios WHERE id = $1",
            [req.usuario.id]
        );
        if (resultado.rows.length === 0) {
            res.status(401).json({ mensagem: "Utilizador não encontrado" });
            return;
        }
        if (resultado.rows[0].perfil !== "gestor_desafios") {
            res.status(403).json({ mensagem: "Permissão de gestor de desafios necessária" });
            return;
        }
        next();
    } catch (erro) {
        console.error("Erro ao verificar perfil de gestor:", erro);
        res.status(503).json({ mensagem: "Não foi possível verificar as permissões" });
    }
}

async function exigirUtilizador(req, res, next) {
    try {
        const resultado = await pool.query(
            "SELECT perfil FROM usuarios WHERE id = $1",
            [req.usuario.id]
        );
        if (resultado.rows.length === 0) {
            res.status(401).json({ mensagem: "Utilizador não encontrado" });
            return;
        }
        if (resultado.rows[0].perfil !== "utilizador") {
            res.status(403).json({ mensagem: "A participação está disponível para contas de utilizador" });
            return;
        }
        next();
    } catch (erro) {
        console.error("Erro ao verificar perfil de utilizador:", erro);
        res.status(503).json({ mensagem: "Não foi possível verificar as permissões" });
    }
}

function dataISOValida(valor) {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const data = new Date(valor + "T00:00:00.000Z");
    return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function validarDadosDesafio(dados) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
        return "Envia os dados do desafio num objeto JSON";
    }
    if (typeof dados.titulo !== "string" || dados.titulo.trim().length < 3 || dados.titulo.trim().length > 100) {
        return "O título deve ter entre 3 e 100 caracteres";
    }
    if (typeof dados.descricao !== "string" || !dados.descricao.trim() || dados.descricao.trim().length > 2000) {
        return "A descrição é obrigatória e deve ter no máximo 2000 caracteres";
    }
    if (!dataISOValida(dados.data_inicio) || !dataISOValida(dados.data_fim)) {
        return "As datas devem usar o formato AAAA-MM-DD e ser datas válidas";
    }
    if (dados.data_fim < dados.data_inicio) {
        return "A data de fim não pode ser anterior à data de início";
    }
    const emblemaRaro = dados.emblema_raro == null || dados.emblema_raro === ""
        ? null
        : dados.emblema_raro;
    if (emblemaRaro !== null && emblemaRaro !== "semana-resistencia") {
        return "O emblema raro selecionado não é válido";
    }
    if (emblemaRaro) {
        const dias = (Date.parse(dados.data_fim + "T00:00:00.000Z") -
            Date.parse(dados.data_inicio + "T00:00:00.000Z")) / 86400000 + 1;
        if (dias !== 7) {
            return "A medalha Semana da Resistência exige um desafio de exatamente 7 dias";
        }
    }
    return null;
}

function idDesafioValido(valor) {
    return /^\d+$/.test(valor) && Number(valor) > 0;
}

async function consultarDiasMetaDesafio(desafioId, utilizadorId, metaDiaria) {
    const resultado = await pool.query(
        `WITH intervalo AS (
            SELECT data_inicio, data_fim
            FROM desafios
            WHERE id = $1
        ), dias AS (
            SELECT generate_series(
                intervalo.data_inicio::timestamp,
                intervalo.data_fim::timestamp,
                INTERVAL '1 day'
            )::date AS data
            FROM intervalo
        ), totais AS (
            SELECT registros.horario::date AS data,
                SUM(registros.quantidade) AS total_litros
            FROM registro_agua AS registros
            JOIN intervalo ON TRUE
            WHERE registros.usuario_id = $2
              AND registros.horario >= intervalo.data_inicio
              AND registros.horario < intervalo.data_fim + INTERVAL '1 day'
            GROUP BY registros.horario::date
        )
        SELECT to_char(dias.data, 'YYYY-MM-DD') AS data,
            COALESCE(totais.total_litros, 0)::numeric(10,2) AS total_litros,
            $3::numeric(6,2) AS meta_diaria,
            COALESCE(totais.total_litros, 0) >= $3::numeric AS meta_cumprida,
            CASE
                WHEN dias.data > CURRENT_DATE THEN 'por_iniciar'
                WHEN dias.data = CURRENT_DATE
                    AND COALESCE(totais.total_litros, 0) < $3::numeric THEN 'em_curso'
                WHEN COALESCE(totais.total_litros, 0) >= $3::numeric THEN 'atingida'
                ELSE 'nao_atingida'
            END AS estado
        FROM dias
        LEFT JOIN totais ON totais.data = dias.data
        ORDER BY dias.data`,
        [desafioId, utilizadorId, metaDiaria]
    );
    const dias = resultado.rows.map((dia) => ({
        ...dia,
        total_litros: Number(dia.total_litros),
        meta_diaria: Number(dia.meta_diaria),
        meta_cumprida: Boolean(dia.meta_cumprida)
    }));
    return {
        dias,
        dias_meta_cumprida: dias.filter((dia) => dia.meta_cumprida).length,
        dias_no_desafio: dias.length
    };
}



// GET - buscar registros de água
app.get("/api/registros-agua", verificarToken, function (req, res) {
   pool.query(
    // Só devolve os registos do dia atual (no fuso horário do utilizador).
    // O cliente envia "inicio" e "fim" (ISO) do seu dia local; os dias
    // anteriores continuam guardados na base de dados para o histórico.
    `SELECT * FROM registro_agua
     WHERE usuario_id = $1
       AND horario >= $2
       AND horario < $3
     ORDER BY horario`,
    (function () {
        let inicio = Date.parse(req.query.inicio);
        let fim = Date.parse(req.query.fim);
        if (isNaN(inicio) || isNaN(fim)) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            inicio = hoje.getTime();
            fim = inicio + 24 * 60 * 60 * 1000;
        }
        return [req.usuario.id, new Date(inicio).toISOString(), new Date(fim).toISOString()];
    })(),
    function (erro, resultado) {
        if (erro) {
            console.error("Erro ao buscar registros de água:", erro);
            res.status(500).json({
                mensagem: "Erro ao buscar registros de água"
            });
            return;
        }

        res.json(resultado.rows);
    });
});


 // GET - buscar meta diária do utilizador
app.get("/api/meta-diaria", verificarToken, function (req, res) {
    pool.query(
        "SELECT meta_diaria FROM usuarios WHERE id = $1",
        [req.usuario.id],
        function (erro, resultado) {
            if (erro) {
                console.error("Erro ao buscar meta diária:", erro);
                res.status(500).json({
                    mensagem: "Erro ao buscar meta diária"
                });
                return;
            }

            if (resultado.rows.length === 0) {
                res.status(404).json({
                    mensagem: "Utilizador não encontrado"
                });
                return;
            }

            res.json({
                meta_diaria: Number(resultado.rows[0].meta_diaria)
            });
        }
    );
});


 // GET - obter estatísticas diárias de hidratação
app.get("/api/estatisticas-diarias", verificarToken, function (req, res) {
    pool.query(
        `SELECT
            to_char(dias.data, 'YYYY-MM-DD') AS data,
            COALESCE(SUM(registros.quantidade), 0) AS total_litros
        FROM generate_series(
            CURRENT_DATE - INTERVAL '6 days',
            CURRENT_DATE,
            INTERVAL '1 day'
        ) AS dias(data)
        LEFT JOIN registro_agua AS registros
            ON registros.horario::date = dias.data::date
            AND registros.usuario_id = $1
        GROUP BY dias.data
        ORDER BY dias.data`,
        [req.usuario.id],
        function (erro, resultado) {
            if (erro) {
                console.error("Erro ao buscar estatísticas diárias:", erro);
                res.status(500).json({
                    mensagem: "Erro ao buscar estatísticas diárias"
                });
                return;
            }

            res.json(resultado.rows);
        }
    );
});




// GET - calendário mensal de hidratação do utilizador autenticado
app.get("/api/calendario-hidratacao", verificarToken, function (req, res) {
    const mes = req.query.mes;
    if (typeof mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
        res.status(400).json({ mensagem: "Indica o mês no formato AAAA-MM" });
        return;
    }

    const [ano, numeroMes] = mes.split("-").map(Number);
    const agora = new Date();
    if (ano < 2000 || ano > 9999 || ano * 100 + numeroMes > agora.getFullYear() * 100 + agora.getMonth() + 1) {
        res.status(400).json({ mensagem: "Não é possível consultar um mês futuro" });
        return;
    }

    pool.query(
        `WITH periodo AS (
            SELECT to_date($2 || '-01', 'YYYY-MM-DD') AS inicio
        ), dias AS (
            SELECT generate_series(
                periodo.inicio,
                LEAST((periodo.inicio + INTERVAL '1 month - 1 day')::date, CURRENT_DATE),
                INTERVAL '1 day'
            )::date AS data
            FROM periodo
        )
        SELECT to_char(dias.data, 'YYYY-MM-DD') AS data,
            COALESCE(SUM(registros.quantidade), 0)::numeric(10,2) AS total_litros,
            utilizador.meta_diaria,
            COALESCE(SUM(registros.quantidade), 0) >= utilizador.meta_diaria AS meta_cumprida
        FROM dias
        JOIN usuarios AS utilizador ON utilizador.id = $1
        LEFT JOIN registro_agua AS registros
            ON registros.usuario_id = utilizador.id
            AND registros.horario >= dias.data
            AND registros.horario < dias.data + INTERVAL '1 day'
        GROUP BY dias.data, utilizador.meta_diaria
        ORDER BY dias.data`,
        [req.usuario.id, mes],
        function (erro, resultado) {
            if (erro) {
                console.error("Erro ao buscar calendário de hidratação:", erro);
                res.status(500).json({ mensagem: "Erro ao buscar calendário de hidratação" });
                return;
            }
            res.json(resultado.rows);
        }
    );
});

 // PUT - atualizar meta diária do utilizador
app.put("/api/meta-diaria", verificarToken, function (req, res) {
    const metaDiaria = req.body.meta_diaria;

    if (
        typeof metaDiaria !== "number" ||
        !Number.isFinite(metaDiaria) ||
        metaDiaria < 0.5 ||
        metaDiaria > 10
    ) {
        res.status(400).json({
            mensagem: "A meta diária deve estar entre 0,5 e 10 litros"
        });
        return;
    }

    pool.query(
        "UPDATE usuarios SET meta_diaria = $1 WHERE id = $2 RETURNING meta_diaria",
        [metaDiaria, req.usuario.id],
        function (erro, resultado) {
            if (erro) {
                console.error("Erro ao atualizar meta diária:", erro);
                res.status(500).json({
                    mensagem: "Erro ao atualizar meta diária"
                });
                return;
            }

            if (resultado.rows.length === 0) {
                res.status(404).json({
                    mensagem: "Utilizador não encontrado"
                });
                return;
            }

            res.json({
                mensagem: "Meta diária atualizada com sucesso",
                meta_diaria: Number(resultado.rows[0].meta_diaria)
            });
        }
    );
});

app.get("/api/avaliacao-inicial", verificarToken, function (req, res) {
    pool.query(
        "SELECT limite_liquidos, ocultar_aviso_meta FROM avaliacao_inicial WHERE usuario_id = $1",
        [req.usuario.id],
        function (erro, resultado) {
            if (erro) {
                console.error("Erro ao consultar avaliação inicial:", erro);
                res.status(500).json({ mensagem: "Erro ao consultar avaliação inicial" });
                return;
            }
            if (resultado.rows.length === 0) {
                res.status(404).json({ mensagem: "Avaliação inicial não encontrada" });
                return;
            }
            res.json({
                limite_liquidos: resultado.rows[0].limite_liquidos,
                ocultar_aviso_meta: resultado.rows[0].ocultar_aviso_meta
            });
        }
    );
});

// PUT - "Não mostrar novamente" o aviso médico
app.put("/api/avaliacao-inicial/ocultar-aviso", verificarToken, function (req, res) {
    pool.query(
        "UPDATE avaliacao_inicial SET ocultar_aviso_meta = true WHERE usuario_id = $1",
        [req.usuario.id],
        function (erro) {
            if (erro) {
                console.error("Erro ao ocultar aviso:", erro);
                res.status(500).json({ mensagem: "Erro ao guardar a preferência" });
                return;
            }
            res.json({ mensagem: "Aviso ocultado" });
        }
    );
});


// PUT - marcar avaliação inicial como concluída
app.put("/api/avaliacao-inicial", verificarToken, function (req, res) {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ mensagem: "Respostas da avaliação inválidas" });
    }

    const {
        faixa_etaria,
        peso,
        atividade,
        exercicio_calor,
        limite_liquidos,
        unidade
    } = req.body;

    const valoresPermitidos = {
        faixa_etaria: ["13-17", "18-64", "65+"],
        atividade: ["baixa", "moderada", "alta"],
        exercicio_calor: ["raramente", "algumas-vezes", "frequentemente"],
        limite_liquidos: ["nao", "sim", "nao-sei"],
        unidade: ["L", "mL"]
    };

    const camposValidos = Object.entries(valoresPermitidos).every(
        ([campo, opcoes]) => opcoes.includes(req.body[campo])
    );

    const pesoValido = peso === null || peso === undefined ||
        ((typeof peso === "number" || typeof peso === "string") &&
            String(peso).trim() !== "" &&
            Number.isFinite(Number(peso)) &&
            Number(peso) > 0 &&
            Number(peso) < 500);

    if (!camposValidos || !pesoValido) {
        return res.status(400).json({ mensagem: "Respostas da avaliação inválidas" });
    }

    const pesoNormalizado = peso === null || peso === undefined ? null : Number(peso);

    pool.query(
        `INSERT INTO avaliacao_inicial
            (usuario_id, faixa_etaria, peso, atividade, exercicio_calor, limite_liquidos, unidade)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (usuario_id)
         DO UPDATE SET
            faixa_etaria = EXCLUDED.faixa_etaria,
            peso = EXCLUDED.peso,
            atividade = EXCLUDED.atividade,
            exercicio_calor = EXCLUDED.exercicio_calor,
            limite_liquidos = EXCLUDED.limite_liquidos,
            unidade = EXCLUDED.unidade`,
        [
            req.usuario.id,
            faixa_etaria,
            pesoNormalizado,
            atividade,
            exercicio_calor,
            limite_liquidos,
            unidade
        ],
        function (erro) {
            if (erro) {
                console.error("Erro ao guardar avaliação inicial:", erro);
                res.status(500).json({
                    mensagem: "Erro ao guardar avaliação inicial"
                });
                return;
            }

            pool.query(
                "UPDATE usuarios SET avaliacao_inicial_concluida = true WHERE id = $1",
                [req.usuario.id],
                function (erroAtualizacao) {
                    if (erroAtualizacao) {
                        console.error("Erro ao concluir avaliação inicial:", erroAtualizacao);
                        res.status(500).json({
                            mensagem: "Respostas guardadas, mas não foi possível concluir a avaliação"
                        });
                        return;
                    }

                    res.json({
                        mensagem: "Avaliação inicial guardada e concluída"
                    });
                }
            );
        }
    );
});

// POST - registrar água
app.post("/api/registros-agua", verificarToken, function (req, res) {

    if (
        typeof req.body.quantidade !== "number" ||
        req.body.quantidade <= 0 ||
        req.body.quantidade > 0.5 ||
        !req.body.horario ||
        isNaN(Date.parse(req.body.horario))
    ) {
        res.status(400).json({
            mensagem: "Dados inválidos"
        });
        return;
    }

  pool.query(
    "INSERT INTO registro_agua (quantidade, horario, usuario_id) VALUES ($1, $2, $3)",
    [req.body.quantidade, req.body.horario, req.usuario.id],
        function (erro) {

            if (erro) {
                console.error("Erro ao inserir registro de água:", erro);
                res.status(500).json({
                    mensagem: "Erro ao inserir registro de água"
                });
                return;
            }

            res.json({
                mensagem: "Registro de água recebido com sucesso!"
            });
        }
    );
});


// POST - criar usuário
app.post("/api/usuarios", async function (req, res) {

    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        res.status(400).json({
            mensagem: "Nome, email e senha são obrigatórios"
        });
        return;
    }

    if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
) {
    res.status(400).json({
        mensagem: "O formato do email é inválido"
    });
    return;
}
     
if (!senhaValida(senha)) {
    res.status(400).json({
        mensagem: "A senha deve ter pelo menos 8 caracteres"
    });
    return;
}
 

    try {

        const hash = await bcrypt.hash(senha, 10);

        
await pool.query(
    "INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3)",
    [nome, email, hash]
);


        res.status(201).json({
            mensagem: "Usuário criado com sucesso!"
        });

    } catch (erro) {

        if (erro.code === "23505") {
            res.status(409).json({
                mensagem: "Este email já está cadastrado"
            });
            return;
        }

        console.error("Erro ao criar usuário:", erro);

        res.status(500).json({
            mensagem: "Erro ao criar usuário"
        });
    }
});

// POST - login de usuário
    app.post("/api/login", limitarTentativasLogin, async function (req, res) {

        // Garante um objeto mesmo quando o pedido não contém corpo JSON.
        const { email, senha } = req.body && typeof req.body === "object"
            ? req.body
            : {};

        if (!email || !senha) {
    res.status(400).json({
        mensagem: "Email e senha são obrigatórios"
    });
    return;
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({
        mensagem: "Email inválido"
    });
    return;
}

try {
        const resultado = await pool.query(
    "SELECT * FROM usuarios WHERE email = $1",
    [email]
);
        if (resultado.rows.length === 0) {
    res.status(401).json({
        mensagem: "Email ou senha incorretos"
    });
    return;
}

    const usuario = resultado.rows[0];

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    
    if (!senhaCorreta) {
        res.status(401).json({
            mensagem: "Email ou senha incorretos"
        });
        return;
}

    // Um login bem-sucedido limpa os contadores deste IP e desta conta.
    await Promise.all([
        pool.query(
            "DELETE FROM login_rate_limits WHERE ip_hash = $1",
            [req.loginRateLimitHashIp]
        ),
        pool.query(
            "DELETE FROM login_rate_limits_accounts WHERE account_hash = $1",
            [req.loginRateLimitHashConta]
        )
    ]);

    const jti = crypto.randomUUID();
    const token = jwt.sign(
    {
        id: usuario.id,
        email: usuario.email
    },
    JWT_SECRET,
    {
        algorithm: "HS256",
        expiresIn: DURACAO_SESSAO_SEGUNDOS,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        jwtid: jti
    }
);
    const expiraEm = new Date(Date.now() + DURACAO_SESSAO_SEGUNDOS * 1000);
    await pool.query(
        "INSERT INTO sessoes_utilizador (jti, user_id, expires_at) VALUES ($1, $2, $3)",
        [jti, usuario.id, expiraEm]
    );
    definirCookieSessao(res, token);
    res.json({
    mensagem: "Login realizado com sucesso!",
    usuario: {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    avaliacao_inicial_concluida: usuario.avaliacao_inicial_concluida
}
});

} catch (erro) {
    console.error("Erro ao iniciar sessão:", erro);
    res.status(500).json({
        mensagem: "Erro interno de servidor"
    });
}
});

// POST - terminar sessão de forma idempotente, incluindo repetições após revogação.
app.post("/api/logout", async function (req, res) {
    if (!origemPermitida(req)) {
        res.status(403).json({ mensagem: "Origem não autorizada" });
        return;
    }

    const token = obterCookie(req, NOME_COOKIE_SESSAO);

    // Sem cookie, não há sessão a revogar: limpar o cookie e confirmar o logout.
    if (!token) {
        limparCookieSessao(res);
        res.json({ mensagem: "Sessão terminada com sucesso" });
        return;
    }

    let usuario;
    try {
        // Ignora apenas a expiração do JWT para permitir repetir o logout.
        // A assinatura, algoritmo, emissor e destinatário continuam a ser validados.
        usuario = jwt.verify(token, JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            ignoreExpiration: true
        });
    } catch {
        // Um token inválido não pode identificar uma sessão para revogar.
        limparCookieSessao(res);
        res.json({ mensagem: "Sessão terminada com sucesso" });
        return;
    }

    if (!usuario.jti || !usuario.id) {
        limparCookieSessao(res);
        res.json({ mensagem: "Sessão terminada com sucesso" });
        return;
    }

    try {
        // A atualização é segura para repetições: só altera sessões ainda ativas.
        await pool.query(
            "UPDATE sessoes_utilizador SET revoked_at = NOW() WHERE jti = $1 AND user_id = $2 AND revoked_at IS NULL",
            [usuario.jti, usuario.id]
        );
        limparCookieSessao(res);
        res.json({ mensagem: "Sessão terminada com sucesso" });
    } catch (erro) {
        console.error("Erro ao terminar sessão:", erro);
        res.status(503).json({ mensagem: "Não foi possível terminar a sessão" });
    }
});

// DELETE - apagar registros de água
app.delete("/api/registros-agua", verificarToken, function (req, res) {

   pool.query(
    "DELETE FROM registro_agua WHERE usuario_id = $1",
    [req.usuario.id],
    function (erro) {

        if (erro) {
            console.error("Erro ao apagar registros de água:", erro);
            res.status(500).json({
                mensagem: "Erro ao apagar registros de água"
            });
            return;
        }

        res.json({
            mensagem: "Registros de água apagados com sucesso!"
        });
    });
});


// Qualquer utilizador autenticado pode consultar os desafios. Apenas o gestor
// pode criar, editar ou apagar os desafios que criou.
app.get("/api/desafios", verificarToken, async function (req, res) {
    try {
        const [perfil, desafios] = await Promise.all([
            pool.query("SELECT id, perfil FROM usuarios WHERE id = $1", [req.usuario.id]),
            pool.query(
                "SELECT d.id, d.titulo, d.descricao, d.data_inicio, d.data_fim, " +
                "d.gestor_id, u.nome AS gestor_nome, d.criado_em, " +
                "CASE WHEN d.gestor_id = $1 OR EXISTS (" +
                "SELECT 1 FROM participacoes_desafios AS p " +
                "WHERE p.desafio_id = d.id AND p.usuario_id = $1) OR EXISTS (" +
                "SELECT 1 FROM emblemas_desafios_utilizadores AS e " +
                "WHERE e.desafio_id = d.id AND e.usuario_id = $1 AND e.tipo = 'participacao') " +
                "THEN d.emblema_raro ELSE NULL END AS emblema_raro, " +
                "EXISTS (SELECT 1 FROM participacoes_desafios AS p " +
                "WHERE p.desafio_id = d.id AND p.usuario_id = $1) AS participa, " +
                "EXISTS (SELECT 1 FROM emblemas_desafios_utilizadores AS e " +
                "WHERE e.desafio_id = d.id AND e.usuario_id = $1 AND e.tipo = 'participacao') AS tem_plaqueta, " +
                "EXISTS (SELECT 1 FROM emblemas_desafios_utilizadores AS e " +
                "WHERE e.desafio_id = d.id AND e.usuario_id = $1 AND e.tipo = 'semana-resistencia') AS medalha_rara_conquistada, " +
                "(SELECT COUNT(*)::int FROM participacoes_desafios AS p " +
                "WHERE p.desafio_id = d.id) AS total_participantes " +
                "FROM desafios AS d JOIN usuarios AS u ON u.id = d.gestor_id " +
                "ORDER BY d.data_inicio DESC, d.id DESC",
                [req.usuario.id]
            )
        ]);
        if (perfil.rows.length === 0) {
            res.status(401).json({ mensagem: "Utilizador não encontrado" });
            return;
        }
        res.json({
            perfil: perfil.rows[0].perfil,
            utilizador_id: perfil.rows[0].id,
            desafios: desafios.rows
        });
    } catch (erro) {
        console.error("Erro ao consultar desafios:", erro);
        res.status(500).json({ mensagem: "Erro ao consultar desafios" });
    }
});

app.post("/api/desafios/:id/participacao", verificarToken, exigirUtilizador, async function (req, res) {
    if (!idDesafioValido(req.params.id)) {
        res.status(400).json({ mensagem: "Identificador de desafio inválido" });
        return;
    }
    try {
        const desafio = await pool.query(
            "SELECT id, data_inicio::text AS data_inicio, data_fim::text AS data_fim, " +
            "emblema_raro, CURRENT_DATE::text AS hoje FROM desafios WHERE id = $1",
            [Number(req.params.id)]
        );
        if (desafio.rows.length === 0) {
            res.status(404).json({ mensagem: "Desafio não encontrado" });
            return;
        }
        const dadosDesafio = desafio.rows[0];
        const participacaoExistente = await pool.query(
            "SELECT 1 FROM participacoes_desafios WHERE desafio_id = $1 AND usuario_id = $2",
            [Number(req.params.id), req.usuario.id]
        );
        if (participacaoExistente.rows.length > 0) {
            res.json({ mensagem: "Já estás a participar neste desafio" });
            return;
        }
        if (dadosDesafio.emblema_raro && dadosDesafio.hoje > dadosDesafio.data_inicio) {
            res.status(409).json({ mensagem: "As inscrições para este desafio já terminaram" });
            return;
        }

        const resultado = await pool.query(
            `WITH inscricao AS (
                INSERT INTO participacoes_desafios (desafio_id, usuario_id, meta_diaria_alvo)
                SELECT d.id, u.id, u.meta_diaria
                FROM desafios AS d
                JOIN usuarios AS u ON u.id = $2
                WHERE d.id = $1
                ON CONFLICT (desafio_id, usuario_id) DO NOTHING
                RETURNING desafio_id, usuario_id
            ), emblema AS (
                INSERT INTO emblemas_desafios_utilizadores (desafio_id, usuario_id, tipo)
                SELECT desafio_id, usuario_id, 'participacao'
                FROM inscricao
                ON CONFLICT (desafio_id, usuario_id, tipo) DO NOTHING
                RETURNING desafio_id
            )
            SELECT EXISTS (SELECT 1 FROM inscricao) AS inscricao_criada`,
            [Number(req.params.id), req.usuario.id]
        );
        if (!resultado.rows[0]?.inscricao_criada) {
            res.status(409).json({ mensagem: "Não foi possível registar a participação" });
            return;
        }
        res.status(201).json({ mensagem: "Participação registada e plaqueta atribuída" });
    } catch (erro) {
        console.error("Erro ao aderir ao desafio:", erro);
        res.status(500).json({ mensagem: "Erro ao registar participação" });
    }
});

app.delete("/api/desafios/:id/participacao", verificarToken, exigirUtilizador, async function (req, res) {
    if (!idDesafioValido(req.params.id)) {
        res.status(400).json({ mensagem: "Identificador de desafio inválido" });
        return;
    }
    try {
        const resultado = await pool.query(
            "DELETE FROM participacoes_desafios WHERE desafio_id = $1 AND usuario_id = $2 RETURNING desafio_id",
            [Number(req.params.id), req.usuario.id]
        );
        if (resultado.rows.length === 0) {
            const existente = await pool.query(
                "SELECT 1 FROM desafios WHERE id = $1",
                [Number(req.params.id)]
            );
            if (existente.rows.length === 0) {
                res.status(404).json({ mensagem: "Desafio não encontrado" });
                return;
            }
        }
        res.json({ mensagem: resultado.rows.length ? "Participação cancelada" : "Não estavas inscrito neste desafio" });
    } catch (erro) {
        console.error("Erro ao cancelar participação no desafio:", erro);
        res.status(500).json({ mensagem: "Erro ao cancelar participação" });
    }
});

// Os emblemas e o progresso só são devolvidos a quem já se inscreveu.
app.get("/api/desafios/:id/emblemas", verificarToken, exigirUtilizador, async function (req, res) {
    if (!idDesafioValido(req.params.id)) {
        res.status(400).json({ mensagem: "Identificador de desafio inválido" });
        return;
    }
    try {
        const resultado = await pool.query(
            `SELECT d.id, d.emblema_raro, p.meta_diaria_alvo, p.emblema_raro_estado,
                (p.usuario_id IS NOT NULL) AS participa,
                EXISTS (
                    SELECT 1 FROM emblemas_desafios_utilizadores AS e
                    WHERE e.desafio_id = d.id AND e.usuario_id = $2 AND e.tipo = 'participacao'
                ) AS tem_plaqueta,
                EXISTS (
                    SELECT 1 FROM emblemas_desafios_utilizadores AS e
                    WHERE e.desafio_id = d.id AND e.usuario_id = $2 AND e.tipo = 'semana-resistencia'
                ) AS medalha_rara_conquistada
             FROM desafios AS d
             LEFT JOIN participacoes_desafios AS p
                ON p.desafio_id = d.id AND p.usuario_id = $2
             WHERE d.id = $1
               AND (p.usuario_id IS NOT NULL OR EXISTS (
                    SELECT 1 FROM emblemas_desafios_utilizadores AS e
                    WHERE e.desafio_id = d.id AND e.usuario_id = $2 AND e.tipo = 'participacao'
               ))`,
            [Number(req.params.id), req.usuario.id]
        );
        if (resultado.rows.length === 0) {
            res.status(403).json({ mensagem: "Inscreve-te no desafio para veres os emblemas" });
            return;
        }
        const dados = resultado.rows[0];
        let progresso = { dias: [], dias_meta_cumprida: 0, dias_no_desafio: 0 };
        if (dados.participa && dados.emblema_raro === "semana-resistencia") {
            progresso = await consultarDiasMetaDesafio(
                Number(req.params.id),
                req.usuario.id,
                Number(dados.meta_diaria_alvo)
            );
        }
        res.json({
            participa: dados.participa,
            emblema_raro: dados.emblema_raro,
            tem_plaqueta: dados.tem_plaqueta,
            medalha_rara_conquistada: dados.medalha_rara_conquistada,
            estado_emblema_raro: dados.emblema_raro_estado || null,
            ...progresso
        });
    } catch (erro) {
        console.error("Erro ao consultar emblemas do desafio:", erro);
        res.status(500).json({ mensagem: "Erro ao consultar emblemas do desafio" });
    }
});

// Só o gestor que criou o desafio pode rever o progresso dos participantes.
app.get("/api/desafios/:id/participantes", verificarToken, exigirGestorDesafios, async function (req, res) {
    if (!idDesafioValido(req.params.id)) {
        res.status(400).json({ mensagem: "Identificador de desafio inválido" });
        return;
    }
    try {
        const desafio = await pool.query(
            "SELECT id, emblema_raro FROM desafios WHERE id = $1 AND gestor_id = $2",
            [Number(req.params.id), req.usuario.id]
        );
        if (desafio.rows.length === 0) {
            res.status(404).json({ mensagem: "Desafio não encontrado ou não gerido por este utilizador" });
            return;
        }
        if (desafio.rows[0].emblema_raro !== "semana-resistencia") {
            res.status(400).json({ mensagem: "Este desafio não tem uma medalha rara para avaliar" });
            return;
        }
        const participantes = await pool.query(
            `SELECT p.usuario_id, u.nome, p.meta_diaria_alvo,
                p.emblema_raro_estado, p.emblema_raro_avaliado_em
             FROM participacoes_desafios AS p
             JOIN usuarios AS u ON u.id = p.usuario_id
             WHERE p.desafio_id = $1
             ORDER BY u.nome, p.usuario_id`,
            [Number(req.params.id)]
        );
        const comProgresso = await Promise.all(participantes.rows.map(async (participante) => ({
            ...participante,
            meta_diaria_alvo: Number(participante.meta_diaria_alvo),
            ...await consultarDiasMetaDesafio(
                Number(req.params.id),
                participante.usuario_id,
                Number(participante.meta_diaria_alvo)
            )
        })));
        res.json({ participantes: comProgresso });
    } catch (erro) {
        console.error("Erro ao consultar participantes do desafio:", erro);
        res.status(500).json({ mensagem: "Erro ao consultar participantes do desafio" });
    }
});

app.put("/api/desafios/:id/participantes/:usuarioId/emblema", verificarToken, exigirGestorDesafios, async function (req, res) {
    if (!idDesafioValido(req.params.id) || !idDesafioValido(req.params.usuarioId)) {
        res.status(400).json({ mensagem: "Identificador inválido" });
        return;
    }
    const estado = req.body?.estado;
    if (!["conquistado", "nao_conquistado"].includes(estado)) {
        res.status(400).json({ mensagem: "Indica se o emblema foi conquistado ou não conquistado" });
        return;
    }
    try {
        const desafio = await pool.query(
            "SELECT id, emblema_raro, data_fim::text AS data_fim, CURRENT_DATE::text AS hoje " +
            "FROM desafios WHERE id = $1 AND gestor_id = $2",
            [Number(req.params.id), req.usuario.id]
        );
        if (desafio.rows.length === 0) {
            res.status(404).json({ mensagem: "Desafio não encontrado ou não gerido por este utilizador" });
            return;
        }
        if (desafio.rows[0].emblema_raro !== "semana-resistencia") {
            res.status(400).json({ mensagem: "Este desafio não tem uma medalha rara para avaliar" });
            return;
        }
        if (desafio.rows[0].hoje <= desafio.rows[0].data_fim) {
            res.status(409).json({ mensagem: "A avaliação só fica disponível depois dos sete dias do desafio" });
            return;
        }
        const participacao = await pool.query(
            "SELECT meta_diaria_alvo FROM participacoes_desafios WHERE desafio_id = $1 AND usuario_id = $2",
            [Number(req.params.id), Number(req.params.usuarioId)]
        );
        if (participacao.rows.length === 0) {
            res.status(404).json({ mensagem: "Participação não encontrada" });
            return;
        }
        if (estado === "conquistado") {
            const progresso = await consultarDiasMetaDesafio(
                Number(req.params.id),
                Number(req.params.usuarioId),
                Number(participacao.rows[0].meta_diaria_alvo)
            );
            if (progresso.dias_no_desafio !== 7 || progresso.dias_meta_cumprida !== 7) {
                res.status(409).json({ mensagem: "A medalha só pode ser concedida com a meta atingida nos sete dias" });
                return;
            }
        }
        await pool.query(
            "UPDATE participacoes_desafios SET emblema_raro_estado = $1, " +
            "emblema_raro_avaliado_por = $2, emblema_raro_avaliado_em = CURRENT_TIMESTAMP " +
            "WHERE desafio_id = $3 AND usuario_id = $4",
            [estado, req.usuario.id, Number(req.params.id), Number(req.params.usuarioId)]
        );
        if (estado === "conquistado") {
            await pool.query(
                "INSERT INTO emblemas_desafios_utilizadores (desafio_id, usuario_id, tipo, concedido_por) " +
                "VALUES ($1, $2, 'semana-resistencia', $3) " +
                "ON CONFLICT (desafio_id, usuario_id, tipo) DO UPDATE SET concedido_por = EXCLUDED.concedido_por",
                [Number(req.params.id), Number(req.params.usuarioId), req.usuario.id]
            );
        } else {
            await pool.query(
                "DELETE FROM emblemas_desafios_utilizadores " +
                "WHERE desafio_id = $1 AND usuario_id = $2 AND tipo = 'semana-resistencia'",
                [Number(req.params.id), Number(req.params.usuarioId)]
            );
        }
        res.json({ mensagem: "Resultado do emblema atualizado", estado });
    } catch (erro) {
        console.error("Erro ao avaliar emblema do desafio:", erro);
        res.status(500).json({ mensagem: "Erro ao avaliar emblema do desafio" });
    }
});

app.post("/api/desafios", verificarToken, exigirGestorDesafios, async function (req, res) {
    const erroValidacao = validarDadosDesafio(req.body);
    if (erroValidacao) {
        res.status(400).json({ mensagem: erroValidacao });
        return;
    }
    try {
        const resultado = await pool.query(
            "INSERT INTO desafios (titulo, descricao, data_inicio, data_fim, gestor_id, emblema_raro) " +
            "VALUES ($1, $2, $3, $4, $5, $6) " +
            "RETURNING id, titulo, descricao, data_inicio, data_fim, gestor_id, emblema_raro, criado_em",
            [
                req.body.titulo.trim(),
                req.body.descricao.trim(),
                req.body.data_inicio,
                req.body.data_fim,
                req.usuario.id,
                req.body.emblema_raro || null
            ]
        );
        res.status(201).json(resultado.rows[0]);
    } catch (erro) {
        console.error("Erro ao criar desafio:", erro);
        res.status(500).json({ mensagem: "Erro ao criar desafio" });
    }
});

app.put("/api/desafios/:id", verificarToken, exigirGestorDesafios, async function (req, res) {
    if (!idDesafioValido(req.params.id)) {
        res.status(400).json({ mensagem: "Identificador de desafio inválido" });
        return;
    }
    const erroValidacao = validarDadosDesafio(req.body);
    if (erroValidacao) {
        res.status(400).json({ mensagem: erroValidacao });
        return;
    }
    try {
        const atual = await pool.query(
            `SELECT d.data_inicio::text AS data_inicio, d.data_fim::text AS data_fim,
                d.emblema_raro,
                EXISTS (
                    SELECT 1 FROM participacoes_desafios AS p
                    WHERE p.desafio_id = d.id
                ) AS tem_participantes
             FROM desafios AS d
             WHERE d.id = $1 AND d.gestor_id = $2`,
            [Number(req.params.id), req.usuario.id]
        );
        if (atual.rows.length === 0) {
            res.status(404).json({ mensagem: "Desafio não encontrado ou não gerido por este utilizador" });
            return;
        }
        const desafioAtual = atual.rows[0];
        const emblemaNovo = req.body.emblema_raro || null;
        if (desafioAtual.tem_participantes &&
            (String(desafioAtual.data_inicio).slice(0, 10) !== req.body.data_inicio ||
             String(desafioAtual.data_fim).slice(0, 10) !== req.body.data_fim ||
             desafioAtual.emblema_raro !== emblemaNovo)) {
            res.status(409).json({ mensagem: "Não podes alterar as datas ou o emblema depois de haver inscrições" });
            return;
        }
        const resultado = await pool.query(
            "UPDATE desafios SET titulo = $1, descricao = $2, data_inicio = $3, data_fim = $4, emblema_raro = $5 " +
            "WHERE id = $6 AND gestor_id = $7 " +
            "RETURNING id, titulo, descricao, data_inicio, data_fim, gestor_id, emblema_raro, criado_em",
            [
                req.body.titulo.trim(),
                req.body.descricao.trim(),
                req.body.data_inicio,
                req.body.data_fim,
                emblemaNovo,
                Number(req.params.id),
                req.usuario.id
            ]
        );
        if (resultado.rows.length === 0) {
            res.status(404).json({ mensagem: "Desafio não encontrado ou não gerido por este utilizador" });
            return;
        }
        res.json(resultado.rows[0]);
    } catch (erro) {
        console.error("Erro ao atualizar desafio:", erro);
        res.status(500).json({ mensagem: "Erro ao atualizar desafio" });
    }
});

app.delete("/api/desafios/:id", verificarToken, exigirGestorDesafios, async function (req, res) {
    if (!idDesafioValido(req.params.id)) {
        res.status(400).json({ mensagem: "Identificador de desafio inválido" });
        return;
    }
    try {
        const resultado = await pool.query(
            "DELETE FROM desafios WHERE id = $1 AND gestor_id = $2 RETURNING id",
            [Number(req.params.id), req.usuario.id]
        );
        if (resultado.rows.length === 0) {
            res.status(404).json({ mensagem: "Desafio não encontrado ou não gerido por este utilizador" });
            return;
        }
        res.json({ mensagem: "Desafio eliminado com sucesso" });
    } catch (erro) {
        console.error("Erro ao eliminar desafio:", erro);
        res.status(500).json({ mensagem: "Erro ao eliminar desafio" });
    }
});


// GET - perfil, total de dias hidratados e sequência atual de metas atingidas
app.get("/api/perfil", verificarToken, function (req, res) {
    pool.query(
        `WITH RECURSIVE meta_utilizador AS (
            SELECT id, meta_diaria
            FROM usuarios
            WHERE id = $1
        ), consumo_diario AS (
            SELECT r.horario::date AS data, SUM(r.quantidade) AS total_litros
            FROM registro_agua AS r
            WHERE r.usuario_id = $1
            GROUP BY r.horario::date
        ), dias_por_grupo AS (
            SELECT d.data,
                d.data - ROW_NUMBER() OVER (ORDER BY d.data)::integer AS grupo
            FROM consumo_diario AS d
            CROSS JOIN meta_utilizador AS m
            WHERE d.total_litros >= m.meta_diaria
        ), sequencias_historicas AS (
            SELECT COUNT(*) AS dias
            FROM dias_por_grupo
            GROUP BY grupo
        ), inicio_sequencia AS (
            SELECT CASE
                WHEN COALESCE((SELECT total_litros FROM consumo_diario WHERE data = CURRENT_DATE), 0) >= m.meta_diaria
                    THEN CURRENT_DATE
                WHEN COALESCE((SELECT total_litros FROM consumo_diario WHERE data = CURRENT_DATE - 1), 0) >= m.meta_diaria
                    THEN CURRENT_DATE - 1
                ELSE NULL
            END AS data
            FROM meta_utilizador AS m
        ), sequencia AS (
            SELECT data FROM inicio_sequencia WHERE data IS NOT NULL
            UNION ALL
            SELECT s.data - 1
            FROM sequencia AS s
            JOIN consumo_diario AS d ON d.data = s.data - 1
            CROSS JOIN meta_utilizador AS m
            WHERE d.total_litros >= m.meta_diaria
        )
        SELECT u.nome, u.meta_diaria,
            (SELECT COUNT(*) FROM (
                SELECT r.horario::date
                FROM registro_agua AS r
                WHERE r.usuario_id = u.id
                GROUP BY r.horario::date
                HAVING SUM(r.quantidade) >= u.meta_diaria
            ) AS dias) AS dias_hidratado,
            (SELECT COUNT(*) FROM sequencia) AS sequencia_atual,
            COALESCE((SELECT MAX(dias) FROM sequencias_historicas), 0) AS maior_sequencia
        FROM usuarios AS u
        WHERE u.id = $1`,
        [req.usuario.id],
        function (erro, resultado) {
            if (erro) {
                console.error("Erro ao buscar perfil:", erro);
                res.status(500).json({ mensagem: "Erro ao buscar perfil" });
                return;
            }
            if (resultado.rows.length === 0) {
                res.status(404).json({ mensagem: "Utilizador não encontrado" });
                return;
            }
            const linha = resultado.rows[0];
            res.json({
                nome: linha.nome,
                dias_hidratado: Number(linha.dias_hidratado),
                sequencia_atual: Number(linha.sequencia_atual),
                maior_sequencia: Number(linha.maior_sequencia)
            });
        }
    );
});


// Rota de teste da API
app.get("/api", function (req, res) {
    res.json({
        mensagem: "WaterKraft API está funcionando!"
    });
});


if (require.main === module) {
    agendarLimpezaDiariaLogin(pool);
    app.listen(PORT, "0.0.0.0", function () {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

module.exports = app;
module.exports.app = app;
module.exports.pool = pool;
