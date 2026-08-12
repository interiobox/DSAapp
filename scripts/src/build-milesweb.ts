import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(import.meta.dirname, "../..");
const outputDir = path.join(rootDir, "milesweb-deploy");

async function run(command: string, args: string[]) {
  await execFileAsync(command, args, {
    cwd: rootDir,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function build() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  await run("pnpm", ["--filter", "@workspace/project-hub", "run", "build"]);
  await run("pnpm", ["--filter", "@workspace/api-server", "run", "build"]);

  const apiDistDir = path.join(rootDir, "artifacts/api-server/dist");
  const apiDistFiles = await readdir(apiDistDir);

  for (const fileName of apiDistFiles) {
    if (!fileName.endsWith(".mjs")) continue;
    await cp(
      path.join(apiDistDir, fileName),
      path.join(outputDir, fileName),
    );
  }
  await cp(
    path.join(rootDir, "artifacts/project-hub/dist/public"),
    path.join(outputDir, "public"),
    { recursive: true },
  );
  await cp(
    path.join(rootDir, "lib/db/drizzle/0000_massive_the_initiative.sql"),
    path.join(outputDir, "database-schema.sql"),
  );

  await writeFile(
    path.join(outputDir, "server.mjs"),
    `import path from "node:path";

process.env.FRONTEND_DIST_DIR = path.join(process.cwd(), "public");
await import("./index.mjs");
`,
  );

  await writeFile(
    path.join(outputDir, "package.json"),
    `${JSON.stringify(
      {
        name: "drawing-library-milesweb",
        private: true,
        type: "module",
        engines: { node: ">=20" },
        scripts: { start: "node server.mjs" },
        dependencies: {
          "@google-cloud/storage": "^7.21.0",
          mysql2: "^3.23.2",
        },
      },
      null,
      2,
    )}
`,
  );

  await writeFile(
    path.join(outputDir, "README-MILESWEB.md"),
    `# Drawing Library — MilesWeb cPanel deployment

## Upload and install

1. Upload the contents of this folder to the Node.js application root in cPanel.
2. Create the MySQL database and user in cPanel, then import \`database-schema.sql\` using phpMyAdmin.
3. In cPanel, open **Setup Node.js App** (Application Manager).
4. Create or edit the application with:
   - Node.js version: 20 or newer
   - Application root: the folder containing \`server.mjs\`
   - Startup file: \`server.mjs\`
   - Application URL: your domain or subdomain
   - Environment: Production
5. Open the application terminal and run \`npm install --omit=dev\`.
6. Add the environment variables listed below, then restart the application.

## Required environment variables

- \`MYSQL_URL\`: the complete MySQL connection URL for the MilesWeb database
- \`SESSION_SECRET\`: a long, random secret used to sign sessions

Add any existing Google Cloud Storage variables used by your account if drawing
files are stored in Google Cloud Storage.

## Database

The same Node process serves both the React frontend and the \`/api\` routes.
`,
  );
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});