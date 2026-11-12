/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Cria o armazenamento persistente das sessões individuais dos utilizadores.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.createTable("sessoes_utilizador", {
        jti: {
            type: "uuid",
            primaryKey: true,
        },
        user_id: {
            type: "integer",
            notNull: true,
            references: "usuarios",
            onDelete: "cascade",
        },
        expires_at: {
            type: "timestamptz",
            notNull: true,
        },
        revoked_at: {
            type: "timestamptz",
        },
        created_at: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("current_timestamp"),
        },
    });

    pgm.createIndex("sessoes_utilizador", "user_id");
    pgm.createIndex("sessoes_utilizador", "expires_at");
};

/**
 * Remove apenas a tabela criada por esta migração.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropTable("sessoes_utilizador");
};
