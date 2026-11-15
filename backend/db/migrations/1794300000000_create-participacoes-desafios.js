/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
    pgm.createTable("participacoes_desafios", {
        desafio_id: { type: "integer", notNull: true, references: "desafios", onDelete: "cascade" },
        usuario_id: { type: "integer", notNull: true, references: "usuarios", onDelete: "cascade" },
        criado_em: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    });
    pgm.addConstraint("participacoes_desafios", "participacoes_desafios_pkey", {
        primaryKey: ["desafio_id", "usuario_id"],
    });
    pgm.createIndex("participacoes_desafios", "usuario_id");
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
    pgm.dropTable("participacoes_desafios");
};
