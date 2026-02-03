.PHONY: quickstart setup up down restart update rebuild chat logs shell status health configure audit audit-fix backup restore clean skill-install skill-list skill-remove workspace-new workspace-list validate ps help

# default workspace
WORKSPACE ?= default

help:
	@echo "openclaw-docker makefile"
	@echo ""
	@echo "  quick start:"
	@echo "    quickstart       setup + up + chat (first-time users)"
	@echo "    setup            first-time initialization"
	@echo ""
	@echo "  lifecycle:"
	@echo "    up               build and start gateway"
	@echo "    down             stop gateway"
	@echo "    restart          down + up"
	@echo "    update           pull latest image and rebuild"
	@echo "    rebuild          rebuild without cache"
	@echo ""
	@echo "  operations:"
	@echo "    chat             interactive tui (WORKSPACE=name)"
	@echo "    logs             follow container logs"
	@echo "    shell            debug shell access"
	@echo "    status           show model/auth status"
	@echo "    health           health check"
	@echo ""
	@echo "  configuration:"
	@echo "    configure        run onboarding wizard"
	@echo "    audit            security audit"
	@echo "    audit-fix        auto-fix security issues"
	@echo "    validate         validate docker-compose config"
	@echo ""
	@echo "  data management:"
	@echo "    backup           export data/ and workspaces/"
	@echo "    restore FILE=x   import from tarball"
	@echo "    clean            wipe data (with confirmation)"
	@echo ""
	@echo "  skills:"
	@echo "    skill-install SKILL=x    install a skill"
	@echo "    skill-list               list installed skills"
	@echo "    skill-remove SKILL=x     remove a skill"
	@echo ""
	@echo "  workspaces:"
	@echo "    workspace-new NAME=x     create new workspace"
	@echo "    workspace-list           list workspaces"
	@echo ""
	@echo "  utilities:"
	@echo "    ps               show running containers"
	@echo ""

# === quick start ===

quickstart: setup up
	@chmod +x scripts/check-provider.sh
	@if ./scripts/check-provider.sh; then \
		echo ""; \
		echo "starting chat..."; \
		sleep 2; \
		$(MAKE) chat; \
	else \
		echo ""; \
		echo "setup complete."; \
		echo ""; \
		echo "next steps:"; \
		echo "  1. configure your ai provider:"; \
		echo "     make configure        # interactive wizard (free providers available)"; \
		echo ""; \
		echo "     OR add to .env, then restart:"; \
		echo "     ANTHROPIC_API_KEY=sk-ant-..."; \
		echo "     OPENAI_API_KEY=sk-..."; \
		echo "     make restart"; \
		echo ""; \
		echo "  2. start chatting:"; \
		echo "     make chat"; \
		echo ""; \
		echo "docs: docs/PROVIDERS.md"; \
	fi

setup:
	@chmod +x scripts/setup.sh
	@./scripts/setup.sh

# === lifecycle ===

up:
	@echo "building and starting openclaw..."
	docker compose build
	docker compose down --remove-orphans 2>/dev/null || true
	OPENCLAW_WORKSPACE=$(WORKSPACE) docker compose up -d
	@echo "gateway starting at http://127.0.0.1:$${OPENCLAW_GATEWAY_PORT:-18789}"

down:
	docker compose down

restart: down up

update:
	@echo "pulling latest base image and rebuilding..."
	docker compose build --pull
	docker compose down --remove-orphans 2>/dev/null || true
	OPENCLAW_WORKSPACE=$(WORKSPACE) docker compose up -d
	@echo "updated to latest version"

rebuild:
	@echo "rebuilding from scratch..."
	docker compose build --no-cache
	docker compose down --remove-orphans 2>/dev/null || true
	OPENCLAW_WORKSPACE=$(WORKSPACE) docker compose up -d
	@echo "rebuild complete"

# === operations ===

chat:
	@if ! docker compose ps --quiet openclaw-gateway 2>/dev/null | grep -q .; then \
		echo "error: container not running. run 'make up' first."; \
		exit 1; \
	fi
	@echo "connecting to workspace: $(WORKSPACE)"
	@docker compose exec openclaw-gateway sh -c 'node dist/index.js tui --token $$(node -e "console.log(require(\"/home/node/.openclaw/openclaw.json\").gateway.auth.token)")'

logs:
	docker compose logs -f

shell:
	docker compose exec openclaw-gateway /bin/sh

status:
	docker compose exec openclaw-gateway node dist/index.js status

health:
	docker compose exec openclaw-gateway node dist/index.js health

# === configuration ===

configure:
	@if ! docker compose ps --quiet openclaw-gateway 2>/dev/null | grep -q .; then \
		echo "error: container not running. run 'make up' first."; \
		exit 1; \
	fi
	docker compose exec openclaw-gateway node dist/index.js onboard

# alias for configure (mentioned in some docs)
onboard: configure

dashboard:
	@if ! docker compose ps --quiet openclaw-gateway 2>/dev/null | grep -q .; then \
		echo "error: container not running. run 'make up' first."; \
		exit 1; \
	fi
	@TOKEN=$$(grep "^OPENCLAW_GATEWAY_TOKEN=" .env | cut -d'=' -f2); \
	PORT=$$(grep "^OPENCLAW_GATEWAY_PORT=" .env | cut -d'=' -f2); \
	PORT=$${PORT:-18789}; \
	echo ""; \
	echo "open in browser:"; \
	echo "http://127.0.0.1:$${PORT}/?token=$${TOKEN}"; \
	echo ""

devices:
	docker compose exec openclaw-gateway node dist/index.js devices list

pair:
	@echo "approving all pending device requests..."
	@docker compose exec openclaw-gateway sh -c 'node dist/index.js devices list --json 2>/dev/null | \
		node -e "const d=JSON.parse(require(\"fs\").readFileSync(0,\"utf8\")); \
		(d.pending||[]).forEach(p=>console.log(p.requestId))"' | \
		while read id; do \
			[ -n "$$id" ] && docker compose exec openclaw-gateway node dist/index.js devices approve "$$id" 2>/dev/null; \
		done
	@echo "done. refresh your browser."

audit:
	docker compose exec openclaw-gateway node dist/index.js security audit --deep

audit-fix:
	docker compose exec openclaw-gateway node dist/index.js security audit --fix

validate:
	@echo "validating docker-compose.yml..."
	@docker compose config --quiet && echo "docker-compose.yml is valid"

# === data management ===

backup:
	@chmod +x scripts/backup.sh
	@./scripts/backup.sh

restore:
ifndef FILE
	@echo "usage: make restore FILE=backup.tar.gz"
	@exit 1
endif
	@chmod +x scripts/restore.sh
	@./scripts/restore.sh $(FILE)

clean:
	@echo "this will remove all data and workspaces"
	@read -p "are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	rm -rf data workspaces
	@echo "cleaned"

# === skills ===

skill-install:
ifndef SKILL
	@echo "usage: make skill-install SKILL=skill-name"
	@exit 1
endif
	docker compose exec openclaw-gateway npm install -g $(SKILL)
	@echo "skill $(SKILL) installed"

skill-list:
	docker compose exec openclaw-gateway npm list -g --depth=0

skill-remove:
ifndef SKILL
	@echo "usage: make skill-remove SKILL=skill-name"
	@exit 1
endif
	docker compose exec openclaw-gateway npm uninstall -g $(SKILL)
	@echo "skill $(SKILL) removed"

# === workspaces ===

workspace-new:
ifndef NAME
	@echo "usage: make workspace-new NAME=workspace-name"
	@exit 1
endif
	@if [ -d "workspaces/$(NAME)" ]; then \
		echo "workspace $(NAME) already exists"; \
		exit 1; \
	fi
	@mkdir -p workspaces/$(NAME)
	@cp -r templates/workspace/* workspaces/$(NAME)/
	@echo "workspace $(NAME) created"
	@echo "customize files in workspaces/$(NAME)/"
	@echo "use with: make chat WORKSPACE=$(NAME)"

workspace-list:
	@echo "available workspaces:"
	@ls -1 workspaces 2>/dev/null || echo "  (none - run 'make setup' first)"

# === utilities ===

ps:
	@echo "running containers:"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "resource usage:"
	@docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
