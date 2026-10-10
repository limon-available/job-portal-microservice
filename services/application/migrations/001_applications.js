export const up = (pgm) => {
  pgm.createTable("applications", {
    application_id: { type: "bigserial", primaryKey: true },
    job_id: { type: "bigint", notNull: true },
    user_id: { type: "bigint", notNull: true },
    resume_url: { type: "text" },
    cover_letter: { type: "text", notNull: true, default: "" },
    status: { type: "varchar(20)", notNull: true, default: "applied" },
    recruiter_note: { type: "text" },
    rating: { type: "smallint" },
    applied_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
  });
  pgm.addConstraint("applications", "applications_job_user_unique", {
    unique: ["job_id", "user_id"],
  });
  pgm.addConstraint("applications", "applications_status_check", {
    check: "status IN ('applied','shortlisted','interview','hired','rejected','withdrawn','closed')",
  });
  pgm.addConstraint("applications", "applications_rating_check", {
    check: "rating IS NULL OR rating BETWEEN 1 AND 5",
  });
  pgm.createIndex("applications", ["job_id", "status", "applied_at"]);
  pgm.createIndex("applications", ["user_id", "applied_at"]);

  pgm.createTable("application_history", {
    history_id: { type: "bigserial", primaryKey: true },
    application_id: {
      type: "bigint",
      notNull: true,
      references: "applications(application_id)",
      onDelete: "cascade",
    },
    from_status: { type: "varchar(20)" },
    to_status: { type: "varchar(20)", notNull: true },
    changed_by: { type: "bigint" },
    changed_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
  });
  pgm.createIndex("application_history", ["application_id", "changed_at"]);
};

export const down = (pgm) => {
  pgm.dropTable("application_history");
  pgm.dropTable("applications");
};
