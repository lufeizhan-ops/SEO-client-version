import { createClient } from '@supabase/supabase-js';

// ============================================
// Supabase Client Configuration
// ============================================
// 
// To configure your Supabase connection:
// 1. Get your Project URL and Anon Key from your Supabase dashboard:
//    - Go to https://app.supabase.com
//    - Select your project
//    - Go to Settings > API
//    - Copy "Project URL" and "anon public" key
//
// 2. Add them to your .env.local file:
//    VITE_SUPABASE_URL=your_project_url_here
//    VITE_SUPABASE_ANON_KEY=your_anon_key_here
//
// 3. The client will automatically use these environment variables
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables!\n' +
    'Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.\n' +
    'Get these values from: https://app.supabase.com > Your Project > Settings > API'
  );
}

// Initialize Supabase client
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: false, // Client portal doesn't need persistent auth
    },
  }
);

