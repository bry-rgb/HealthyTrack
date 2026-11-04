/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Guarda se o utilizador pediu para não voltar a ver o aviso médico da meta de água.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.addColumn("avaliacao_inicial", {
        ocultar_aviso_meta: {
            type: "boolean",
            notNull: true,
            default: false,
        },
    }, { ifNotExists: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropColumn("avaliacao_inicial", "ocultar_aviso_meta");
};
