#!/bin/bash

# =============================================================================
# Backend Startup Script with Error Handling
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting Project Invoice Management Backend"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Change to backend directory
cd backend

# Step 1: Kill any existing process on port 5000
print_info "Checking for existing processes on port 5000..."
if lsof -i :5000 >/dev/null 2>&1; then
    print_warning "Port 5000 is in use, killing existing process..."
    npm run kill-port
    print_status "Port 5000 cleared"
else
    print_status "Port 5000 is available"
fi

# Step 2: Test environment configuration
print_info "Testing environment configuration..."
if npm run test-env; then
    print_status "Environment configuration is valid"
else
    print_error "Environment configuration failed"
    print_info "Please check your .env file and run: ./setup.sh"
    exit 1
fi

# Step 3: Check if Google Sheets are set up
print_info "Checking Google Sheets setup..."
if npm run setup-sheets:validate >/dev/null 2>&1; then
    print_status "Google Sheets are properly configured"
else
    print_warning "Google Sheets need to be set up"
    print_info "Setting up Google Sheets..."
    
    if npm run setup-sheets:full; then
        print_status "Google Sheets setup completed"
    else
        print_error "Failed to set up Google Sheets"
        print_info "Please check your Google Cloud configuration"
        exit 1
    fi
fi

# Step 4: Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies..."
    npm install
    print_status "Dependencies installed"
fi

# Step 5: Build if needed
if [ ! -d "dist" ]; then
    print_info "Building project..."
    npm run build
    print_status "Project built"
fi

# Step 6: Start the server
print_info "Starting backend server..."
print_status "Backend will be available at: http://localhost:5000"
print_status "Health check: http://localhost:5000/health"
print_status "API documentation: http://localhost:5000/api"

# Start the development server
npm run dev