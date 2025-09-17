# z-task

A collaborative todo application with user authentication, project management, and real-time collaboration features.

## Features

- 🔐 **User Authentication**: Secure signup/login with JWT tokens
- 📁 **Project Organization**: Folders and projects with drag-and-drop support
- 🏷️ **Smart Tagging**: Color-coded tags for easy task categorization
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile
- 🌙 **Dark/Light Theme**: Toggle between themes
- 💾 **Persistent Storage**: SQLite database for reliable data storage
- 🔒 **Security**: Rate limiting, CORS protection, and secure authentication

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

### Production Deployment

#### Option 1: Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set environment variables in Vercel dashboard:**
   - `JWT_SECRET`: Your secure JWT secret
   - `NODE_ENV`: `production`

#### Option 2: Docker

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

2. **Or build manually:**
   ```bash
   docker build -t z-task .
   docker run -p 3000:3000 -e JWT_SECRET=your-secret z-task
   ```

#### Option 3: Traditional Server

1. **Install Node.js (16+) on your server**

2. **Clone and setup:**
   ```bash
   git clone <your-repo>
   cd z-task
   npm install
   cp env.example .env
   # Edit .env with production values
   ```

3. **Start with PM2:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "z-task"
   pm2 startup
   pm2 save
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `DATABASE_URL` | Database file path | `./database.sqlite` |

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Data Management
- `GET /api/user/data` - Get user's projects and tasks
- `POST /api/user/data` - Save user's projects and tasks

### Health Check
- `GET /api/health` - Server health status

## Database Schema

The application uses SQLite with the following tables:
- `users` - User accounts
- `folders` - Project folders
- `projects` - User projects
- `columns` - Project columns
- `tasks` - Individual tasks
- `project_folders` - Project-folder relationships

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Rate Limiting**: Prevents abuse and DDoS attacks
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet.js**: Security headers and CSP
- **Input Validation**: Server-side validation for all inputs

## Development

### Project Structure
```
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── index.html         # Frontend HTML
├── styles.css         # Frontend styles
├── script.js          # Frontend JavaScript
├── database.sqlite    # SQLite database (auto-created)
├── Dockerfile         # Docker configuration
├── docker-compose.yml # Docker Compose setup
└── vercel.json        # Vercel deployment config
```

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (if implemented)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the API endpoints

## Changelog

### v1.0.0
- Initial release
- User authentication
- Project and task management
- Drag-and-drop functionality
- Tag system with colors
- Responsive design
- Dark/light theme support

