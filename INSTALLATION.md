# Server Installation Guide

This document provides detailed, step-by-step instructions for deploying and running this application on a production server.

The application is a full-stack React and Express application. It is bundled with Vite and esbuild.

## Prerequisites

Before you begin, ensure your server has the following installed:

1. **Node.js** (version 18 or higher recommended)
   - To check if Node.js is installed, run: `node -v`
   - To install Node.js, we recommend using NVM (Node Version Manager) or the official installer from [nodejs.org](https://nodejs.org/).
2. **NPM** (Node Package Manager)
   - Usually installed automatically with Node.js. Check using: `npm -v`
3. Optional: **PM2** (Process Manager)
   - Useful for keeping the application running in the background and automatically restarting it on server reboots.
   - Install globally via: `npm install -g pm2`

---

## Installation Steps

### 1. Transfer Files to the Server

Clone the repository or transfer the project files (via FTP/SFTP) to your server.
Navigate to the directory where the files are located using the terminal:

```bash
cd /path/to/your/app
```

### 2. Install Dependencies

Install all the required Node.js libraries and dependencies defined in `package.json`.

```bash
npm install
```

### 3. Environment Variables

If your application requires environment variables, you must configure them before starting the application. 

1. Create a `.env` file from the example file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in a text editor (like `nano` or `vim`) and update the values appropriately.
   ```bash
   nano .env
   ```

### 4. Build the Application

Build both the React frontend and the Express backend for production. This shrinks down the code and prepares it for optimal performance.

```bash
npm run build
```

This command will:
- Bundle the Vite (React) client into the `dist/` directory.
- Bundle the Express Node.js backend into `dist/server.cjs`.

---

## Running the Application

### Option A: Running Manually (Testing)

You can test that the application starts completely by running the production start script.

```bash
npm run start
```
*Note: The server will run on port 3000 by default. Press `Ctrl+C` to stop it.*

### Option B: Running in the Background (Recommended for Production)

To keep the application running even after you disconnect from the server terminal, use **PM2**.

1. Start the app via the compiled server file:
   ```bash
   pm2 start dist/server.cjs --name "nexusftp-app"
   ```

2. Save the PM2 list so it restarts on server reboot:
   ```bash
   pm2 save
   pm2 startup
   ```

3. Some useful PM2 commands:
   - View logs: `pm2 logs nexusftp-app`
   - Stop app: `pm2 stop nexusftp-app`
   - Restart app: `pm2 restart nexusftp-app`

---

## Setting up a Reverse Proxy (Optional but Recommended)

By default, the Express server listens on Port `3000`. To access your app via a standard web port (`80` for HTTP or `443` for HTTPS) or a domain name, you should set up a reverse proxy like Nginx or Apache.

### Example Nginx Configuration

Create a new configuration block in `/etc/nginx/sites-available/your-domain.com`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/your-domain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Security Recommendations

- Ensure you secure your server with a firewall (like UFW or iptables) and only allow inbound traffic on required ports (e.g., 22 for SSH, 80 for HTTP, 443 for HTTPS).
- Secure your HTTP traffic using an SSL certificate (e.g., Let's Encrypt / Certbot).
- Keep your Node.js runtime and project dependencies updated.
