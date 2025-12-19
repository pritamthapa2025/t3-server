import { db } from "../config/db.js";
import { userBankAccounts } from "../drizzle/schema/org.schema.js";
import { and, eq } from "drizzle-orm";

export const createBankAccount = async (data: {
  userId: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  routingNumber?: string;
  accountType: "savings" | "current" | "salary" | "checking" | "business";
  branchName?: string;
  isPrimary?: boolean;
}) => {
  const [bankAccount] = await db
    .insert(userBankAccounts)
    .values({
      userId: data.userId,
      accountHolderName: data.accountHolderName,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      routingNumber: data.routingNumber || null,
      accountType: data.accountType,
      branchName: data.branchName || null,
      isPrimary: data.isPrimary !== undefined ? data.isPrimary : false,
    })
    .returning();
  return bankAccount;
};

export const getPrimaryBankAccount = async (userId: string) => {
  const [bankAccount] = await db
    .select()
    .from(userBankAccounts)
    .where(
      and(
        eq(userBankAccounts.userId, userId),
        eq(userBankAccounts.isPrimary, true),
        eq(userBankAccounts.isDeleted, false)
      )
    )
    .limit(1);
  return bankAccount || null;
};

export const updateBankAccount = async (
  userId: string,
  data: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    routingNumber?: string;
    accountType?: "savings" | "current" | "salary" | "checking" | "business";
    branchName?: string;
  }
) => {
  const updateData: any = {
    updatedAt: new Date(),
  };

  if (data.accountHolderName !== undefined) {
    updateData.accountHolderName = data.accountHolderName;
  }
  if (data.bankName !== undefined) {
    updateData.bankName = data.bankName;
  }
  if (data.accountNumber !== undefined) {
    updateData.accountNumber = data.accountNumber;
  }
  if (data.routingNumber !== undefined) {
    updateData.routingNumber = data.routingNumber || null;
  }
  if (data.accountType !== undefined) {
    updateData.accountType = data.accountType;
  }
  if (data.branchName !== undefined) {
    updateData.branchName = data.branchName || null;
  }

  const [bankAccount] = await db
    .update(userBankAccounts)
    .set(updateData)
    .where(
      and(
        eq(userBankAccounts.userId, userId),
        eq(userBankAccounts.isPrimary, true),
        eq(userBankAccounts.isDeleted, false)
      )
    )
    .returning();
  return bankAccount || null;
};















