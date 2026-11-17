/**
 * Emblemas dos desafios:
 * - a plaqueta de participação fica registada quando a pessoa adere;
 * - a medalha rara é avaliada pelo gestor no fim do desafio.
 */
export const shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
    pgm.addColumn("desafios", {
        emblema_raro: { type: "text" }
    });
    pgm.addConstraint("desafios", "desafios_emblema_raro_valido", {
        check: "emblema_raro IS NULL OR emblema_raro IN ('semana-resistencia')"
    });

    pgm.addColumn("participacoes_desafios", {
        meta_diaria_alvo: { type: "numeric(6,2)" },
        emblema_raro_estado: { type: "text", notNull: true, default: "em_curso" },
        emblema_raro_avaliado_por: {
            type: "integer",
            references: "usuarios",
            onDelete: "SET NULL"
        },
        emblema_raro_avaliado_em: { type: "timestamptz" }
    });
    pgm.sql(`
        UPDATE participacoes_desafios AS participacao
        SET meta_diaria_alvo = utilizador.meta_diaria
        FROM usuarios AS utilizador
        WHERE utilizador.id = participacao.usuario_id
    `);
    pgm.alterColumn("participacoes_desafios", "meta_diaria_alvo", { notNull: true });
    pgm.addConstraint("participacoes_desafios", "participacoes_emblema_raro_estado_valido", {
        check: "emblema_raro_estado IN ('em_curso', 'conquistado', 'nao_conquistado')"
    });

    pgm.createTable("emblemas_desafios_utilizadores", {
        desafio_id: {
            type: "integer",
            notNull: true,
            references: "desafios",
            onDelete: "CASCADE"
        },
        usuario_id: {
            type: "integer",
            notNull: true,
            references: "usuarios",
            onDelete: "CASCADE"
        },
        tipo: { type: "text", notNull: true },
        conquistado_em: {
            type: "timestamptz",
            notNull: true,
            default: pgm.func("current_timestamp")
        },
        concedido_por: {
            type: "integer",
            references: "usuarios",
            onDelete: "SET NULL"
        }
    });
    pgm.addConstraint("emblemas_desafios_utilizadores", "emblemas_desafios_utilizadores_pkey", {
        primaryKey: ["desafio_id", "usuario_id", "tipo"]
    });
    pgm.addConstraint("emblemas_desafios_utilizadores", "emblemas_desafios_tipo_valido", {
        check: "tipo IN ('participacao', 'semana-resistencia')"
    });
    pgm.createIndex("emblemas_desafios_utilizadores", "usuario_id");

    pgm.sql(`
        INSERT INTO emblemas_desafios_utilizadores (desafio_id, usuario_id, tipo, conquistado_em)
        SELECT desafio_id, usuario_id, 'participacao', criado_em
        FROM participacoes_desafios
        ON CONFLICT (desafio_id, usuario_id, tipo) DO NOTHING
    `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
    pgm.dropTable("emblemas_desafios_utilizadores");
    pgm.dropConstraint("participacoes_desafios", "participacoes_emblema_raro_estado_valido");
    pgm.dropColumn("participacoes_desafios", "emblema_raro_avaliado_em");
    pgm.dropColumn("participacoes_desafios", "emblema_raro_avaliado_por");
    pgm.dropColumn("participacoes_desafios", "emblema_raro_estado");
    pgm.dropColumn("participacoes_desafios", "meta_diaria_alvo");
    pgm.dropConstraint("desafios", "desafios_emblema_raro_valido");
    pgm.dropColumn("desafios", "emblema_raro");
};
