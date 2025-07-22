#!/bin/bash

# Production Deployment Script for Project Invoice Management System
# This script automates the deployment process for the application

set -e  # Exit immediately if a command exits with a non-zero status

# Configuration
APP_NAME="project-invoice-management"
DEPLOY_DIR="/var/www/$APP_NAME"
BACKUP_DIR="/var/backups/$APP_NAME"
REPO_URL="git@github.com:yourusername/project-invoice-management.git"
BRANCH="main"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Print step information
print_step() {
  echo -e "${GREEN}==>${NC} $1"
}

# Print warning
print_warning() {
  echo -e "${YELLOW}WARNING:${NC} $1"
}

# Print error and exit
print_error() {
  echo -e "${RED}ERROR:${NC} $1"
  exit 1
}

# Check if running as root
if [ "$(id -u)" != "0" ]; then
   print_error "This script must be run as root"
fi

# Create timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Step 1: Backup current deployment
print_step "Creating backup of current deployment"
if [ -d "$DEPLOY_DIR" ]; then
  mkdir -p "$BACKUP_DIR"
  tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C "$(dirname "$DEPLOY_DIR")" "$(basename "$DEPLOY_DIR")"
  print_step "Backup created at $BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
else
  print_warning "No existing deployment to backup"
fi

# Step 2: Backup Google Sheets data
print_step "Backing up Google Sheets data"
cd "$DEPLOY_DIR/backend" || print_error "Backend directory not found"
npm run sheets:backup || print_warning "Google Sheets backup failed, continuing deployment"

# Step 3: Pull latest code
print_step "Pulling latest code from repository"
if [ -d "$DEPLOY_DIR/.git" ]; then
  cd "$DEPLOY_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  print_step "Cloning repository"
  mkdir -p "$DEPLOY_DIR"
  git clone -b "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# Step 4: Install backend dependencies
print_step "Installing backend dependencies"
cd "$DEPLOY_DIR/backend"
npm ci --production

# Step 5: Build backend
print_step "Building backend"
npm run build

# Step 6: Install frontend dependencies
print_step "Installing frontend dependencies"
cd "$DEPLOY_DIR/frontend"
npm ci --production

# Step 7: Build frontend
print_step "Building frontend"
npm run build

# Step 8: Update environment configuration
print_step "Updating environment configuration"
if [ ! -f "$DEPLOY_DIR/backend/.env" ]; then
  print_warning "No .env file found, creating from example"
  cp "$DEPLOY_DIR/backend/.env.example" "$DEPLOY_DIR/backend/.env"
  print_warning "Please update the .env file with production values"
fi

# Step 9: Restart application with PM2
print_step "Restarting application with PM2"
cd "$DEPLOY_DIR/backend"
if pm2 list | grep -q "$APP_NAME"; then
  pm2 reload "$APP_NAME"
else
  pm2 start dist/index.js --name "$APP_NAME" --env production
fi

# Step 10: Verify deployment
print_step "Verifying deployment"
sleep 5
if pm2 list | grep -q "$APP_NAME" && pm2 show "$APP_NAME" | grep -q "online"; then
  print_step "Deployment successful! Application is running."
  
  # Run health check
  if curl -s http://localhost:3001/health | grep -q "ok"; then
    print_step "Health check passed."
  else
    print_warning "Health check failed. Please check application logs."
  fi
else
  print_error "Deployment failed. Application is not running."
fi

print_step "Deployment completed at $(date)"