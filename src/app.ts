import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import index from "./routes/index.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Get allowed origins from environment variable (comma-separated)
      const allowedOrigins = process.env.CLIENT_URL
        ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
        : ["*"];

      // If "*" is in allowed origins, allow all
      if (allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      // Check if the origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject the request
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", index);

export default app;
