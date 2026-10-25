import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local"))
  throw new Error(
    ".env.local already exists. Preserve it; remove or rename it yourself before regenerating.",
  );
const result = JSON.parse(
  execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8",
  }),
);
if (!result.API_URL.startsWith("http://127.0.0.1:"))
  throw new Error(
    "Only the project-local Supabase URL is supported by this setup helper.",
  );
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=${result.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${result.PUBLISHABLE_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${result.SECRET_KEY}\nAPP_ORIGIN=http://127.0.0.1:3000\nTEST_DATABASE_URL=${result.DB_URL}\nMAILPIT_URL=${result.MAILPIT_URL}\n`,
  { mode: 0o600 },
);
console.log("Created .env.local with local-only credentials.");
