import { z } from "zod";

const blankAsUndefined = (value: unknown) => (value === "" ? undefined : value);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional().or(z.literal("")),
  NEXT_PUBLIC_SITE_URL: z.preprocess(
    blankAsUndefined,
    z.string().url().default("http://localhost:3000"),
  ),
});

const serverEnvSchema = publicEnvSchema.extend({
  DEEPSEEK_API_KEY: z.string().min(20).optional().or(z.literal("")),
  DEEPSEEK_MODEL: z.preprocess(
    blankAsUndefined,
    z.string().min(1).default("deepseek-chat"),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional().or(z.literal("")),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  DEMO_MODE: z.preprocess(blankAsUndefined, z.enum(["true", "false"]).default("false")),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}

export function getServerEnv() {
  const env = serverEnvSchema.parse(process.env);
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && env.DEMO_MODE === "true") {
    throw new Error("DEMO_MODE cannot be enabled in production.");
  }
  return env;
}

export function hasSupabaseConfig() {
  const env = getServerEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function isDemoMode() {
  const env = getServerEnv();
  return env.DEMO_MODE === "true" || (!hasSupabaseConfig() && process.env.NODE_ENV !== "production");
}
