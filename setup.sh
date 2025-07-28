#!/bin/bash

# =============================================================================
# PROJECT INVOICE MANAGEMENT SYSTEM - QUICK SETUP SCRIPT
# =============================================================================

set -e  # Exit on any error

echo "🚀 Project Invoice Management System - Quick Setup"
echo "=================================================="

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

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    print_status "Node.js $(node --version) is installed"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm"
        exit 1
    fi
    print_status "npm $(npm --version) is installed"
}

# Create environment files
setup_env_files() {
    print_info "Setting up environment files..."
    
    # Backend environment
    if [ ! -f "backend/.env" ]; then
        cp backend/.env.example backend/.env
        print_status "Created backend/.env from template"
        print_warning "Please edit backend/.env with your actual configuration values"
    else
        print_warning "backend/.env already exists, skipping..."
    fi
    
    # Frontend environment
    if [ ! -f "frontend/.env" ]; then
        cp frontend/.env.example frontend/.env
        print_status "Created frontend/.env from template"
        print_warning "Please edit frontend/.env with your actual configuration values"
    else
        print_warning "frontend/.env already exists, skipping..."
    fi
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    # Backend dependencies
    print_info "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    print_status "Backend dependencies installed"
    
    # Frontend dependencies
    print_info "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    print_status "Frontend dependencies installed"
    
    # Documentation dependencies (optional)
    if [ -d "docs" ]; then
        print_info "Installing documentation dependencies..."
        cd docs
        npm install
        cd ..
        print_status "Documentation dependencies installed"
    fi
}

# Generate JWT secrets
generate_jwt_secrets() {
    print_info "Generating JWT secrets..."
    
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # Update backend .env file with generated secrets
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long/JWT_SECRET=$JWT_SECRET/" backend/.env
        sed -i '' "s/JWT_ACCESS_SECRET=your_super_secret_access_token_key_here/JWT_ACCESS_SECRET=$JWT_SECRET/" backend/.env
        sed -i '' "s/JWT_REFRESH_SECRET=your_super_secret_refresh_token_key_here/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" backend/.env
        sed -i '' "s/SESSION_SECRET=your-session-secret-key/SESSION_SECRET=$SESSION_SECRET/" backend/.env
    else
        # Linux
        sed -i "s/JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long/JWT_SECRET=$JWT_SECRET/" backend/.env
        sed -i "s/JWT_ACCESS_SECRET=your_super_secret_access_token_key_here/JWT_ACCESS_SECRET=$JWT_SECRET/" backend/.env
        sed -i "s/JWT_REFRESH_SECRET=your_super_secret_refresh_token_key_here/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" backend/.env
        sed -i "s/SESSION_SECRET=your-session-secret-key/SESSION_SECRET=$SESSION_SECRET/" backend/.env
    fi
    
    print_status "JWT secrets generated and updated in backend/.env"
}

# Create basic project structure
create_project_structure() {
    print_info "Creating project structure..."
    
    # Create uploads directory
    mkdir -p backend/uploads
    mkdir -p backend/logs
    mkdir -p backend/backups
    
    print_status "Project directories created"
}

# Display next steps
show_next_steps() {
    echo ""
    echo "🎉 Setup completed successfully!"
    echo "================================"
    echo ""
    print_info "Next steps:"
    echo ""
    echo "1. 📝 Configure your environment variables:"
    echo "   - Edit backend/.env with your Google Sheets API credentials"
    echo "   - Edit backend/.env with your payment gateway keys"
    echo "   - Edit backend/.env with your email service configuration"
    echo "   - Edit frontend/.env with your public API keys"
    echo ""
    echo "2. 📚 Read the detailed setup guide:"
    echo "   - Open ENVIRONMENT_SETUP_GUIDE.md for detailed instructions"
    echo ""
    echo "3. 🗄️  Set up Google Sheets:"
    echo "   - Create a Google Cloud Project"
    echo "   - Enable Google Sheets API and Google Drive API"
    echo "   - Create a service account and download the JSON key"
    echo "   - Create a Google Sheets spreadsheet and share it with the service account"
    echo "   - Run: cd backend && npm run setup-sheets:full"
    echo ""
    echo "4. 🚀 Start the application:"
    echo "   - Backend: cd backend && npm run dev"
    echo "   - Frontend: cd frontend && npm start"
    echo ""
    echo "5. 🧪 Test the setup:"
    echo "   - Backend: cd backend && npm test"
    echo "   - Frontend: cd frontend && npm test"
    echo ""
    print_warning "Important: Make sure to configure all environment variables before starting the application!"
    echo ""
    print_info "For detailed setup instructions, see: ENVIRONMENT_SETUP_GUIDE.md"
    print_info "For troubleshooting, see: docs/docs/user-guide/system-testing-guide.md"
}

# Main setup function
main() {
    echo "Starting setup process..."
    echo ""
    
    check_node
    check_npm
    setup_env_files
    install_dependencies
    generate_jwt_secrets
    create_project_structure
    show_next_steps
}

# Run main function
main