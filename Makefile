.PHONY: quickstart resume setup up down restart update rebuild wait-ready chat logs shell status health configure onboard dashboard devices pair pairing audit audit-fix doctor doctor-fix backup restore clean skill-install skill-list skill-remove workspace-new workspace-list validate validate-env ps info infra-check help test test-quick test-validate-env infra-init infra-plan infra-apply infra-destroy infra-output

# default workspace
WORKSPACE ?= default

# wait-ready timeout (seconds)
WAIT_TIMEOUT ?= 120

help:
	@echo "openclaw-docker makefile"
	@echo ""
	@echo "  quick start:"
	@echo "    quickstart       setup + up + chat (first-time users)"
	@echo "    resume           start (if needed) and chat"
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
	@echo "    info             show workspace, provider, and container status"
	@echo ""
	@echo "  configuration:"
	@echo "    configure        run onboarding wizard"
	@echo "    pairing          approve channel pairing code (CODE=x, CHANNEL=telegram)"
	@echo "    audit            security audit"
	@echo "    audit-fix        auto-fix security issues"
	@echo "    doctor           health diagnostics"
	@echo "    doctor-fix       auto-fix diagnosed issues"
	@echo "    validate         validate docker-compose config"
	@echo "    validate-env     validate .env configuration"
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
	@echo "    infra-check      deployment readiness checks"
	@echo ""
	@echo "  testing:"
	@echo "    test             run full test suite"
	@echo "    test-quick       infrastructure tests only (no container)"
	@echo ""
	@echo "  infrastructure (hetzner):"
	@echo "    infra-init       initialize opentofu"
	@echo "    infra-plan       preview infrastructure changes"
	@echo "    infra-apply      create/update infrastructure"
	@echo "    infra-destroy    tear down infrastructure"
	@echo "    infra-output     show infrastructure outputs"
	@echo ""

# === quick start ===

quickstart: setup up wait-ready
	@chmod +x scripts/auto-pair-first.sh
	@./scripts/auto-pair-first.sh &
	@chmod +x scripts/check-provider.sh
	@if ./scripts/check-provider.sh; then \
		echo ""; \
		echo "starting chat..."; \
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

resume:
	@if docker compose ps --quiet openclaw-gateway 2>/dev/null | grep -q .; then \
		echo "gateway already running"; \
	else \
		echo "starting gateway..."; \
		OPENCLAW_WORKSPACE=$(WORKSPACE) docker compose up -d; \
	fi
	@$(MAKE) wait-ready
	@$(MAKE) chat

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

wait-ready:
	@if ! docker compose ps --quiet openclaw-gateway 2>/dev/null | grep -q .; then \
		echo "error: container not running. run 'make up' first."; \
		exit 1; \
	fi
	@printf "waiting for gateway to be ready (timeout: $(WAIT_TIMEOUT)s)..."
	@i=0; while [ $$i -lt $(WAIT_TIMEOUT) ]; do \
		status=$$(docker compose ps openclaw-gateway --format "{{.Health}}" 2>/dev/null); \
		if [ "$$status" = "healthy" ]; then echo " ready"; exit 0; fi; \
		if docker compose exec -T openclaw-gateway node openclaw.mjs health >/dev/null 2>&1; then \
			echo " ready"; exit 0; \
		fi; \
		printf "."; sleep 1; i=$$((i + 1)); \
	done; echo " timeout"; echo "error: gateway failed to become ready"; docker compose ps; docker compose logs --tail=50; exit 1

# === operations ===

chat: wait-ready
	@echo "connecting to workspace: $(WORKSPACE)"
	@TOKEN=$$(grep "^OPENCLAW_GATEWAY_TOKEN=" .env | cut -d'=' -f2); \
	docker compose exec openclaw-gateway node openclaw.mjs tui --token "$$TOKEN"

logs:
	docker compose logs -f

shell:
	docker compose exec openclaw-gateway /bin/sh

status:
	docker compose exec openclaw-gateway node openclaw.mjs status

health:
	docker compose exec openclaw-gateway node openclaw.mjs health

info:
	@echo "openclaw-docker status"
	@echo "====================="
	@echo ""
	@echo "  workspace:  $(WORKSPACE)"
	@if [ -f .env ]; then \
		TOKEN=$$(grep "^OPENCLAW_GATEWAY_TOKEN=" .env | cut -d'=' -f2); \
		echo "  token:      $${TOKEN:0:8}..."; \
		PROVIDERS=$$(grep "_API_KEY=" .env | grep -v "^#" | grep -v "=$$" | \
			sed 's/_API_KEY=.*//' | tr '[:upper:]' '[:lower:]' | \
			tr '\n' ', ' | sed 's/,$$//'); \
		if [ -n "$$PROVIDERS" ]; then \
			echo "  providers:  $$PROVIDERS"; \
		else \
			echo "  providers:  (none configured - run 'make configure')"; \
		fi; \
	else \
		echo "  .env:       missing (run 'make setup')"; \
	fi
	@STATUS=$$(docker compose ps openclaw-gateway --format "{{.Status}}" 2>/dev/null) || true; \
	if [ -n "$$STATUS" ]; then \
		echo "  container:  $$STATUS"; \
	else \
		echo "  container:  not running"; \
	fi
	@echo ""

# === configuration ===

configure: wait-ready
	docker compose exec openclaw-gateway node openclaw.mjs onboard

# alias for configure (mentioned in some docs)
onboard: configure

dashboard: wait-ready
	@TOKEN=$$(grep "^OPENCLAW_GATEWAY_TOKEN=" .env | cut -d'=' -f2); \
	PORT=$$(grep "^OPENCLAW_GATEWAY_PORT=" .env | cut -d'=' -f2); \
	PORT=$${PORT:-18789}; \
	echo ""; \
	echo "open in browser:"; \
	echo "http://127.0.0.1:$${PORT}/?token=$${TOKEN}"; \
	echo ""

devices:
	docker compose exec openclaw-gateway node openclaw.mjs devices list

pair:
	@echo "approving all pending device requests..."
	@docker compose exec openclaw-gateway sh -c '\
		ids=$$(node openclaw.mjs devices list --json 2>/dev/null | \
			node -e "const d=JSON.parse(require(\"fs\").readFileSync(0,\"utf8\")); \
			(d.pending||[]).forEach(p=>console.log(p.requestId))"); \
		if [ -z "$$ids" ]; then \
			echo "no pending requests"; \
		else \
			echo "$$ids" | while read id; do \
				[ -n "$$id" ] && node openclaw.mjs devices approve "$$id"; \
			done; \
		fi'
	@echo "done. refresh your browser."

pairing:
ifndef CODE
	@echo "usage: make pairing CODE=PAIRING_CODE [CHANNEL=telegram]"
	@exit 1
endif
	@CHANNEL=$${CHANNEL:-telegram}; \
	echo "approving $$CHANNEL pairing code $(CODE)..."; \
	docker compose exec -T openclaw-gateway node openclaw.mjs pairing approve "$$CHANNEL" "$(CODE)"

audit:
	docker compose exec openclaw-gateway node openclaw.mjs security audit --deep

audit-fix:
	docker compose exec openclaw-gateway node openclaw.mjs security audit --fix

doctor: wait-ready
	docker compose exec openclaw-gateway node openclaw.mjs doctor

doctor-fix: wait-ready
	docker compose exec openclaw-gateway node openclaw.mjs doctor --fix

validate:
	@echo "validating docker-compose.yml..."
	@docker compose config --quiet && echo "docker-compose.yml is valid"

validate-env:
	@chmod +x scripts/validate-env.sh
	@./scripts/validate-env.sh

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

colima-start:
	@echo "starting colima (2 cpu, 1.5gb memory, 10gb disk)..."
	colima start --cpu 2 --memory 1.5 --disk 10 --runtime docker

colima-stop:
	colima stop

colima-status:
	@colima status

ps:
	@echo "running containers:"
	@docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
	@echo ""
	@echo "resource usage:"
	@docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

infra-check:
	@chmod +x scripts/infra-check.sh
	@./scripts/infra-check.sh

# === testing ===

test:
	@chmod +x scripts/test.sh
	@./scripts/test.sh

test-quick:
	@echo "running layer 1 tests only..."
	@SKIP_CONTAINER_TESTS=1 ./scripts/test.sh

test-validate-env:
	@chmod +x scripts/test-validate-env.sh
	@./scripts/test-validate-env.sh

# === infrastructure ===

INFRA_DIR := infra/hetzner
TOFU := tofu

infra-init:
	@echo "initializing opentofu..."
	cd $(INFRA_DIR) && $(TOFU) init

infra-plan:
	@echo "planning infrastructure changes..."
	cd $(INFRA_DIR) && $(TOFU) plan

infra-apply:
	@echo "applying infrastructure..."
	cd $(INFRA_DIR) && $(TOFU) apply

infra-destroy:
	@echo "destroying infrastructure..."
	cd $(INFRA_DIR) && $(TOFU) destroy

infra-output:
	@cd $(INFRA_DIR) && $(TOFU) output
