const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { supabase, supabaseHelpers } = require('./supabase-setup');

const app = express();

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
        ? [process.env.FRONTEND_URL, 'https://yourdomain.vercel.app'] 
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

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Supabase Authentication middleware
async function authenticateSupabase(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const { data, error } = await supabase.from('folders').select('count').limit(1);
        
        if (error) {
            throw error;
        }
        
        res.json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            database: 'connected',
            version: process.env.npm_package_version || '1.0.0'
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'unhealthy', 
            error: 'Database connection failed' 
        });
    }
});

// User registration (using Supabase Auth)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;

        if (!email || !password || !username) {
            return res.status(400).json({ error: 'Email, password, and username are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Register user with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        if (!data.user) {
            return res.status(400).json({ error: 'Failed to create user' });
        }

        // Create default folder and project
        const userId = data.user.id;
        
        // Create default folder
        const { data: folderData } = await supabase
            .from('folders')
            .insert({
                user_id: userId,
                name: 'Default',
                expanded: true
            })
            .select()
            .single();

        // Create default project
        const { data: projectData } = await supabase
            .from('projects')
            .insert({
                user_id: userId,
                name: 'My First Project',
                description: 'Welcome to z-task!'
            })
            .select()
            .single();

        // Link project to folder
        await supabase
            .from('project_folders')
            .insert({
                project_id: projectData.id,
                folder_id: folderData.id
            });

        // Create default columns
        const defaultColumns = [
            { title: 'TODO', tag: 'todo' },
            { title: 'IN PROGRESS', tag: 'in-progress' },
            { title: 'DONE', tag: 'done' }
        ];

        for (const column of defaultColumns) {
            await supabase
                .from('columns')
                .insert({
                    project_id: projectData.id,
                    title: column.title,
                    tag: column.tag
                });
        }

        res.status(201).json({
            message: 'User created successfully',
            user: { 
                id: data.user.id, 
                email: data.user.email, 
                username: username 
            },
            session: data.session
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User login (using Supabase Auth)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Login with Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!data.user) {
            return res.status(401).json({ error: 'Login failed' });
        }

        res.json({
            message: 'Login successful',
            user: { 
                id: data.user.id, 
                email: data.user.email, 
                username: data.user.user_metadata?.username || 'User'
            },
            session: data.session
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user data
app.get('/api/user/data', authenticateSupabase, async (req, res) => {
    try {
        const userId = req.user.id;
        const data = await supabaseHelpers.getUserData(userId);
        res.json(data);
    } catch (error) {
        console.error('Get user data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save user data
app.post('/api/user/data', authenticateSupabase, async (req, res) => {
    try {
        const userId = req.user.id;
        const data = req.body;
        
        await supabaseHelpers.saveUserData(userId, data);
        res.json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('Save user data error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

module.exports = app;
