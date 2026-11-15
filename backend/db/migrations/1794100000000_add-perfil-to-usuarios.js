/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
    pgm.addColumn("usuarios", {
        perfil: { type: "text", notNull: true, default: "utilizador" },
    });
    pgm.addConstraint("usuarios", "usuarios_perfil_valido", {
        check: "perfil IN ('utilizador', 'gestor_desafios')",
    });
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
    pgm.dropConstraint("usuarios", "usuarios_perfil_valido");
    pgm.dropColumn("usuarios", "perfil");
};
