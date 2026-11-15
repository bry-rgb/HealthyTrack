require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });
const { Pool } = require("pg");

const email = process.argv[2];
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Uso: npm run promover-gestor -- email@exemplo.com");
    process.exit(1);
}

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

async function promoverGestor() {
    try {
        const resultado = await pool.query(
            "UPDATE usuarios SET perfil = 'gestor_desafios' WHERE lower(email) = lower($1) RETURNING id, email",
            [email.trim()]
        );
        if (resultado.rows.length === 0) {
            console.error("Não existe uma conta registada com esse email.");
            process.exitCode = 1;
            return;
        }
        console.log("Perfil de gestor atribuído a " + resultado.rows[0].email + ".");
    } catch (erro) {
        console.error("Não foi possível atribuir o perfil de gestor:", erro.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

promoverGestor();
