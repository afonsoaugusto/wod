# WOD Timer

Contador de tempo para treinos de CrossFit, otimizado para iPad em modo paisagem.

## Páginas

| Página | URL | Uso |
|--------|-----|-----|
| Timer | [index.html](index.html) | Tudo no mesmo dispositivo |
| Tela | [display.html](display.html) | iPad — relógio e exercícios |
| Controle | [remote.html](remote.html) | Celular — configurar e comandar |
| Barra | [bar-calculator.html](bar-calculator.html) | Anilhas por lado e tabela de % |
| Sobre | [about.html](about.html) | Guia completo + redes |

## Controle remoto

1. iPad abre **display.html** → anote o código de 6 letras
2. Celular abre **remote.html** → digite o código → **Conectar**
3. Configure o WOD no celular → **Iniciar na tela**

Requer mesma rede Wi‑Fi e internet (sinalização WebRTC via PeerJS).

## Testes

Com Node.js 20+ instalado:

```bash
npm test
# ou
make test
```

Sem Node — via Podman:

```bash
make test-podman
```

CI roda automaticamente no GitHub Actions a cada push/PR na branch `main`.

## WODs salvos e clássicos

- **Salvar** — digite um nome e toque em **Salvar** (até 30 WODs no navegador).
- **Carregar** — seletor com 16 benchmarks pré-cadastrados (Girls, Murph ★) e os seus salvos.
- **Pesos M/F** — campos opcionais por exercício; unidade em lb (padrão) ou kg no setup ou menu ⚙.

## Calculadora de barra

Em [bar-calculator.html](bar-calculator.html): informe barra e peso alvo para ver anilhas por lado. Tabela de **50%–110%** com base no peso de referência.

## Temas

Botão ao lado do ⚙ alterna: **Escuro** → **Claro** → **Neon** → **Âmbar** → **Oceano**. Preferência salva na sessão do navegador.

## Planejamento

Roadmap em [PLANEJAMENTO-FUTURO.md](PLANEJAMENTO-FUTURO.md).

## GitHub Pages

[https://afonsorodrigues.com/wod/](https://afonsorodrigues.com/wod/)
