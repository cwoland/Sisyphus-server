import { createHash } from 'node:crypto';
import { query } from '../config/db.js';

const hashKey = (key) => createHash('sha256').update(key).digest('hex');

// Shared across serverless instances and Render; each limiter gets its own bucket.
export class PostgresRateLimitStore {
  constructor(bucket) {
    this.bucket = bucket;
    this.prefix = `${bucket}:`;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const { rows } = await query(`
      INSERT INTO api_rate_limits AS limits (bucket, key_hash, hit_count, reset_at)
      VALUES ($1, $2, 1, now() + $3 * interval '1 millisecond')
      ON CONFLICT (bucket, key_hash) DO UPDATE SET
        hit_count = CASE WHEN limits.reset_at <= now() THEN 1 ELSE limits.hit_count + 1 END,
        reset_at = CASE WHEN limits.reset_at <= now() THEN now() + $3 * interval '1 millisecond' ELSE limits.reset_at END
      RETURNING hit_count, reset_at
    `, [this.bucket, hashKey(key), this.windowMs]);

    if (Math.random() < 0.01) {
      await query(`DELETE FROM api_rate_limits WHERE (bucket, key_hash) IN (
        SELECT bucket, key_hash FROM api_rate_limits
        WHERE reset_at < now() - interval '1 day' ORDER BY reset_at LIMIT 500
      )`)
        .catch((error) => console.error('Rate-limit cleanup failed:', error.message));
    }
    return { totalHits: rows[0].hit_count, resetTime: new Date(rows[0].reset_at) };
  }

  async decrement(key) {
    await query(`UPDATE api_rate_limits SET hit_count = GREATEST(hit_count - 1, 0)
      WHERE bucket = $1 AND key_hash = $2`, [this.bucket, hashKey(key)]);
  }

  async resetKey(key) {
    await query('DELETE FROM api_rate_limits WHERE bucket = $1 AND key_hash = $2',
      [this.bucket, hashKey(key)]);
  }
}
