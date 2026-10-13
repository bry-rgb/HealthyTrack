
const request = require("supertest");
const app = require("./server");

test("GET /api devolve uma mensagem de sucesso", async function () {
    const resposta = await request(app).get("/api");

    expect(resposta.status).toBe(200);
    expect(resposta.body.mensagem).toBe("HealthyTrack API está funcionando!");
});

//teste se o login sem email e senha é rejeitado
test("POST /api/login rejeita campos vazios", async function () {
    const resposta = await request(app)
        .post("/api/login")
        .send({
            email: "",
            senha: ""
        });

    expect(resposta.status).toBe(400);
});

// testa se o email invalido é rejeitado
test("POST /api/login rejeita email inválido", async function () {
    const resposta = await request(app)
        .post("/api/login")
        .send({
            email: "emailinvalido",
            senha: "Aventura123"
        });

    expect(resposta.status).toBe(400);
});

