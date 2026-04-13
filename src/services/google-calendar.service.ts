import { readFileSync, existsSync } from "node:fs";
import { google } from "googleapis";
import { eq, and } from "drizzle-orm";
import { db } from "../config/db.js";
import {
  dispatchAssignments,
  dispatchTasks,
} from "../drizzle/schema/dispatch.schema.js";
import { jobs } from "../drizzle/schema/jobs.schema.js";
import { employees } from "../drizzle/schema/org.schema.js";
import { users } from "../drizzle/schema/auth.schema.js";
import { bidsTable } from "../drizzle/schema/bids.schema.js";
import { logger } from "../utils/logger.js";
import { formatNaiveDateTimeIsoTForZonedApi } from "../utils/naive-datetime.js";

const CALENDAR_EVENTS_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

/**
 * IANA zone for naive dispatch times in Google Calendar (`dateTime` + `timeZone`).
 * Default: California Pacific. Override with env if needed (e.g. multi-region later).
 */
const DEFAULT_NAIVE_APP_TIMEZONE = "America/Los_Angeles";

function naiveAppTimeZone(): string {
  return process.env.NAIVE_APP_TIMEZONE?.trim() || DEFAULT_NAIVE_APP_TIMEZONE;
}

type ServiceAccountCredentials = {
  type?: string;
  client_email?: string;
  private_key?: string;
};

/** Resolved once per process (env / file is read at first use). */
let credentialsMemo: ServiceAccountCredentials | null | undefined;

function loadServiceAccountCredentials(): ServiceAccountCredentials | null {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const keyPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  let jsonText: string | null = null;

  if (inline) {
    try {
      jsonText = inline.startsWith("{")
        ? inline
        : Buffer.from(inline, "base64").toString("utf8");
    } catch {
      logger.warn(
        "[google-calendar] GOOGLE_SERVICE_ACCOUNT_JSON is not valid base64(JSON).",
      );
      return null;
    }
  } else if (keyPath) {
    if (!existsSync(keyPath)) {
      logger.warn(
        `[google-calendar] Service account key file not found: ${keyPath}`,
      );
      return null;
    }
    try {
      jsonText = readFileSync(keyPath, "utf8");
    } catch (err) {
      logger.warn("[google-calendar] Could not read service account key file", {
        keyPath,
        err,
      });
      return null;
    }
  } else {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as ServiceAccountCredentials;
    if (
      parsed?.type !== "service_account" ||
      !parsed.client_email ||
      !parsed.private_key
    ) {
      logger.warn(
        "[google-calendar] Credentials must be service-account JSON (type, client_email, private_key). Use the downloaded .json file or base64 of it — not the Key ID from the console.",
      );
      return null;
    }
    return parsed;
  } catch {
    logger.warn("[google-calendar] Service account file is not valid JSON.");
    return null;
  }
}

function parseServiceAccountJson(): ServiceAccountCredentials | null {
  if (credentialsMemo === undefined) {
    credentialsMemo = loadServiceAccountCredentials();
  }
  return credentialsMemo;
}

export function isGoogleCalendarConfigured(): boolean {
  return parseServiceAccountJson() !== null;
}

function allowedWorkspaceEmail(email: string): boolean {
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim().toLowerCase();
  if (!domain) return true;
  const lower = email.toLowerCase();
  return lower.endsWith(`@${domain}`) || lower === domain;
}

async function getCalendarClient(impersonateUserEmail: string) {
  const creds = parseServiceAccountJson();
  if (!creds?.client_email || !creds.private_key) {
    throw new Error("Google Calendar service account is not configured");
  }
  if (!allowedWorkspaceEmail(impersonateUserEmail)) {
    throw new Error(
      `Calendar sync skipped: ${impersonateUserEmail} is not in GOOGLE_WORKSPACE_DOMAIN`,
    );
  }
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [CALENDAR_EVENTS_SCOPE],
    subject: impersonateUserEmail,
  });
  await auth.authorize();
  return google.calendar({ version: "v3", auth });
}

/** Event was deleted in Google UI or id is stale — recreate on next insert. */
function isGoogleCalendarNotFound(err: unknown): boolean {
  const e = err as {
    code?: number;
    status?: number;
    response?: { status?: number };
  };
  return (
    e.code === 404 ||
    e.status === 404 ||
    e.response?.status === 404
  );
}

async function resolveEmployeeToEmail(
  employeeId: number | null,
): Promise<string | null> {
  if (employeeId == null) return null;
  const [row] = await db
    .select({ email: users.email })
    .from(employees)
    .innerJoin(users, eq(employees.userId, users.id))
    .where(
      and(eq(employees.id, employeeId), eq(employees.isDeleted, false)),
    )
    .limit(1);
  return row?.email?.trim() || null;
}

async function resolveUserIdToEmail(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isDeleted, false)))
    .limit(1);
  return row?.email?.trim() || null;
}

/** Exclusive end date for Google Calendar all-day events (YYYY-MM-DD). */
function addOneDayYmd(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function deleteGoogleCalendarEvent(
  impersonateEmail: string,
  eventId: string,
): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;
  try {
    const calendar = await getCalendarClient(impersonateEmail);
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "none",
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 404) return;
    logger.error("[google-calendar] Failed to delete event", {
      impersonateEmail,
      eventId,
      err,
    });
    throw err;
  }
}

/**
 * Remove Google events for all non-deleted assignments on a dispatch task (before soft-delete).
 */
export async function removeDispatchAssignmentGoogleCalendar(
  assignmentId: string,
): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;
  const [row] = await db
    .select({
      googleCalendarEventId: dispatchAssignments.googleCalendarEventId,
      technicianId: dispatchAssignments.technicianId,
    })
    .from(dispatchAssignments)
    .where(
      and(
        eq(dispatchAssignments.id, assignmentId),
        eq(dispatchAssignments.isDeleted, false),
      ),
    )
    .limit(1);
  if (!row?.googleCalendarEventId || row.technicianId == null) return;
  const email = await resolveEmployeeToEmail(row.technicianId);
  if (!email) return;
  try {
    await deleteGoogleCalendarEvent(email, row.googleCalendarEventId);
  } catch {
    /* logged in deleteGoogleCalendarEvent */
  }
}

export async function removeGoogleCalendarEventsForDispatchTask(
  taskId: string,
): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;
  const rows = await db
    .select({
      id: dispatchAssignments.id,
      googleCalendarEventId: dispatchAssignments.googleCalendarEventId,
      technicianId: dispatchAssignments.technicianId,
    })
    .from(dispatchAssignments)
    .where(
      and(
        eq(dispatchAssignments.taskId, taskId),
        eq(dispatchAssignments.isDeleted, false),
      ),
    );
  for (const row of rows) {
    if (!row.googleCalendarEventId || row.technicianId == null) continue;
    const email = await resolveEmployeeToEmail(row.technicianId);
    if (!email) continue;
    try {
      await deleteGoogleCalendarEvent(email, row.googleCalendarEventId);
    } catch {
      /* logged in deleteGoogleCalendarEvent */
    }
  }
}

export async function syncDispatchAssignmentGoogleCalendar(
  assignmentId: string,
): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;

  const [row] = await db
    .select({
      assignmentId: dispatchAssignments.id,
      googleCalendarEventId: dispatchAssignments.googleCalendarEventId,
      technicianId: dispatchAssignments.technicianId,
      taskTitle: dispatchTasks.title,
      taskDescription: dispatchTasks.description,
      startTime: dispatchTasks.startTime,
      endTime: dispatchTasks.endTime,
      jobId: dispatchTasks.jobId,
      jobNumber: jobs.jobNumber,
    })
    .from(dispatchAssignments)
    .innerJoin(dispatchTasks, eq(dispatchAssignments.taskId, dispatchTasks.id))
    .innerJoin(jobs, eq(dispatchTasks.jobId, jobs.id))
    .where(
      and(
        eq(dispatchAssignments.id, assignmentId),
        eq(dispatchAssignments.isDeleted, false),
        eq(dispatchTasks.isDeleted, false),
        eq(jobs.isDeleted, false),
      ),
    )
    .limit(1);

  if (!row?.technicianId) return;

  const email = await resolveEmployeeToEmail(row.technicianId);
  if (!email) {
    logger.warn(
      `[google-calendar] No user email for employee ${row.technicianId}; skip dispatch assignment ${assignmentId}`,
    );
    return;
  }

  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const jobUrl = `${clientUrl}/dashboard/jobs/${row.jobId}`;
  const summary = `Dispatch: ${row.taskTitle}`;
  const description = [
    row.taskDescription || "",
    "",
    `Job #${row.jobNumber}`,
    jobUrl,
  ]
    .join("\n")
    .trim();

  const startD = row.startTime ? new Date(row.startTime as Date) : null;
  const endD = row.endTime ? new Date(row.endTime as Date) : null;
  if (!startD || !endD) return;

  const tz = naiveAppTimeZone();
  const start = formatNaiveDateTimeIsoTForZonedApi(startD);
  const end = formatNaiveDateTimeIsoTForZonedApi(endD);
  if (!start || !end) return;

  const calendar = await getCalendarClient(email);
  const body = {
    summary,
    description,
    start: { dateTime: start, timeZone: tz },
    end: { dateTime: end, timeZone: tz },
    extendedProperties: {
      private: {
        t3_dispatch_assignment_id: assignmentId,
        t3_job_id: row.jobId,
      },
    },
  };

  try {
    if (row.googleCalendarEventId) {
      try {
        await calendar.events.patch({
          calendarId: "primary",
          eventId: row.googleCalendarEventId,
          requestBody: body,
          sendUpdates: "none",
        });
        return;
      } catch (patchErr) {
        if (!isGoogleCalendarNotFound(patchErr)) throw patchErr;
        logger.warn(
          "[google-calendar] Dispatch Google event missing (404); recreating",
          { assignmentId, eventId: row.googleCalendarEventId },
        );
        await db
          .update(dispatchAssignments)
          .set({
            googleCalendarEventId: null,
            updatedAt: new Date(),
          })
          .where(eq(dispatchAssignments.id, assignmentId));
      }
    }

    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: body,
      sendUpdates: "none",
    });
    if (data.id) {
      await db
        .update(dispatchAssignments)
        .set({
          googleCalendarEventId: data.id,
          updatedAt: new Date(),
        })
        .where(eq(dispatchAssignments.id, assignmentId));
    }
  } catch (err) {
    logger.error("[google-calendar] syncDispatchAssignmentGoogleCalendar", {
      assignmentId,
      err,
    });
  }
}

export async function removeBidEndDateGoogleCalendar(
  bidId: string,
): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;
  const [bid] = await db
    .select({
      eventId: bidsTable.googleCalendarEndDateEventId,
      ownerUserId: bidsTable.googleCalendarEndDateOwnerUserId,
    })
    .from(bidsTable)
    .where(and(eq(bidsTable.id, bidId), eq(bidsTable.isDeleted, false)))
    .limit(1);
  if (!bid?.eventId || !bid.ownerUserId) return;
  const email = await resolveUserIdToEmail(bid.ownerUserId);
  if (!email) return;
  try {
    await deleteGoogleCalendarEvent(email, bid.eventId);
  } catch {
    /* logged */
  }
  await db
    .update(bidsTable)
    .set({
      googleCalendarEndDateEventId: null,
      googleCalendarEndDateOwnerUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(bidsTable.id, bidId));
}

export async function syncBidEndDateGoogleCalendar(
  bidId: string,
): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;

  const [bid] = await db
    .select({
      endDate: bidsTable.endDate,
      bidNumber: bidsTable.bidNumber,
      projectName: bidsTable.projectName,
      assignedTo: bidsTable.assignedTo,
      createdBy: bidsTable.createdBy,
      eventId: bidsTable.googleCalendarEndDateEventId,
      ownerUserId: bidsTable.googleCalendarEndDateOwnerUserId,
    })
    .from(bidsTable)
    .where(and(eq(bidsTable.id, bidId), eq(bidsTable.isDeleted, false)))
    .limit(1);

  if (!bid) return;

  const targetOwnerUserId = bid.assignedTo ?? bid.createdBy;
  const endDateStr =
    bid.endDate == null
      ? null
      : typeof bid.endDate === "string"
        ? bid.endDate
        : (bid.endDate as Date).toISOString().slice(0, 10);

  if (!endDateStr) {
    if (bid.eventId && bid.ownerUserId) {
      await removeBidEndDateGoogleCalendar(bidId);
    }
    return;
  }

  const ownerEmail = await resolveUserIdToEmail(targetOwnerUserId);
  if (!ownerEmail) {
    logger.warn(
      `[google-calendar] No email for bid owner user ${targetOwnerUserId}; skip bid ${bidId}`,
    );
    return;
  }

  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const bidUrl = `${clientUrl}/dashboard/bids/${bidId}`;
  const summary = `Bid due: ${bid.projectName || bid.bidNumber}`;
  const description = [`Bid #${bid.bidNumber}`, bidUrl].join("\n");

  const startDay = endDateStr;
  const endExclusive = addOneDayYmd(endDateStr);
  const body = {
    summary,
    description,
    start: { date: startDay },
    end: { date: endExclusive },
    extendedProperties: {
      private: { t3_bid_id: bidId },
    },
  };

  try {
    if (
      bid.eventId &&
      bid.ownerUserId &&
      bid.ownerUserId !== targetOwnerUserId
    ) {
      const oldEmail = await resolveUserIdToEmail(bid.ownerUserId);
      if (oldEmail) {
        try {
          await deleteGoogleCalendarEvent(oldEmail, bid.eventId);
        } catch {
          /* continue — will insert fresh */
        }
      }
      await db
        .update(bidsTable)
        .set({
          googleCalendarEndDateEventId: null,
          googleCalendarEndDateOwnerUserId: null,
          updatedAt: new Date(),
        })
        .where(eq(bidsTable.id, bidId));
    }

    const [fresh] = await db
      .select({
        eventId: bidsTable.googleCalendarEndDateEventId,
      })
      .from(bidsTable)
      .where(eq(bidsTable.id, bidId))
      .limit(1);

    const calendar = await getCalendarClient(ownerEmail);

    if (fresh?.eventId) {
      try {
        await calendar.events.patch({
          calendarId: "primary",
          eventId: fresh.eventId,
          requestBody: body,
          sendUpdates: "none",
        });
        await db
          .update(bidsTable)
          .set({
            googleCalendarEndDateOwnerUserId: targetOwnerUserId,
            updatedAt: new Date(),
          })
          .where(eq(bidsTable.id, bidId));
        return;
      } catch (patchErr) {
        if (!isGoogleCalendarNotFound(patchErr)) throw patchErr;
        logger.warn(
          "[google-calendar] Bid due-date Google event missing (404); recreating",
          { bidId, eventId: fresh.eventId },
        );
        await db
          .update(bidsTable)
          .set({
            googleCalendarEndDateEventId: null,
            googleCalendarEndDateOwnerUserId: null,
            updatedAt: new Date(),
          })
          .where(eq(bidsTable.id, bidId));
      }
    }

    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: body,
      sendUpdates: "none",
    });
    if (data.id) {
      await db
        .update(bidsTable)
        .set({
          googleCalendarEndDateEventId: data.id,
          googleCalendarEndDateOwnerUserId: targetOwnerUserId,
          updatedAt: new Date(),
        })
        .where(eq(bidsTable.id, bidId));
    }
  } catch (err) {
    logger.error("[google-calendar] syncBidEndDateGoogleCalendar", {
      bidId,
      err,
    });
  }
}

/**
 * When a technician is reassigned, delete the event from the previous technician's calendar.
 */
export async function deleteDispatchAssignmentGoogleCalendarIfReassigned(
  assignmentId: string,
  previousTechnicianId: number,
  googleCalendarEventId: string | null,
): Promise<void> {
  if (!googleCalendarEventId || !isGoogleCalendarConfigured()) return;
  const email = await resolveEmployeeToEmail(previousTechnicianId);
  if (!email) return;
  try {
    await deleteGoogleCalendarEvent(email, googleCalendarEventId);
  } catch {
    /* logged */
  }
  await db
    .update(dispatchAssignments)
    .set({
      googleCalendarEventId: null,
      updatedAt: new Date(),
    })
    .where(eq(dispatchAssignments.id, assignmentId));
}

export async function syncAllDispatchAssignmentsForTaskGoogleCalendar(
  taskId: string,
): Promise<void> {
  if (!isGoogleCalendarConfigured()) return;
  const rows = await db
    .select({ id: dispatchAssignments.id })
    .from(dispatchAssignments)
    .where(
      and(
        eq(dispatchAssignments.taskId, taskId),
        eq(dispatchAssignments.isDeleted, false),
      ),
    );
  for (const { id } of rows) {
    try {
      await syncDispatchAssignmentGoogleCalendar(id);
    } catch {
      /* logged in sync */
    }
  }
}
