export const up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF to_regclass('public.profiles') IS NULL AND (
        to_regclass('public.skills') IS NOT NULL OR
        to_regclass('public.user_skills') IS NOT NULL OR
        to_regclass('public.education') IS NOT NULL OR
        to_regclass('public.experience') IS NOT NULL OR
        to_regclass('public.saved_jobs') IS NOT NULL
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '55000',
          MESSAGE = 'User schema is partially present or this database is shared. Use a dedicated user-service database; do not skip conflicting tables with IF NOT EXISTS.';
      END IF;
    END
    $$;
  `);

  pgm.createTable("profiles", {
    user_id: { type: "integer", primaryKey: true },
    name: { type: "varchar(255)", notNull: true, default: "" },
    phone: { type: "varchar(32)" },
    bio: { type: "text" },
    picture_url: { type: "text" },
    picture_public_id: { type: "text" },
    resume_url: { type: "text" },
    resume_public_id: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createTable("skills", {
    skill_id: { type: "bigserial", primaryKey: true },
    name: { type: "varchar(100)", notNull: true, unique: true },
  });
  pgm.createTable("user_skills", {
    user_id: {
      type: "integer",
      notNull: true,
      references: "profiles(user_id)",
      onDelete: "cascade",
    },
    skill_id: {
      type: "bigint",
      notNull: true,
      references: "skills(skill_id)",
      onDelete: "cascade",
    },
  });
  pgm.addConstraint("user_skills", "user_skills_pkey", {
    primaryKey: ["user_id", "skill_id"],
  });

  pgm.createTable("education", {
    education_id: { type: "bigserial", primaryKey: true },
    user_id: {
      type: "integer",
      notNull: true,
      references: "profiles(user_id)",
      onDelete: "cascade",
    },
    institution: { type: "varchar(255)", notNull: true },
    degree: { type: "varchar(255)", notNull: true },
    field_of_study: { type: "varchar(255)" },
    start_date: { type: "date" },
    end_date: { type: "date" },
    description: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createTable("experience", {
    experience_id: { type: "bigserial", primaryKey: true },
    user_id: {
      type: "integer",
      notNull: true,
      references: "profiles(user_id)",
      onDelete: "cascade",
    },
    company: { type: "varchar(255)", notNull: true },
    title: { type: "varchar(255)", notNull: true },
    location: { type: "varchar(255)" },
    start_date: { type: "date" },
    end_date: { type: "date" },
    description: { type: "text" },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createTable("saved_jobs", {
    user_id: {
      type: "integer",
      notNull: true,
      references: "profiles(user_id)",
      onDelete: "cascade",
    },
    job_id: { type: "text", notNull: true },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });
  pgm.addConstraint("saved_jobs", "saved_jobs_pkey", {
    primaryKey: ["user_id", "job_id"],
  });
  pgm.createIndex("saved_jobs", ["user_id", "created_at"]);
};

export const down = (pgm) => {
  pgm.dropTable("saved_jobs");
  pgm.dropTable("experience");
  pgm.dropTable("education");
  pgm.dropTable("user_skills");
  pgm.dropTable("skills");
  pgm.dropTable("profiles");
};
