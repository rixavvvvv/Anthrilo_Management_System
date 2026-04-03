#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.prod}"
COMPOSE_FILE="docker-compose.prod.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose plugin is not available."
  exit 1
fi

for required_file in "$ENV_FILE" "backend/.env" "frontend/.env.local"; do
  if [ ! -f "$required_file" ]; then
    echo "Error: missing required file: $required_file"
    exit 1
  fi
done

echo "Building and starting production stack..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

echo "Running containers:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "Recent backend logs:"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=30 backend

echo "Deployment completed."
echo "Health check URL: http://127.0.0.1:8000/health"
