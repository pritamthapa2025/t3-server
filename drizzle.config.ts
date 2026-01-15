import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

export default {
  schema: ["./dist/drizzle/schema/**/*.js", "./dist/drizzle/enums/**/*.js", "./dist/drizzle/index.js"],
  out: "./src/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["auth", "org"],
} satisfies Config;
