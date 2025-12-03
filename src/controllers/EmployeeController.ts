import type { Request, Response } from "express";
import {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../services/employee.service.js";

export const getEmployeesHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const employees = await getEmployees(offset, limit);

    return res
      .status(200)
      .send({ data: employees.data, total: employees.total });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const getEmployeeByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const employee = await getEmployeeById(id);
    if (!employee) {
      return res.status(404).send("Employee not found");
    }

    return res.status(200).send(employee);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const createEmployeeHandler = async (req: Request, res: Response) => {
  try {
    const { userId, employeeId, departmentId, positionId, reportsTo, startDate } = req.body;

    const employee = await createEmployee({
      userId,
      employeeId,
      departmentId,
      positionId,
      reportsTo,
      startDate,
    });
    return res.status(201).send(employee);
  } catch (error: any) {
    console.error(error);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Employee ID already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const updateEmployeeHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);
    const { userId, employeeId, departmentId, positionId, reportsTo } = req.body;

    const employee = await updateEmployee(id, {
      userId,
      employeeId,
      departmentId,
      positionId,
      reportsTo,
    });
    if (!employee) {
      return res.status(404).send("Employee not found");
    }

    return res.status(200).send(employee);
  } catch (error: any) {
    console.error(error);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Employee ID already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const deleteEmployeeHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    const employee = await deleteEmployee(id);
    if (!employee) {
      return res.status(404).send("Employee not found");
    }

    return res.status(200).send("Employee deleted successfully");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

