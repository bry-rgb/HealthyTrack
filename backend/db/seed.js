const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const pool = new Pool(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || "healthytrack",
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "healthytrack"
    }
);

const DEMO_EMAIL = "demo@waterkraft.local";
const DEMO_PASSWORD = "WaterkraftDemo2026!";
const DEMO_MANAGER_EMAIL = "gestor@waterkraft.local";
const DEMO_MANAGER_PASSWORD = "WaterkraftGestor2026!";

async function seed() {
    if (process.env.SEED_DEMO_DATA !== "true") {
        console.log("Seed ignorado: SEED_DEMO_DATA não está ativo.");
        await pool.end();
        return;
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const utilizadores = await client.query("SELECT COUNT(*)::int AS total FROM usuarios");
        if (utilizadores.rows[0].total > 0) {
            await client.query("ROLLBACK");
            console.log("Seed ignorado: já existem utilizadores; os dados existentes foram preservados.");
            return;
        }

        const senhaHash = await bcrypt.hash(DEMO_PASSWORD, 12);
        const utilizador = await client.query(
            `INSERT INTO usuarios (nome, email, senha, criado_em)
             VALUES ($1, $2, $3, NOW())
             RETURNING id`,
            ["Utilizador de demonstração", DEMO_EMAIL, senhaHash]
        );
        const senhaGestorHash = await bcrypt.hash(DEMO_MANAGER_PASSWORD, 12);
        await client.query(
            "INSERT INTO usuarios (nome, email, senha, criado_em, perfil) VALUES ($1, $2, $3, NOW(), 'gestor_desafios')",
            ["Gestor de demonstração", DEMO_MANAGER_EMAIL, senhaGestorHash]
        );
        await client.query(
            "INSERT INTO desafios (titulo, descricao, data_inicio, data_fim, gestor_id) " +
            "SELECT $1, $2, CURRENT_DATE, CURRENT_DATE + 7, id FROM usuarios WHERE email = $3",
            ["Semana da Hidratação", "Regista a tua hidratação durante sete dias.", DEMO_MANAGER_EMAIL]
        );

        const usuarioId = utilizador.rows[0].id;

        await client.query(
            `INSERT INTO registro_agua (quantidade, horario, usuario_id)
             SELECT amostra.quantidade,
                    CURRENT_DATE - amostra.dias_antes + TIME '12:00',
                    $1
             FROM (VALUES (0.75::numeric, 0), (1.0, 1), (1.5, 2), (0.5, 3), (1.25, 4))
                  AS amostra(quantidade, dias_antes)`,
            [usuarioId]
        );

        await client.query(
            `INSERT INTO avaliacao_inicial
                (usuario_id, faixa_etaria, peso, atividade, exercicio_calor, limite_liquidos, unidade)
             VALUES ($1, '18-64', 70, 'moderada', 'raramente', 'nao', 'L')`,
            [usuarioId]
        );
        await client.query(
            "UPDATE usuarios SET avaliacao_inicial_concluida = true WHERE id = $1",
            [usuarioId]
        );

        await client.query("COMMIT");
        console.log("Seed de demonstração criado.");
    } catch (erro) {
        await client.query("ROLLBACK");
        throw erro;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(async (erro) => {
    console.error("Falha ao criar seed de demonstração:", erro.message);
    await pool.end();
    process.exitCode = 1;
});
