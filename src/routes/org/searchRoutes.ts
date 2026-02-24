import { Router, type IRouter } from "express";
import { globalSearchHandler } from "../../controllers/SearchController.js";
import { authenticate } from "../../middleware/auth.js";

const router: IRouter = Router();

// GET /api/v1/org/search?q=<query>
router.get("/search", authenticate, globalSearchHandler);

export default router;
