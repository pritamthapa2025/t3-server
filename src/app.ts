import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import index from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
console.log("old1", process.env.CLIENT_URL_Old);
console.log(
  "All CORS origins:",
  [
    "http://localhost:3000",
    process.env.CLIENT_URL || "http://localhost:3000",
    process.env.CLIENT_URL_Old,
  ].filter((url): url is string => Boolean(url))
);

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      process.env.CLIENT_URL || "http://localhost:3000",
      process.env.CLIENT_URL_Old,
    ].filter((url): url is string => Boolean(url)),
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint (before routes)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api/v1", index);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
