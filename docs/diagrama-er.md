# Diagrama entidade-relacionamento

O diagrama representa o esquema PostgreSQL atual do HealthyTrack. A tabela `participacoes_desafios` resolve a relação muitos-para-muitos entre utilizadores e desafios: cada linha associa um utilizador a um desafio.

```mermaid
erDiagram
    USUARIOS {
        int id PK
        text nome
        text email UK
        text senha
        text perfil
        numeric meta_diaria
        boolean avaliacao_inicial_concluida
        timestamp criado_em
    }

    DESAFIOS {
        int id PK
        varchar titulo
        text descricao
        date data_inicio
        date data_fim
        int gestor_id FK
        timestamptz criado_em
    }

    PARTICIPACOES_DESAFIOS {
        int desafio_id PK, FK
        int usuario_id PK, FK
        timestamptz criado_em
    }

    REGISTRO_AGUA {
        int id PK
        numeric quantidade
        timestamp horario
        timestamp criado_em
        int usuario_id FK
    }

    AVALIACAO_INICIAL {
        int id PK
        int usuario_id FK, UK
        text faixa_etaria
        numeric peso
        text atividade
        text exercicio_calor
        text limite_liquidos
        text unidade
    }

    USUARIOS ||--o{ DESAFIOS : "gere como gestor"
    USUARIOS ||--o{ PARTICIPACOES_DESAFIOS : participa
    DESAFIOS ||--o{ PARTICIPACOES_DESAFIOS : recebe
    USUARIOS o|--o{ REGISTRO_AGUA : regista
    USUARIOS ||--o| AVALIACAO_INICIAL : responde
```

`PARTICIPACOES_DESAFIOS` tem uma chave primária composta por `(desafio_id, usuario_id)`. Assim, a base de dados impede que o mesmo utilizador participe duas vezes no mesmo desafio. As duas chaves estrangeiras usam eliminação em cascata: apagar o utilizador ou o desafio também remove as respetivas participações.

As relações `USUARIOS`–`PARTICIPACOES_DESAFIOS` e `DESAFIOS`–`PARTICIPACOES_DESAFIOS` são individualmente um-para-muitos; em conjunto, representam a relação muitos-para-muitos entre utilizadores e desafios.
