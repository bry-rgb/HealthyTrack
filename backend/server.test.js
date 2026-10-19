const request = require("supertest");
const { app, pool } = require("./server");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const tokenTeste = jwt.sign(
    { id: 1, email: "teste@example.com" },
    process.env.JWT_SECRET
);

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


test("POST /api/login rejeita um email válido que não existe", async function () {
    const resposta = await request(app)
        .post("/api/login")
        .send({
            email: "utilizador.inexistente@example.com",
            senha: "Aventura123"
        });

    expect(resposta.status).toBe(401);
});


test("POST /api/registros-agua rejeita quantidade superior a 0.5 litros", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({
            quantidade: 1,
            horario: new Date().toISOString()
        });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe("Dados inválidos");
});


test("POST /api/registros-agua rejeita quantidade igual a zero", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({
            quantidade: 0,
            horario: new Date().toISOString()
        });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe("Dados inválidos");
});


test("POST /api/registros-agua rejeita pedido sem token", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .send({
            quantidade: 0.5,
            horario: new Date().toISOString()
        });

    expect(resposta.status).toBe(401);
});


test("POST /api/registros-agua rejeita token JWT inválido", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .set("Authorization", "Bearer tokenfalso")
        .send({
            quantidade: 0.5,
            horario: new Date().toISOString()
        });

    expect(resposta.status).toBe(401);
});


test("POST /api/registros-agua rejeita data inválida", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({
            quantidade: 0.5,
            horario: "data-invalida"
        });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe("Dados inválidos");
});


test("POST /api/usuarios rejeita senha demasiado curta", async function () {
    const resposta = await request(app)
        .post("/api/usuarios")
        .send({
            nome: "Teste",
            email: "senha.curta@example.com",
            senha: "abc123"
        });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe(
        "A senha deve ter pelo menos 8 caracteres"
    );
});


test("POST /api/usuarios rejeita email inválido", async function () {
    const resposta = await request(app)
        .post("/api/usuarios")
        .send({
            nome: "Teste",
            email: "emailinvalido",
            senha: "Aventura123"
        });

    expect(resposta.body.mensagem).toBe("O formato do email é inválido");
});


test("POST /api/usuarios rejeita nome em falta", async function () {
    const resposta = await request(app)
        .post("/api/usuarios")
        .send({
            email: "nome.em.falta@example.com",
            senha: "Aventura123"
        });

    expect(resposta.status).toBe(400);
});


test("POST /api/usuarios rejeita senha em falta", async function () {
    const resposta = await request(app)
        .post("/api/usuarios")
        .send({
            nome: "Teste",
            email: "senha.em.falta@example.com"
        });

    expect(resposta.status).toBe(400);
});


test("POST /api/login rejeita senha em falta", async function () {
    const resposta = await request(app)
        .post("/api/login")
        .send({
            email: "teste@example.com"
        });

    expect(resposta.status).toBe(400);
});


afterAll(async function () {
    await pool.end();
});



