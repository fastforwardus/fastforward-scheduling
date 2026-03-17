import { pgTable, uuid, text, boolean, integer, numeric, timestamp, time, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ── Enums ──
export const roleEnum = pgEnum("role", ["admin", "sales_manager", "sales_rep"]);
export const platformEnum = pgEnum("platform", ["meet", "zoom", "whatsapp"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["pending_assignment", "scheduled", "confirmed", "completed", "no_show", "cancelled", "rescheduled"]);
export const outcomeEnum = pgEnum("outcome", ["interested", "needs_time", "not_qualified", "proposal_sent", "closed"]);
export const leadScoreEnum = pgEnum("lead_score", ["hot", "warm", "cold"]);
export const languageEnum = pgEnum("language", ["es", "en", "pt"]);
export const reminderTypeEnum = pgEnum("reminder_type", ["confirmation", "assigned", "24h", "2h", "15min", "noshow_client", "noshow_sales", "followup_d1", "followup_d3", "followup_d7", "survey"]);
export const channelEnum = pgEnum("channel", ["email", "whatsapp"]);
export const reminderStatusEnum = pgEnum("reminder_status", ["sent", "failed", "delivered"]);
export const nextStepEnum = pgEnum("next_step", ["none", "send_proposal", "schedule_followup", "escalate"]);

// ── Users ──
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  slug: text("slug").unique(),
  avatarUrl: text("avatar_url"),
  zoomUserId: text("zoom_user_id"),
  googleCalendarId: text("google_calendar_id"),
  googleRefreshToken: text("google_refresh_token"),
  whatsappPhone: text("whatsapp_phone"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// ── Availability ──
export const availabilityRules = pgTable("availability_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// ── Appointments ──
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientCompany: text("client_company").notNull(),
  clientWhatsapp: text("client_whatsapp").notNull(),
  clientTimezone: text("client_timezone").notNull(),
  clientLanguage: languageEnum("client_language").default("es").notNull(),
  serviceInterest: text("service_interest"),
  exportVolume: text("export_volume"),
  isB2b: boolean("is_b2b").default(true).notNull(),
  platform: platformEnum("platform").notNull(),
  meetingLink: text("meeting_link"),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  bookedVia: text("booked_via").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  outcome: outcomeEnum("outcome"),
  notes: text("notes"),
  nextStep: nextStepEnum("next_step"),
  noShowCount: integer("no_show_count").default(0).notNull(),
  leadScore: leadScoreEnum("lead_score").default("warm").notNull(),
  zohoLeadId: text("zoho_lead_id"),
  utmSource: text("utm_source"),
  confirmToken: text("confirm_token").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// ── Client Profiles ──
export const clientProfiles = pgTable("client_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  whatsapp: text("whatsapp"),
  timezone: text("timezone"),
  language: languageEnum("language").default("es"),
  leadScore: leadScoreEnum("lead_score").default("warm"),
  isB2b: boolean("is_b2b").default(true),
  noShowCount: integer("no_show_count").default(0).notNull(),
  satisfactionAvg: numeric("satisfaction_avg", { precision: 3, scale: 2 }),
  isReincident: boolean("is_reincident").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
}, (table) => ({
  emailIdx: uniqueIndex("client_profiles_email_idx").on(table.email),
}));

// ── Reminders Log ──
export const remindersLog = pgTable("reminders_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "cascade" }).notNull(),
  type: reminderTypeEnum("type").notNull(),
  channel: channelEnum("channel").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  status: reminderStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
});

// ── Follow-up Sequences ──
export const followUpSequences = pgTable("follow_up_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "cascade" }).notNull(),
  currentStep: integer("current_step").default(0).notNull(),
  nextSendAt: timestamp("next_send_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  aiDraftD1: text("ai_draft_d1"),
  aiDraftD3: text("ai_draft_d3"),
  aiDraftD7: text("ai_draft_d7"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ── Surveys ──
export const surveys = pgTable("surveys", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "cascade" }).notNull(),
  clientEmail: text("client_email").notNull(),
  rating: integer("rating").notNull(),
  feedback: text("feedback"),
  googleReviewClicked: boolean("google_review_clicked").default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// ── Activity Logs ──
export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`now()`).notNull(),
});

// ── Relations ──
export const usersRelations = relations(users, ({ many }) => ({
  appointments: many(appointments),
  availabilityRules: many(availabilityRules),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  assignedUser: one(users, { fields: [appointments.assignedTo], references: [users.id] }),
  reminders: many(remindersLog),
  followUp: one(followUpSequences),
  survey: one(surveys),
}));

export const availabilityRulesRelations = relations(availabilityRules, ({ one }) => ({
  user: one(users, { fields: [availabilityRules.userId], references: [users.id] }),
}));

// ── Types ──
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type AvailabilityRule = typeof availabilityRules.$inferSelect;
export type ClientProfile = typeof clientProfiles.$inferSelect;
