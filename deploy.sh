#!/bin/bash

# Production Deployment Script for z-task
# This script sets up a production environment with PostgreSQL

set -e  # Exit on any error

echo "🚀 Starting z-task production deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL is not installed. Installing PostgreSQL..."
    
    # Detect OS and install PostgreSQL
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            # Ubuntu/Debian
            sudo apt-get update
            sudo apt-get install -y postgresql postgresql-contrib
        elif command -v yum &> /dev/null; then
            # CentOS/RHEL
            sudo yum install -y postgresql-server postgresql-contrib
            sudo postgresql-setup initdb
        else
            print_error "Unsupported Linux distribution. Please install PostgreSQL manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install postgresql
        else
            print_error "Homebrew not found. Please install PostgreSQL manually."
            exit 1
        fi
    else
        print_error "Unsupported operating system. Please install PostgreSQL manually."
        exit 1
    fi
fi

print_status "PostgreSQL version: $(psql --version)"

# Start PostgreSQL service
print_status "Starting PostgreSQL service..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
elif [[ "$OSTYPE" == "darwin"* ]]; then
    brew services start postgresql
fi

# Create database and user
print_status "Setting up database..."

# Create database user
sudo -u postgres psql -c "CREATE USER ztask_user WITH PASSWORD 'ztask_secure_password';" 2>/dev/null || print_warning "User might already exist"
sudo -u postgres psql -c "CREATE DATABASE ztask_production OWNER ztask_user;" 2>/dev/null || print_warning "Database might already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ztask_production TO ztask_user;"

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
npm install

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p backups
mkdir -p public

# Copy environment file
if [ ! -f .env ]; then
    print_status "Creating environment configuration..."
    cp env.example .env
    
    # Generate secure JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s/your_super_secure_jwt_secret_key_change_this_in_production/$JWT_SECRET/" .env
    
    print_warning "Please edit .env file with your actual configuration before starting the server"
fi

# Run database migrations
print_status "Running database migrations..."
PGPASSWORD=ztask_secure_password psql -h localhost -U ztask_user -d ztask_production -f migrations/001_initial_schema.sql

# Set up PM2 for process management
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    npm install -g pm2
fi

# Create PM2 ecosystem file
print_status "Creating PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'z-task',
    script: 'server-production.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Set up log rotation
print_status "Setting up log rotation..."
sudo tee /etc/logrotate.d/z-task << EOF
$(pwd)/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $(whoami) $(whoami)
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

# Set up firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    print_status "Configuring firewall..."
    sudo ufw allow 3000/tcp
    sudo ufw allow 22/tcp
fi

# Create systemd service (alternative to PM2)
print_status "Creating systemd service..."
sudo tee /etc/systemd/system/z-task.service << EOF
[Unit]
Description=z-task Production Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node server-production.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Set up SSL with Let's Encrypt (if domain is provided)
if [ ! -z "$1" ]; then
    DOMAIN=$1
    print_status "Setting up SSL for domain: $DOMAIN"
    
    if command -v certbot &> /dev/null; then
        sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    else
        print_warning "Certbot not found. Please install certbot for SSL setup."
    fi
fi

# Final setup
print_status "Setting up file permissions..."
chmod +x deploy.sh
chmod 600 .env

print_status "Deployment completed successfully! 🎉"
echo ""
print_status "Next steps:"
echo "1. Edit .env file with your actual configuration"
echo "2. Start the server with: pm2 start ecosystem.config.js"
echo "3. Check status with: pm2 status"
echo "4. View logs with: pm2 logs z-task"
echo ""
print_warning "Important:"
echo "- Change the default database password in .env"
echo "- Set up proper SSL certificates"
echo "- Configure your domain name"
echo "- Set up monitoring and alerts"
echo ""
print_status "Your z-task application is ready for production! 🚀"
