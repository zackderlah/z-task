# z-task Production Deployment Guide

A production-ready todo application with PostgreSQL, automatic backups, and robust error handling.

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

```bash
# Clone the repository
git clone <your-repo-url>
cd z-task

# Set up environment variables
cp env.example .env
# Edit .env with your configuration

# Start with Docker Compose
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
```

### Option 2: Manual Deployment

```bash
# Run the deployment script
chmod +x deploy.sh
./deploy.sh

# Or with a domain name
./deploy.sh yourdomain.com
```

## 🗄️ Database Setup

### PostgreSQL Configuration

The application uses PostgreSQL for production with the following features:

- **Connection pooling** for better performance
- **Automatic migrations** on startup
- **Data validation** with Joi schemas
- **Transaction support** for data integrity

### Database Schema

- `users` - User accounts with secure password hashing
- `folders` - Project organization
- `projects` - User projects
- `columns` - Project columns (TODO, IN PROGRESS, DONE)
- `tasks` - Individual tasks with metadata
- `task_history` - Archived completed tasks
- `user_sessions` - JWT token management

## 🔒 Security Features

### Authentication & Authorization
- **JWT tokens** with 7-day expiration
- **bcrypt password hashing** (12 rounds)
- **Rate limiting** on API endpoints
- **CORS protection** with configurable origins

### Data Protection
- **Input validation** with Joi schemas
- **SQL injection protection** with parameterized queries
- **XSS protection** with security headers
- **HTTPS enforcement** in production

### Error Handling
- **Comprehensive logging** with Winston
- **Graceful error recovery** without data loss
- **Health check endpoints** for monitoring

## 📊 Monitoring & Logging

### Log Files
- `logs/error.log` - Error logs only
- `logs/combined.log` - All application logs
- `logs/backup.log` - Backup operation logs

### Health Checks
- `GET /api/health` - Application health status
- Database connection monitoring
- Automatic restart on failures

## 💾 Backup System

### Automatic Backups
- **Every 6 hours** - Incremental backups
- **Daily at 2 AM** - Full database backup
- **30-day retention** - Configurable retention period
- **Compressed storage** - gzip compression for space efficiency

### Manual Backup
```bash
# Create manual backup
npm run backup

# Or via API (admin only)
curl -X POST http://localhost:3000/api/admin/backup \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Restore from Backup
```bash
# Restore from backup file
node scripts/backup.js restore /path/to/backup.sql
```

## 🌐 Production Deployment

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ztask_production
DB_USER=ztask_user
DB_PASSWORD=your_secure_password

# Security
JWT_SECRET=your_super_secure_jwt_secret_key
CORS_ORIGIN=https://yourdomain.com

# Backup Configuration
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=30
```

### SSL/HTTPS Setup

The application includes Nginx configuration for SSL termination:

1. **Obtain SSL certificates** (Let's Encrypt recommended)
2. **Place certificates** in `./ssl/` directory:
   - `cert.pem` - SSL certificate
   - `key.pem` - Private key
3. **Update domain** in `nginx.conf`

### Process Management

#### PM2 (Recommended)
```bash
# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 status
pm2 logs z-task

# Restart
pm2 restart z-task
```

#### Systemd Service
```bash
# Enable and start service
sudo systemctl enable z-task
sudo systemctl start z-task

# Check status
sudo systemctl status z-task
```

## 🔧 Maintenance

### Database Maintenance
```bash
# Run migrations
npm run migrate

# Check database status
psql -h localhost -U ztask_user -d ztask_production -c "SELECT version();"

# Monitor database size
psql -h localhost -U ztask_user -d ztask_production -c "SELECT pg_size_pretty(pg_database_size('ztask_production'));"
```

### Log Management
```bash
# View recent logs
tail -f logs/combined.log

# Check error logs
tail -f logs/error.log

# Rotate logs (automatic with logrotate)
sudo logrotate -f /etc/logrotate.d/z-task
```

### Performance Monitoring
```bash
# Check application health
curl http://localhost:3000/api/health

# Monitor resource usage
pm2 monit

# Check database connections
psql -h localhost -U ztask_user -d ztask_production -c "SELECT * FROM pg_stat_activity;"
```

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U ztask_user -d ztask_production

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Application Won't Start
```bash
# Check logs
pm2 logs z-task

# Check environment variables
cat .env

# Verify database schema
npm run migrate
```

#### Backup Issues
```bash
# Check backup directory permissions
ls -la backups/

# Test manual backup
npm run backup

# Check disk space
df -h
```

### Performance Issues

#### High Memory Usage
- Check for memory leaks in logs
- Restart application: `pm2 restart z-task`
- Monitor with: `pm2 monit`

#### Slow Database Queries
- Check database logs: `tail -f /var/log/postgresql/postgresql-*.log`
- Analyze slow queries: `EXPLAIN ANALYZE SELECT ...`
- Consider adding database indexes

## 📈 Scaling

### Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Multiple application instances
- Database read replicas
- Redis for session storage

### Vertical Scaling
- Increase server resources
- Optimize database configuration
- Enable connection pooling
- Use SSD storage for database

## 🔄 Updates & Maintenance

### Application Updates
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Run migrations
npm run migrate

# Restart application
pm2 restart z-task
```

### Database Updates
```bash
# Create new migration
touch migrations/002_new_feature.sql

# Run migration
npm run migrate

# Verify changes
psql -h localhost -U ztask_user -d ztask_production -c "\dt"
```

## 📞 Support

For production support and issues:

1. **Check logs** first: `pm2 logs z-task`
2. **Verify health**: `curl http://localhost:3000/api/health`
3. **Check database**: `psql -h localhost -U ztask_user -d ztask_production`
4. **Review configuration**: `cat .env`

## 🎯 Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database backups scheduled
- [ ] Monitoring set up
- [ ] Log rotation configured
- [ ] Firewall rules applied
- [ ] Domain DNS configured
- [ ] Health checks working
- [ ] Performance monitoring active
- [ ] Security headers enabled

---

**Your z-task application is now production-ready with enterprise-grade features! 🚀**
