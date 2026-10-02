DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dragon_rush_z_runtime') THEN
    GRANT SELECT ON exploration_events, exploration_routes TO dragon_rush_z_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON exploration_sessions TO dragon_rush_z_runtime;
  END IF;
END $$;
