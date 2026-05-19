/**
 * supabase.ts — Phase 4
 * Supabase browser client (anon key, safe for frontend).
 * Used for Realtime subscriptions in later phases.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    '[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set. ' +
    'Realtime subscriptions will not work.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnon);
