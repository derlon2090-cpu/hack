import { z } from "zod";
import { isTikTokVideoDestination } from "@/lib/destinations";

export const createSessionInput = z.object({
  name: z.string().trim().min(1).max(100),
  locale: z.enum(["en", "ar", "zh"]),
  durationDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(0)]),
  purpose: z.string().trim().max(240).optional().default(""),
  destination: z.string().trim().max(2048).optional().default("").refine((value) => !value || isTikTokVideoDestination(value), "Enter an official HTTPS TikTok video URL."),
  retentionDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(90), z.literal(180), z.literal(365)])
});

export const sessionStatusInput = z.object({ active: z.boolean() });
