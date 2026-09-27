const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "healthytrack",
    password: "healthytrack111111",
    database: "healthytrack"
});

pool.query("SELECT NOW()", function (erro, resultado) {
    if (erro) {
        console.error( "Erro ao conectar ao banco de dados:", erro);
        return;
    }
    console.log("Connectado ao Postgres com sucesso! Hora atual:", resultado.rows[0].now);
});


const app = express();
app.use(express.json());
app.use(cors({
    origin: "http://localhost:5500"
}));
const PORT = 3000;


app.get("/api/registros-agua", function (req, res) {
    pool.query("SELECT * FROM registro_agua", function (erro, resultado) {
        if (erro) {
            console.error("Erro ao buscar registros de água:", erro);
            res.status(500).json({ mensagem: "Erro ao buscar registros de água" });
            return;
        }
        res.json(resultado.rows);
    });
});

app.post("/api/registros-agua", function (req, res) {
    pool.query("INSERT INTO registro_agua (quantidade, horario) VALUES ($1, $2)", [req.body.quantidade, req.body.horario], function (erro, resultado) {
        if (erro) {
            console.error("Erro ao inserir registro de água:", erro);
            res.status(500).json({ mensagem: "Erro ao inserir registro de água" });
            return;
        }
        res.json({
            mensagem: "Registro de água recebido com sucesso!"
        });
    });
});

app.get("/api", function (req, res){
    res.json({
        mensagem: "HealthyTrack API está funcionando!"
    });
})

app.listen(PORT, function() {
    console.log(`Servidor rodando na porta ${PORT}`);
})