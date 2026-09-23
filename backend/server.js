const express = require("express");
const app = express();
const PORT = 3000;

app.get("/api", function (req, res){
    res.send("HealthyTrack API está funcionando!");
})

app.listen(PORT, function() {
    console.log(`Servidor rodando na porta ${PORT}`);
})