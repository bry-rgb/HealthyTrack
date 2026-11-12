/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * Guarda contadores partilhados de tentativas de login.
 * Não armazena endereços IP: ip_hash contém um HMAC calculado pelo backend.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
    pgm.createTable("login_rate_limits", {
        ip_hash: {
            type: "char(64)",
            primaryKey: true,
        },
        window_started_at: {
            type: "timestamptz",
            notNull: true,
        },
        attempts: {
            type: "integer",
            notNull: true,
            default: 0,
        },
        updated_at: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("current_timestamp"),
        },
    });

    pgm.createIndex("login_rate_limits", "updated_at");
};

/**
 * Remove apenas a tabela criada por esta migração.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
    pgm.dropTable("login_rate_limits");
};
