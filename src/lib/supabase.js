import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://licvfuzvvbmjdvcooogo.supabase.co';
const supabaseKey = 'sb_publishable_8hwXxxU7C4owwVmlc4FvPg_0pEXUFK-'; // Pegue no painel do Supabase em Project Settings -> API

export const supabase = createClient(supabaseUrl, supabaseKey);