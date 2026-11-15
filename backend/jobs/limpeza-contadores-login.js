const { setTimeout } = require("node:timers");

async function limparContadoresAntigosLogin(pool, logger = console) {
    const inicio = new Date();
    logger.info(`[limpeza-login] Início da limpeza diária: ${inicio.toISOString()}`);

    try {
        const [limpezaIP, limpezaContas] = await Promise.all([
            pool.query("DELETE FROM login_rate_limits WHERE updated_at < NOW() - INTERVAL '24 hours'"),
            pool.query("DELETE FROM login_rate_limits_accounts WHERE updated_at < NOW() - INTERVAL '24 hours'")
        ]);

        logger.info(
            `[limpeza-login] Limpeza concluída: ${limpezaIP.rowCount} contadores de IP e ` +
            `${limpezaContas.rowCount} contadores de conta removidos.`
        );
    } catch (erro) {
        logger.error(`[limpeza-login] Falha na limpeza diária: ${erro.message}`, erro);
        throw erro;
    }
}

function agendarLimpezaDiariaLogin(pool, logger = console) {
    function agendarProximaExecucao() {
        const agora = new Date();
        const proximaMeiaNoiteUTC = new Date(Date.UTC(
            agora.getUTCFullYear(),
            agora.getUTCMonth(),
            agora.getUTCDate() + 1
        ));
        const espera = proximaMeiaNoiteUTC.getTime() - agora.getTime();
        const timer = setTimeout(async function executarLimpeza() {
            try {
                await limparContadoresAntigosLogin(pool, logger);
            } catch {
                // O erro já foi registado; a próxima execução continua agendada.
            }
            agendarProximaExecucao();
        }, espera);

        if (typeof timer.unref === "function") timer.unref();
        logger.info(`[limpeza-login] Próxima execução agendada para ${proximaMeiaNoiteUTC.toISOString()}.`);
    }

    agendarProximaExecucao();
}

module.exports = { agendarLimpezaDiariaLogin, limparContadoresAntigosLogin };
