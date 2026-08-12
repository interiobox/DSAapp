# Drawing Library — MilesWeb cPanel deployment

## Upload and install

1. Upload the contents of this folder to the Node.js application root in cPanel.
2. Create the MySQL database and user in cPanel, then import `database-schema.sql` using phpMyAdmin.
3. In cPanel, open **Setup Node.js App** (Application Manager).
4. Create or edit the application with:
   - Node.js version: 20 or newer
   - Application root: the folder containing `server.mjs`
   - Startup file: `server.mjs`
   - Application URL: your domain or subdomain
   - Environment: Production
5. Open the application terminal and run `npm install --omit=dev`.
6. Add the environment variables listed below, then restart the application.

## Required environment variables

- `MYSQL_URL`: the complete MySQL connection URL for the MilesWeb database
- `SESSION_SECRET`: a long, random secret used to sign sessions

Add any existing Google Cloud Storage variables used by your account if drawing
files are stored in Google Cloud Storage.

## Database

The same Node process serves both the React frontend and the `/api` routes.
