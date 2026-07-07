const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");
const { buildOAuthUserPayload } = require("../utils/oauth");

function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function roleFor(email) {
  return email && adminEmails().includes(email.toLowerCase()) ? "admin" : "student";
}

const providers = {
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
};

if (providers.google) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const payload = buildOAuthUserPayload(profile, "google");
          const correctRole = roleFor(payload.email);
          
          let user = await User.findOne({ provider: "google", providerId: payload.providerId });
          if (!user) {
            user = await User.findOne({ email: payload.email });
            if (user) {
              user = await User.findByIdAndUpdate(
                user._id,
                {
                  provider: "google",
                  providerId: payload.providerId,
                  name: payload.name,
                  avatar: payload.avatar,
                  role: correctRole,
                },
                { new: true }
              );
              console.log(`🔗 Reused existing account and linked Google: ${payload.email} (Role: ${correctRole})`);
            } else {
              // New user - create with correct role
              user = await User.create({
                ...payload,
                role: correctRole,
              });
              console.log(`✅ Created new Google user: ${payload.email} (Role: ${correctRole})`);
            }
          } else {
            // Existing user - verify and enforce correct role on every login
            if (user.role !== correctRole) {
              user = await User.findByIdAndUpdate(user._id, { role: correctRole }, { new: true });
              const change = correctRole === 'admin' ? '⬆️ Promoted' : '⬇️ Demoted';
              console.log(`${change} ${payload.email} to ${correctRole}`);
            }
          }
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

if (providers.github) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/api/auth/github/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const payload = buildOAuthUserPayload(profile, "github");
          const correctRole = roleFor(payload.email);
          
          let user = await User.findOne({ provider: "github", providerId: payload.providerId });
          if (!user) {
            user = await User.findOne({ email: payload.email });
            if (user) {
              user = await User.findByIdAndUpdate(
                user._id,
                {
                  provider: "github",
                  providerId: payload.providerId,
                  name: payload.name,
                  avatar: payload.avatar,
                  role: correctRole,
                },
                { new: true }
              );
              console.log(`🔗 Reused existing account and linked GitHub: ${payload.email} (Role: ${correctRole})`);
            } else {
              // New user - create with correct role
              user = await User.create({
                ...payload,
                role: correctRole,
              });
              console.log(`✅ Created new GitHub user: ${payload.email} (Role: ${correctRole})`);
            }
          } else {
            // Existing user - verify and enforce correct role on every login
            if (user.role !== correctRole) {
              user = await User.findByIdAndUpdate(user._id, { role: correctRole }, { new: true });
              const change = correctRole === 'admin' ? '⬆️ Promoted' : '⬇️ Demoted';
              console.log(`${change} ${payload.email} to ${correctRole}`);
            }
          }
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
}

passport.providers = providers;
passport.roleFor = roleFor;

// Passport serialization for session management (OAuth flow only)
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
