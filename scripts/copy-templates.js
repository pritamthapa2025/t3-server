import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcTemplates = path.join(root, "src", "templates");
const destTemplates = path.join(root, "dist", "templates");

if (!fs.existsSync(srcTemplates)) {
  console.warn("copy-templates: src/templates not found, skipping");
  process.exit(0);
}

fs.mkdirSync(destTemplates, { recursive: true });
fs.cpSync(srcTemplates, destTemplates, { recursive: true });
console.log("Templates copied to dist/templates");
