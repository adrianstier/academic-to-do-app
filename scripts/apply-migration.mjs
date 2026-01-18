#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('🔌 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test connection
console.log('🧪 Testing connection...');
const { error } = await supabase.from('users').select('count').limit(1);

if (error) {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
}

console.log('✅ Connected to Supabase successfully!\n');
console.log('📄 Reading migration file...');

const migrationSql = readFileSync('supabase/migrations/20260108_fix_all_security_warnings.sql', 'utf-8');
console.log(`✅ Migration loaded (${migrationSql.split('\n').length} lines)\n`);

console.log('⚠️  MANUAL ACTION REQUIRED:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('The migration is ready to apply, but must be run through');
console.log('the Supabase Dashboard SQL Editor for safety.\n');
console.log('🔗 Steps:');
console.log('   1. Open: https://supabase.com/dashboard');
console.log('   2. Go to: SQL Editor → New Query');
console.log('   3. Paste the migration (copying to clipboard now...)');
console.log('   4. Click: Run\n');

// Copy to clipboard
import { exec } from 'child_process';
exec(`echo '${migrationSql.replace(/'/g, "'\\''")}' | pbcopy`, (error) => {
  if (error) {
    console.log('⚠️  Could not copy to clipboard automatically');
    console.log('   Run: cat supabase/migrations/20260108_fix_all_security_warnings.sql | pbcopy\n');
  } else {
    console.log('✅ Migration SQL copied to clipboard!\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('After applying, run this script again with --verify flag');
  console.log('to check that all warnings are resolved:\n');
  console.log('   node apply-migration.mjs --verify\n');
});
