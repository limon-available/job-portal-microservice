export const up = (pgm) => {
  pgm.createTable("companies", {
    company_id: { type: "bigserial", primaryKey: true },
    owner_id: { type: "integer", notNull: true },
    name: { type: "varchar(255)", notNull: true },
    description: { type: "text", notNull: true, default: "" },
    website: { type: "text" },
    location: { type: "varchar(255)" },
    logo_url: { type: "text" },
    logo_public_id: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
  });
  pgm.createIndex("companies", ["owner_id"]);

  pgm.createTable("jobs", {
    job_id: { type: "bigserial", primaryKey: true },
    title: { type: "varchar(255)", notNull: true },
    description: { type: "text", notNull: true },
    location: { type: "varchar(255)", notNull: true },
    job_type: { type: "varchar(40)", notNull: true },
    salary_min: { type: "integer" },
    salary_max: { type: "integer" },
    experience_years: { type: "integer", notNull: true, default: 0 },
    deadline: { type: "date" },
    status: { type: "varchar(20)", notNull: true, default: "draft" },
    company_id: {
      type: "bigint",
      notNull: true,
      references: "companies(company_id)",
      onDelete: "restrict",
    },
    posted_by: { type: "integer", notNull: true },
    views: { type: "integer", notNull: true, default: 0 },
    slug: { type: "varchar(300)", notNull: true, unique: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
  });
  pgm.sql(`
    ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
      CHECK (status IN ('draft','open','closed','expired'));
    ALTER TABLE jobs ADD CONSTRAINT jobs_salary_check
      CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max);
    ALTER TABLE jobs ADD CONSTRAINT jobs_experience_years_check
      CHECK (experience_years >= 0);
  `);
  pgm.createIndex("jobs", ["status", "created_at"]);
  pgm.createIndex("jobs", ["company_id"]);
  pgm.createIndex("jobs", ["location"]);
  pgm.sql(`
    CREATE INDEX jobs_title_description_fts_idx
    ON jobs USING GIN (
      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
    )
  `);

  pgm.createTable("job_skills", {
    job_id: {
      type: "bigint",
      notNull: true,
      references: "jobs(job_id)",
      onDelete: "cascade",
    },
    skill: { type: "varchar(100)", notNull: true },
  });
  pgm.addConstraint("job_skills", "job_skills_pkey", {
    primaryKey: ["job_id", "skill"],
  });
  pgm.createIndex("job_skills", ["skill"]);
};

export const down = (pgm) => {
  pgm.dropTable("job_skills");
  pgm.dropTable("jobs");
  pgm.dropTable("companies");
};
