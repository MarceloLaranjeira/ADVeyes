import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://yjfhuuovxhqpcpheivgv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7O_TLtq7fk8R4xu1y6BB-g_-5L_5qBp";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
