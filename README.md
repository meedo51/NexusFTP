# NexusFTP — Modern FTP/SFTP Client

A full-stack FTP/SFTP client built with React, TypeScript, and Node.js. Containerized with Docker for production deployment.

## Architecture

```
NexusFTP/
├── backend/            # Express + WebSocket server (Node.js)
│   ├── src/
│   │   ├── server.ts           # Main entry point
│   │   ├── routes/             # API route handlers
│   │   ├── services/           # FTP & SFTP protocol services
│   │   ├── middleware/         # Auth, error handling, rate limiting
│   │   └── utils/              # Logging (Winston)
│   ├── Dockerfile
│   └── package.json
├── src/                # React frontend (Vite)
│   ├── components/     # UI components
│   ├── lib/            # API client, WebSocket manager, utils
│   ├── hooks/          # React hooks
│   └── store.ts        # Zustand state management
├── nginx/              # Nginx configuration
├── scripts/            # Deployment & backup scripts
├── docker-compose.yml  # Production orchestration
├── Dockerfile.frontend # Frontend Dockerfile
└── .env.production     # Environment template
```

## Quick Start (Development)

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Start development server
npm run dev
```

## Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Production Deployment to VPS

```bash
# 1. Copy files to VPS
rsync -avz --exclude 'node_modules' --exclude '.git' ./ root@187.77.183.14:/opt/nexusftp/

# 2. SSH into VPS
ssh root@187.77.183.14

# 3. Run deployment script
cd /opt/nexusftp && bash scripts/deploy.sh
```

The application will be available at `https://ifpt.xus.me:3434`.

## Features

- **Connection Manager** — Save and manage FTP/SFTP/FTPS connections
- **Split File Browser** — Local and remote file panels with grid/list view
- **File Operations** — Upload, download, delete, rename, copy, paste
- **Code Editor** — Monaco-based editor with syntax highlighting
- **Drag & Drop** — Upload files by dragging into the browser
- **Transfer Manager** — Real-time progress tracking with queue
- **Search** — Recursive file search with results
- **Trash/Recovery** — Soft delete with 30-day retention
- **Context Menu** — Right-click operations with keyboard shortcuts
- **Notifications** — Toast-based feedback for all operations
- **WebSocket** — Real-time updates and connection monitoring
- **JWT Authentication** — Secure token-based API access
- **Rate Limiting** — Protection against abuse
- **Structured Logging** — Winston-based with rotation
- **Health Checks** — Monitoring endpoint at `/health`
- **Backup Strategy** — Automated daily backups with 30-day retention

## Security

- JWT authentication for all API endpoints
- Rate limiting on connection attempts (20/min) and API calls (200/min)
- Helmet security headers
- Input validation on all endpoints
- HTTPS/SSL ready (Let's Encrypt)
- No plaintext credential storage

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 4, Monaco Editor, Zustand
- **Backend:** Express 4, WebSocket (ws), basic-ftp, ssh2, Winston
- **Infrastructure:** Docker, Docker Compose, Nginx, Let's Encrypt
