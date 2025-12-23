import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        organizationId?: string;
        employeeId?: number;
      };
      file?: Express.Multer.File;
      files?: Express.Multer.File[];
    }
  }
}









