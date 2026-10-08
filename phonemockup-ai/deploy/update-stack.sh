#!/bin/bash

# Exit on any error
set -e

# --- Configuration ---
STACK_NAME="phonemockup"
REGISTRY="127.0.0.1:5000"
FRONTEND_IMAGE="$REGISTRY/phonemockup_client:latest"

# Get the directory where the script is located (the 'deploy' folder)
DEPLOY_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$DEPLOY_DIR/.."

echo "🚀 Starting Deployment for $STACK_NAME"

# --- Step 1: Build & Push Frontend ---
echo "📦 Building Frontend from $PROJECT_ROOT/client..."
docker build -t "$FRONTEND_IMAGE" "$PROJECT_ROOT/client"

echo "📤 Pushing to Registry..."
docker push "$FRONTEND_IMAGE"

# --- Step 2: Deploy Stack ---
echo "🚢 Deploying Stack..."
# --with-registry-auth: Ensures nodes can pull from the local registry
# --resolve-image always: Tells Swarm to pull the latest digest and update automatically
docker stack deploy \
  --with-registry-auth \
  --resolve-image always \
  -c "$DEPLOY_DIR/docker-compose.yml" \
  $STACK_NAME

# --- Step 3: Health Check ---
echo "⏳ Waiting for services to stabilize..."
sleep 5
docker stack services $STACK_NAME

echo "✅ Update completed successfully!"