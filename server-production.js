const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initializeDatabase, query, transaction, logger } = require('./config/database');
const { scheduleBackups, manualBackup } = require('./scripts/backup');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [process.env.FRONTEND_URL, 'https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });
    next();
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// JWT Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const jwt = require('jsonwebtoken');
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            logger.warn('Invalid token attempt', { error: err.message, ip: req.ip });
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Data validation middleware
const Joi = require('joi');

const userSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const taskSchema = Joi.object({
    text: Joi.string().min(1).max(1000).required(),
    description: Joi.string().max(5000).allow(''),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
    due_date: Joi.date().allow(null),
    tags: Joi.array().items(Joi.string()).default([])
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await query('SELECT 1');
        res.json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            database: 'connected',
            version: process.env.npm_package_version || '1.0.0'
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            error: 'Database connection failed' 
        });
    }
});

// User registration
app.post('/api/auth/register', async (req, res) => {
    try {
        // Validate input
        const { error, value } = userSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        const { username, email, password } = value;

        // Check if user already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user in transaction
        const result = await transaction(async (client) => {
            // Create user
            const userResult = await client.query(
                'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
                [username, email, hashedPassword]
            );
            const user = userResult.rows[0];

            // Create default folder
            const folderResult = await client.query(
                'INSERT INTO folders (user_id, name) VALUES ($1, $2) RETURNING id',
                [user.id, 'Default']
            );
            const folderId = folderResult.rows[0].id;

            // Create default project
            const projectResult = await client.query(
                'INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING id',
                [user.id, 'My First Project']
            );
            const projectId = projectResult.rows[0].id;

            // Link project to folder
            await client.query(
                'INSERT INTO project_folders (project_id, folder_id) VALUES ($1, $2)',
                [projectId, folderId]
            );

            // Create default columns
            const defaultColumns = [
                { title: 'TODO', tag: 'todo' },
                { title: 'IN PROGRESS', tag: 'in-progress' },
                { title: 'DONE', tag: 'done' }
            ];

            for (const column of defaultColumns) {
                await client.query(
                    'INSERT INTO columns (project_id, title, tag) VALUES ($1, $2, $3)',
                    [projectId, column.title, column.tag]
                );
            }

            return user;
        });

        // Generate JWT token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { userId: result.id, username: result.username, email: result.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info('User registered successfully', { userId: result.id, email: result.email });

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: result.id, username: result.username, email: result.email }
        });

    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const userResult = await query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        if (userResult.rows.length === 0) {
            logger.warn('Login attempt with non-existent email', { email, ip: req.ip });
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = userResult.rows[0];

        // Verify password
        const bcrypt = require('bcryptjs');
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            logger.warn('Login attempt with invalid password', { email, ip: req.ip });
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        // Generate JWT token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { userId: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info('User logged in successfully', { userId: user.id, email: user.email });

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user data
app.get('/api/user/data', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get folders with projects
        const foldersResult = await query(`
            SELECT 
                f.id, f.name, f.expanded,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', p.id,
                            'name', p.name,
                            'description', p.description,
                            'columns', (
                                SELECT json_agg(
                                    json_build_object(
                                        'id', c.id,
                                        'title', c.title,
                                        'tag', c.tag,
                                        'position', c.position,
                                        'items', (
                                            SELECT json_agg(
                                                json_build_object(
                                                    'id', t.id,
                                                    'text', t.text,
                                                    'description', t.description,
                                                    'priority', t.priority,
                                                    'dueDate', t.due_date,
                                                    'tags', t.tags,
                                                    'completed', t.completed,
                                                    'completedAt', t.completed_at,
                                                    'position', t.position
                                                ) ORDER BY t.position
                                            )
                                            FROM tasks t 
                                            WHERE t.column_id = c.id
                                        )
                                    ) ORDER BY c.position
                                )
                                FROM columns c 
                                WHERE c.project_id = p.id
                            )
                        )
                    ) FILTER (WHERE p.id IS NOT NULL),
                    '[]'
                ) as projects
            FROM folders f
            LEFT JOIN project_folders pf ON f.id = pf.folder_id
            LEFT JOIN projects p ON pf.project_id = p.id
            WHERE f.user_id = $1
            GROUP BY f.id, f.name, f.expanded
            ORDER BY f.name
        `, [userId]);

        // Get uncategorized projects
        const uncategorizedResult = await query(`
            SELECT 
                p.id, p.name, p.description,
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', c.id,
                            'title', c.title,
                            'tag', c.tag,
                            'position', c.position,
                            'items', (
                                SELECT json_agg(
                                    json_build_object(
                                        'id', t.id,
                                        'text', t.text,
                                        'description', t.description,
                                        'priority', t.priority,
                                        'dueDate', t.due_date,
                                        'tags', t.tags,
                                        'completed', t.completed,
                                        'completedAt', t.completed_at,
                                        'position', t.position
                                    ) ORDER BY t.position
                                )
                                FROM tasks t 
                                WHERE t.column_id = c.id
                            )
                        ) ORDER BY c.position
                    )
                    FROM columns c 
                    WHERE c.project_id = p.id
                ) as columns
            FROM projects p
            LEFT JOIN project_folders pf ON p.id = pf.project_id
            WHERE p.user_id = $1 AND pf.project_id IS NULL
            ORDER BY p.name
        `, [userId]);

        const response = {
            folders: foldersResult.rows,
            uncategorized: uncategorizedResult.rows
        };

        res.json(response);

    } catch (error) {
        logger.error('Get user data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save user data
app.post('/api/user/data', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { folders, uncategorized } = req.body;

        // Validate data structure
        if (!folders || !Array.isArray(folders)) {
            return res.status(400).json({ error: 'Invalid data structure' });
        }

        // Save data in transaction
        await transaction(async (client) => {
            // Clear existing data
            await client.query('DELETE FROM tasks WHERE column_id IN (SELECT id FROM columns WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1))', [userId]);
            await client.query('DELETE FROM columns WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1)', [userId]);
            await client.query('DELETE FROM project_folders WHERE project_id IN (SELECT id FROM projects WHERE user_id = $1)', [userId]);
            await client.query('DELETE FROM projects WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM folders WHERE user_id = $1', [userId]);

            // Insert folders
            for (const folder of folders) {
                const folderResult = await client.query(
                    'INSERT INTO folders (user_id, name, expanded) VALUES ($1, $2, $3) RETURNING id',
                    [userId, folder.name, folder.expanded !== false]
                );
                const folderId = folderResult.rows[0].id;

                // Insert projects in folder
                if (folder.projects && Array.isArray(folder.projects)) {
                    for (const project of folder.projects) {
                        const projectResult = await client.query(
                            'INSERT INTO projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING id',
                            [userId, project.name, project.description || '']
                        );
                        const projectId = projectResult.rows[0].id;

                        // Link project to folder
                        await client.query(
                            'INSERT INTO project_folders (project_id, folder_id) VALUES ($1, $2)',
                            [projectId, folderId]
                        );

                        // Insert columns
                        if (project.columns && Array.isArray(project.columns)) {
                            for (const column of project.columns) {
                                const columnResult = await client.query(
                                    'INSERT INTO columns (project_id, title, tag, position) VALUES ($1, $2, $3, $4) RETURNING id',
                                    [projectId, column.title, column.tag || '', column.position || 0]
                                );
                                const columnId = columnResult.rows[0].id;

                                // Insert tasks
                                if (column.items && Array.isArray(column.items)) {
                                    for (const item of column.items) {
                                        await client.query(
                                            'INSERT INTO tasks (column_id, text, description, priority, due_date, tags, completed, completed_at, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                                            [
                                                columnId,
                                                item.text,
                                                item.description || '',
                                                item.priority || 'medium',
                                                item.dueDate || null,
                                                item.tags || [],
                                                item.completed || false,
                                                item.completedAt || null,
                                                item.position || 0
                                            ]
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Insert uncategorized projects
            if (uncategorized && Array.isArray(uncategorized)) {
                for (const project of uncategorized) {
                    const projectResult = await client.query(
                        'INSERT INTO projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING id',
                        [userId, project.name, project.description || '']
                    );
                    const projectId = projectResult.rows[0].id;

                    // Insert columns
                    if (project.columns && Array.isArray(project.columns)) {
                        for (const column of project.columns) {
                            const columnResult = await client.query(
                                'INSERT INTO columns (project_id, title, tag, position) VALUES ($1, $2, $3, $4) RETURNING id',
                                [projectId, column.title, column.tag || '', column.position || 0]
                            );
                            const columnId = columnResult.rows[0].id;

                            // Insert tasks
                            if (column.items && Array.isArray(column.items)) {
                                for (const item of column.items) {
                                    await client.query(
                                        'INSERT INTO tasks (column_id, text, description, priority, due_date, tags, completed, completed_at, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                                        [
                                            columnId,
                                            item.text,
                                            item.description || '',
                                            item.priority || 'medium',
                                            item.dueDate || null,
                                            item.tags || [],
                                            item.completed || false,
                                            item.completedAt || null,
                                            item.position || 0
                                        ]
                                    );
                                }
                            }
                        }
                    }
                }
            }
        });

        logger.info('User data saved successfully', { userId });

        res.json({ message: 'Data saved successfully' });

    } catch (error) {
        logger.error('Save user data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Manual backup endpoint (admin only)
app.post('/api/admin/backup', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin (you can implement proper admin check)
        if (req.user.userId !== 1) { // Simple admin check
            return res.status(403).json({ error: 'Admin access required' });
        }

        await manualBackup();
        res.json({ message: 'Backup initiated successfully' });

    } catch (error) {
        logger.error('Manual backup error:', error);
        res.status(500).json({ error: 'Backup failed' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();
        
        // Schedule backups
        scheduleBackups();
        
        // Start server
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`, {
                environment: process.env.NODE_ENV || 'development',
                port: PORT
            });
        });
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

startServer();
