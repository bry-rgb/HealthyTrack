const request = require("supertest");
const { app, pool } = require("./server");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const tokenTeste = jwt.sign(
    { id: 1, email: "teste@example.com" },
    process.env.JWT_SECRET,
    {
        algorithm: "HS256",
        issuer: "healthytrack",
        audience: "healthytrack-api"
    }
);

test("GET /api devolve uma mensagem de sucesso", async function () {
    const resposta = await request(app).get("/api");

    expect(resposta.status).toBe(200);
    expect(resposta.body.mensagem).toBe("WaterKraft API está funcionando!");
});

test("GET /api inclui cabeçalhos HTTP de segurança", async function () {
    const resposta = await request(app).get("/api");

    expect(resposta.status).toBe(200);
    expect(resposta.headers["x-content-type-options"]).toBe("nosniff");
    expect(resposta.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(resposta.headers["referrer-policy"]).toBeDefined();
    expect(resposta.headers["x-powered-by"]).toBeUndefined();
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

test("POST /api/login trata erros na consulta à base de dados", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockRejectedValue(
        new Error("Erro de ligação à base de dados")
    );

    try {
        const resposta = await request(app)
            .post("/api/login")
            .send({
                email: "teste@example.com",
                senha: "Aventura123"
            });

        // O limitador falha em modo fechado quando o PostgreSQL está indisponível.
        expect(resposta.status).toBe(503);
        expect(resposta.body.mensagem).toBe(
            "Não foi possível validar o limite de tentativas. Tenta novamente."
        );
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


test("GET /api/estatisticas-diarias rejeita pedidos sem token", async function () {
    const resposta = await request(app)
        .get("/api/estatisticas-diarias");

    expect(resposta.status).toBe(401);
});


test("GET /api/estatisticas-diarias devolve sete dias para o utilizador autenticado", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(null, {
            rows: [
                { data: "2026-10-16", total_litros: "0" },
                { data: "2026-10-17", total_litros: "0.5" },
                { data: "2026-10-18", total_litros: "0" },
                { data: "2026-10-19", total_litros: "1" },
                { data: "2026-10-20", total_litros: "1.5" },
                { data: "2026-10-21", total_litros: "2" },
                { data: "2026-10-22", total_litros: "0.5" }
            ]
        });
    });

    try {
        const resposta = await request(app)
            .get("/api/estatisticas-diarias")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body).toHaveLength(7);
        expect(resposta.body[4].total_litros).toBe("1.5");
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("generate_series"),
            [1],
            expect.any(Function)
        );
    } finally {
        pool.query = consultaOriginal;
    }
});

test("GET /api/meta-diaria rejeita pedidos sem token", async function () {
    const resposta = await request(app)
        .get("/api/meta-diaria");

    expect(resposta.status).toBe(401);
});

test("GET /api/meta-diaria devolve 404 se o utilizador não existir", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(null, { rows: [] });
    });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(404);
        expect(resposta.body.mensagem).toBe("Utilizador não encontrado");
    } finally {
        pool.query = consultaOriginal;
    }
});


test("GET /api/estatisticas-diarias trata erros na consulta à base de dados", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(new Error("Erro de ligação à base de dados"));
    });

    try {
        const resposta = await request(app)
            .get("/api/estatisticas-diarias")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(500);
        expect(resposta.body.mensagem).toBe(
            "Erro ao buscar estatísticas diárias"
        );
    } finally {
        pool.query = consultaOriginal;
    }
});

test("PUT /api/meta-diaria devolve 404 se o utilizador não existir", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(null, { rows: [] });
    });

    try {
        const resposta = await request(app)
            .put("/api/meta-diaria")
            .set("Authorization", `Bearer ${tokenTeste}`)
            .send({ meta_diaria: 3.5 });

        expect(resposta.status).toBe(404);
        expect(resposta.body.mensagem).toBe("Utilizador não encontrado");
    } finally {
        pool.query = consultaOriginal;
    }
});


test("PUT /api/meta-diaria trata erros na consulta à base de dados", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(new Error("Erro de ligação à base de dados"));
    });

    try {
        const resposta = await request(app)
            .put("/api/meta-diaria")
            .set("Authorization", `Bearer ${tokenTeste}`)
            .send({ meta_diaria: 3.5 });

        expect(resposta.status).toBe(500);
        expect(resposta.body.mensagem).toBe("Erro ao atualizar meta diária");
    } finally {
        pool.query = consultaOriginal;
    }
});


test("DELETE /api/registros-agua rejeita pedidos sem token", async function () {
    const resposta = await request(app)
        .delete("/api/registros-agua");

    expect(resposta.status).toBe(401);
});


test("DELETE /api/registros-agua trata erros na consulta à base de dados", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(new Error("Erro de ligação à base de dados"));
    });

    try {
        const resposta = await request(app)
            .delete("/api/registros-agua")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(500);
        expect(resposta.body.mensagem).toBe(
            "Erro ao apagar registros de água"
        );
    } finally {
        pool.query = consultaOriginal;
    }
});


test("DELETE /api/registros-agua rejeita token JWT inválido", async function () {
    const resposta = await request(app)
        .delete("/api/registros-agua")
        .set("Authorization", "Bearer tokenfalso");

    expect(resposta.status).toBe(401);
});


test("GET /api/registros-agua rejeita pedidos sem token", async function () {
    const resposta = await request(app)
        .get("/api/registros-agua");

    expect(resposta.status).toBe(401);
});


test("GET /api/registros-agua rejeita token inválido", async function () {
    const resposta = await request(app)
        .get("/api/registros-agua")
        .set("Authorization", "Bearer token-invalido");

    expect(resposta.status).toBe(401);
});


test("GET /api/registros-agua devolve 500 quando ocorre um erro na base de dados", async function () {
    const queryOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(new Error("Erro de teste"), null);
    });

    try {
        const resposta = await request(app)
            .get("/api/registros-agua")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(500);
    } finally {
        pool.query = queryOriginal;
    }
});


test("GET /api/meta-diaria rejeita token inválido", async function () {
    const resposta = await request(app)
        .get("/api/meta-diaria")
        .set("Authorization", "Bearer token-invalido");

    expect(resposta.status).toBe(401);
});


test("GET /api/estatisticas-diarias rejeita token inválido", async function () {
    const resposta = await request(app)
        .get("/api/estatisticas-diarias")
        .set("Authorization", "Bearer token-invalido");

    expect(resposta.status).toBe(401);
});


test("PUT /api/meta-diaria rejeita token inválido", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Authorization", "Bearer token-invalido")
        .send({ meta_diaria: 2.5 });

    expect(resposta.status).toBe(401);
});


test("POST /api/registros-agua rejeita token inválido", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .set("Authorization", "Bearer token-invalido")
        .send({ quantidade: 0.5 });

    expect(resposta.status).toBe(401);
});


test("DELETE /api/registros-agua rejeita token inválido", async function () {
    const resposta = await request(app)
        .delete("/api/registros-agua")
        .set("Authorization", "Bearer token-invalido");

    expect(resposta.status).toBe(401);
});


test("POST /api/login rejeita uma palavra-passe incorreta", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockResolvedValue({
        rows: [{
            id: 1,
            email: "teste@example.com",
            senha: "$2b$10$hashfalso"
        }]
    });

    try {
        const resposta = await request(app)
            .post("/api/login")
            .send({
                email: "teste@example.com",
                senha: "PalavraPasseErrada123"
            });

        expect(resposta.status).toBe(401);
    } finally {
        pool.query = consultaOriginal;
    }
});



test("POST /api/usuarios cria um utilizador com sucesso", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    try {
        const resposta = await request(app)
            .post("/api/usuarios")
            .send({
                nome: "Teste",
                email: "novo@example.com",
                senha: "Aventura123"
            });

        expect(resposta.status).toBe(201);
        expect(resposta.body.mensagem).toBe("Usuário criado com sucesso!");
    } finally {
        pool.query = consultaOriginal;
    }
});


test("POST /api/usuarios devolve 500 quando ocorre um erro na base de dados", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockRejectedValue(
        new Error("Erro de teste")
    );

    try {
        const resposta = await request(app)
            .post("/api/usuarios")
            .send({
                nome: "Teste",
                email: "erro@example.com",
                senha: "Aventura123"
            });

        expect(resposta.status).toBe(500);
        expect(resposta.body.mensagem).toBe("Erro ao criar usuário");
    } finally {
        pool.query = consultaOriginal;
    }
});


test("POST /api/registros-agua rejeita quantidade negativa", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({
            quantidade: -0.5,
            horario: new Date().toISOString()
        });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe("Dados inválidos");
});


test("POST /api/registros-agua rejeita pedido sem quantidade", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({
            horario: new Date().toISOString()
        });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe("Dados inválidos");
});


test("POST /api/registros-agua regista água com sucesso", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(null, { rows: [] });
    });

    try {
        const resposta = await request(app)
            .post("/api/registros-agua")
            .set("Authorization", `Bearer ${tokenTeste}`)
            .send({
                quantidade: 0.5,
                horario: new Date().toISOString()
            });

        expect(resposta.status).toBe(200);
    } finally {
        pool.query = consultaOriginal;
    }
});


test("GET /api/registros-agua devolve os registos do utilizador autenticado", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(null, {
            rows: [
                { id: 1, quantidade: 0.5, horario: "2026-10-30T09:00:00.000Z" }
            ]
        });
    });

    try {
        const resposta = await request(app)
            .get("/api/registros-agua")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body).toHaveLength(1);
        expect(resposta.body[0].quantidade).toBe(0.5);
    } finally {
        pool.query = consultaOriginal;
    }
});


test("POST /api/registros-agua devolve 500 quando ocorre um erro na base de dados", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(new Error("Erro de teste"), null);
    });

    try {
        const resposta = await request(app)
            .post("/api/registros-agua")
            .set("Authorization", `Bearer ${tokenTeste}`)
            .send({
                quantidade: 0.5,
                horario: new Date().toISOString()
            });

        expect(resposta.status).toBe(500);
    } finally {
        pool.query = consultaOriginal;
    }
});


test("GET /api/meta-diaria devolve 500 quando ocorre um erro na base de dados", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(new Error("Erro de teste"), null);
    });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(500);
    } finally {
        pool.query = consultaOriginal;
    }
});



test("PUT /api/meta-diaria rejeita pedido sem meta diária", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({});

    expect(resposta.status).toBe(400);
});


test("PUT /api/meta-diaria rejeita uma meta negativa", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Authorization", `Bearer ${tokenTeste}`)
        .send({ meta_diaria: -1 });

    expect(resposta.status).toBe(400);
});


test("DELETE /api/registros-agua apaga os registos do utilizador autenticado", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        callback(null, { rows: [] });
    });

    try {
        const resposta = await request(app)
            .delete("/api/registros-agua")
            .set("Authorization", `Bearer ${tokenTeste}`);

        expect(resposta.status).toBe(200);
    } finally {
        pool.query = consultaOriginal;
    }
});


const bcrypt = require("bcrypt");

test("POST /api/login faz login com credenciais válidas", async function () {
    const consultaOriginal = pool.query;
    const senhaHash = await bcrypt.hash("Aventura123", 10);

    pool.query = jest.fn().mockResolvedValue({
        rows: [{
            id: 1,
            email: "teste@example.com",
            senha: senhaHash
        }]
    });

    try {
        const resposta = await request(app)
            .post("/api/login")
            .send({
                email: "teste@example.com",
                senha: "Aventura123"
            });

        expect(resposta.status).toBe(200);
        expect(resposta.body.token).toBeUndefined();
        expect(resposta.body.usuario.email).toBe("teste@example.com");
        const cookie = resposta.headers["set-cookie"].find(valor => valor.startsWith("waterkraft_session="));
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("Secure");
        expect(cookie).toContain("SameSite=Lax");
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO sessoes_utilizador"),
            expect.arrayContaining([expect.any(String), 1, expect.any(Date)])
        );
    } finally {
        pool.query = consultaOriginal;
    }
});


test("GET /api/registros-agua rejeita cabeçalho Bearer sem token", async function () {
    const resposta = await request(app)
        .get("/api/registros-agua")
        .set("Authorization", "Bearer ");

    expect(resposta.status).toBe(401);
    expect(resposta.body.mensagem).toBe(
        "Token não fornecido ou formato inválido"
    );
});

test("GET /api/registros-agua rejeita Bearer sem token", async function () {
    const resposta = await request(app)
        .get("/api/registros-agua")
        .set("Authorization", "Bearer  ");

    expect(resposta.status).toBe(401);
    expect(resposta.body.mensagem).toBe(
        "Token não fornecido ou formato inválido"
    );
});

test("GET /api/meta-diaria rejeita token com emissor incorreto", async function () {
    const token = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        { algorithm: "HS256", issuer: "outro-emissor", audience: "healthytrack-api" }
    );
    const resposta = await request(app)
        .get("/api/meta-diaria")
        .set("Authorization", `Bearer ${token}`);
    expect(resposta.status).toBe(401);
});

test("GET /api/meta-diaria rejeita token com destinatário incorreto", async function () {
    const token = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        { algorithm: "HS256", issuer: "healthytrack", audience: "outra-api" }
    );
    const resposta = await request(app)
        .get("/api/meta-diaria")
        .set("Authorization", `Bearer ${token}`);
    expect(resposta.status).toBe(401);
});

test("GET /api/meta-diaria rejeita token assinado com algoritmo diferente", async function () {
    const token = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        { algorithm: "HS384", issuer: "healthytrack", audience: "healthytrack-api" }
    );
    const resposta = await request(app)
        .get("/api/meta-diaria")
        .set("Authorization", `Bearer ${token}`);
    expect(resposta.status).toBe(401);
});

test("POST /api/login bloqueia a sexta tentativa falhada no mesmo IP", async function () {
    const consultaOriginal = pool.query;
    const ipTeste = "192.0.2.77";
    let tentativas = 0;
    pool.query = jest.fn().mockImplementation(async (sql) => {
        if (sql.includes("INSERT INTO login_rate_limits")) {
            tentativas += 1;
            return { rows: [{ attempts: tentativas, segundos_restantes: 900 }] };
        }
        return { rows: [] };
    });

    try {
        for (let tentativa = 0; tentativa < 5; tentativa++) {
            const resposta = await request(app)
                .post("/api/login")
                .set("X-Forwarded-For", ipTeste)
                .send({ email: "nao-existe@example.com", senha: "Aventura123" });
            expect(resposta.status).toBe(401);
        }

        const bloqueada = await request(app)
            .post("/api/login")
            .set("X-Forwarded-For", ipTeste)
            .send({ email: "nao-existe@example.com", senha: "Aventura123" });

        expect(bloqueada.status).toBe(429);
        expect(bloqueada.headers["retry-after"]).toBeDefined();
        expect(tentativas).toBe(6);
    } finally {
        pool.query = consultaOriginal;
    }
});

test("POST /api/login não conta erros de validação como tentativas falhadas", async function () {
    const consultaOriginal = pool.query;
    const ipTeste = "192.0.2.78";
    let tentativas = 0;
    pool.query = jest.fn().mockImplementation(async (sql) => {
        if (sql.includes("INSERT INTO login_rate_limits")) {
            tentativas += 1;
            return { rows: [{ attempts: tentativas, segundos_restantes: 900 }] };
        }
        return { rows: [] };
    });

    try {
        for (let tentativa = 0; tentativa < 6; tentativa++) {
            const resposta = await request(app)
                .post("/api/login")
                .set("X-Forwarded-For", ipTeste)
                .send({ email: "email-invalido", senha: "Aventura123" });
            expect(resposta.status).toBe(400);
        }

        const resposta = await request(app)
            .post("/api/login")
            .set("X-Forwarded-For", ipTeste)
            .send({ email: "nao-existe@example.com", senha: "Aventura123" });

        expect(resposta.status).toBe(401);
        expect(tentativas).toBe(1);
    } finally {
        pool.query = consultaOriginal;
    }
});

test("GET /api/meta-diaria aceita cookie de sessão ativa", async function () {
    const consultaOriginal = pool.query;
    const jti = "7d9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f10";
    const token = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            issuer: "healthytrack",
            audience: "healthytrack-api",
            expiresIn: "1h",
            jwtid: jti
        }
    );

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti }] });
        }
        callback(null, { rows: [{ meta_diaria: "2.5" }] });
    });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.meta_diaria).toBe(2.5);
    } finally {
        pool.query = consultaOriginal;
    }
});

test("POST /api/logout revoga a sessão e elimina o cookie", async function () {
    const consultaOriginal = pool.query;
    const jti = "8d9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f11";
    const token = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            issuer: "healthytrack",
            audience: "healthytrack-api",
            expiresIn: "1h",
            jwtid: jti
        }
    );

    pool.query = jest.fn().mockImplementation(function (sql) {
        if (sql.includes("SELECT jti FROM sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti }] });
        }
        if (sql.includes("UPDATE sessoes_utilizador")) {
            return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
    });

    try {
        const resposta = await request(app)
            .post("/api/logout")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        expect(resposta.status).toBe(200);
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE sessoes_utilizador"),
            [jti]
        );
        expect(resposta.headers["set-cookie"].join(";")).toContain("Max-Age=0");
    } finally {
        pool.query = consultaOriginal;
    }
});

test("GET /api/meta-diaria rejeita uma sessão revogada", async function () {
    const consultaOriginal = pool.query;
    const jti = "ad9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f13";
    const token = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            issuer: "healthytrack",
            audience: "healthytrack-api",
            expiresIn: "1h",
            jwtid: jti
        }
    );

    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        expect(resposta.status).toBe(401);
        expect(resposta.body.mensagem).toBe("Sessão inválida ou expirada");
    } finally {
        pool.query = consultaOriginal;
    }
});

test("GET /api/meta-diaria rejeita um JWT expirado no cookie", async function () {
    const jti = "bd9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f14";
    const token = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            issuer: "healthytrack",
            audience: "healthytrack-api",
            expiresIn: -1,
            jwtid: jti
        }
    );

    const resposta = await request(app)
        .get("/api/meta-diaria")
        .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

    expect(resposta.status).toBe(401);
    expect(resposta.body.mensagem).toBe("Token inválido ou expirado");
});

test("PUT autenticado por cookie rejeita origem não autorizada", async function () {
    const jti = "9d9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f12";
    const token = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            issuer: "healthytrack",
            audience: "healthytrack-api",
            expiresIn: "1h",
            jwtid: jti
        }
    );

    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Origin", "https://origem-nao-autorizada.example")
        .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`)
        .send({ meta_diaria: 3 });

    expect(resposta.status).toBe(403);
});

afterAll(async function () {
    await pool.end();
});



