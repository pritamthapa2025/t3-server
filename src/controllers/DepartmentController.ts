import type { Request, Response } from "express";
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../services/department.service.js";

export const getDepartmentsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const departments = await getDepartments(offset, limit);

    return res
      .status(200)
      .send({ data: departments.data, total: departments.total });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const getDepartmentByIdHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("Department ID is required");
    }
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return res.status(400).send("Invalid department ID");
    }

    const department = await getDepartmentById(id);
    if (!department) {
      return res.status(404).send("Department not found");
    }

    return res.status(200).send(department);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const createDepartmentHandler = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).send("Department name is required");
    }

    const department = await createDepartment({ name, description });
    return res.status(201).send(department);
  } catch (error: any) {
    console.error(error);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Department name already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const updateDepartmentHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("Department ID is required");
    }
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return res.status(400).send("Invalid department ID");
    }

    const { name, description } = req.body;

    if (!name && description === undefined) {
      return res
        .status(400)
        .send("At least one field (name or description) is required");
    }

    const department = await updateDepartment(id, { name, description });
    if (!department) {
      return res.status(404).send("Department not found");
    }

    return res.status(200).send(department);
  } catch (error: any) {
    console.error(error);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Department name already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const deleteDepartmentHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("Department ID is required");
    }
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return res.status(400).send("Invalid department ID");
    }

    const department = await deleteDepartment(id);
    if (!department) {
      return res.status(404).send("Department not found");
    }

    return res.status(200).send("Department deleted successfully");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};
