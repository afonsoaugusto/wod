NODE_IMAGE ?= docker.io/library/node:22-alpine
WORKDIR    := /app

.PHONY: test test-podman shell

# Roda testes localmente (requer Node.js 20+)
test:
	node --test tests/*.test.js

# Roda testes em container Podman (não precisa instalar Node)
test-podman:
	podman run --rm \
		-v "$(CURDIR):$(WORKDIR)" \
		-w $(WORKDIR) \
		$(NODE_IMAGE) \
		node --test tests/*.test.js

# Shell interativo no container para depuração
shell:
	podman run --rm -it \
		-v "$(CURDIR):$(WORKDIR)" \
		-w $(WORKDIR) \
		$(NODE_IMAGE) \
		sh
