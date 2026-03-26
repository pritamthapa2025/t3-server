/// <reference types="express" />

import type { AuthMeProfileRow } from "../services/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        organizationId?: string;
        employeeId?: number;
      };
      /** Set by authenticate() when present — avoids a second DB query on GET /auth/me. */
      authPrincipal?: AuthMeProfileRow;
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}

export {};









