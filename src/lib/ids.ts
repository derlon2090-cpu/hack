import { randomBytes, randomUUID } from "node:crypto";

export const newId = () => randomUUID();
export const newCode = () => randomBytes(9).toString("base64url");
export const newShareToken = () => randomBytes(32).toString("base64url");
