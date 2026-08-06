import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

if (!process.env.MYSQL_URL) {
  throw new Error(
    "MYSQL_URL must be set. Provide a MySQL connection string.",
  );
}

const mysqlUrl = new URL(process.env.MYSQL_URL);
mysqlUrl.searchParams.delete("ssl-mode");

export const pool = mysql.createPool({
  uri: mysqlUrl.toString(),
  // Aiven's REQUIRED TLS endpoint presents a self-signed chain in this
  // environment. Keep transport encryption enabled while accepting that chain.
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
});
export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
