import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "../storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    console.error("Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    return;
  }

  // Use APP_URL for the callback — works on DO App Platform, custom domains, etc.
  // Falls back to a relative path for local dev without APP_URL set.
  const callbackURL = process.env.APP_URL
    ? `${process.env.APP_URL}/api/auth/google/callback`
    : "/api/auth/google/callback";

  console.log("Google OAuth callback URL:", callbackURL);

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const firstName = profile.name?.givenName || null;
          const lastName = profile.name?.familyName || null;
          const profileImageUrl = profile.photos?.[0]?.value || null;

          let user = await storage.getUser(profile.id);

          const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL?.toLowerCase();
          const isDefaultAdmin = email && defaultAdminEmail && email.toLowerCase() === defaultAdminEmail;

          if (!user) {
            const { db } = await import("../db");
            const { users } = await import("@shared/schema");

            const [newUser] = await db.insert(users).values({
              id: profile.id,
              email: email || null,
              firstName,
              lastName,
              profileImageUrl,
              isAdmin: isDefaultAdmin || false,
            }).returning();
            user = newUser;
          } else {
            const updateData: any = {
              email: email || user.email,
              firstName: firstName || user.firstName,
              lastName: lastName || user.lastName,
              profileImageUrl: profileImageUrl || user.profileImageUrl,
            };
            if (isDefaultAdmin && !user.isAdmin) {
              updateData.isAdmin = true;
            }
            user = await storage.updateUser(profile.id, updateData);
          }

          // Only store the user ID in the session — user data is fetched fresh on each request
          return done(null, { id: user?.id ?? profile.id });
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  // ── Session serialization ─────────────────────────────────────────────────
  // Store only the user ID — prevents sensitive fields (paynowIntegrationKey
  // etc.) from being written into every session row in the database.
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Re-fetch user from DB on each request — ensures fresh data and correct roles.
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      // Never expose paynow secret key to req.user
      const { paynowIntegrationKey, ...safeUser } = user as any;
      done(null, safeUser);
    } catch (error) {
      done(error);
    }
  });

  app.get("/api/login", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/",
      successRedirect: "/",
    })
  );

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.json({ success: true });
    });
  });

  app.get("/api/logout", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.redirect("/");
    }
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.redirect("/");
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

export const isAdmin: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && (req.user as any)?.isAdmin) {
    return next();
  }
  res.status(403).json({ message: "Forbidden: Admin access required" });
};
