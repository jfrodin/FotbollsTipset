import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["player", "admin"]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "open",
  "active",
  "finished",
]);

export const phaseTypeEnum = pgEnum("phase_type", ["group", "knockout"]);

export const phaseStatusEnum = pgEnum("phase_status", [
  "locked",
  "open",
  "active",
  "finished",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "live",
  "finished",
  "postponed",
  "cancelled",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "success",
  "partial",
  "error",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull().default("player"),
  profileComplete: boolean("profile_complete").notNull().default(false),
  hasAcceptedTerms: boolean("has_accepted_terms").notNull().default(false),
  isBot: boolean("is_bot").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("sessions_token_idx").on(t.token)]);

// ─── Auth Codes (OTP) ─────────────────────────────────────────────────────────

export const authCodes = pgTable("auth_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("auth_codes_email_idx").on(t.email)]);

// ─── Tournaments ──────────────────────────────────────────────────────────────

export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  sport: text("sport").notNull().default("football"),
  status: tournamentStatusEnum("status").notNull().default("draft"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  apiProvider: text("api_provider"),
  externalId: text("external_id"),
  notice: text("notice"),
  pointsForCorrectOutcome: integer("points_for_correct_outcome").notNull().default(2),
  pointsForExactScore: integer("points_for_exact_score").notNull().default(3),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Phases ───────────────────────────────────────────────────────────────────

export const phases = pgTable("phases", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: phaseTypeEnum("type").notNull(),
  status: phaseStatusEnum("status").notNull().default("locked"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
}, (t) => [index("phases_tournament_idx").on(t.tournamentId)]);

// ─── Teams ────────────────────────────────────────────────────────────────────

export const teams = pgTable("teams", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  shortName: text("short_name"),
  countryCode: text("country_code"),
  logoUrl: text("logo_url"),
  externalId: text("external_id"),
}, (t) => [uniqueIndex("teams_external_id_idx").on(t.externalId)]);

// ─── Tournament Teams ─────────────────────────────────────────────────────────

export const tournamentTeams = pgTable("tournament_teams", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  groupName: text("group_name"),
}, (t) => [
  uniqueIndex("tournament_teams_unique_idx").on(t.tournamentId, t.teamId),
  index("tournament_teams_tournament_idx").on(t.tournamentId),
]);

// ─── Matches ──────────────────────────────────────────────────────────────────

export const matches = pgTable("matches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  phaseId: text("phase_id").notNull().references(() => phases.id, { onDelete: "cascade" }),
  externalId: text("external_id"),
  homeTeamId: text("home_team_id").references(() => teams.id),
  awayTeamId: text("away_team_id").references(() => teams.id),
  startsAt: timestamp("starts_at").notNull(),
  status: matchStatusEnum("status").notNull().default("scheduled"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  winnerTeamId: text("winner_team_id").references(() => teams.id),
  groupName: text("group_name"),
  roundName: text("round_name"),
  venue: text("venue"),
  broadcastChannel: text("broadcast_channel"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("matches_tournament_idx").on(t.tournamentId),
  index("matches_phase_idx").on(t.phaseId),
  index("matches_starts_at_idx").on(t.startsAt),
  uniqueIndex("matches_external_id_idx").on(t.externalId),
]);

// ─── Predictions ──────────────────────────────────────────────────────────────

export const predictions = pgTable("predictions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
  matchId: text("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  predictedHomeScore: integer("predicted_home_score").notNull(),
  predictedAwayScore: integer("predicted_away_score").notNull(),
  points: integer("points"),
  isExactScore: boolean("is_exact_score"),
  isCorrectOutcome: boolean("is_correct_outcome"),
  analysis: text("analysis"),
  lockedAt: timestamp("locked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("predictions_user_match_idx").on(t.userId, t.matchId),
  index("predictions_tournament_idx").on(t.tournamentId),
  index("predictions_user_idx").on(t.userId),
]);

// ─── Sync Logs ────────────────────────────────────────────────────────────────

export const syncLogs = pgTable("sync_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tournamentId: text("tournament_id").references(() => tournaments.id),
  provider: text("provider"),
  status: syncStatusEnum("status").notNull(),
  message: text("message"),
  matchesUpdated: integer("matches_updated").default(0),
  predictionsScored: integer("predictions_scored").default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (t) => [index("sync_logs_tournament_idx").on(t.tournamentId)]);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  predictions: many(predictions),
}));

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  phases: many(phases),
  tournamentTeams: many(tournamentTeams),
  matches: many(matches),
  predictions: many(predictions),
  syncLogs: many(syncLogs),
}));

export const phasesRelations = relations(phases, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [phases.tournamentId], references: [tournaments.id] }),
  matches: many(matches),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  tournamentTeams: many(tournamentTeams),
  homeMatches: many(matches, { relationName: "homeTeam" }),
  awayMatches: many(matches, { relationName: "awayTeam" }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [matches.tournamentId], references: [tournaments.id] }),
  phase: one(phases, { fields: [matches.phaseId], references: [phases.id] }),
  homeTeam: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: "homeTeam" }),
  awayTeam: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: "awayTeam" }),
  predictions: many(predictions),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  tournament: one(tournaments, { fields: [predictions.tournamentId], references: [tournaments.id] }),
  match: one(matches, { fields: [predictions.matchId], references: [matches.id] }),
  user: one(users, { fields: [predictions.userId], references: [users.id] }),
}));
