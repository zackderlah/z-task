const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com', 'https://www.yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:8000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Database initialization
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Projects table
    db.run(`CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

    // Folders table
    db.run(`CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      expanded BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

    // Project folders junction table
    db.run(`CREATE TABLE IF NOT EXISTS project_folders (
      project_id INTEGER NOT NULL,
      folder_id INTEGER,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE CASCADE
    )`);

    // Columns table
    db.run(`CREATE TABLE IF NOT EXISTS columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      tag TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )`);

    // Tasks table
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      column_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      completed BOOLEAN DEFAULT 0,
      description TEXT,
      due_date TEXT,
      priority TEXT DEFAULT 'medium',
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (column_id) REFERENCES columns (id) ON DELETE CASCADE
    )`);

    // Project invitations table
    db.run(`CREATE TABLE IF NOT EXISTS project_invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      inviter_id INTEGER NOT NULL,
      invitee_email TEXT NOT NULL,
      invitee_id INTEGER,
      status TEXT DEFAULT 'pending',
      token TEXT UNIQUE NOT NULL,
      permissions TEXT DEFAULT 'view,edit',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME DEFAULT (datetime('now', '+7 days')),
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (inviter_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (invitee_id) REFERENCES users (id) ON DELETE CASCADE
    )`);

    // Add permissions column to existing project_invitations table if it doesn't exist
    db.run(`ALTER TABLE project_invitations ADD COLUMN permissions TEXT DEFAULT 'view,edit'`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding permissions column to project_invitations:', err);
      }
    });

    // Project collaborators table
    db.run(`CREATE TABLE IF NOT EXISTS project_collaborators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'collaborator',
      permissions TEXT DEFAULT 'view,edit',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(project_id, user_id)
    )`);

    // Add permissions column to existing project_collaborators table if it doesn't exist
    db.run(`ALTER TABLE project_collaborators ADD COLUMN permissions TEXT DEFAULT 'view,edit'`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding permissions column to project_collaborators:', err);
      }
    });

    // Notifications table
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`);
  });
}

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Email configuration - using Ethereal Email for testing (no auth required)
let emailTransporter = null;

// For development, we'll use Ethereal Email (fake SMTP for testing)
// This doesn't require real email credentials
emailTransporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'ethereal.user@ethereal.email',
    pass: 'ethereal.pass'
  }
});

// Test the connection
emailTransporter.verify((error, success) => {
  if (error) {
    console.log('Email service not available, using fallback mode');
    emailTransporter = null;
  } else {
    console.log('Email service ready for testing');
  }
});

// Email service functions
async function sendInvitationEmail(inviteeEmail, inviterName, projectName, invitationToken) {
  const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}?invite=${invitationToken}`;
  
  // If email is not configured, just log the invitation link
  if (!emailTransporter) {
    console.log('Email not configured. Invitation link:', invitationUrl);
    return true; // Return true so the invitation is still created
  }
  
  const mailOptions = {
    from: '"z-task" <noreply@ztask.com>',
    to: inviteeEmail,
    subject: `You've been invited to collaborate on "${projectName}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Project Invitation</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hello!</p>
          <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
            <strong style="color: #667eea;">${inviterName}</strong> has invited you to collaborate on the project 
            <strong style="color: #764ba2;">"${projectName}"</strong> in z-task.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              ✨ Accept Invitation
            </a>
          </div>
          <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #667eea; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">${invitationUrl}</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px; margin: 0;">⏰ This invitation will expire in 7 days.</p>
            <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </div>
    `
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    console.log('Falling back to console log. Invitation link:', invitationUrl);
    // Still return true so the invitation is created even if email fails
    return true;
  }
}

function generateInvitationToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    db.get('SELECT id FROM users WHERE email = ? OR username = ?', [email, username], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        return res.status(400).json({ error: 'User with this email or username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
        [username, email, hashedPassword], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create user' });
        }

        // Create default folder and project for new user
        const userId = this.lastID;
        
        // Create default folder
        db.run('INSERT INTO folders (user_id, name) VALUES (?, ?)', [userId, 'Default'], function(err) {
          if (err) {
            console.error('Error creating default folder:', err);
          }
          
          const folderId = this.lastID;
          
          // Create default project
          db.run('INSERT INTO projects (user_id, name) VALUES (?, ?)', [userId, 'My First Project'], function(err) {
            if (err) {
              console.error('Error creating default project:', err);
            }
            
            const projectId = this.lastID;
            
            // Link project to folder
            db.run('INSERT INTO project_folders (project_id, folder_id) VALUES (?, ?)', [projectId, folderId]);
            
            // Create default columns
            const defaultColumns = [
              { title: 'TODO', tag: 'todo' },
              { title: 'IN PROGRESS', tag: 'in-progress' },
              { title: 'DONE', tag: 'done' }
            ];
            
            defaultColumns.forEach((column, index) => {
              db.run('INSERT INTO columns (project_id, title, tag) VALUES (?, ?, ?)', 
                [projectId, column.title, column.tag]);
            });
          });
        });

        // Generate JWT token
        const token = jwt.sign({ userId, username, email }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
          message: 'User created successfully',
          token,
          user: { id: userId, username, email }
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, username: user.username, email: user.email }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user data
app.get('/api/user/data', authenticateToken, (req, res) => {
  const userId = req.user.userId;

  // Get user's folders
  db.all('SELECT * FROM folders WHERE user_id = ?', [userId], (err, folders) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Get user's projects (owned + collaborated) with their folder assignments and permissions
    db.all(`
      SELECT DISTINCT p.*, pf.folder_id, 
             CASE 
               WHEN p.user_id = ? THEN 'owner'
               ELSE pc.permissions
             END as permissions
      FROM projects p 
      LEFT JOIN project_folders pf ON p.id = pf.project_id 
      LEFT JOIN project_collaborators pc ON p.id = pc.project_id AND pc.user_id = ?
      WHERE p.user_id = ? OR p.id IN (
        SELECT project_id FROM project_collaborators WHERE user_id = ?
      )
    `, [userId, userId, userId, userId], (err, projects) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Get columns for each project
      const projectIds = projects.map(p => p.id);
      if (projectIds.length === 0) {
        return res.json({ folders, projects: [], uncategorized: [] });
      }

      const placeholders = projectIds.map(() => '?').join(',');
      db.all(`SELECT * FROM columns WHERE project_id IN (${placeholders})`, projectIds, (err, columns) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Get tasks for each column
        const columnIds = columns.map(c => c.id);
        if (columnIds.length === 0) {
          return res.json({ folders, projects, columns, tasks: [] });
        }

        const taskPlaceholders = columnIds.map(() => '?').join(',');
        db.all(`SELECT * FROM tasks WHERE column_id IN (${taskPlaceholders})`, columnIds, (err, tasks) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          // Organize data
          const organizedData = {
            folders: folders.map(folder => ({
              id: folder.id.toString(),
              name: folder.name,
              expanded: Boolean(folder.expanded),
              projects: []
            })),
            uncategorized: []
          };

          // Group projects by folder
          projects.forEach(project => {
            const projectData = {
              id: project.id.toString(),
              name: project.name,
              permissions: project.permissions,
              columns: columns
                .filter(col => col.project_id === project.id)
                .map(col => ({
                  id: col.id.toString(),
                  title: col.title,
                  tag: col.tag,
                  items: tasks
                    .filter(task => task.column_id === col.id)
                    .map(task => ({
                      id: task.id.toString(),
                      text: task.text,
                      completed: Boolean(task.completed),
                      description: task.description || '',
                      dueDate: task.due_date || '',
                      priority: task.priority,
                      tags: task.tags ? task.tags.split(',').map(tag => tag.trim()) : []
                    }))
                }))
            };

            if (project.folder_id) {
              const folder = organizedData.folders.find(f => f.id === project.folder_id.toString());
              if (folder) {
                folder.projects.push(projectData);
              }
            } else {
              organizedData.uncategorized.push(projectData);
            }
          });

          res.json(organizedData);
        });
      });
    });
  });
});

// Invite user to project
app.post('/api/projects/:projectId/invite', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email, permissions } = req.body;
    const inviterId = req.user.userId;

    console.log('Invitation request:', { projectId, email, inviterId, permissions });

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if project exists and user has access (owner or collaborator)
    db.get(`
      SELECT p.* FROM projects p 
      WHERE p.id = ? AND (
        p.user_id = ? OR 
        p.id IN (SELECT project_id FROM project_collaborators WHERE user_id = ?)
      )
    `, [projectId, inviterId, inviterId], async (err, project) => {
      if (err) {
        console.error('Database error in invitation:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!project) {
        console.log('Project not found or access denied. Checking user projects...');
        // Debug: Check what projects the user actually has access to
        db.all(`
          SELECT p.* FROM projects p 
          WHERE p.user_id = ? OR 
          p.id IN (SELECT project_id FROM project_collaborators WHERE user_id = ?)
        `, [inviterId, inviterId], (debugErr, userProjects) => {
          if (!debugErr) {
            console.log('User accessible projects:', userProjects.map(p => ({ id: p.id, name: p.name, user_id: p.user_id })));
          }
        });
        return res.status(404).json({ error: 'Project not found or access denied' });
      }

      // Check if user is already a collaborator
      db.get('SELECT * FROM project_collaborators WHERE project_id = ? AND user_id = (SELECT id FROM users WHERE email = ?)', 
        [projectId, email], (err, existingCollaborator) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (existingCollaborator) {
          return res.status(400).json({ error: 'User is already a collaborator on this project' });
        }

        // Check if there's already a pending invitation
        db.get('SELECT * FROM project_invitations WHERE project_id = ? AND invitee_email = ? AND status = "pending"', 
          [projectId, email], async (err, existingInvitation) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (existingInvitation) {
            return res.status(400).json({ error: 'Invitation already sent to this email' });
          }

          // Create invitation
          const invitationToken = generateInvitationToken();
          const inviterName = req.user.username;

          db.run('INSERT INTO project_invitations (project_id, inviter_id, invitee_email, token, permissions) VALUES (?, ?, ?, ?, ?)', 
            [projectId, inviterId, email, invitationToken, permissions || 'view,edit'], async function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to create invitation' });
            }

            // Send email
            const emailSent = await sendInvitationEmail(email, inviterName, project.name, invitationToken);
            
            if (!emailTransporter) {
              console.log('Email not configured. Invitation created but no email sent.');
            } else if (!emailSent) {
              console.error('Failed to send invitation email to:', email);
            }

            // Create notification for existing user if they exist
            db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
              if (user) {
                db.run('INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)', 
                  [user.id, 'project_invitation', 'Project Invitation', 
                   `${inviterName} invited you to collaborate on "${project.name}"`,
                   JSON.stringify({ projectId, inviterId, invitationToken })]);
              }
            });

            const responseMessage = emailTransporter ? 
              'Invitation sent successfully via email' : 
              'Invitation created successfully (email not configured)';
              
            res.json({ 
              message: responseMessage,
              invitationId: this.lastID,
              invitationLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?invite=${invitationToken}`
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept project invitation
app.post('/api/invitations/:token/accept', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.userId;

    // Find invitation
    db.get('SELECT * FROM project_invitations WHERE token = ? AND status = "pending"', [token], (err, invitation) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!invitation) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }

      // Check if invitation is expired
      const now = new Date();
      const expiresAt = new Date(invitation.expires_at);
      if (now > expiresAt) {
        return res.status(400).json({ error: 'Invitation has expired' });
      }

      // Check if user email matches invitation email
      db.get('SELECT email FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (user.email !== invitation.invitee_email) {
          return res.status(403).json({ error: 'This invitation is not for your account' });
        }

        // Add user as collaborator with permissions
        db.run('INSERT OR IGNORE INTO project_collaborators (project_id, user_id, permissions) VALUES (?, ?, ?)', 
          [invitation.project_id, userId, invitation.permissions || 'view,edit'], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to add collaborator' });
          }

          // Update invitation status
          db.run('UPDATE project_invitations SET status = "accepted", invitee_id = ? WHERE id = ?', 
            [userId, invitation.id], (err) => {
            if (err) {
              console.error('Error updating invitation status:', err);
            }

            res.json({ message: 'Invitation accepted successfully' });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Decline project invitation
app.post('/api/invitations/:token/decline', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.userId;

    // Find invitation
    db.get('SELECT * FROM project_invitations WHERE token = ? AND status = "pending"', [token], (err, invitation) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!invitation) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }

      // Check if user email matches invitation email
      db.get('SELECT email FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (user.email !== invitation.invitee_email) {
          return res.status(403).json({ error: 'This invitation is not for your account' });
        }

        // Update invitation status
        db.run('UPDATE project_invitations SET status = "declined", invitee_id = ? WHERE id = ?', 
          [userId, invitation.id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to decline invitation' });
          }

          res.json({ message: 'Invitation declined successfully' });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;

    db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, notifications) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      res.json(notifications);
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ message: 'Notification marked as read' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get invitation details by token
app.get('/api/invitations/:token', (req, res) => {
  try {
    const { token } = req.params;

    db.get(`
      SELECT pi.*, p.name as project_name, u.username as inviter_name 
      FROM project_invitations pi 
      JOIN projects p ON pi.project_id = p.id 
      JOIN users u ON pi.inviter_id = u.id 
      WHERE pi.token = ? AND pi.status = "pending"
    `, [token], (err, invitation) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!invitation) {
        return res.status(404).json({ error: 'Invalid or expired invitation' });
      }

      // Check if invitation is expired
      const now = new Date();
      const expiresAt = new Date(invitation.expires_at);
      if (now > expiresAt) {
        return res.status(400).json({ error: 'Invitation has expired' });
      }

      res.json({
        projectName: invitation.project_name,
        inviterName: invitation.inviter_name,
        inviteeEmail: invitation.invitee_email,
        expiresAt: invitation.expires_at
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save user data
app.post('/api/user/data', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { folders, uncategorized } = req.body;

  // Start transaction
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    // Clear existing data
    db.run('DELETE FROM tasks WHERE column_id IN (SELECT id FROM columns WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?))', [userId]);
    db.run('DELETE FROM columns WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)', [userId]);
    db.run('DELETE FROM project_folders WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)', [userId]);
    db.run('DELETE FROM projects WHERE user_id = ?', [userId]);
    db.run('DELETE FROM folders WHERE user_id = ?', [userId]);

    // Insert folders
    folders.forEach(folder => {
      db.run('INSERT INTO folders (user_id, name, expanded) VALUES (?, ?, ?)', 
        [userId, folder.name, folder.expanded ? 1 : 0], function(err) {
        if (err) {
          console.error('Error inserting folder:', err);
          return;
        }
        
        const folderId = this.lastID;
        
        // Insert projects in this folder
        folder.projects.forEach(project => {
          db.run('INSERT INTO projects (user_id, name) VALUES (?, ?)', 
            [userId, project.name], function(err) {
            if (err) {
              console.error('Error inserting project:', err);
              return;
            }
            
            const projectId = this.lastID;
            
            // Link project to folder
            db.run('INSERT INTO project_folders (project_id, folder_id) VALUES (?, ?)', [projectId, folderId]);
            
            // Insert columns
            project.columns.forEach(column => {
              db.run('INSERT INTO columns (project_id, title, tag) VALUES (?, ?, ?)', 
                [projectId, column.title, column.tag], function(err) {
                if (err) {
                  console.error('Error inserting column:', err);
                  return;
                }
                
                const columnId = this.lastID;
                
                // Insert tasks
                column.items.forEach(task => {
                  db.run('INSERT INTO tasks (column_id, text, completed, description, due_date, priority, tags) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                    [columnId, task.text, task.completed ? 1 : 0, task.description, task.dueDate, task.priority, task.tags.join(',')]);
                });
              });
            });
          });
        });
      });
    });

    // Insert uncategorized projects
    uncategorized.forEach(project => {
      db.run('INSERT INTO projects (user_id, name) VALUES (?, ?)', 
        [userId, project.name], function(err) {
        if (err) {
          console.error('Error inserting uncategorized project:', err);
          return;
        }
        
        const projectId = this.lastID;
        
        // Insert columns
        project.columns.forEach(column => {
          db.run('INSERT INTO columns (project_id, title, tag) VALUES (?, ?, ?)', 
            [projectId, column.title, column.tag], function(err) {
            if (err) {
              console.error('Error inserting uncategorized column:', err);
              return;
            }
            
            const columnId = this.lastID;
            
            // Insert tasks
            column.items.forEach(task => {
              db.run('INSERT INTO tasks (column_id, text, completed, description, due_date, priority, tags) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                [columnId, task.text, task.completed ? 1 : 0, task.description, task.dueDate, task.priority, task.tags.join(',')]);
            });
          });
        });
      });
    });

    db.run('COMMIT', (err) => {
      if (err) {
        console.error('Error committing transaction:', err);
        db.run('ROLLBACK');
        return res.status(500).json({ error: 'Failed to save data' });
      }
      
      res.json({ message: 'Data saved successfully' });
    });
  });
});

// Serve the main application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});
