require("dotenv").config();

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
    host: "localhost",
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
    origin: "http://localhost:5500"
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

} catch (erro) {
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
        function (erro, resultado) {

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

        const resultado = await pool.query(
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
        email: usuario.email
    }
});

});


// DELETE - apagar registros de água
app.delete("/api/registros-agua", verificarToken, function (req, res) {

   pool.query(
    "DELETE FROM registro_agua WHERE usuario_id = $1",
    [req.usuario.id],
    function (erro, resultado) {

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