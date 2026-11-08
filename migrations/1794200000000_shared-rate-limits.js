export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE api_rate_limits (
      bucket text NOT NULL,
      key_hash text NOT NULL,
      hit_count integer NOT NULL,
      reset_at timestamptz NOT NULL,
      PRIMARY KEY (bucket, key_hash)
    );
    CREATE INDEX api_rate_limits_reset_at_idx ON api_rate_limits (reset_at);
  `);
};

export const down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS api_rate_limits');
};
