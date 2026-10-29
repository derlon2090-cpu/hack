import { randomBytes, randomUUID } from "node:crypto";

const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SHORT_CODE_LENGTH = 11;
const BYTE_LIMIT = Math.floor(256 / SHORT_CODE_ALPHABET.length) * SHORT_CODE_ALPHABET.length;

export const newId = () => randomUUID();
export const newCode = () => {
  let code = "";
  while (code.length < SHORT_CODE_LENGTH) {
    for (const byte of randomBytes(SHORT_CODE_LENGTH - code.length)) {
      if (byte >= BYTE_LIMIT) continue;
      code += SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length];
      if (code.length === SHORT_CODE_LENGTH) break;
    }
  }
  return code;
};
export const newShareToken = () => randomBytes(32).toString("base64url");
