/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
    pgm.createTable("desafios", {
        id: { type: "serial", primaryKey: true },
        titulo: { type: "varchar(100)", notNull: true },
        descricao: { type: "text", notNull: true },
        data_inicio: { type: "date", notNull: true },
        data_fim: { type: "date", notNull: true },
        gestor_id: { type: "integer", notNull: true, references: "usuarios", onDelete: "cascade" },
        criado_em: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    });
    pgm.addConstraint("desafios", "desafios_intervalo_valido", {
        check: "data_fim >= data_inicio",
    });
    pgm.createIndex("desafios", "gestor_id");
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
    pgm.dropTable("desafios");
};
