import path from "node:path";

process.env.FRONTEND_DIST_DIR = path.join(process.cwd(), "public");
await import("./index.mjs");
