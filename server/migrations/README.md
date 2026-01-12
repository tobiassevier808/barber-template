# Database Migration: Rename availbility to availability

This migration fixes the PGRST205 error by renaming the misspelled table `availbility` to `availability`.

## Quick Start

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New query**
4. Copy and paste the contents of `001_rename_availbility_to_availability.sql`
5. Click **Run** (or press Ctrl+Enter)
6. Verify the migration succeeded (no errors)

## Files

- **001_rename_availbility_to_availability.sql** - Main migration script to rename the table
- **verify_table_structure.sql** - Verification queries to check table structure and data integrity
- **rollback_rename_availability.sql** - Rollback script (use only if needed)

## Verification Steps

After running the migration:

1. Run the queries in `verify_table_structure.sql` to confirm:
   - Table exists with correct name
   - All columns are present
   - Data count matches expectations
   - Constraints/indexes are intact

2. Restart your Node.js server:
   ```bash
   cd server
   npm start
   ```

3. Test the API endpoints:
   - GET `http://localhost:3000/api/availability` - Should return data without errors
   - POST to save availability - Should work without PGRST205 errors

## Notes

- The code in `server/server.js` already uses the correct table name `availability`
- No code changes are required
- The rename operation preserves all data, constraints, and indexes
- PostgREST schema cache will refresh automatically

## Troubleshooting

If you encounter issues:
1. Check Supabase logs for any errors
2. Verify the table was renamed: `SELECT * FROM information_schema.tables WHERE table_name = 'availability';`
3. If needed, use the rollback script to revert the change

