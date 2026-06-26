# WOD Timer

Contador de tempo para treinos de CrossFit, com plataforma para coach associar treinos a alunos e grupos.

**Produção:** [wod-sandy.vercel.app](https://wod-sandy.vercel.app)

---

## Arquitetura

Aplicação **única** em Node.js (Next.js 16) na Vercel: frontend, API REST e autenticação no mesmo deploy.

```text
┌─────────────────────────────────────────────────────────────┐
│  Vercel (Next.js App Router)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Páginas app  │  │ API routes   │  │ Timer estático   │  │
│  │ /login       │  │ /api/students│  │ public/timer/    │  │
│  │ /admin       │  │ /api/groups  │  │ → /timer (público)│  │
│  │ /dashboard   │  │ /api/...     │  │                  │  │
│  └──────────────┘  └──────┬───────┘  └──────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │ MongoDB Atlas   │
                   │ users, groups,  │
                   │ assignments     │
                   └─────────────────┘
```

| Camada | Tecnologia |
|--------|------------|
| Frontend + API | Next.js 16 (App Router), React 19 |
| Autenticação | Auth.js (NextAuth v5) — credenciais + JWT |
| Banco | MongoDB Atlas (`users`, `groups`, `assignments`) |
| Deploy | Vercel (build automático no push em `main`) |
| CI | GitHub Actions — testes unitários + `next build` |
| Timer legado | HTML/CSS/JS vanilla em `public/timer/` |

### Papéis de usuário

| Papel | Acesso |
|-------|--------|
| `admin` | Setup inicial; mesmas permissões de coach |
| `coach` | `/admin` — cadastrar alunos, grupos, associar treinos |
| `student` | `/dashboard` — ver próximo treino e histórico |

O **timer** (`/timer`, `/display`, `/remote`, etc.) é **público** e não exige login.

---

## Estrutura do repositório

```text
wod/
├── app/                    # Next.js — páginas e API
│   ├── admin/              # Painel do coach
│   ├── dashboard/          # Painel do aluno
│   ├── login/
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── students/
│       ├── groups/
│       ├── assignments/
│       ├── public/next-workout/   # Sem login — treino por token
│       └── setup/                 # Criação do primeiro admin
├── public/timer/           # Timer estático (preservado da v1)
│   ├── index.html          # → /timer
│   ├── display.html        # → /display
│   ├── remote.html         # → /remote
│   ├── core.js, app.js, …
│   └── workouts/*.json     # Templates de benchmark
├── lib/                    # MongoDB, modelos, guards
├── components/             # Formulários React (login, admin)
├── tests/                  # Testes unitários (core.js)
├── scripts/                # Índice de workouts, seed admin
└── workout-editor/         # Editor desktop Python/Tkinter (offline)
```

---

## Rotas

### Aplicação (Next.js)

| Rota | Auth | Descrição |
|------|------|-----------|
| `/` | Sim | Redireciona para `/admin` ou `/dashboard` |
| `/login` | Não | Login email/senha |
| `/admin` | Coach | Gestão de alunos, grupos e treinos |
| `/dashboard` | Aluno | Próximo treino associado |

### API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `POST` | `/api/setup` | `x-setup-token` | Cria o primeiro admin (uma vez) |
| `GET/POST` | `/api/students` | Coach | Listar / cadastrar alunos |
| `GET/POST` | `/api/groups` | Coach | Listar / criar grupos |
| `GET/POST` | `/api/assignments` | Coach ou aluno | Treinos associados |
| `GET` | `/api/public/next-workout?token=` | Não | Próximo treino do aluno por `shareToken` |

### Timer (estático, sem login)

| URL | Página |
|-----|--------|
| `/timer` | Timer completo no mesmo dispositivo |
| `/display` | Tela do iPad |
| `/remote` | Controle pelo celular |
| `/board` | Quadro |
| `/bar-calculator` | Calculadora de anilhas |
| `/timer?wod=fran` | Carrega template direto |
| `/timer?aluno=<token>` | Carrega próximo treino do aluno (sem login) |

---

## Variáveis de ambiente

Copie `.env.example` para `.env.local` em desenvolvimento. Na Vercel, configure em **Project → Settings → Environment Variables**.

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `MONGODB_URI` | Sim | Connection string do MongoDB Atlas |
| `MONGODB_DB` | Não | Nome do banco (padrão: `wod`) |
| `AUTH_SECRET` | Sim | Segredo para sessões Auth.js (`openssl rand -base64 32`) |
| `SETUP_TOKEN` | Sim* | Token único para `POST /api/setup` (*só até criar o admin) |

**Nunca** commite `.env` ou credenciais reais. O `.gitignore` já exclui arquivos de ambiente.

### Primeiro admin

Após o deploy, com `SETUP_TOKEN` configurado:

```bash
curl -X POST https://SEU-DOMINIO/api/setup \
  -H "Content-Type: application/json" \
  -H "x-setup-token: SEU_SETUP_TOKEN" \
  -d '{"email":"voce@exemplo.com","password":"senhaForte123","name":"Coach"}'
```

Alternativa local/script: `npm run seed:admin` (requer `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MONGODB_URI`).

---

## Desenvolvimento

### Com Node.js 22+

```bash
npm install
cp .env.example .env.local   # edite com suas credenciais
npm run dev                  # http://localhost:3000
npm test                     # testes unitários
npm run build
```

### Sem Node — via Podman

```bash
make test-podman             # testes
make shell                   # shell no container node:22-alpine

# build
podman run --rm -v "$PWD":/app:Z -w /app \
  -e AUTH_SECRET=dev -e MONGODB_URI=mongodb://localhost:27017/wod \
  node:22-alpine npm run build
```

### Atualizar índice de workouts

Após adicionar um JSON em `public/timer/workouts/`:

```bash
npm run workouts:index
# ou: make workouts-index
```

---

## CI (GitHub Actions)

Workflow em `.github/workflows/test.yml`:

1. **Testes unitários** — `node --test tests/*.test.js` (lógica em `public/timer/core.js`)
2. **Build Next.js** — `npm ci && npm run build` (com env placeholders)

Roda em push e pull request na branch `main`.

### Deploy na Vercel

- Repositório conectado à Vercel; cada push em `main` dispara deploy automático.
- Em **repo privado no plano Hobby**, o email do autor do commit deve corresponder à conta Vercel/GitHub vinculada — caso contrário o deploy é bloqueado. Repositório **público** não tem essa restrição.

---

## Timer — funcionalidades

- Modos: sequencial, EMOM, Tabata, AMRAP, For Time
- 16+ benchmarks (Girls, Heroes) em `public/timer/workouts/`
- Salvar até 30 WODs no `localStorage` do navegador
- Pesos M/F por exercício (lb ou kg)
- Controle remoto iPad + celular (WebRTC via PeerJS)
- Calculadora de anilhas com tabela 50%–110%
- Temas: Escuro, Claro, Neon, Âmbar, Oceano

### Controle remoto

1. iPad abre `/display` → anote o código de 6 letras
2. Celular abre `/remote` → digite o código → **Conectar**
3. Configure o WOD no celular → **Iniciar na tela**

Requer mesma rede Wi‑Fi e internet (sinalização PeerJS).

---

## Modelo de dados (MongoDB)

### `users`

```text
email, name, passwordHash, role (admin|coach|student),
coachId?, shareToken? (alunos — link público do timer)
```

### `groups`

```text
name, coachId, studentIds[]
```

### `assignments`

```text
coachId, targetType (student|group), targetId,
title, workoutId?, details?, scheduledFor?
```

Templates de treino continuam em JSON versionado em `public/timer/workouts/`. A associação no banco referencia `workoutId` quando o coach escolhe um template.

---

## Segurança e repositório público

O código **não contém** senhas, tokens ou connection strings reais — apenas placeholders em `.env.example`. Arquivos sensíveis (`.env`, `.vercel/`) estão no `.gitignore`.

É seguro tornar o repositório **público** do ponto de vista de segredos no git. Mantenha sempre as credenciais apenas na Vercel e no MongoDB Atlas.

Pontos de atenção (design, não vazamento no repo):

- `shareToken` do aluno permite ver o próximo treino sem login — trate o link como URL privada.
- `POST /api/setup` deve usar `SETUP_TOKEN` forte e pode ser desabilitado após criar o admin.
- No Atlas, restrinja o usuário do banco ao mínimo necessário; senha forte.

---

## Roadmap

Ver [PLANEJAMENTO-FUTURO.md](PLANEJAMENTO-FUTURO.md).

---

## Licença

Projeto pessoal — uso conforme definido pelo autor.
