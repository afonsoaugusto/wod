# Planejamento futuro — WOD Timer

Documento de roadmap com base na revisão do projeto e nas entregas da versão atual.

## Entregue nesta versão

- [x] Salvar e carregar WODs personalizados (`localStorage`)
- [x] Templates clássicos: Cindy, Murph, Fran, Grace, Helen
- [x] Preview de duração estimada antes de iniciar
- [x] Botão **Concluído** no modo For Time (sem time cap)
- [x] Sincronização de rounds AMRAP entre tela e controle remoto
- [x] Campos de peso sugerido M/F por exercício
- [x] Unidade de peso configurável (lb padrão / kg)
- [x] Calculadora de barra com tabela de percentuais
- [x] Testes unitários para lógica nova

---

## Curto prazo (próximas 2–4 semanas)

### Persistência e fluxo do coach

| Item | Descrição | Prioridade |
|------|-----------|------------|
| Exportar/importar WOD | JSON para compartilhar entre dispositivos e coaches | Alta |
| Biblioteca de exercícios | Autocomplete a partir de exercícios já usados | Alta |
| Reordenar exercícios | Drag-and-drop ou botões ↑↓ na lista | Média |
| Sincronizar config automaticamente | Enviar alterações ao remoto sem botão manual | Média |

### Timer e treino

| Item | Descrição | Prioridade |
|------|-----------|------------|
| Tabata customizável | Intervalos 30/15, 40/20 além de 20/10 | Alta |
| Modo Chipper / RFT | N rounds de uma lista com descanso entre rounds | Média |
| Barra de progresso do treino | % total do WOD além do anel da fase | Média |
| Destaque `.current` na lista AMRAP | Exercício em foco durante o bloco | Baixa |

### Interface

| Item | Descrição | Prioridade |
|------|-----------|------------|
| QR Code no pareamento | Escanear código abre `remote.html?code=XXX` | Alta |
| Confirmação ao Parar | Evitar toque acidental | Média |
| Seletor de tema no menu ⚙ | Em vez de só ciclar com o botão 🌙 | Baixa |

---

## Médio prazo (1–3 meses)

### PWA e offline

- `manifest.json` + ícones para instalar no iPad
- Service worker para páginas estáticas e calculadora offline
- Splash screen e orientação bloqueada em paisagem na tela

### Áudio e acessibilidade

- Voz em português (opção PT-BR / EN)
- Volume separado para apitos e voz
- Modo alto contraste para projetor / luz forte

### Controle remoto

- Reconexão automática com último código
- Indicador de latência / qualidade da conexão
- PIN opcional no pareamento (segurança em rede aberta)
- Substituir ou complementar PeerJS com sinalização própria

### Histórico

- Registro local de treinos concluídos (data, tempo, rounds)
- Melhor tempo / mais rounds por WOD salvo (leaderboard local)

---

## Longo prazo (3+ meses)

### Arquitetura

- Refatorar `app.js` em módulos: `timer.js`, `audio.js`, `setup-ui.js`, `storage.js`
- Reduzir HTML duplicado entre `index.html` e `display.html`
- Testes de integração com Playwright (timer, remoto, calculadora)

### Funcionalidades avançadas

- Modo “só relógio” (countdown / count-up livre)
- Metrônomo configurável no EMOM
- Coach view: timeline completa do treino na tela
- Integração com APIs de boxes (Wodify, SugarWOD) — avaliar demanda
- Múltiplos atletas / heats na mesma tela

### Calculadora de barra

- Presets de anilhas customizáveis (box com kit limitado)
- Suporte a barra técnica / EZ
- Modo “só uma lateral” para ajuste fino

---

## Débito técnico conhecido

1. **`app.js` monolítico** — difícil testar UI e timer isoladamente
2. **PeerJS via CDN** — dependência externa; falha em redes restritas
3. **Preferências em `sessionStorage`** — tema e prefs somem ao fechar aba (WODs salvos já usam `localStorage`)
4. **Testes só em `core.js`** — `sync.js` e fluxo do timer sem cobertura automatizada
5. **Prep countdown** — agora cancelável ao parar; validar em todos os fluxos remotos

---

## Métricas de sucesso sugeridas

- Coach configura e inicia um WOD em menos de 2 minutos
- Pareamento remoto em menos de 30 segundos na mesma rede
- Zero perda de configuração ao recarregar a página (WODs salvos)
- Calculadora de barra: resultado correto para 95% dos pesos comuns de box

---

*Última atualização: junho de 2026*
