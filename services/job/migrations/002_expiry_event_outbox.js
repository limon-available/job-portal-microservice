export const up = (pgm) => {
  pgm.createTable("job_event_outbox", {
    event_id: { type: "uuid", primaryKey: true },
    payload: { type: "jsonb", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    published_at: { type: "timestamptz" },
  });
  pgm.sql(`
    CREATE INDEX job_event_outbox_pending_idx ON job_event_outbox (created_at)
    WHERE published_at IS NULL
  `);
};

export const down = (pgm) => {
  pgm.dropTable("job_event_outbox");
};
