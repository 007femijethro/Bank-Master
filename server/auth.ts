import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import type { User as AppUser } from "@shared/schema";
import { pool } from "./db";
import { encryptSensitive } from "./security";

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}

async function ensureSessionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");`);
  await pool.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ssn_last4_encrypted" text;`);
  await pool.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "idempotency_key" text;`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS "transactions_idempotency_key_idx" ON "transactions" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;`);
}

export async function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set");
  }
  await ensureSessionTable();
  const legacySsnRows = await pool.query<{ id: number; ssn_last4: string }>(`SELECT "id", "ssn_last4" FROM "users" WHERE "ssn_last4" IS NOT NULL AND "ssn_last4_encrypted" IS NULL`);
  for (const row of legacySsnRows.rows) {
    await pool.query(`UPDATE "users" SET "ssn_last4_encrypted" = $1, "ssn_last4" = NULL WHERE "id" = $2`, [encryptSensitive(row.ssn_last4), row.id]);
  }
  const PgStore = connectPgSimple(session);
  const sessionSettings: session.SessionOptions = {
    name: "redbird.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 30 * 60 * 1000,
    },
    store: new PgStore({
      pool: pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
    }),
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
    sessionSettings.cookie = {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE !== "false",
      maxAge: 30 * 60 * 1000,
    };
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        
        if (user.status === "locked") {
          return done(null, false, { message: "Your account is locked. Please contact support." });
        }

        if (user.status === "pending") {
          return done(null, false, { message: "Your membership is pending approval. A staff member will review your application shortly." });
        }

        const isValid = await storage.comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Incorrect password." });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}
