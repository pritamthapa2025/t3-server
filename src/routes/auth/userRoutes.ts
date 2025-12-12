import { Router } from "express";
import multer from "multer";
import {
  getUsersHandler,
  getUserByIdHandler,
  createUserHandler,
  updateUserHandler,
  deleteUserHandler,
} from "../../controllers/UserControler.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  getUsersQuerySchema,
  getUserByIdSchema,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
} from "../../validations/user.validations.js";

const router = Router();

// Configure multer for memory storage (we'll upload directly to DO Spaces)
// Only process file field, allow other fields to pass through
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
}).single("profilePicture"); // Only handle the profilePicture field

// Multer error handler middleware
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send("File size too large. Maximum size is 5MB.");
    }
    return res.status(400).send(`File upload error: ${err.message}`);
  }
  if (err) {
    return res.status(400).send(err.message);
  }
  next();
};

// Apply authentication middleware to all user routes
router.use(authenticate);

router
  .route("/users")
  .get(validate(getUsersQuerySchema), getUsersHandler)
  .post(
    (req, res, next) => {
      // Apply multer only if Content-Type is multipart/form-data
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        upload(req, res, (err) => {
          if (err) {
            return handleMulterError(err, req, res, next);
          }
          next();
        });
      } else {
        // Skip multer for JSON requests
        next();
      }
    },
    validate(createUserSchema),
    createUserHandler
  );
router
  .route("/users/:id")
  .get(validate(getUserByIdSchema), getUserByIdHandler)
  .put(
    (req, res, next) => {
      // Apply multer only if Content-Type is multipart/form-data
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        upload(req, res, (err) => {
          if (err) {
            return handleMulterError(err, req, res, next);
          }
          next();
        });
      } else {
        // Skip multer for JSON requests
        next();
      }
    },
    validate(updateUserSchema),
    updateUserHandler
  )
  .delete(validate(deleteUserSchema), deleteUserHandler);

export default router;
