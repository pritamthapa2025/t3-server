import type { Response } from "express";

export function successResponse(
  res: Response,
  data: unknown,
  message?: string,
  statusCode = 200,
) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(message && { message }),
  });
}

export function errorResponse(
  res: Response,
  message: string,
  statusCode = 500,
) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}
