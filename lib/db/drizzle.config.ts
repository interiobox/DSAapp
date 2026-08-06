import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.MYSQL_URL) {
  throw new Error("MYSQL_URL must be set");
}

const mysqlUrl = new URL(process.env.MYSQL_URL);
mysqlUrl.searchParams.delete("ssl-mode");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "mysql",
  dbCredentials: {
    url: mysqlUrl.toString(),
  },
});
