export const up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('jobseeker', 'recruiter');
      END IF;
    END
    $$;
  `);
  pgm.sql("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin'");
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      role user_role NOT NULL,
      is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      bio TEXT,
      resume VARCHAR(255),
      resume_public_id VARCHAR(255),
      profile_pic VARCHAR(255),
      profile_pic_public_id VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      subscription TIMESTAMPTZ
    )
  `);
  pgm.sql(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE",
  );
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email)
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS skills (
      skill_id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE
    )
  `);
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      skill_id INTEGER NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, skill_id)
    )
  `);
};

export const down = (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS user_skills");
  pgm.sql("DROP TABLE IF EXISTS skills");
  pgm.sql("DROP TABLE IF EXISTS users");
  pgm.sql("DROP TYPE IF EXISTS user_role");
};
