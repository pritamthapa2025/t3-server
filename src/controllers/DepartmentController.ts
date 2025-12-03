import type { Request, Response } from "express";
import {
  getDepartments,
  getDepartmentById,
  getDepartmentByName,
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

    return res.status(200).send({ data: departments.data });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const getDepartmentByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

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

    // Check if department with this name already exists
    const existingDepartment = await getDepartmentByName(name);
    if (existingDepartment) {
      return res.status(409).send("Department name already exists");
    }

    const department = await createDepartment({ name, description });
    return res.status(201).send(department);
  } catch (error: any) {
    console.error(error);
    // Fallback: handle race condition if two requests create simultaneously
    if (error?.code === "23505") {
      return res.status(409).send("Department name already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const updateDepartmentHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { name, description } = req.body;

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
    const id = parseInt(req.params.id as string);

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
