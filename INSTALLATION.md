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

### Changing the Default Port
By default, the application is configured to run on port `3000`. Since you are installing it on port `3434`, you will need to open `server.ts` before building, and change line 18:
```typescript
// Change this:
const PORT = 3000;

// To this:
const PORT = 3434;
```
*(Alternatively, you can leave the application running on port `3000` and use Nginx to map port `3434` to it, as shown in the Nginx section).*

### Option A: Running Manually (Testing)

You can test that the application starts up correctly by running the production start script:

```bash
npm run start
```
*Note: The server will start and output the port it's running on. Press `Ctrl+C` to stop it.*

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

---

## Setting up a Reverse Proxy for `iftp.xus.me`

To access your app via your domain (`iftp.xus.me`) using a standard web port (`80`/`443`) or your custom port (`3434`), you should set up a reverse proxy like Nginx.

### Nginx Configuration

Create a new configuration block in `/etc/nginx/sites-available/iftp.xus.me`:

```nginx
server {
    # If the proxy itself needs to listen on 3434, use: listen 3434;
    # Otherwise, for standard HTTP, use: listen 80;
    listen 80; 
    server_name iftp.xus.me;

    location / {
        # Ensure this matches the port your Node app is running on (3434 or 3000)
        proxy_pass http://localhost:3434;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable your domain configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/iftp.xus.me /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Security Recommendations

- Ensure you secure your server with a firewall (like UFW or iptables) and only allow inbound traffic on required ports (e.g., 22 for SSH, 80 for HTTP, 443 for HTTPS).
- Secure your HTTP traffic using an SSL certificate (e.g., Let's Encrypt / Certbot).
- Keep your Node.js runtime and project dependencies updated.
