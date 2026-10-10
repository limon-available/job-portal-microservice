export const up = (pgm) => {
  pgm.createTable("notifications", {
    notification_id: {
      type: "bigserial",
      primaryKey: true,
    },
    user_id: {
      type: "integer",
      notNull: true,
    },
    type: {
      type: "varchar(80)",
      notNull: true,
    },
    title: {
      type: "varchar(255)",
      notNull: true,
    },
    message: {
      type: "text",
      notNull: true,
    },
    is_read: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });
  pgm.createIndex("notifications", ["user_id", "created_at"]);
  pgm.createIndex("notifications", ["user_id", "is_read"]);
};

export const down = (pgm) => {
  pgm.dropTable("notifications");
};
