const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/backup.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Database configuration
const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ztask_production',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Backup configuration
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);
    
    try {
        logger.info('Starting database backup...');
        
        // Create pg_dump command
        const pgDumpCommand = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f ${backupFile}`;
        
        // Set password environment variable
        process.env.PGPASSWORD = dbConfig.password;
        
        // Execute backup
        const { exec } = require('child_process');
        exec(pgDumpCommand, (error, stdout, stderr) => {
            if (error) {
                logger.error('Backup failed:', error);
                return;
            }
            
            if (stderr) {
                logger.warn('Backup warnings:', stderr);
            }
            
            logger.info(`Backup completed successfully: ${backupFile}`);
            
            // Compress backup file
            compressBackup(backupFile);
        });
        
    } catch (error) {
        logger.error('Backup error:', error);
    }
}

function compressBackup(backupFile) {
    const { exec } = require('child_process');
    const compressedFile = `${backupFile}.gz`;
    
    exec(`gzip ${backupFile}`, (error, stdout, stderr) => {
        if (error) {
            logger.error('Compression failed:', error);
            return;
        }
        
        logger.info(`Backup compressed: ${compressedFile}`);
        
        // Clean up old backups
        cleanupOldBackups();
    });
}

function cleanupOldBackups() {
    try {
        const files = fs.readdirSync(BACKUP_DIR);
        const now = Date.now();
        const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
        
        files.forEach(file => {
            if (file.startsWith('backup-') && file.endsWith('.sql.gz')) {
                const filePath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > retentionMs) {
                    fs.unlinkSync(filePath);
                    logger.info(`Deleted old backup: ${file}`);
                }
            }
        });
    } catch (error) {
        logger.error('Cleanup error:', error);
    }
}

// Schedule automatic backups
function scheduleBackups() {
    // Backup every 6 hours
    cron.schedule('0 */6 * * *', () => {
        logger.info('Scheduled backup starting...');
        createBackup();
    });
    
    // Daily backup at 2 AM
    cron.schedule('0 2 * * *', () => {
        logger.info('Daily backup starting...');
        createBackup();
    });
    
    logger.info('Backup scheduling initialized');
}

// Manual backup function
async function manualBackup() {
    logger.info('Manual backup requested');
    await createBackup();
}

// Restore from backup
async function restoreBackup(backupFile) {
    try {
        logger.info(`Starting restore from: ${backupFile}`);
        
        const pool = new Pool(dbConfig);
        
        // Drop existing database (be careful!)
        await pool.query('DROP SCHEMA public CASCADE');
        await pool.query('CREATE SCHEMA public');
        
        // Restore from backup
        const { exec } = require('child_process');
        const restoreCommand = `psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} -f ${backupFile}`;
        
        process.env.PGPASSWORD = dbConfig.password;
        
        exec(restoreCommand, (error, stdout, stderr) => {
            if (error) {
                logger.error('Restore failed:', error);
                return;
            }
            
            if (stderr) {
                logger.warn('Restore warnings:', stderr);
            }
            
            logger.info('Restore completed successfully');
        });
        
        await pool.end();
        
    } catch (error) {
        logger.error('Restore error:', error);
    }
}

module.exports = {
    createBackup,
    scheduleBackups,
    manualBackup,
    restoreBackup,
    cleanupOldBackups
};
