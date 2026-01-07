#!/usr/bin/env tsx
/**
 * Health check script to verify production environment before starting server
 * Run this before deploying to catch configuration issues early
 */

import dotenv from "dotenv";
import { Pool } from "pg";
import { Redis } from "ioredis";
import net from "net";

dotenv.config();

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

const results: CheckResult[] = [];

function addResult(name: string, status: "pass" | "fail" | "warn", message: string) {
  results.push({ name, status, message });
  const icon = status === "pass" ? "✅" : status === "fail" ? "❌" : "⚠️";
  console.log(`${icon} ${name}: ${message}`);
}

// Check environment variables
console.log("\n🔍 Running production health checks...\n");

// Check DATABASE_URL
if (!process.env.DATABASE_URL) {
  addResult("DATABASE_URL", "fail", "Missing required environment variable");
} else {
  addResult("DATABASE_URL", "pass", "Set");
  
  // Test database connection
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    await pool.end();
    addResult("Database Connection", "pass", "Successfully connected");
  } catch (error: any) {
    addResult("Database Connection", "fail", `Failed: ${error.message}`);
  }
}

// Check REDIS_URL (optional)
if (!process.env.REDIS_URL) {
  addResult("REDIS_URL", "warn", "Not set (optional - 2FA features will be disabled)");
} else {
  addResult("REDIS_URL", "pass", "Set");
  
  // Test Redis connection
  try {
    const redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 5000,
      lazyConnect: false,
    });
    
    await redis.ping();
    await redis.quit();
    addResult("Redis Connection", "pass", "Successfully connected");
  } catch (error: any) {
    addResult("Redis Connection", "warn", `Failed: ${error.message} (app will still start)`);
  }
}

// Check PORT
const port = process.env.PORT || "4000";
addResult("PORT", "pass", `Set to ${port}`);

// Check NODE_ENV
if (!process.env.NODE_ENV) {
  addResult("NODE_ENV", "warn", "Not set (defaults to development)");
} else {
  addResult("NODE_ENV", "pass", `Set to ${process.env.NODE_ENV}`);
}

// Check if dist folder exists
try {
  const fs = await import("fs/promises");
  await fs.access("dist/server.js");
  addResult("Build Files", "pass", "dist/server.js exists");
} catch {
  addResult("Build Files", "fail", "dist/server.js not found - run 'npm run build'");
}

// Summary
console.log("\n📊 Summary:\n");
const passed = results.filter((r) => r.status === "pass").length;
const failed = results.filter((r) => r.status === "fail").length;
const warnings = results.filter((r) => r.status === "warn").length;

console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⚠️  Warnings: ${warnings}\n`);

if (failed > 0) {
  console.log("❌ Health check failed! Please fix the issues above before deploying.\n");
  process.exit(1);
} else if (warnings > 0) {
  console.log("⚠️  Health check passed with warnings. Review the warnings above.\n");
  process.exit(0);
} else {
  console.log("✅ All health checks passed! Ready for production.\n");
  process.exit(0);
}

