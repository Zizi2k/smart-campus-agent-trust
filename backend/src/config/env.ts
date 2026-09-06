import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16),

  RPC_URL: z.string().url(),

  CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/),
  BACKEND_SIGNER_PRIVATE_KEY: z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/),
  ADMIN_USERNAME: z.string().trim().min(3),

ADMIN_PASSWORD: z.string().min(12),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Biến môi trường không hợp lệ:",
    parsed.error.flatten().fieldErrors
  );

  process.exit(1);
}

export const env = parsed.data;