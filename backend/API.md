# HealthyTrack API

## Verificar se a API está a funcionar

- **Método:** `GET`
- **Endpoint:** `/api`
- **Autenticação:** não necessária

### Resposta de sucesso — `200 OK`

```json
{
  "mensagem": "HealthyTrack API está funcionando!"
}
```

## Consultar registos de água

- **Método:** `GET`
- **Endpoint:** `/api/registros-agua`
- **Autenticação:** JWT obrigatório
- **Descrição:** devolve os registos de água do utilizador autenticado.

### Resposta de sucesso — `200 OK`

Devolve um array de registos. Cada registo contém os campos devolvidos pela tabela `registro_agua`, incluindo:

- `id`
- `quantidade`
- `horario`
- `criado_em`
- `usuario_id`

### Erro — `500 Internal Server Error`

```json
{
  "mensagem": "Erro ao buscar registros de água"
}
```

## Registar água

- **Método:** `POST`
- **Endpoint:** `/api/registros-agua`
- **Autenticação:** JWT obrigatório
- **Descrição:** regista uma nova quantidade de água para o utilizador autenticado.

### Corpo do pedido

```json
{
  "quantidade": 0.5,
  "horario": "2026-11-01T10:30:00"
}
```

- `quantidade`: número maior que `0` e menor ou igual a `0.5`.
- `horario`: data e hora válidas.

### Resposta de sucesso — `200 OK`

```json
{
  "mensagem": "Registro de água recebido com sucesso!"
}
```

### Erro — `400 Bad Request`

```json
{
  "mensagem": "Dados inválidos"
}
```

### Erro — `500 Internal Server Error`

```json
{
  "mensagem": "Erro ao inserir registro de água"
}
```

## Criar utilizador

- **Método:** `POST`
- **Endpoint:** `/api/usuarios`
- **Autenticação:** não necessária
- **Descrição:** cria uma conta de utilizador.

### Corpo do pedido

```json
{
  "nome": "Ana",
  "email": "ana@example.com",
  "senha": "senha123"
}
```

- `nome`, `email` e `senha` são obrigatórios.
- O email tem de ter um formato válido.
- A senha deve ter pelo menos 8 caracteres.

### Resposta de sucesso — `201 Created`

```json
{
  "mensagem": "Usuário criado com sucesso!"
}
```

### Erro — `400 Bad Request`

Se faltar algum campo:

```json
{
  "mensagem": "Nome, email e senha são obrigatórios"
}
```

Se o formato do email for inválido:

```json
{
  "mensagem": "O formato do email é inválido"
}
```

Se a senha tiver menos de 8 caracteres:

```json
{
  "mensagem": "A senha deve ter pelo menos 8 caracteres"
}
```

### Erro — `409 Conflict`

Se o email já estiver registado:

```json
{
  "mensagem": "Este email já está cadastrado"
}
```

### Erro — `500 Internal Server Error`

```json
{
  "mensagem": "Erro ao criar usuário"
}
```

## Iniciar sessão

- **Método:** `POST`
- **Endpoint:** `/api/login`
- **Autenticação:** não necessária
- **Descrição:** autentica o utilizador e devolve um token JWT válido durante 1 hora.

### Corpo do pedido

```json
{
  "email": "ana@example.com",
  "senha": "senha123"
}
```

### Resposta de sucesso — `200 OK`

```json
{
  "mensagem": "Login realizado com sucesso!",
  "token": "<token JWT>",
  "usuario": {
    "id": 1,
    "nome": "Ana",
    "email": "ana@example.com"
  }
}
```

### Erro — `400 Bad Request`

Se faltar o email ou a senha:

```json
{
  "mensagem": "Email e senha são obrigatórios"
}
```

Se o formato do email for inválido:

```json
{
  "mensagem": "Email inválido"
}
```

### Erro — `401 Unauthorized`

Se o email ou a senha estiverem incorretos:

```json
{
  "mensagem": "Email ou senha incorretos"
}
```

### Erro — `500 Internal Server Error`

```json
{
  "mensagem": "Erro interno de servidor"
}
```

## Apagar registos de água

- **Método:** `DELETE`
- **Endpoint:** `/api/registros-agua`
- **Autenticação:** JWT obrigatório
- **Descrição:** apaga todos os registos de água do utilizador autenticado.

### Resposta de sucesso — `200 OK`

```json
{
  "mensagem": "Registros de água apagadoscom sucesso!"
}
```

### Erro — `500 Internal Server Error`

```json
{
  "mensagem": "Erro ao apagar registros de água"
}
```

## Consultar meta diária

- **Método:** `GET`
- **Endpoint:** `/api/meta-diaria`
- **Autenticação:** JWT obrigatório
- **Descrição:** devolve a meta diária de hidratação do utilizador autenticado.

### Resposta de sucesso — `200 OK`

```json
{
  "meta_diaria": 2.5
}
```

### Erro — `404 Not Found`

```json
{
  "mensagem": "Utilizador não encontrado"
}
```

### Erro — `500 Internal Server Error`

```json
{
  "mensagem": "Erro ao buscar meta diária"
}
```

## Consultar estatísticas diárias

- **Método:** `GET`
- **Endpoint:** `/api/estatisticas-diarias`
- **Autenticação:** JWT obrigatório
- **Descrição:** devolve o total de água registado por dia pelo utilizador autenticado, desde há 6 dias até hoje.

### Resposta de sucesso — `200 OK`

Devolve um array com uma entrada por dia, incluindo dias sem registos. Exemplo parcial:

```json
[
  {
    "data": "2026-10-26T00:00:00.000Z",
    "total_litros": "1.5"
  },
  {
    "data": "2026-10-27T00:00:00.000Z",
    "total_litros": "0"
  }
]
```

### Erro — `500 Internal Server Error`

```json
{
  "mensagem": "Erro ao buscar estatísticas diárias"
}
```

## Atualizar meta diária

- **Método:** `PUT`
- **Endpoint:** `/api/meta-diaria`
- **Autenticação:** JWT obrigatório
- **Descrição:** atualiza a meta diária do utilizador autenticado.
- **Corpo do pedido:** `meta_diaria` deve ser um número entre `0.5` e `10`, inclusive.

### Exemplo do corpo do pedido

```json
{
  "meta_diaria": 2.5
}
```

### Resposta de sucesso — `200 OK`

```json
{
  "mensagem": "Meta diária atualizadacom sucesso",
  "meta_diaria": 2.5
}
```

### Erro — `400 Bad Request`

```json
{
  "mensagem": "A meta diária deve estar entre 0,5 e 10 litros"
}
```

### Erro — `404 Not Found`

```json
{
  "mensagem": "Utilizador não encontrado"
}
```

### Erro — `500 Internal Server Error`

```json
{
  "mensagem": "Erro ao atualizar meta diária"
}
```