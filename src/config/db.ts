import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";
import net from "net";

dotenv.config();

// Validate DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  console.error(
    "Please set DATABASE_URL in your .env file or environment variables."
  );
  console.error(
    "Example: DATABASE_URL=postgresql://user:password@host:5432/database"
  );
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
  // Optimized connection pool for better performance
  max: 25, // Increased max connections
  min: 8, // Increased min connections to reduce connection overhead
  idleTimeoutMillis: 45000, // Increased idle timeout
  connectionTimeoutMillis: 30000, // Reduced connection timeout to fail faster
  // acquireTimeoutMillis not supported in this pool config - using connectionTimeoutMillis instead
  query_timeout: 25000, // Query timeout to prevent hanging queries
  statement_timeout: 25000, // Statement timeout
});

//  Create Drizzle ORM instance
export const db = drizzle(pool);

export { pool };

// Helper to test basic network connectivity to database host:port
const testNetworkConnectivity = (
  host: string,
  port: number,
  timeout: number = 5000
): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let _connected = false;

    socket.setTimeout(timeout);

    socket.once("connect", () => {
      _connected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
};

// Extract host and port from connection string
const parseConnectionString = (
  connectionString: string
): { host: string; port: number } | null => {
  try {
    // Handle postgres:// and postgresql:// URLs
    const url = connectionString.replace(/^postgres:\/\//, "postgresql://");
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    };
  } catch {
    return null;
  }
};

//  Helper to test DB connection with retry logic
export const initDB = async (retries = 5, delay = 5000) => {
  const dbUrl = process.env.DATABASE_URL || "";

  // Test basic network connectivity first
  const connectionInfo = parseConnectionString(dbUrl);
  if (connectionInfo) {
    const isReachable = await testNetworkConnectivity(
      connectionInfo.host,
      connectionInfo.port,
      10000
    );

    if (!isReachable) {
      console.error(
        `❌ Network connectivity test failed: Cannot reach ${connectionInfo.host}:${connectionInfo.port}`
      );
      console.error("💡 This indicates a network/firewall issue:");
      console.error(
        "   - The database server may be blocking connections from this IP"
      );
      console.error(
        "   - Firewall rules may need to whitelist this server's IP address"
      );
      console.error("   - The database host/port may be incorrect");
      console.error("   - Network routing issues between servers");
      console.error(
        `   - Check if ${connectionInfo.host}:${connectionInfo.port} is accessible from this location`
      );
      console.error(
        "   - Compare network configuration with the working server (Germany)"
      );
      process.exit(1);
    }
  }

  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      
      // Extract database name from connection string for display
      let dbName = "database";
      try {
        const url = dbUrl.replace(/^postgres:\/\//, "postgresql://");
        const parsed = new URL(url);
        dbName = parsed.pathname.replace("/", "") || "database";
      } catch {
        // Use default if parsing fails
      }
      
      console.log(`✅ Database connected successfully to: ${dbName}`);
      return;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.error(
        `❌ Database connection failed (attempt ${i + 1}/${retries}):`,
        errorMessage
      );

      // Provide helpful error messages
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED")
      ) {
        console.error("💡 Troubleshooting tips:");
        console.error("   - Check if the database server is running");
        console.error("   - Verify DATABASE_URL is correct");
        console.error("   - Check network connectivity and firewall rules");
        console.error("   - Ensure database host/port are accessible");
        if (connectionInfo) {
          console.error(
            `   - Verify firewall allows connections from this server to ${connectionInfo.host}:${connectionInfo.port}`
          );
          console.error(
            "   - Check if database server whitelist includes this server's IP address"
          );
        }
      } else if (errorMessage.includes("authentication")) {
        console.error(
          "💡 Authentication failed - check username and password in DATABASE_URL"
        );
      } else if (errorMessage.includes("does not exist")) {
        console.error(
          "💡 Database does not exist - verify database name in DATABASE_URL"
        );
      }

      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error("❌ Database connection failed after all retries");
        console.error(
          "💡 Please check your DATABASE_URL and ensure the database is accessible"
        );
        if (connectionInfo) {
          console.error(
            `💡 Network test passed, but PostgreSQL connection failed. Check:`
          );
          console.error("   - Database authentication credentials");
          console.error("   - Database server configuration");
          console.error("   - PostgreSQL connection limits");
        }
        process.exit(1);
      }
    }
  }
};
