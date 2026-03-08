.PHONY: up up-local up-staging down logs migrate seed-demo backend-test backend-lint frontend-lint frontend-build

up:
	docker compose up --build

up-local:
	docker compose -f docker-compose.yml -f docker-compose.local.yml up --build

up-staging:
	docker compose -f docker-compose.yml -f docker-compose.staging.yml up --build -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

migrate:
	docker compose run --rm migrations

seed-demo:
	docker compose exec api python -m scripts.seed_demo_data

backend-test:
	cd backend && python3 -m unittest discover -s tests

backend-lint:
	cd backend && ruff check app tests

frontend-lint:
	cd frontend && npm run lint

frontend-build:
	cd frontend && npm run build
