/**
 * Types the public environment variables as real properties.
 *
 * Without this, `noPropertyAccessFromIndexSignature` forces bracket access on
 * process.env — but Next only inlines NEXT_PUBLIC_* values when they are read
 * as a static member expression (`process.env.NEXT_PUBLIC_X`). Declaring them
 * here keeps the strict flag on everywhere else and keeps the inlining working.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_SUPABASE_URL: string;
    readonly NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    readonly NEXT_PUBLIC_APP_URL?: string;
    readonly NEXT_PUBLIC_PLATFORM_HOST?: string;
  }
}
