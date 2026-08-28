/**
 * PLACEHOLDER — replaced in Fase 2 by generated types.
 *
 * Once the migrations exist, this file is regenerated with:
 *
 *   npm run db:types
 *
 * Do not hand-edit it after that point: the schema is the source of truth
 * (masterprompt §41), and a hand-edited type that drifts from the database is
 * worse than no type at all.
 */
export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
