/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.createTable("avaliacao_inicial", {
        id: {
            type: "serial",
            primaryKey: true,
        },
        usuario_id: {
            type: "integer",
            notNull: true,
            references: "usuarios",
            onDelete: "cascade",
            unique: true,
        },
        faixa_etaria: {
            type: "text",
            notNull: true,
        },
        peso: {
            type: "numeric",
        },
        atividade: {
            type: "text",
            notNull: true,
        },
        exercicio_calor: {
            type: "text",
            notNull: true,
        },
        limite_liquidos: {
            type: "text",
            notNull: true,
        },
        unidade: {
            type: "text",
            notNull: true,
        },
    });
};

export const down = (pgm) => {
    pgm.dropTable("avaliacao_inicial");
};
