import { z } from "zod";

export const createSessionInput = z.object({
  name: z.string().trim().min(1).max(100),
  locale: z.enum(["en", "ar", "zh"]),
  durationDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(0)]),
  purpose: z.string().trim().max(240).optional().default(""),
  retentionDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90), z.literal(180), z.literal(365)])
});

export const sessionStatusInput = z.object({ active: z.boolean() });
