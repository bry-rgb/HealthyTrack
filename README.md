# 🐸 WaterKraft

O **WaterKraft** é uma aplicação web focada no acompanhamento de hábitos relacionados com a saúde e o bem-estar, começando pelo registo e acompanhamento do consumo diário de água.

O projeto está a ser desenvolvido como forma de aprendizagem prática de desenvolvimento web Full Stack, desde a criação da interface até à implementação de uma API, autenticação de utilizadores e persistência de dados numa base de dados.

## 🎯 Objetivo

O objetivo do WaterKraft é permitir que os utilizadores acompanhem os seus hábitos diários de forma simples e intuitiva, começando pela hidratação e criando uma base para futuras funcionalidades relacionadas com o bem-estar.

## ✨ Funcionalidades

### Hidratação
- Registo do consumo de água.
- Histórico dos registos de consumo.
- Definição de uma meta diária de água.
- Consulta de estatísticas diárias de consumo.
- Acompanhamento do progresso em relação à meta estabelecida.
- Tarot da Hidratação com tiragem de três cartas, significados e cartas invertidas.

### Utilizadores e autenticação
- Criação de contas de utilizador.
- Início de sessão com email e palavra-passe.
- Proteção de rotas através de autenticação com tokens JWT.
- Associação dos registos de água ao respetivo utilizador.

### Dados e persistência
- Armazenamento dos dados numa base de dados PostgreSQL.
- Persistência das metas e dos registos de água.
- Utilização de migrações para gerir a estrutura da base de dados.

### Qualidade do código
- Testes automatizados com Jest e Supertest.
- Verificação da qualidade do código com ESLint.
- Integração contínua através do GitHub Actions.

## 🛠️ Tecnologias

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express
- PostgreSQL
- `pg`
- `bcrypt`
- JSON Web Tokens (JWT)

### Ferramentas de desenvolvimento
- Docker e Docker Compose
- `node-pg-migrate`
- Jest
- Supertest
- ESLint
- Git e GitHub
- GitHub Actions

## 📁 Estrutura do projeto

```text
healthy-track/
├── .github/
│   └── workflows/
├── backend/
│   ├── server.js
│   ├── server.test.js
│   ├── validacoes.test.js
│   ├── package.json
│   └── ...
├── frontend/
│   ├── index.html
│   ├── script.js
│   └── ...
└── README.md
```

## 🗄️ Base de dados

O projeto utiliza PostgreSQL para armazenar os dados dos utilizadores, os registos de água e as respetivas metas.

A estrutura da base de dados é gerida através de migrações, permitindo acompanhar a evolução do esquema ao longo do desenvolvimento.

O ambiente de desenvolvimento utiliza Docker Compose para executar o PostgreSQL, aplicar as migrações pendentes e preparar dados de demonstração quando a base ainda não tem utilizadores. Se já existirem utilizadores, o seed é ignorado e os dados existentes são preservados.

Para iniciar os serviços, configura `DB_PASSWORD` e `JWT_SECRET` no ficheiro `.env` e executa `docker compose up --build`. A conta local de demonstração é `demo@waterkraft.local`, com a palavra-passe `WaterkraftDemo2026!`. Esta conta é criada apenas numa base vazia e destina-se ao ambiente local do projeto.

## 🧪 Testes e qualidade do código

Os testes automatizados verificam o comportamento da API e as validações implementadas.

Para executar os testes, abre um terminal na pasta `backend` e executa:

```bash
npm test
```

Para verificar a qualidade do código, executa:

```bash
npm run lint
```

Para executar os testes do front-end, a partir da pasta principal:

```bash
npm --prefix frontend test
```

## 🚀 Estado do projeto

O WaterKraft encontra-se em desenvolvimento, com funcionalidades de hidratação, autenticação, persistência de dados e testes automatizados já implementadas.

O projeto continua a evoluir à medida que são consolidados os conhecimentos de desenvolvimento Full Stack.

## 📌 Objetivo de aprendizagem

Este projeto tem como objetivo consolidar conhecimentos de desenvolvimento web, incluindo:

- Estruturação de páginas com HTML.
- Estilização com CSS.
- Programação com JavaScript.
- Manipulação do DOM.
- Desenvolvimento de APIs REST.
- Autenticação e autorização.
- Bases de dados relacionais e SQL.
- Testes automatizados.
- Controlo de versões com Git.
- Integração contínua.
