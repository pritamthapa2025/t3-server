import type { Request, Response } from "express";
import {
  getPositions,
  getPositionById,
  getPositionByName,
  createPosition,
  updatePosition,
  deletePosition,
} from "../services/position.service.js";

export const getPositionsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const positions = await getPositions(offset, limit);

    return res
      .status(200)
      .send({ data: positions.data, total: positions.total });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const getPositionByIdHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("Position ID is required");
    }
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return res.status(400).send("Invalid position ID");
    }

    const position = await getPositionById(id);
    if (!position) {
      return res.status(404).send("Position not found");
    }

    return res.status(200).send(position);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const createPositionHandler = async (req: Request, res: Response) => {
  try {
    const { name, departmentId, description } = req.body;

    if (!name) {
      return res.status(400).send("Position name is required");
    }

    // Check if position with this name already exists
    const existingPosition = await getPositionByName(name);
    if (existingPosition) {
      return res.status(409).send("Position name already exists");
    }

    const position = await createPosition({ name, departmentId, description });
    return res.status(201).send(position);
  } catch (error: any) {
    console.error(error);
    // Fallback: handle race condition if two requests create simultaneously
    if (error?.code === "23505") {
      return res.status(409).send("Position name already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const updatePositionHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("Position ID is required");
    }
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return res.status(400).send("Invalid position ID");
    }

    const { name, departmentId, description } = req.body;

    if (!name && departmentId === undefined && description === undefined) {
      return res
        .status(400)
        .send(
          "At least one field (name, departmentId, or description) is required"
        );
    }

    const position = await updatePosition(id, {
      name,
      departmentId,
      description,
    });
    if (!position) {
      return res.status(404).send("Position not found");
    }

    return res.status(200).send(position);
  } catch (error: any) {
    console.error(error);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Position name already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const deletePositionHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("Position ID is required");
    }
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return res.status(400).send("Invalid position ID");
    }

    const position = await deletePosition(id);
    if (!position) {
      return res.status(404).send("Position not found");
    }

    return res.status(200).send("Position deleted successfully");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};
