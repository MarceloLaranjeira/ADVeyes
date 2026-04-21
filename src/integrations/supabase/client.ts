import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://qawfrmuitdiqmdjezyly.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhd2ZybXVpdGRpcW1kamV6eWx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDk4NzQsImV4cCI6MjA4ODMyNTg3NH0.tRm-_Gl2W9yWVnM7Jrs4flyhdwN1UlMo8OYcE373Fp8";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
