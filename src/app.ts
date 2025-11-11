import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import index from "./routes/index.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", index);

export default app;
