# API WaterKraft

Referência das rotas implementadas em `backend/server.js`.

## Base e autenticação

- Em desenvolvimento, a API está normalmente em `http://localhost:3000`; em produção, usa o URL do serviço configurado no deploy.
- Os pedidos e respostas usam JSON quando existe corpo.
- Rotas protegidas usam o cookie de sessão `waterkraft_session`, definido pelo servidor no login. O cookie é `HttpOnly`, `Secure`, `SameSite=Lax` e tem validade de uma hora. O token não é devolvido no corpo JSON.
- O cliente web deve enviar credenciais (`credentials: "include"`). Os pedidos mutáveis protegidos também precisam de um cabeçalho `Origin` permitido pela configuração CORS.
- Sem sessão, com sessão expirada ou revogada, a API responde `401`. Uma origem não permitida num pedido mutável responde `403`.
- Contas novas recebem o perfil `utilizador`. O perfil `gestor_desafios` é atribuído por um operador; não pode ser escolhido no registo.

## Resumo das rotas

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/api` | Público | Verifica se a API responde. |
| `POST` | `/api/usuarios` | Público | Cria uma conta. |
| `POST` | `/api/login` | Público | Inicia sessão e define o cookie. |
| `POST` | `/api/logout` | Origem permitida; cookie opcional | Revoga a sessão, se válida, e limpa o cookie. |
| `GET` | `/api/registros-agua` | Sessão | Consulta os registos do dia/período do utilizador. |
| `POST` | `/api/registros-agua` | Sessão | Regista consumo de água. |
| `DELETE` | `/api/registros-agua` | Sessão | Apaga os registos do utilizador autenticado. |
| `GET` | `/api/meta-diaria` | Sessão | Consulta a meta diária. |
| `PUT` | `/api/meta-diaria` | Sessão | Atualiza a meta diária. |
| `GET` | `/api/estatisticas-diarias` | Sessão | Consulta totais dos últimos sete dias, incluindo hoje. |
| `GET` | `/api/calendario-hidratacao?mes=AAAA-MM` | Sessão | Consulta o calendário de um mês até à data atual. |
| `GET` | `/api/avaliacao-inicial` | Sessão | Consulta dados da avaliação inicial e preferência do aviso. |
| `PUT` | `/api/avaliacao-inicial` | Sessão | Guarda ou atualiza as respostas da avaliação. |
| `PUT` | `/api/avaliacao-inicial/ocultar-aviso` | Sessão | Guarda a preferência para ocultar o aviso. |
| `GET` | `/api/perfil` | Sessão | Consulta estatísticas de sequência de hidratação. |
| `GET` | `/api/desafios` | Sessão | Lista desafios, perfil atual e estado de participação. |
| `POST` | `/api/desafios` | Gestor | Cria um desafio. |
| `PUT` | `/api/desafios/:id` | Gestor proprietário | Atualiza um desafio criado pelo gestor. |
| `DELETE` | `/api/desafios/:id` | Gestor proprietário | Apaga um desafio criado pelo gestor. |
| `POST` | `/api/desafios/:id/participacao` | Utilizador | Adere a um desafio. |
| `DELETE` | `/api/desafios/:id/participacao` | Utilizador | Sai de um desafio. |

## Conta e sessão

### Criar conta

`POST /api/usuarios` não exige sessão. Envia:

```json
{
  "nome": "Ana",
  "email": "ana@example.com",
  "senha": "palavra-passe-segura"
}
```

Os três campos são obrigatórios, o email tem de ter formato válido e a palavra-passe tem de ter pelo menos 8 caracteres. A palavra-passe é guardada com bcrypt. O perfil inicial é `utilizador`.

- `201`: `{"mensagem":"Usuário criado com sucesso!"}`
- `400`: dados em falta ou inválidos.
- `409`: email já registado.
- `500`: erro ao criar a conta.

### Iniciar sessão

`POST /api/login` não exige sessão. Envia `email` e `senha` no corpo JSON. Em sucesso (`200`), o servidor define o cookie de sessão e devolve:

```json
{
  "mensagem": "Login realizado com sucesso!",
  "usuario": {
    "id": 1,
    "nome": "Ana",
    "email": "ana@example.com",
    "avaliacao_inicial_concluida": false
  }
}
```

Erros possíveis: `400` para campos em falta ou email inválido, `401` para credenciais incorretas, `429` quando o limite de tentativas é excedido e `503` se não for possível validar esse limite. O limite usa contadores por conta e por IP.

### Terminar sessão

`POST /api/logout` exige uma origem permitida. Revoga uma sessão válida, limpa o cookie e responde `200` com `{"mensagem":"Sessão terminada com sucesso"}`. É idempotente: também limpa o cookie quando este está ausente ou inválido. Falha ao revogar a sessão responde `503`.

## Hidratação

Todas as rotas desta secção exigem sessão e operam sobre o utilizador autenticado; o cliente não escolhe o `usuario_id`.

### Registos de água

- `GET /api/registros-agua?inicio=<ISO>&fim=<ISO>` devolve um array de registos no intervalo `[inicio, fim)`. Se os limites forem omitidos ou inválidos, usa o dia atual no fuso horário do servidor. Cada linha inclui `id`, `quantidade`, `horario`, `criado_em` e `usuario_id`.
- `POST /api/registros-agua` aceita uma quantidade numérica maior que `0` e até `0.5` litros, e um `horario` parseável:

  ```json
  { "quantidade": 0.5, "horario": "2026-11-01T10:30:00.000Z" }
  ```

  Sucesso: `200` com `{"mensagem":"Registro de água recebido com sucesso!"}`. Dados inválidos: `400`.
- `DELETE /api/registros-agua` apaga todos os registos pertencentes à sessão atual e responde `200` com uma mensagem de sucesso.

Erros de consulta, gravação ou eliminação respondem `500` com uma mensagem no campo `mensagem`.

### Meta diária

- `GET /api/meta-diaria` devolve `{ "meta_diaria": 2.5 }`.
- `PUT /api/meta-diaria` aceita um número entre `0.5` e `10` litros, inclusive:

  ```json
  { "meta_diaria": 2.5 }
  ```

  Sucesso: `200` com a meta atualizada. Valor inválido: `400`; utilizador inexistente: `404`.

### Estatísticas e calendário

- `GET /api/estatisticas-diarias` devolve um array com `data` (`AAAA-MM-DD`) e `total_litros` para cada um dos últimos sete dias, incluindo dias sem consumo.
- `GET /api/calendario-hidratacao?mes=2026-11` devolve um array diário até hoje, com `data`, `total_litros`, `meta_diaria` e `meta_cumprida`. Exige `mes` no formato `AAAA-MM`; mês inválido, anterior ao ano 2000 ou futuro responde `400`.

### Avaliação inicial

- `PUT /api/avaliacao-inicial` cria ou atualiza as respostas e marca a avaliação da conta como concluída. Campos aceites:

  ```json
  {
    "faixa_etaria": "18-64",
    "peso": 70,
    "atividade": "moderada",
    "exercicio_calor": "raramente",
    "limite_liquidos": "nao",
    "unidade": "L"
  }
  ```

  Opções válidas: `faixa_etaria` = `13-17`, `18-64`, `65+`; `atividade` = `baixa`, `moderada`, `alta`; `exercicio_calor` = `raramente`, `algumas-vezes`, `frequentemente`; `limite_liquidos` = `nao`, `sim`, `nao-sei`; `unidade` = `L`, `mL`. `peso` é opcional, mas se enviado deve ser maior que 0 e menor que 500. Dados inválidos respondem `400`; sucesso responde `200`.
- `GET /api/avaliacao-inicial` devolve `limite_liquidos` e `ocultar_aviso_meta`; se ainda não existir avaliação, responde `404`.
- `PUT /api/avaliacao-inicial/ocultar-aviso` define `ocultar_aviso_meta` como `true` e responde `200`.

### Perfil de progresso

`GET /api/perfil` devolve `nome`, `dias_hidratado`, `sequencia_atual` e `maior_sequencia` para a conta autenticada. Utilizador inexistente responde `404`.

## Perfis e desafios

Os perfis são `utilizador` e `gestor_desafios`. O backend confirma o perfil atual na base de dados para cada operação restrita. Um gestor só pode alterar ou apagar desafios que criou.

### Consultar desafios

`GET /api/desafios` devolve:

```json
{
  "perfil": "utilizador",
  "utilizador_id": 7,
  "desafios": [
    {
      "id": 12,
      "titulo": "Semana da Hidratação",
      "descricao": "Regista a tua hidratação durante sete dias.",
      "data_inicio": "2026-11-15",
      "data_fim": "2026-11-22",
      "gestor_id": 2,
      "gestor_nome": "Gestor",
      "criado_em": "2026-11-14T12:00:00.000Z",
      "participa": false,
      "total_participantes": 0
    }
  ]
}
```

`participa` indica se a conta atual está inscrita; `total_participantes` é a contagem total.

### Criar, editar e apagar desafios

As três operações exigem perfil `gestor_desafios` e origem permitida nos pedidos mutáveis. O corpo de `POST /api/desafios` e `PUT /api/desafios/:id` é:

```json
{
  "titulo": "Semana da Hidratação",
  "descricao": "Regista a tua hidratação durante sete dias.",
  "data_inicio": "2026-11-15",
  "data_fim": "2026-11-22"
}
```

O título deve ter entre 3 e 100 caracteres; a descrição é obrigatória e tem até 2000 caracteres; as datas têm de ser datas válidas no formato `AAAA-MM-DD`, e a data final não pode anteceder a inicial.

- `POST /api/desafios`: `201` e o desafio criado.
- `PUT /api/desafios/:id`: `200` e o desafio atualizado.
- `DELETE /api/desafios/:id`: `200` com `{"mensagem":"Desafio eliminado com sucesso"}`.
- Perfil insuficiente: `403`; ID ou dados inválidos: `400`; desafio inexistente ou não pertencente ao gestor: `404`.

### Participar num desafio

As operações de participação estão disponíveis para o perfil `utilizador`. Cada adesão é guardada em `participacoes_desafios`; a chave primária composta `(desafio_id, usuario_id)` impede inscrições duplicadas.

- `POST /api/desafios/:id/participacao`: adere ao desafio. Primeira adesão responde `201`; repetir a adesão responde `200` sem criar duplicado.
- `DELETE /api/desafios/:id/participacao`: remove a adesão e responde `200`. Se a conta não estava inscrita, responde também `200` com uma mensagem informativa.
- ID inválido: `400`; desafio inexistente: `404`; gestor ou sessão ausente: `403` ou `401`, respetivamente.

## Códigos de estado comuns

- `200 OK`: pedido concluído.
- `201 Created`: conta, desafio ou participação criada.
- `400 Bad Request`: corpo ou parâmetros inválidos.
- `401 Unauthorized`: sessão ausente, inválida, expirada ou revogada.
- `403 Forbidden`: origem ou perfil sem autorização.
- `404 Not Found`: recurso ou conta não encontrado.
- `409 Conflict`: email já registado.
- `429 Too Many Requests`: limite de tentativas de login excedido; pode incluir `Retry-After`.
- `500 Internal Server Error` / `503 Service Unavailable`: falha interna ou indisponibilidade de uma dependência.
