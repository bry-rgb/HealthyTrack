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
    pgm.createTable('usuarios', {
        id: {
            type: 'integer',
            primaryKey: true,
            sequence: 'usuarios_id_seq'
        },
        nome: {
             type: 'text',
             notNull: true
        },
        email: {
            type: 'text',
            notNull: true,
            unique: true
        },
        senha: {
            type: 'text',
            notNull: true
        },
        criado_em: {
            type: 'timestamp'
        }
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropTable('usuarios');
};