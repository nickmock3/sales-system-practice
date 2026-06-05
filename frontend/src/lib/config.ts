import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z
    .url("NEXT_PUBLIC_API_BASE_URL は URL 形式で指定してください")
    .default("http://localhost:5134"),
});

const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

export const apiBaseUrl = clientEnv.NEXT_PUBLIC_API_BASE_URL;
