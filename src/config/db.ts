import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  console.error("Please set DATABASE_URL in your .env file or environment variables.");
  console.error("Example: DATABASE_URL=postgresql://user:password@host:5432/database");
  process.exit(1);
}

// Parse SSL mode from connection string
const dbUrl = process.env.DATABASE_URL || "";
const urlParts = dbUrl.split("?");
let sslMode: string | null = null;

if (urlParts.length > 1) {
  const urlParams = new URLSearchParams(urlParts[1]);
  sslMode = urlParams.get("sslmode");
}

// Configure SSL based on sslmode parameter or environment
// Default: use SSL in production, disable in development
let sslConfig: boolean | { rejectUnauthorized: boolean } = false;
if (sslMode === "require" || sslMode === "prefer") {
  sslConfig = { rejectUnauthorized: false };
} else if (sslMode === "disable") {
  sslConfig = false;
} else if (process.env.NODE_ENV === "production") {
  // Default for production if sslmode not specified
  sslConfig = { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  // Connection pool optimization for better performance
  max: 20, // Maximum number of clients in the pool
  min: 5, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 60000, // Increased to 60 seconds for Docker/network delays
});

//  Create Drizzle ORM instance
export const db = drizzle(pool);

export { pool };

//  Helper to test DB connection with retry logic
export const initDB = async (retries = 5, delay = 5000) => {
  // Log connection attempt info (without sensitive data)
  const dbUrl = process.env.DATABASE_URL || "";
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":****@"); // Mask password
  console.log(`🔌 Attempting to connect to database: ${maskedUrl}`);
  
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log("✅ PostgreSQL connected successfully");
      client.release();
      return;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.error(`❌ Database connection failed (attempt ${i + 1}/${retries}):`, errorMessage);
      
      // Provide helpful error messages
      if (errorMessage.includes("timeout") || errorMessage.includes("ECONNREFUSED")) {
        console.error("💡 Troubleshooting tips:");
        console.error("   - Check if the database server is running");
        console.error("   - Verify DATABASE_URL is correct");
        console.error("   - Check network connectivity and firewall rules");
        console.error("   - Ensure database host/port are accessible");
      } else if (errorMessage.includes("authentication")) {
        console.error("💡 Authentication failed - check username and password in DATABASE_URL");
      } else if (errorMessage.includes("does not exist")) {
        console.error("💡 Database does not exist - verify database name in DATABASE_URL");
      }
      
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error("❌ Database connection failed after all retries");
        console.error("💡 Please check your DATABASE_URL and ensure the database is accessible");
        process.exit(1);
      }
    }
  }
};
