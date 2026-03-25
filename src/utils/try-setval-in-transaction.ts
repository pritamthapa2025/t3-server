import { sql } from "drizzle-orm";
import { db } from "../config/db.js";

export type DrizzleTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/**
 * Best-effort `setval` inside an open transaction. A failed `setval` (missing
 * sequence, permissions, etc.) would otherwise put Postgres in "aborted"
 * state and make every following statement in the same transaction fail with
 * 25P02. SAVEPOINT isolates that failure.
 *
 * `savepointName` must be a valid unquoted SQL identifier (e.g. sp_client_id_setval).
 * `fullyQualifiedSequenceName` must be a trusted literal like org.client_id_seq.
 */
export async function trySetvalInTransaction(
  tx: DrizzleTransaction,
  savepointName: string,
  fullyQualifiedSequenceName: string,
  value: number,
): Promise<void> {
  await tx.execute(sql.raw(`SAVEPOINT ${savepointName}`));
  try {
    await tx.execute(
      sql.raw(
        `SELECT setval('${fullyQualifiedSequenceName}', ${value}, true)`,
      ),
    );
    await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepointName}`));
  } catch {
    await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepointName}`));
  }
}
