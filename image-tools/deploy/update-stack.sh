#!/bin/bash

# Exit on any error
set -e

# --- Configuration ---
STACK_NAME="imagetoolbox"
REGISTRY="127.0.0.1:5000"
WEB_IMAGE="$REGISTRY/imagetoolbox_web:latest"

# Directory handling
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

echo "🚀 Starting Deployment Update for $STACK_NAME"

# --- Step 1: Build & Push the SvelteKit app ---
# The Dockerfile lives at the project root (multi-stage node:22-alpine build,
# prerenders all ~115 pages, runtime is the self-contained adapter-node output).
echo "📦 Building web from $PROJECT_ROOT..."
docker build -t $WEB_IMAGE "$PROJECT_ROOT"
docker push $WEB_IMAGE

# --- Step 2: Deploy Stack ---
# --resolve-image always ensures Swarm fetches the new SHA digest from the registry
echo "🚢 Deploying Stack..."
docker stack deploy \
  --with-registry-auth \
  --resolve-image always \
  -c "$SCRIPT_DIR/docker-compose.yml" \
  $STACK_NAME

# --- Step 3: Health Check ---
echo "⏳ Waiting for services to stabilize..."
sleep 5
docker stack services $STACK_NAME

echo "✅ Update completed successfully!"
