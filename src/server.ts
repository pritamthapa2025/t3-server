import http from "http";
import app from "./app.js";
import { initDB } from "./config/db.js";

import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

initDB();

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
