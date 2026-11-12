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

// Limita tentativas de login com armazenamento partilhado no PostgreSQL.
// O IP é transformado num HMAC; o endereço original nunca é guardado na tabela.
const JANELA_LOGIN_MS = 15 * 60 * 1000;
const MAX_TENTATIVAS_LOGIN = 5;

async function limitarTentativasLogin(req, res, next) {
    // Mantém os erros de validação fora do contador.
    if (
        typeof req.body.email !== "string" ||
        !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(req.body.email) ||
        typeof req.body.senha !== "string" ||
        !req.body.senha
    ) {
        next();
        return;
    }

    const ip = req.ip || req.socket.remoteAddress || "desconhecido";
    const hashIp = crypto.createHmac("sha256", JWT_SECRET)
        .update(ip)
        .digest("hex");

    try {
        const resultado = await pool.query(
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
            [hashIp, JANELA_LOGIN_MS, MAX_TENTATIVAS_LOGIN]
        );

        req.loginRateLimitHash = hashIp;

        if (resultado.rows[0].attempts > MAX_TENTATIVAS_LOGIN) {
            res.set("Retry-After", String(resultado.rows[0].segundos_restantes));
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

// Cookie-auth exige Origin permitido nos métodos que alteram estado.
// Bearer mantém compatibilidade transitória com clientes e testes antigos.
async function verificarToken(req, res, next) {
    const tokenCookie = obterCookie(req, NOME_COOKIE_SESSAO);
    const authHeader = req.headers.authorization;
    const tokenBearer = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
    const usaCookie = Boolean(tokenCookie);
    const token = tokenCookie || tokenBearer;

    if (!token) {
        res.status(401).json({ mensagem: "Token não fornecido ou formato inválido" });
        return;
    }

    if (usaCookie && !["GET", "HEAD", "OPTIONS"].includes(req.method) && !origemPermitida(req)) {
        res.status(403).json({ mensagem: "Origem não autorizada" });
        return;
    }

    try {
        const usuario = jwt.verify(token, JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        });

        if (usaCookie) {
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
        }

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
    const {
        faixa_etaria,
        peso,
        atividade,
        exercicio_calor,
        limite_liquidos,
        unidade
    } = req.body;

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
            peso,
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

        const { email, senha } = req.body;

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

// POST - terminar sessão e invalidá-la na base de dados
app.post("/api/logout", verificarToken, async function (req, res) {
    try {
        if (req.sessaoJti) {
            await pool.query(
                "UPDATE sessoes_utilizador SET revoked_at = NOW() WHERE jti = $1 AND revoked_at IS NULL",
                [req.sessaoJti]
            );
        }
        limparCookieSessao(res);
        res.json({ mensagem: "Sessão terminada com sucesso" });
    } catch (erro) {
        console.error("Erro ao terminar sessão:", erro);
        res.status(500).json({ mensagem: "Não foi possível terminar a sessão" });
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
    app.listen(PORT, "0.0.0.0", function () {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

module.exports = app;
module.exports.app = app;
module.exports.pool = pool;
