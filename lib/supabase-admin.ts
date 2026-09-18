/**
 * Shared Supabase admin client for API routes.
 * Uses service_role key when set (and not the placeholder), otherwise falls
 * back to the publishable/anon key — which works fine when RLS is disabled.
 */
import { createClient } from "@supabase/supabase-js";

const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resolvedKey =
  svcKey && svcKey !== "your_service_role_key_here"
    ? svcKey
    : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  resolvedKey,
  { auth: { persistSession: false } }
);
