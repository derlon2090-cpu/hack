import { pgTable, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  purpose: text("purpose"),
  destination: text("destination"),
  locale: text("locale").notNull().default("en"),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  retentionDays: integer("retention_days").notNull().default(30),
  views: integer("views").notNull().default(0),
  ownerId: text("owner_id").notNull().default("admin"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("sessions_created_at_idx").on(table.createdAt), index("sessions_owner_id_idx").on(table.ownerId)]);

export const links = pgTable("links", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  locale: text("locale").notNull().default("en"),
  active: boolean("active").notNull().default(true),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("links_created_at_idx").on(table.createdAt)]);

export const consents = pgTable("consents", {
  id: text("id").primaryKey(),
  linkId: text("link_id").references(() => links.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  decision: text("decision").notNull(),
  locale: text("locale").notNull(),
  deviceType: text("device_type"),
  region: text("region"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  policyVersion: text("policy_version").notNull()
}, (table) => [index("consents_link_id_idx").on(table.linkId)]);

export const photos = pgTable("photos", {
  id: text("id").primaryKey(),
  linkId: text("link_id").references(() => links.id, { onDelete: "cascade" }),
  sessionId: text("session_id").references(() => sessions.id, { onDelete: "cascade" }),
  consentId: text("consent_id").notNull().references(() => consents.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("photos_created_at_idx").on(table.createdAt)]);

export const videos = pgTable("videos", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  photoId: text("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull().unique(),
  title: text("title"),
  background: text("background").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  size: integer("size").notNull(),
  shareToken: text("share_token").unique(),
  shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => [index("videos_session_id_idx").on(table.sessionId), index("videos_created_at_idx").on(table.createdAt)]);
