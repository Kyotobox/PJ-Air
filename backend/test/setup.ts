// backend/test/setup.ts
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = require('path').join(process.cwd(), 'database.sqlite');
process.env.SUPABASE_KEY = 'test-supabase-key';
process.env.GOOGLE_MAPS_KEY = 'test-maps-key';
