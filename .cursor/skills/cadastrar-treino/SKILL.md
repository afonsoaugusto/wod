---
name: cadastrar-treino
description: >-
  Cadastra o treino do dia no app WOD (JSON em public/timer/workouts, índice,
  seed MongoDB, commit/push). Use when the user asks to cadastrar treino, WOD
  do dia, registrar workout, seed:today, or @wod com a planilha do treino.
---

# Cadastrar treino (WOD)

Repo: `/Users/azos/projetos/pinga/wod` (remoto `afonsoaugusto/wod`, branch `main`).

## Inputs

1. **Texto do treino** (partes/sets/reps/descansos) — obrigatório
2. **Data** — default hoje em `America/Sao_Paulo` (`YYYY-MM-DD`)
3. **Commit/push** — só se o usuário pedir
4. **Seed MongoDB** — default sim (associa a grupos/alunos)

## Workflow

```
Progresso:
- [ ] 1. Parsear partes → blocos do timer
- [ ] 2. Criar public/timer/workouts/YYYY-MM-DD.json
- [ ] 3. Atualizar public/timer/workouts/index.json (ordenar)
- [ ] 4. Seed MongoDB (npm run seed:today / script)
- [ ] 5. Commit + push na main (se pedido)
```

### 1. Parsear → JSON

Espelhar o padrão de treinos datados (ex. `2026-07-28.json`, `2026-07-31.json`).

| Campo | Valor |
|-------|--------|
| `id` | `YYYY-MM-DD` |
| `name` | `DD/MM — <dia da semana>` (ex. `31/07 — Sexta`) |
| `description` | resumo curto das partes |
| `classic` | `false` |
| `config.weightUnit` | `kg` |
| `config.restBetweenBlocks` | `90` (salvo indicação contrária) |

**Modos** (`config.blockList[].mode`):

| Texto do coach | mode | Campos-chave |
|----------------|------|----------------|
| Aquecimento / livre com tempo (ex. `5'`) | `amrap` | `timeCapMinutes` = minutos |
| `N' x M sets` / EMOM / a cada N' | `emom` | `totalMinutes` = **nº de intervalos**, `intervalSeconds` = segundos do intervalo |
| Sets com descanso entre (ex. `4 sets … rest 3'`) | `sequential` | repetir o exercício N vezes; `restSeconds` no exercício (último vazio) |
| RFT / chipper / for time | `fortime` | listar exercícios; descanso como exercício `Descanso` se fizer sentido |
| AMRAP clássico | `amrap` | `timeCapMinutes` |

**Categorias**: `alongamento` | `tecnica` | `wod`  
**exerciseView**: `list` (default) ou `cards` (EMOM multi-estação).

Cada exercício:

```json
{ "name": "", "reps": "", "weightM": "", "weightF": "", "restSeconds": "" }
```

Notas de parsing:
- `2,5'` → `150` segundos; `3'` → `180`; `60"` → `60`
- Em **EMOM**, `totalMinutes` é o número de rounds/intervalos (nome legado), **não** minutos de relógio
- Sets com 2 movimentos + rest no fim do set: sequenciar movimentos; colocar `restSeconds` no último movimento do set (exceto o último set)

### 2–3. Arquivos

1. Escrever `public/timer/workouts/<id>.json`
2. Incluir `<id>` em `index.json` → array `workouts` ordenado
3. Opcional: `npm run workouts:index` (com Node) ou editar o índice manualmente

### 4. Seed MongoDB

```bash
# Node local:
MONGODB_URI="..." WORKOUT_ID=YYYY-MM-DD SCHEDULED_FOR=YYYY-MM-DD npm run seed:today

# Sem Node local (Podman):
podman run --rm \
  -v /Users/azos/projetos/pinga/wod:/app -w /app \
  -e MONGODB_URI -e MONGODB_DB=wod \
  -e WORKOUT_ID=YYYY-MM-DD -e SCHEDULED_FOR=YYYY-MM-DD \
  docker.io/library/node:22-alpine \
  sh -c 'node scripts/seed-today-workout.mjs'
```

`MONGODB_URI`: preferir `.env.local` / Vercel env pull. **Nunca** commitá-la. Não imprimir a URI completa no chat.

Sucesso típico: `✓ group … ← <title> (YYYY-MM-DD)`.

### 5. Git (só se pedido)

Escopo do commit do treino: apenas o JSON novo + `index.json`.

```bash
cd /Users/azos/projetos/pinga/wod
git add public/timer/workouts/YYYY-MM-DD.json public/timer/workouts/index.json
git commit -m "$(cat <<'EOF'
feat: cadastra treino de DD/MM (<resumo curto>)

EOF
)"
git push origin main
```

Push em `main` dispara deploy Vercel.

## Checklist final

- [ ] Timer carrega: `/timer?wod=YYYY-MM-DD`
- [ ] Assignment no Mongo com `scheduledFor` = data
- [ ] Sem secrets no commit
- [ ] Push ok (se pedido)

## Anti-padrões

- Não misturar mudanças de app com o commit do treino do dia
- Não usar senha/URI de transcript antigo sem validar (auth fail → puxar env atual)
- Não inventar cargas se o texto não tiver pesos
