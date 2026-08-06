import app from "./app";
import { logger } from "./lib/logger";
import { ensurePortalSeed } from "./lib/portalAuth";
import { purgeExpiredRecycleBin } from "./lib/recycleBin";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

void ensurePortalSeed().then(async () => {
  await purgeExpiredRecycleBin();
  setInterval(() => void purgeExpiredRecycleBin().catch((error) => logger.error({ err: error }, "Recycle-bin purge failed")), 60 * 60 * 1000);
  app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  });
}).catch((error) => {
  logger.error({ err: error }, "Unable to initialize portal accounts");
  process.exit(1);
});
