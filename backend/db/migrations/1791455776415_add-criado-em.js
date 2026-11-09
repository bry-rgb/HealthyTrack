/**
 * A migração original de criação da tabela foi um no-op porque a tabela existia
 * manualmente. Ao inicializar uma base limpa, garante aqui a estrutura esperada
 * antes de acrescentar criado_em. Em bases existentes, não altera a tabela.
 * @type {import("node-pg-migrate").ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/** @param pgm {import("node-pg-migrate").MigrationBuilder} */
export const up = (pgm) => {
    pgm.createTable("registro_agua", {
        id: { type: "serial", primaryKey: true },
        quantidade: { type: "numeric" },
        horario: { type: "timestamp" },
    }, { ifNotExists: true });

    pgm.addColumn("registro_agua", {
        criado_em: { type: "timestamp" },
    }, { ifNotExists: true });
};

/** @param pgm {import("node-pg-migrate").MigrationBuilder} */
export const down = (pgm) => {
    pgm.dropColumn("registro_agua", "criado_em");
};
