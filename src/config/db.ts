import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  // Connection pool optimization for better performance
  max: 20, // Maximum number of clients in the pool
  min: 5, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 30000, // Return an error after 30 seconds if connection cannot be established (increased for production)
});

//  Create Drizzle ORM instance
export const db = drizzle(pool);

export { pool };

//  Helper to test DB connection with retry logic
export const initDB = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log("✅ PostgreSQL connected successfully");
      client.release();
      return;
    } catch (error) {
      console.error(`Database connection failed (attempt ${i + 1}/${retries}):`, error);
      
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error("❌ Database connection failed after all retries");
        process.exit(1);
      }
    }
  }
};
