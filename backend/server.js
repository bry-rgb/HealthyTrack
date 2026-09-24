const express = require("express");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors({
    origin: "http://localhost:5500"
}));
const PORT = 3000;
const registroAgua = [
    {
        quantidade: 0.5,
        horario: "9:30"
    },
    {
        quantidade: 0.5,
        horario: "11:00"
    }
];

app.get("/api/registros-agua", function (req, res) {
    res.json(registroAgua)
});

app.post("/api/registros-agua", function (req, res) {console.log(req.body);

    res.json({
        mensagem: "Registro de água recebido com sucesso!"
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