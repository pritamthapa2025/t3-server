import { db } from "../config/db.js";
import { userBankAccounts } from "../drizzle/schema/org.schema.js";

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











