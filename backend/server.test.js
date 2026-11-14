const request = require("supertest");
const { app, pool } = require("./server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { beforeEach, afterEach } = require("@jest/globals");

require("dotenv").config();

const jtiTeste = "11111111-1111-4111-8111-111111111111";
const queryReal = pool.query;

beforeEach(function () {
    pool.query = function (sql, parametros, callback) {
        if (typeof sql === "string" && sql.includes("sessoes_utilizador")) {
            // Simula uma única sessão ativa e só a aceita para o JTI e utilizador esperados.
            const sessaoCorresponde =
                parametros[0] === jtiTeste &&
                parametros[1] === 1;

            return Promise.resolve({
                rows: sessaoCorresponde ? [{ jti: jtiTeste }] : []
            });
        }
        return queryReal.call(pool, sql, parametros, callback);
    };
});

afterEach(function () {
    pool.query = queryReal;
});

const tokenTeste = jwt.sign(
    { id: 1, email: "teste@example.com" },
    process.env.JWT_SECRET,
    {
        algorithm: "HS256",
        issuer: "healthytrack",
        audience: "healthytrack-api",
        jwtid: jtiTeste
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

test("POST /api/login rejeita pedido sem corpo", async function () {
    const resposta = await request(app)
        .post("/api/login");

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe("Email e senha são obrigatórios");
});

test("POST /api/login rejeita corpo JSON null", async function () {
    const resposta = await request(app)
        .post("/api/login")
        .set("Content-Type", "application/json")
        .send("null");

    // O express.json() usa strict=true por omissão e rejeita JSON null
    // antes de a rota de login ser executada.
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

    pool.query = jest.fn().mockImplementation(async (sql) => {
        if (sql.includes("INSERT INTO login_rate_limits_accounts") ||
            sql.includes("INSERT INTO login_rate_limits")) {
            return { rows: [{ attempts: 1, segundos_restantes: 900 }] };
        }
        return { rows: [] };
    });

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

test("POST /api/login cria sessão persistente associada ao utilizador autenticado", async function () {
    const consultaOriginal = pool.query;
    const senha = "Aventura123";
    const hashSenha = await bcrypt.hash(senha, 10);
    const utilizador = {
        id: 42,
        nome: "Utilizador de teste",
        email: "login.sucesso@example.com",
        senha: hashSenha,
        avaliacao_inicial_concluida: true
    };

    pool.query = jest.fn().mockImplementation(async (sql, parametros) => {
        if (sql.includes("INSERT INTO login_rate_limits") ||
            sql.includes("INSERT INTO login_rate_limits_accounts")) {
            return { rows: [{ attempts: 1, segundos_restantes: 900 }] };
        }

        if (sql.includes("SELECT * FROM usuarios WHERE email")) {
            expect(parametros).toEqual([utilizador.email]);
            return { rows: [utilizador] };
        }

        if (sql.includes("DELETE FROM login_rate_limits")) {
            return { rows: [] };
        }

        if (sql.includes("DELETE FROM login_rate_limits_accounts")) {
            return { rows: [] };
        }

        if (sql.includes("INSERT INTO sessoes_utilizador")) {
            return { rows: [{ jti: parametros[0], user_id: parametros[1], expires_at: parametros[2] }] };
        }

        throw new Error("Consulta inesperada no teste de login: " + sql);
    });

    try {
        const resposta = await request(app)
            .post("/api/login")
            .send({ email: utilizador.email, senha });

        expect(resposta.status).toBe(200);
        expect(resposta.body.mensagem).toBe("Login realizado com sucesso!");
        expect(resposta.body.usuario).toEqual({
            id: utilizador.id,
            nome: utilizador.nome,
            email: utilizador.email,
            avaliacao_inicial_concluida: true
        });

        const cookie = resposta.headers["set-cookie"].find(valor =>
            valor.startsWith("waterkraft_session=")
        );
        expect(cookie).toBeDefined();
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("Secure");
        expect(cookie).toContain("SameSite=Lax");

        const token = decodeURIComponent(cookie.split(";")[0].split("=").slice(1).join("="));
        const payload = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"],
            issuer: "healthytrack",
            audience: "healthytrack-api"
        });

        expect(payload.id).toBe(utilizador.id);
        expect(payload.email).toBe(utilizador.email);
        expect(payload.jti).toBeTruthy();

        const insercaoSessao = pool.query.mock.calls.find(([sql]) =>
            sql.includes("INSERT INTO sessoes_utilizador")
        );
        expect(insercaoSessao).toBeDefined();
        expect(insercaoSessao[1][0]).toBe(payload.jti);
        expect(insercaoSessao[1][1]).toBe(utilizador.id);
        expect(insercaoSessao[1][2]).toBeInstanceOf(Date);
        expect(insercaoSessao[1][2].getTime()).toBeGreaterThan(Date.now());

    } finally {
        pool.query = consultaOriginal;
    }
});

test("POST /api/login não autentica nem cria cookie se a sessão não puder ser guardada", async function () {
    const consultaOriginal = pool.query;
    const senha = "Aventura123";
    const hashSenha = await bcrypt.hash(senha, 10);
    const utilizador = {
        id: 43,
        nome: "Utilizador sem sessão",
        email: "sessao.indisponivel@example.com",
        senha: hashSenha,
        avaliacao_inicial_concluida: false
    };

    pool.query = jest.fn().mockImplementation(async (sql, parametros) => {
        if (sql.includes("INSERT INTO login_rate_limits") ||
            sql.includes("INSERT INTO login_rate_limits_accounts")) {
            return { rows: [{ attempts: 1, segundos_restantes: 900 }] };
        }

        if (sql.includes("SELECT * FROM usuarios WHERE email")) {
            return { rows: [utilizador] };
        }

        if (sql.includes("DELETE FROM login_rate_limits")) {
            return { rows: [] };
        }

        if (sql.includes("DELETE FROM login_rate_limits_accounts")) {
            return { rows: [] };
        }

        if (sql.includes("INSERT INTO sessoes_utilizador")) {
            expect(parametros[1]).toBe(utilizador.id);
            throw new Error("Falha simulada ao guardar a sessão");
        }

        throw new Error("Consulta inesperada no teste de falha de sessão: " + sql);
    });

    try {
        const resposta = await request(app)
            .post("/api/login")
            .send({ email: utilizador.email, senha });

        expect(resposta.status).toBe(500);
        expect(resposta.body.mensagem).toBe("Erro interno de servidor");
        expect(resposta.body.usuario).toBeUndefined();
        expect(resposta.headers["set-cookie"]).toBeUndefined();

        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO sessoes_utilizador"),
            expect.arrayContaining([
                expect.any(String),
                utilizador.id,
                expect.any(Date)
            ])
        );
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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        .set("Origin", "http://localhost:5500")
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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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


test("GET /api/meta-diaria rejeita sessão com JTI diferente do registo ativo", async function () {
    const tokenComJtiDiferente = jwt.sign(
        { id: 1, email: "teste@example.com" },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            issuer: "healthytrack",
            audience: "healthytrack-api",
            jwtid: "22222222-2222-4222-8222-222222222222"
        }
    );

    const resposta = await request(app)
        .get("/api/meta-diaria")
        .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenComJtiDiferente)}`);

    expect(resposta.status).toBe(401);
    expect(resposta.body.mensagem).toBe("Sessão inválida ou expirada");
});

test("GET /api/meta-diaria devolve a meta do utilizador autenticado", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(null, {
            rows: [{ meta_diaria: "2.5" }]
        });
    });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(null, {
            rows: [{ meta_diaria: parametros[0] }]
        });
    });

    try {
        const resposta = await request(app)
            .put("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
        .send({ meta_diaria: 11 });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe(
        "A meta diária deve estar entre 0,5 e 10 litros"
    );
});


test("PUT /api/meta-diaria rejeita uma meta inferior a 0.5 litros", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
        .send({ meta_diaria: 0.4 });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe(
        "A meta diária deve estar entre 0,5 e 10 litros"
    );
});


test("PUT /api/meta-diaria rejeita uma meta enviada como texto", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
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
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(null, { rows: [] });
    });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

        expect(resposta.status).toBe(404);
        expect(resposta.body.mensagem).toBe("Utilizador não encontrado");
    } finally {
        pool.query = consultaOriginal;
    }
});


test("GET /api/estatisticas-diarias trata erros na consulta à base de dados", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(new Error("Erro de ligação à base de dados"));
    });

    try {
        const resposta = await request(app)
            .get("/api/estatisticas-diarias")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(null, { rows: [] });
    });

    try {
        const resposta = await request(app)
            .put("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(new Error("Erro de ligação à base de dados"));
    });

    try {
        const resposta = await request(app)
            .put("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(new Error("Erro de ligação à base de dados"));
    });

    try {
        const resposta = await request(app)
            .delete("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

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
        .set("Origin", "http://localhost:5500")
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
        .set("Cookie", "waterkraft_session=token-invalido");

    expect(resposta.status).toBe(401);
});


test("GET /api/registros-agua devolve 500 quando ocorre um erro na base de dados", async function () {
    const queryOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(new Error("Erro de teste"), null);
    });

    try {
        const resposta = await request(app)
            .get("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

        expect(resposta.status).toBe(500);
    } finally {
        pool.query = queryOriginal;
    }
});


test("GET /api/meta-diaria rejeita token inválido", async function () {
    const resposta = await request(app)
        .get("/api/meta-diaria")
        .set("Cookie", "waterkraft_session=token-invalido");

    expect(resposta.status).toBe(401);
});


test("GET /api/estatisticas-diarias rejeita token inválido", async function () {
    const resposta = await request(app)
        .get("/api/estatisticas-diarias")
        .set("Cookie", "waterkraft_session=token-invalido");

    expect(resposta.status).toBe(401);
});


test("PUT /api/meta-diaria rejeita token inválido", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Origin", "http://localhost:5500")
        .set("Cookie", "waterkraft_session=token-invalido")
        .send({ meta_diaria: 2.5 });

    expect(resposta.status).toBe(401);
});


test("POST /api/registros-agua rejeita token inválido", async function () {
    const resposta = await request(app)
        .post("/api/registros-agua")
        .set("Origin", "http://localhost:5500")
        .set("Cookie", "waterkraft_session=token-invalido")
        .send({ quantidade: 0.5 });

    expect(resposta.status).toBe(401);
});


test("DELETE /api/registros-agua rejeita token inválido", async function () {
    const resposta = await request(app)
        .delete("/api/registros-agua")
        .set("Origin", "http://localhost:5500")
        .set("Cookie", "waterkraft_session=token-invalido");

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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
        .send({
            horario: new Date().toISOString()
        });

    expect(resposta.status).toBe(400);
    expect(resposta.body.mensagem).toBe("Dados inválidos");
});


test("POST /api/registros-agua regista água com sucesso", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(null, { rows: [] });
    });

    try {
        const resposta = await request(app)
            .post("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(null, {
            rows: [
                { id: 1, quantidade: 0.5, horario: "2026-10-30T09:00:00.000Z" }
            ]
        });
    });

    try {
        const resposta = await request(app)
            .get("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(new Error("Erro de teste"), null);
    });

    try {
        const resposta = await request(app)
            .post("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
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
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(new Error("Erro de teste"), null);
    });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

        expect(resposta.status).toBe(500);
    } finally {
        pool.query = consultaOriginal;
    }
});



test("PUT /api/meta-diaria rejeita pedido sem meta diária", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
        .send({});

    expect(resposta.status).toBe(400);
});


test("PUT /api/meta-diaria rejeita uma meta negativa", async function () {
    const resposta = await request(app)
        .put("/api/meta-diaria")
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
        .send({ meta_diaria: -1 });

    expect(resposta.status).toBe(400);
});


test("DELETE /api/registros-agua apaga os registos do utilizador autenticado", async function () {
    const consultaOriginal = pool.query;

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        if (sql.includes("sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        callback(null, { rows: [] });
    });

    try {
        const resposta = await request(app)
            .delete("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`);

        expect(resposta.status).toBe(200);
    } finally {
        pool.query = consultaOriginal;
    }
});


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


test("GET /api/meta-diaria rejeita um Bearer token válido", async function () {
    const resposta = await request(app)
        .get("/api/meta-diaria")
        .set("Authorization", `Bearer ${tokenTeste}`);

    expect(resposta.status).toBe(401);
    expect(resposta.body.mensagem).toBe("Sessão não fornecida ou formato inválido");
});

test("GET /api/registros-agua rejeita cabeçalho Bearer sem token", async function () {
    const resposta = await request(app)
        .get("/api/registros-agua")
        .set("Authorization", "Bearer ");

    expect(resposta.status).toBe(401);
    expect(resposta.body.mensagem).toBe(
        "Sessão não fornecida ou formato inválido"
    );
});

test("GET /api/registros-agua rejeita Bearer sem token", async function () {
    const resposta = await request(app)
        .get("/api/registros-agua")
        .set("Authorization", "Bearer  ");

    expect(resposta.status).toBe(401);
    expect(resposta.body.mensagem).toBe(
        "Sessão não fornecida ou formato inválido"
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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);
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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);
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
        .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);
    expect(resposta.status).toBe(401);
});

test("POST /api/login bloqueia a sexta tentativa falhada da mesma conta", async function () {
    const consultaOriginal = pool.query;
    const contadores = { ip: 0, conta: 0 };
    pool.query = jest.fn().mockImplementation(async (sql) => {
        if (sql.includes("INSERT INTO login_rate_limits_accounts")) {
            contadores.conta += 1;
            return { rows: [{ attempts: contadores.conta, segundos_restantes: 900 }] };
        }
        if (sql.includes("INSERT INTO login_rate_limits")) {
            contadores.ip += 1;
            return { rows: [{ attempts: contadores.ip, segundos_restantes: 900 }] };
        }
        return { rows: [] };
    });

    try {
        for (let tentativa = 0; tentativa < 5; tentativa++) {
            const resposta = await request(app)
                .post("/api/login")
                .set("X-Forwarded-For", `192.0.2.${80 + tentativa}`)
                .send({ email: "mesma-conta@example.com", senha: "Aventura123" });
            expect(resposta.status).toBe(401);
        }

        const bloqueada = await request(app)
            .post("/api/login")
            .set("X-Forwarded-For", "192.0.2.90")
            .send({ email: "mesma-conta@example.com", senha: "Aventura123" });

        expect(bloqueada.status).toBe(429);
        expect(bloqueada.headers["retry-after"]).toBeDefined();
        expect(contadores.conta).toBe(6);
    } finally {
        pool.query = consultaOriginal;
    }
});

test("POST /api/login permite várias contas na mesma rede até ao limite por IP", async function () {
    const consultaOriginal = pool.query;
    let tentativasIp = 0;
    pool.query = jest.fn().mockImplementation(async (sql) => {
        if (sql.includes("INSERT INTO login_rate_limits_accounts")) {
            return { rows: [{ attempts: 1, segundos_restantes: 900 }] };
        }
        if (sql.includes("INSERT INTO login_rate_limits")) {
            tentativasIp += 1;
            return { rows: [{ attempts: tentativasIp, segundos_restantes: 900 }] };
        }
        return { rows: [] };
    });

    try {
        for (let tentativa = 1; tentativa <= 30; tentativa++) {
            const resposta = await request(app)
                .post("/api/login")
                .set("X-Forwarded-For", "192.0.2.100")
                .send({ email: `conta-${tentativa}@example.com`, senha: "Aventura123" });
            expect(resposta.status).toBe(401);
        }

        const bloqueada = await request(app)
            .post("/api/login")
            .set("X-Forwarded-For", "192.0.2.100")
            .send({ email: "conta-31@example.com", senha: "Aventura123" });

        expect(bloqueada.status).toBe(429);
        expect(tentativasIp).toBe(31);
    } finally {
        pool.query = consultaOriginal;
    }
});

test("POST /api/login não conta erros de validação como tentativas falhadas", async function () {
    const consultaOriginal = pool.query;
    const contadores = { ip: 0, conta: 0 };
    pool.query = jest.fn().mockImplementation(async (sql) => {
        if (sql.includes("INSERT INTO login_rate_limits_accounts")) {
            contadores.conta += 1;
            return { rows: [{ attempts: contadores.conta, segundos_restantes: 900 }] };
        }
        if (sql.includes("INSERT INTO login_rate_limits")) {
            contadores.ip += 1;
            return { rows: [{ attempts: contadores.ip, segundos_restantes: 900 }] };
        }
        return { rows: [] };
    });

    try {
        for (let tentativa = 0; tentativa < 6; tentativa++) {
            const resposta = await request(app)
                .post("/api/login")
                .set("X-Forwarded-For", "192.0.2.78")
                .send({ email: "email-invalido", senha: "Aventura123" });
            expect(resposta.status).toBe(400);
        }

        const resposta = await request(app)
            .post("/api/login")
            .set("X-Forwarded-For", "192.0.2.78")
            .send({ email: "nao-existe@example.com", senha: "Aventura123" });

        expect(resposta.status).toBe(401);
        expect(contadores.ip).toBe(1);
        expect(contadores.conta).toBe(1);
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
            const sessaoCorresponde = parametros[0] === jti && parametros[1] === 1;
            return Promise.resolve({
                rows: sessaoCorresponde ? [{ jti }] : []
            });
        }
        callback(null, { rows: [{ meta_diaria: "2.5" }] });
    });

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
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

    let sessaoRevogada = false;
    pool.query = jest.fn().mockImplementation(function (sql, parametros) {
        if (sql.includes("SELECT jti FROM sessoes_utilizador")) {
            const sessaoCorresponde =
                parametros[0] === jti &&
                parametros[1] === 1 &&
                !sessaoRevogada;
            return Promise.resolve({
                rows: sessaoCorresponde ? [{ jti }] : []
            });
        }
        if (sql.includes("UPDATE sessoes_utilizador")) {
            expect(parametros).toEqual([jti, 1]);
            sessaoRevogada = true;
            return Promise.resolve({ rows: [{ jti }] });
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
            [jti, 1]
        );
        expect(resposta.headers["set-cookie"].join(";")).toContain("Max-Age=0");

        // A mesma credencial deve deixar de autorizar pedidos após o logout.
        const pedidoDepoisDoLogout = await request(app)
            .get("/api/meta-diaria")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        expect(pedidoDepoisDoLogout.status).toBe(401);
        expect(pedidoDepoisDoLogout.body.mensagem).toBe("Sessão inválida ou expirada");
        expect(sessaoRevogada).toBe(true);
    } finally {
        pool.query = consultaOriginal;
    }
});

test("POST /api/logout devolve sucesso ao repetir logout com sessão já revogada", async function () {
    const consultaOriginal = pool.query;
    const jti = "cd9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f19";
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

    let atualizacoes = 0;
    pool.query = jest.fn().mockImplementation(async function (sql, parametros) {
        if (sql.includes("UPDATE sessoes_utilizador")) {
            expect(parametros).toEqual([jti, 1]);
            atualizacoes += 1;
            return { rowCount: 0, rows: [] }; // Já estava revogada.
        }
        throw new Error("Consulta inesperada no teste de logout repetido: " + sql);
    });

    try {
        const resposta = await request(app)
            .post("/api/logout")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        expect(resposta.status).toBe(200);
        expect(resposta.body.mensagem).toBe("Sessão terminada com sucesso");
        expect(resposta.headers["set-cookie"].join(";")).toContain("Max-Age=0");
        expect(atualizacoes).toBe(1);
    } finally {
        pool.query = consultaOriginal;
    }
});

test("POST /api/logout confirma sucesso sem cookie de sessão", async function () {
    const resposta = await request(app)
        .post("/api/logout")
        .set("Origin", "http://localhost:5500");

    expect(resposta.status).toBe(200);
    expect(resposta.body.mensagem).toBe("Sessão terminada com sucesso");
    expect(resposta.headers["set-cookie"].join(";")).toContain("Max-Age=0");
});

test("POST /api/logout rejeita origem não autorizada", async function () {
    const resposta = await request(app)
        .post("/api/logout")
        .set("Origin", "https://site-nao-autorizado.example");

    expect(resposta.status).toBe(403);
});

test("Duas chamadas simultâneas de logout terminam com sucesso e revogam uma única vez", async function () {
    const consultaOriginal = pool.query;
    const jti = "cd9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f18";
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

    let consultasDeSessao = 0;
    let atualizacoes = 0;
    let sessaoRevogada = false;

    pool.query = jest.fn().mockImplementation(async function (sql, parametros) {
        if (sql.includes("SELECT jti FROM sessoes_utilizador")) {
            expect(parametros).toEqual([jti, 1]);
            consultasDeSessao += 1;

            // Ambas as chamadas verificam a sessão antes de qualquer UPDATE.
            return { rows: [{ jti }] };
        }

        if (sql.includes("UPDATE sessoes_utilizador")) {
            expect(parametros).toEqual([jti, 1]);
            atualizacoes += 1;

            if (sessaoRevogada) {
                return { rowCount: 0, rows: [] };
            }

            sessaoRevogada = true;
            return { rowCount: 1, rows: [] };
        }

        return { rows: [] };
    });

    try {
        const pedidoLogout = () => request(app)
            .post("/api/logout")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        const [primeiroLogout, segundoLogout] = await Promise.all([
            pedidoLogout(),
            pedidoLogout()
        ]);

        // O endpoint idempotente não precisa de consultar a sessão antes do UPDATE.
        expect(consultasDeSessao).toBe(0);
        expect(atualizacoes).toBe(2);
        expect(sessaoRevogada).toBe(true);

        // As duas chamadas que já tinham sido autenticadas recebem resposta idempotente.
        expect(primeiroLogout.status).toBe(200);
        expect(segundoLogout.status).toBe(200);
        expect(primeiroLogout.body.mensagem).toBe("Sessão terminada com sucesso");
        expect(segundoLogout.body.mensagem).toBe("Sessão terminada com sucesso");
        expect(primeiroLogout.headers["set-cookie"].join(";")).toContain("Max-Age=0");
        expect(segundoLogout.headers["set-cookie"].join(";")).toContain("Max-Age=0");
    } finally {
        pool.query = consultaOriginal;
    }
});

test("Pedido protegido já autorizado pode terminar enquanto logout revoga a sessão", async function () {
    const consultaOriginal = pool.query;
    const jti = "bd9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f17";
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

    let sessaoRevogada = false;
    let sinalConsultaProtegida;
    let libertarConsultaProtegida;
    const consultaProtegidaIniciada = new Promise(resolve => {
        sinalConsultaProtegida = resolve;
    });
    const consultaProtegidaAguardar = new Promise(resolve => {
        libertarConsultaProtegida = resolve;
    });

    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        if (sql.includes("SELECT jti FROM sessoes_utilizador")) {
            const ativa = parametros[0] === jti &&
                parametros[1] === 1 &&
                !sessaoRevogada;
            return Promise.resolve({ rows: ativa ? [{ jti }] : [] });
        }

        if (sql.includes("UPDATE sessoes_utilizador")) {
            sessaoRevogada = true;
            return Promise.resolve({ rows: [{ jti }] });
        }

        if (sql.includes("SELECT meta_diaria FROM usuarios")) {
            sinalConsultaProtegida();
            return consultaProtegidaAguardar.then(() => {
                callback(null, { rows: [{ meta_diaria: "2.5" }] });
            });
        }

        return Promise.resolve({ rows: [] });
    });

    try {
        // Este pedido passa primeiro pela validação da sessão e fica pendente no handler.
        const pedidoEmCurso = request(app)
            .get("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`)
            .then(resposta => resposta);

        await consultaProtegidaIniciada;

        // O logout revoga a sessão enquanto o pedido anterior ainda está em curso.
        const respostaLogout = await request(app)
            .post("/api/logout")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        expect(respostaLogout.status).toBe(200);
        expect(sessaoRevogada).toBe(true);

        // O pedido já autorizado pode concluir; a próxima chamada deve ser recusada.
        libertarConsultaProtegida();
        const respostaPedidoEmCurso = await pedidoEmCurso;
        expect(respostaPedidoEmCurso.status).toBe(200);

        const pedidoNovo = await request(app)
            .get("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        expect(pedidoNovo.status).toBe(401);
        expect(pedidoNovo.body.mensagem).toBe("Sessão inválida ou expirada");
    } finally {
        libertarConsultaProtegida();
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
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(token)}`);

        expect(resposta.status).toBe(401);
        expect(resposta.body.mensagem).toBe("Sessão inválida ou expirada");
    } finally {
        pool.query = consultaOriginal;
    }
});

test("GET /api/meta-diaria devolve 503 quando o PostgreSQL falha ao validar a sessão", async function () {
    const consultaOriginal = pool.query;
    const jti = "ed9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f16";
    const tokenAindaValido = jwt.sign(
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

    pool.query = jest.fn().mockRejectedValue(
        new Error("Falha simulada de ligação ao PostgreSQL")
    );

    try {
        const resposta = await request(app)
            .get("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenAindaValido)}`);

        expect(resposta.status).toBe(503);
        expect(resposta.body.mensagem).toBe("Não foi possível validar a sessão");
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("revoked_at IS NULL AND expires_at > NOW()"),
            [jti, 1]
        );
    } finally {
        pool.query = consultaOriginal;
    }
});

test("GET /api/meta-diaria rejeita sessão expirada na base de dados mesmo com JWT válido", async function () {
    const consultaOriginal = pool.query;
    const jti = "cd9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f15";
    const tokenAindaValido = jwt.sign(
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
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenAindaValido)}`);

        expect(resposta.status).toBe(401);
        expect(resposta.body.mensagem).toBe("Sessão inválida ou expirada");
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("expires_at > NOW()"),
            [jti, 1]
        );
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
        .set("Origin", "http://localhost:5500")
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


test("POST /api/logout revoga uma sessão existente mesmo quando o JWT já expirou", async function () {
    const consultaOriginal = pool.query;
    const jti = "fd9c6c1a-8d2f-4c0a-9b5a-8a0c4d8e7f20";
    const tokenExpirado = jwt.sign(
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

    let sessaoRevogada = false;
    pool.query = jest.fn().mockImplementation(async function (sql, parametros) {
        if (sql.includes("UPDATE sessoes_utilizador")) {
            expect(parametros).toEqual([jti, 1]);
            sessaoRevogada = true;
            return { rowCount: 1, rows: [] };
        }

        if (sql.includes("SELECT jti FROM sessoes_utilizador")) {
            const sessaoAtiva = !sessaoRevogada &&
                parametros[0] === jti &&
                parametros[1] === 1;
            return { rows: sessaoAtiva ? [{ jti }] : [] };
        }

        throw new Error("Consulta inesperada no teste de JWT expirado: " + sql);
    });

    try {
        const respostaLogout = await request(app)
            .post("/api/logout")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenExpirado)}`);

        expect(respostaLogout.status).toBe(200);
        expect(respostaLogout.body.mensagem).toBe("Sessão terminada com sucesso");
        expect(respostaLogout.headers["set-cookie"].join(";")).toContain("Max-Age=0");
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE sessoes_utilizador"),
            [jti, 1]
        );
        expect(sessaoRevogada).toBe(true);

        // Apesar de o JWT ter expirado, a sessão existente foi revogada na base de dados.
        const pedidoDepoisDoLogout = await request(app)
            .get("/api/meta-diaria")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenExpirado)}`);

        expect(pedidoDepoisDoLogout.status).toBe(401);
        expect(pedidoDepoisDoLogout.body.mensagem).toBe("Token inválido ou expirado");
    } finally {
        pool.query = consultaOriginal;
    }
});


test("Os registos de água ficam isolados por utilizador em leitura, criação e eliminação", async function () {
    const consultaOriginal = pool.query;
    const utilizadores = [
        { id: 1, jti: "a1111111-1111-4111-8111-111111111111" },
        { id: 2, jti: "b2222222-2222-4222-8222-222222222222" }
    ];
    const tokens = utilizadores.map(utilizador => jwt.sign(
        { id: utilizador.id, email: `utilizador${utilizador.id}@example.com` },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            issuer: "healthytrack",
            audience: "healthytrack-api",
            expiresIn: "1h",
            jwtid: utilizador.jti
        }
    ));

    const registos = [
        { id: 10, usuario_id: 1, quantidade: 0.5, horario: "2026-11-14T09:00:00.000Z" },
        { id: 20, usuario_id: 2, quantidade: 0.25, horario: "2026-11-14T10:00:00.000Z" }
    ];
    const utilizadoresQueCriaram = [];
    const utilizadoresQueApagaram = [];

    pool.query = jest.fn().mockImplementation(async function (sql, parametros, callback) {
        if (sql.includes("sessoes_utilizador")) {
            const sessao = utilizadores.find(item =>
                item.jti === parametros[0] && item.id === parametros[1]
            );
            return { rows: sessao ? [{ jti: sessao.jti }] : [] };
        }

        if (sql.includes("SELECT * FROM registro_agua")) {
            const utilizadorId = parametros[0];
            return {
                rows: registos.filter(registo => registo.usuario_id === utilizadorId)
            };
        }

        if (sql.includes("INSERT INTO registro_agua")) {
            utilizadoresQueCriaram.push(parametros[2]);
            return { rows: [] };
        }

        if (sql.includes("DELETE FROM registro_agua")) {
            utilizadoresQueApagaram.push(parametros[0]);
            return { rows: [] };
        }

        throw new Error("Consulta inesperada no teste de isolamento: " + sql);
    });

    try {
        // O utilizador 1 só recebe os seus próprios registos.
        const leituraUtilizador1 = await request(app)
            .get("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokens[0])}`);

        expect(leituraUtilizador1.status).toBe(200);
        expect(leituraUtilizador1.body.map(registo => registo.id)).toEqual([10]);
        expect(leituraUtilizador1.body.some(registo => registo.usuario_id === 2)).toBe(false);

        // Mesmo que envie usuario_id=2 no corpo, o servidor associa o registo ao utilizador 1 autenticado.
        const criacaoUtilizador1 = await request(app)
            .post("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokens[0])}`)
            .send({
                quantidade: 0.5,
                horario: new Date().toISOString(),
                usuario_id: 2
            });

        expect(criacaoUtilizador1.status).toBe(200);
        expect(utilizadoresQueCriaram).toEqual([1]);

        // A eliminação também recebe o ID exclusivamente da sessão autenticada.
        const eliminacaoUtilizador2 = await request(app)
            .delete("/api/registros-agua")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokens[1])}`);

        expect(eliminacaoUtilizador2.status).toBe(200);
        expect(utilizadoresQueApagaram).toEqual([2]);
        expect(pool.query).toHaveBeenCalledWith(
            expect.stringContaining("DELETE FROM registro_agua WHERE usuario_id = $1"),
            [2],
            expect.any(Function)
        );
    } finally {
        pool.query = consultaOriginal;
    }
});


test.each([
    ["faixa etária inválida", { faixa_etaria: "0-12" }],
    ["atividade inválida", { atividade: "extrema" }],
    ["frequência inválida", { exercicio_calor: "sempre" }],
    ["limite de líquidos inválido", { limite_liquidos: "talvez" }],
    ["unidade inválida", { unidade: "cl" }],
    ["peso abaixo do limite", { peso: 0 }],
    ["peso acima do limite", { peso: 500 }],
    ["peso não numérico", { peso: "desconhecido" }],
    ["peso vazio", { peso: "" }]
])("PUT /api/avaliacao-inicial rejeita %s", async function (_descricao, alteracao) {
    const consultaOriginal = pool.query;
    pool.query = jest.fn().mockImplementation(async function (sql) {
        if (sql.includes("SELECT jti FROM sessoes_utilizador")) {
            return { rows: [{ jti: jtiTeste }] };
        }
        return { rows: [] };
    });

    const respostas = {
        faixa_etaria: "18-64",
        peso: 70,
        atividade: "moderada",
        exercicio_calor: "algumas-vezes",
        limite_liquidos: "nao",
        unidade: "L",
        ...alteracao
    };

    try {
        const resposta = await request(app)
            .put("/api/avaliacao-inicial")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
            .send(respostas);

        expect(resposta.status).toBe(400);
        expect(resposta.body.mensagem).toBe("Respostas da avaliação inválidas");
        expect(pool.query).not.toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO avaliacao_inicial"),
            expect.anything(),
            expect.any(Function)
        );
    } finally {
        pool.query = consultaOriginal;
    }
});

test("PUT /api/avaliacao-inicial aceita opções válidas e peso opcional", async function () {
    const consultaOriginal = pool.query;
    const consultas = [];
    pool.query = jest.fn().mockImplementation(function (sql, parametros, callback) {
        if (sql.includes("SELECT jti FROM sessoes_utilizador")) {
            return Promise.resolve({ rows: [{ jti: jtiTeste }] });
        }
        consultas.push({ sql, parametros });
        if (typeof callback === "function") callback(null, { rows: [] });
        return Promise.resolve({ rows: [] });
    });

    try {
        const resposta = await request(app)
            .put("/api/avaliacao-inicial")
            .set("Origin", "http://localhost:5500")
            .set("Cookie", `waterkraft_session=${encodeURIComponent(tokenTeste)}`)
            .send({
                faixa_etaria: "13-17",
                peso: null,
                atividade: "baixa",
                exercicio_calor: "raramente",
                limite_liquidos: "nao-sei",
                unidade: "mL"
            });

        expect(resposta.status).toBe(200);
        expect(consultas[0].sql).toContain("INSERT INTO avaliacao_inicial");
        expect(consultas[0].parametros).toEqual([
            1, "13-17", null, "baixa", "raramente", "nao-sei", "mL"
        ]);
        expect(consultas[1].sql).toContain("UPDATE usuarios SET avaliacao_inicial_concluida = true");
        expect(consultas[1].parametros).toEqual([1]);
    } finally {
        pool.query = consultaOriginal;
    }
});

afterAll(async function () {
    await pool.end();
});



