# Supabase rules

- Create new timestamped migrations; never edit an already-applied migration to hide a change.
- Keep migrations ordered and repeatable.
- Preserve organization isolation and Row Level Security.
- Never use `service_role` in browser code.
- Add indexes for new foreign keys and common filters.
- Protect financial and clinical mutations with authorization and audit logging.
- Seed files are synthetic and are not production migration data.
- Do not run `seed.sql` against a real production database without explicit approval.
- Document every new table, policy, trigger, function and storage bucket.
