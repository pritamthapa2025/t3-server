import type { Request, Response } from "express";
import {
  getPositions,
  getPositionById,
  getPositionByName,
  createPosition,
  updatePosition,
  deletePosition,
} from "../services/position.service.js";
import { logger } from "../utils/logger.js";

export const getPositionsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const offset = (page - 1) * limit;

    const positions = await getPositions(offset, limit, search);

    logger.info("Positions fetched successfully");
    return res.status(200).json({
      success: true,
      data: positions.data,
      total: positions.total,
      pagination: positions.pagination,
    });
  } catch (error) {
    logger.logApiError("Error fetching positions", error, req);
    return res.status(500).send("Internal server error");
  }
};

export const getPositionByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const position = await getPositionById(id);
    if (!position) {
      return res.status(404).send("Position not found");
    }

    logger.info("Position fetched successfully");
    return res.status(200).send(position);
  } catch (error) {
    logger.logApiError("Error fetching position by ID", error, req);
    return res.status(500).send("Internal server error");
  }
};

export const createPositionHandler = async (req: Request, res: Response) => {
  try {
    const { name, departmentId, description } = req.body;

    // Check if position with this name already exists
    const existingPosition = await getPositionByName(name);
    if (existingPosition) {
      return res.status(409).send("Position name already exists");
    }

    const position = await createPosition({ name, departmentId, description });
    logger.info("Position created successfully");
    return res.status(201).send(position);
  } catch (error: any) {
    logger.logApiError("Error creating position", error, req);
    // Fallback: handle race condition if two requests create simultaneously
    if (error?.code === "23505") {
      return res.status(409).send("Position name already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const updatePositionHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, departmentId, description } = req.body;

    const position = await updatePosition(id, {
      name,
      departmentId,
      description,
    });
    if (!position) {
      return res.status(404).send("Position not found");
    }

    logger.info("Position updated successfully");
    return res.status(200).send(position);
  } catch (error: any) {
    logger.logApiError("Error updating position", error, req);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Position name already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const deletePositionHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const position = await deletePosition(id);
    if (!position) {
      return res.status(404).send("Position not found");
    }

    logger.info("Position deleted successfully");
    return res.status(200).send("Position deleted successfully");
  } catch (error) {
    logger.logApiError("Error deleting position", error, req);
    return res.status(500).send("Internal server error");
  }
};
