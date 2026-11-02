const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { senhaValida } = require("./validacoes");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("Erro: JWT_SECRET não está definido no ficheiro .env");
    process.exit(1);
}

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: 5432,
    user: "healthytrack",
    password: process.env.DB_PASSWORD,
    database: "healthytrack"
});


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

app.use(cors({
    origin: "http://localhost:8080"
}));

const PORT = 3000;

// Função para verificar o token JWT
function verificarToken(req, res, next) {
const authHeader = req.headers.authorization;

if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
        mensagem: "Token não fornecido ou formato inválido"
    });
    return;
}

const token = authHeader.split(" ")[1];

if (!token) {
    res.status(401).json({
        mensagem: "Token não fornecido ou formato inválido"
    });
    return;
}

    try {
    const usuario = jwt.verify(token, JWT_SECRET);
    
    req.usuario = usuario;
    
    next();

} catch {
    res.status(401).json({
    mensagem: "Token inválido ou expirado"
});
return;

}
}


// GET - buscar registros de água
app.get("/api/registros-agua", verificarToken, function (req, res) {
   pool.query(
    "SELECT * FROM registro_agua WHERE usuario_id = $1",
    [req.usuario.id],
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
            dias.data::date AS data,
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
        "SELECT limite_liquidos FROM avaliacao_inicial WHERE usuario_id = $1",
        [req.usuario.id],
        function (erro, resultado) {
            if (erro) {
                console.error("Erro ao consultar avaliação inicial:", erro);
                res.status(500).json({
                    mensagem: "Erro ao consultar avaliação inicial"
                });
                return;
            }

            if (resultado.rows.length === 0) {
                res.status(404).json({
                    mensagem: "Avaliação inicial não encontrada"
                });
                return;
            }

            res.json({
                limite_liquidos: resultado.rows[0].limite_liquidos
            });
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
    app.post("/api/login", async function (req, res) { 

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

    const token = jwt.sign(
    {
        id: usuario.id,
        email: usuario.email
    },
    JWT_SECRET,
    {
        expiresIn: "1h"
    }
);
    res.json({
    mensagem: "Login realizado com sucesso!",
    token: token,
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


// Rota de teste da API
app.get("/api", function (req, res) {
    res.json({
        mensagem: "HealthyTrack API está funcionando!"
    });
});


if (require.main === module) {
    app.listen(PORT, function () {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

module.exports = { app, pool };