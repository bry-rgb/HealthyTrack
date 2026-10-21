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
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    try {
        const resposta = await request(app)
            .post("/api/login")
            .send({
                email: "utilizador.inexistente@example.com",
                senha: "Aventura123"
            });

        expect(resposta.status).toBe(401);
    } finally {
        pool.query = consultaOriginal;
    }
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



test("POST /api/usuarios rejeita email duplicado", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockRejectedValue({
        code: "23505"
    });

    try {
        const resposta = await request(app)
            .post("/api/usuarios")
            .send({
                nome: "Teste",
                email: "duplicado@example.com",
                senha: "Aventura123"
            });

        expect(resposta.status).toBe(409);
        expect(resposta.body.mensagem).toBe(
            "Este email já está cadastrado"
        );
    } finally {
        pool.query = consultaOriginal;
    }
});


test("GET /api/meta-diaria devolve a meta do utilizador autenticado", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(null, {
            rows: [{ meta_diaria: "2.5" }]
        });
    });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.meta_diaria).toBe(2.5);
        expect(pool.query).toHaveBeenCalledWith(
            "SELECT meta_diaria FROM usuarios WHERE id = $1",
            [1],
            expect.any(Function)
        );
    } finally {
        pool.query = consultaOriginal;
    }
});


test("PUT /api/meta-diaria atualiza a meta do utilizador autenticado", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(null, {
            rows: [{ meta_diaria: parametros[0] }]
        });
    });

    try {
        const resposta = await request(app)
            .put("/api/meta-diaria")
            .set("Authorization", `Bearer ${tokenTeste}`)
            .send({ meta_diaria: 3.5 });

        expect(resposta.status).toBe(200);
        expect(resposta.body.meta_diaria).toBe(3.5);
        expect(pool.query).toHaveBeenCalledWith(
            "UPDATE usuarios SET meta_diaria = $1 WHERE id = $2 RETURNING meta_diaria",
            [3.5, 1],
            expect.any(Function)
        );
    } finally {
        pool.query = consultaOriginal;
    }
});


test("PUT /api/meta-diaria rejeita uma meta superior a 10 litros", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({ meta_diaria: 11 });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe(
        "A meta diária deve estar entre 0,5 e 10 litros"
    );
});


test("PUT /api/meta-diaria rejeita uma meta inferior a 0.5 litros", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({ meta_diaria: 0.4 });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe(
        "A meta diária deve estar entre 0,5 e 10 litros"
    );
});


test("PUT /api/meta-diaria rejeita uma meta enviada como texto", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({ meta_diaria: "3.5" });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe(
        "A meta diária deve estar entre 0,5 e 10 litros"
    );
});


test("PUT /api/meta-diaria rejeita pedidos sem token", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .send({ meta_diaria: 3.5 });

    expect(resposta.status).toBe(401);
});


afterAll(async function () {
    await pool.end();
});



