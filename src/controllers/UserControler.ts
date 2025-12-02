import type { Request, Response } from "express";
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../services/user.service.js";
import { createEmployee } from "../services/employee.service.js";
import { getDepartmentById } from "../services/department.service.js";
import { getPositionById } from "../services/position.service.js";
import { hashPassword } from "../utils/hash.js";
import { createBankAccount } from "../services/bankAccount.service.js";

export const getUsersHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const offset = (page - 1) * limit;

    const users = await getUsers(offset, limit);

    return res.status(200).send({ data: users.data, total: users.total });
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const getUserByIdHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("User ID is required");
    }

    const user = await getUserById(idParam);
    if (!user) {
      return res.status(404).send("User not found");
    }

    return res.status(200).send(user);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};

export const createUserHandler = async (req: Request, res: Response) => {
  let createdUser = null;
  try {
    const {
      fullName,
      email,
      phone,
      departmentId,
      positionId,
      reportsTo,
      startDate,
      accountHolderName,
      bankName,
      accountNumber,
      routingNumber,
      accountType,
      branchName,
    } = req.body;

    if (!fullName || !email) {
      return res.status(400).send("Full name and email are required");
    }

    if (!startDate) {
      return res.status(400).send("Start date is required");
    }

    // Validate bank account fields if provided
    if (accountHolderName || bankName || accountNumber || accountType) {
      if (!accountHolderName || !bankName || !accountNumber || !accountType) {
        return res
          .status(400)
          .send(
            "providing bank account details, accountHolderName, bankName, accountNumber, and accountType are required"
          );
      }

      // Validate accountType enum
      const validAccountTypes = [
        "savings",
        "current",
        "salary",
        "checking",
        "business",
      ];
      if (!validAccountTypes.includes(accountType)) {
        return res
          .status(400)
          .send(
            `Invalid accountType. Must be one of: ${validAccountTypes.join(
              ", "
            )}`
          );
      }
    }

    // Validate departmentId if provided
    if (departmentId !== undefined && departmentId !== null) {
      const department = await getDepartmentById(departmentId);
      if (!department) {
        return res.status(400).send("Invalid department ID");
      }
    }

    // Validate positionId if provided
    if (positionId !== undefined && positionId !== null) {
      const position = await getPositionById(positionId);
      if (!position) {
        return res.status(400).send("Invalid position ID");
      }
    }

    // Validate reportsTo (user ID) if provided
    if (reportsTo !== undefined && reportsTo !== null) {
      const manager = await getUserById(reportsTo);
      if (!manager) {
        return res.status(400).send("Invalid reportsTo user ID");
      }
    }

    // Hash default password for all new users
    const defaultPassword = "t3-setLaterPassword2025";
    const passwordHash = await hashPassword(defaultPassword);

    // Create user with default password (user can change it later)
    createdUser = await createUser({
      fullName,
      email,
      passwordHash,
      phone,
    });

    if (!createdUser) {
      return res.status(500).send("Failed to create user");
    }

    // Create employee - if this fails, we'll rollback by deleting the user
    try {
      await createEmployee({
        userId: createdUser.id,
        departmentId,
        positionId,
        reportsTo,
        startDate: new Date(startDate),
      });
    } catch (employeeError: any) {
      if (createdUser) {
        await deleteUser(createdUser.id);
      }
      throw employeeError;
    }

    // Create bank account if provided
    if (accountHolderName && bankName && accountNumber && accountType) {
      try {
        await createBankAccount({
          userId: createdUser.id,
          accountHolderName,
          bankName,
          accountNumber,
          routingNumber,
          accountType,
          branchName,
          isPrimary: true, // Set as primary if it's the first account
        });
      } catch (bankAccountError: any) {
        // If bank account creation fails, clean up user and employee
        if (createdUser) {
          try {
            await deleteUser(createdUser.id);
          } catch (cleanupError) {
            console.error("Failed to cleanup user:", cleanupError);
          }
        }
        throw bankAccountError;
      }
    }

    return res.status(201).send("user created successfully");
  } catch (error: any) {
    console.error(error);

    // If user was created but employee creation failed, it's already deleted above
    // But if user creation itself failed, we need to handle it
    if (createdUser && error.code !== "23503") {
      // Try to clean up if there's still a user created
      try {
        await deleteUser(createdUser.id);
      } catch (cleanupError) {
        console.error("Failed to cleanup user:", cleanupError);
      }
    }

    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Email or employee ID already exists");
    }
    if (error.code === "23503") {
      // Foreign key constraint violation
      return res
        .status(400)
        .send("Invalid department, position, or reportsTo reference");
    }
    return res.status(500).send("Internal server error");
  }
};

export const updateUserHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("User ID is required");
    }

    const { fullName, email, phone, isActive, isVerified } = req.body;

    if (
      !fullName &&
      !email &&
      phone === undefined &&
      isActive === undefined &&
      isVerified === undefined
    ) {
      return res
        .status(400)
        .send(
          "At least one field (fullName, email, phone, isActive, or isVerified) is required"
        );
    }

    const user = await updateUser(idParam, {
      fullName,
      email,
      phone,
      isActive,
      isVerified,
    });
    if (!user) {
      return res.status(404).send("User not found");
    }

    return res.status(200).send(user);
  } catch (error: any) {
    console.error(error);
    if (error.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(409).send("Email already exists");
    }
    return res.status(500).send("Internal server error");
  }
};

export const deleteUserHandler = async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    if (!idParam) {
      return res.status(400).send("User ID is required");
    }

    const user = await deleteUser(idParam);
    if (!user) {
      return res.status(404).send("User not found");
    }

    return res.status(200).send("User deleted successfully");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};
