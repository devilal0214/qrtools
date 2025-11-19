import { customAlphabet } from "nanoid";

const alphabet =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// 6-character nano code (ME-QR style)
export const generateNanoCode = customAlphabet(alphabet, 6);
