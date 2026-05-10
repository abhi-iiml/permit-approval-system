import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lnrmpwcdbnmausmeulco.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxucm1wd2NkYm5tYXVzbWV1bGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MzIyNjIsImV4cCI6MjA5MzIwODI2Mn0.x96uQB_KGe7PScLnNehEV16yXQEKHGalT8JwkVBO9CA';

export const supabase = createClient(supabaseUrl, supabaseKey);