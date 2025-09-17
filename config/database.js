const { Pool } = require('pg');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Database configuration
const dbConfig = {
    // Production PostgreSQL configuration
    production: {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'ztask_production',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    },
    
    // Development SQLite configuration (fallback)
    development: {
        filename: './database.sqlite'
    }
};

// Create database pool
let pool;

function initializeDatabase() {
    const environment = process.env.NODE_ENV || 'development';
    
    if (environment === 'production') {
        pool = new Pool(dbConfig.production);
        
        // Handle pool errors
        pool.on('error', (err) => {
            logger.error('Unexpected error on idle client', err);
        });
        
        // Test connection
        pool.query('SELECT NOW()', (err, result) => {
            if (err) {
                logger.error('Database connection failed:', err);
                throw err;
            }
            logger.info('Database connected successfully');
        });
    } else {
        // Use SQLite for development
        const sqlite3 = require('sqlite3').verbose();
        pool = new sqlite3.Database('./database.sqlite');
        logger.info('SQLite database connected for development');
    }
    
    return pool;
}

// Database query helper with error handling
async function query(text, params = []) {
    const start = Date.now();
    
    try {
        if (process.env.NODE_ENV === 'production') {
            const result = await pool.query(text, params);
            const duration = Date.now() - start;
            logger.info('Query executed', { text, duration, rows: result.rowCount });
            return result;
        } else {
            // SQLite query handling
            return new Promise((resolve, reject) => {
                pool.all(text, params, (err, rows) => {
                    if (err) {
                        logger.error('SQLite query error:', err);
                        reject(err);
                    } else {
                        const duration = Date.now() - start;
                        logger.info('SQLite query executed', { text, duration, rows: rows.length });
                        resolve({ rows, rowCount: rows.length });
                    }
                });
            });
        }
    } catch (error) {
        logger.error('Database query error:', error);
        throw error;
    }
}

// Database transaction helper
async function transaction(callback) {
    if (process.env.NODE_ENV === 'production') {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } else {
        // SQLite doesn't support transactions in the same way
        return callback(pool);
    }
}

// Close database connection
function closeDatabase() {
    if (pool && pool.end) {
        return pool.end();
    }
}

module.exports = {
    initializeDatabase,
    query,
    transaction,
    closeDatabase,
    logger
};
