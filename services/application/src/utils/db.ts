import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { env } from "../config/env.js";

export const sql = neon(env.DB_URL);
