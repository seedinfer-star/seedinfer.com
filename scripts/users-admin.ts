/**
 * scripts/users-admin.ts — owner-side management of SeedInfer user data (no web admin panel).
 *
 * Run ON THE SERVER as the service user, from the app directory:
 *   cd /opt/seedinfer && sudo -u orangepi npx tsx scripts/users-admin.ts <command> [args]
 *
 * Commands
 *   storage                      where the data lives, backups, row counts
 *   list [--limit N]             users with sign-in methods, balance, last login
 *   show <email|id>              one account (profile, links, sessions metadata, balance)
 *   export <email|id> [--out F]  full JSON export (GDPR access request)
 *   signout <email|id>           revoke all sessions of the user
 *   delete <email|id> --yes      delete the account (links, sessions, credits, invoices; usage anonymized)
 *   backup                       write a consistent backup now (VACUUM INTO)
 *
 * Refuses to run as root: SQLite would create root-owned -wal/-shm files and lock the service out.
 */
import fs from "fs";
import path from "path";
import { closeDb, describeStorage, getDb, snapshotNow } from "../lib/db";
import { deleteAccount, exportUserData, getAccountSnapshot, isOAuthOnlyAccount } from "../lib/accounts";
import { revokeUserSessions } from "../lib/auth";

function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}

function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

function resolveUser(ref: string | undefined): { id: string; email: string } {
  if (!ref) die("missing <email|id>");
  const row = getDb()
    .prepare("SELECT id, email FROM users WHERE id = ? OR lower(email) = lower(?)")
    .get(ref, ref) as { id: string; email: string } | undefined;
  if (!row) die(`no user matches "${ref}"`);
  return row;
}

function main(): void {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const flag = (name: string) => args.includes(name);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };

  if (!cmd || cmd === "help" || flag("--help")) {
    console.log(
      [
        "usage: sudo -u orangepi npx tsx scripts/users-admin.ts <command>",
        "  storage | list [--limit N] | show <email|id> | export <email|id> [--out F]",
        "  signout <email|id> | delete <email|id> --yes | backup",
      ].join("\n")
    );
    return;
  }
  if (typeof process.getuid === "function" && process.getuid() === 0 && !flag("--allow-root")) {
    die("refusing to run as root — use: sudo -u orangepi npx tsx scripts/users-admin.ts " + args.join(" "));
  }
  loadDotEnv(path.join(process.cwd(), ".env"));
  if (!process.env.DATABASE_URL) die("DATABASE_URL is not set (run from the app directory that has .env)");

  const db = getDb();
  switch (cmd) {
    case "storage": {
      const s = describeStorage();
      const counts = ["users", "oauth_accounts", "sessions", "credits", "invoices", "usage"].map(
        (t) => `${t}=${(db.prepare(`SELECT count(*) AS c FROM ${t}`).get() as any).c}`
      );
      console.log(JSON.stringify({ ...s, backups: s.backups.slice(-5), backup_count: s.backups.length, rows: counts.join(" ") }, null, 2));
      break;
    }
    case "list": {
      const limit = Math.max(1, Math.min(10_000, Number(opt("--limit") || 200)));
      const rows = db
        .prepare(
          `SELECT u.id, u.email, u.email_verified AS verified, u.password_hash, u.created_at, u.last_login_at,
                  COALESCE(c.balance_usd_cents, 0) AS cents,
                  (SELECT group_concat(provider, '+') FROM oauth_accounts o WHERE o.user_id = u.id) AS providers
             FROM users u LEFT JOIN credits c ON c.user_id = u.id
            ORDER BY u.created_at DESC LIMIT ?`
        )
        .all(limit) as any[];
      console.table(
        rows.map((r) => ({
          email: r.email,
          verified: r.verified === 1 ? "yes" : "no",
          methods: [isOAuthOnlyAccount(r.password_hash) ? null : "password", r.providers].filter(Boolean).join("+") || "-",
          balance: `$${(Number(r.cents) / 100).toFixed(2)}`,
          created: String(r.created_at || "").slice(0, 10),
          last_login: String(r.last_login_at || "").slice(0, 16).replace("T", " ") || "-",
          id: String(r.id).slice(0, 8),
        }))
      );
      break;
    }
    case "show": {
      const u = resolveUser(args[1]);
      console.log(JSON.stringify(getAccountSnapshot(u.id, ""), null, 2));
      break;
    }
    case "export": {
      const u = resolveUser(args[1]);
      const data = JSON.stringify(exportUserData(u.id), null, 2);
      const out = opt("--out");
      if (out) {
        fs.writeFileSync(out, data, { mode: 0o600 });
        console.log(`written ${out}`);
      } else console.log(data);
      break;
    }
    case "signout": {
      const u = resolveUser(args[1]);
      console.log(`revoked ${revokeUserSessions(u.id)} session(s) of ${u.email}`);
      break;
    }
    case "delete": {
      const u = resolveUser(args[1]);
      if (!flag("--yes")) die(`this permanently deletes ${u.email} — re-run with --yes`);
      console.log(deleteAccount(u.id) ? `deleted ${u.email}` : `delete failed for ${u.email}`);
      break;
    }
    case "backup": {
      snapshotNow().then((f) => {
        console.log(`backup written: ${f}`);
        closeDb();
      });
      return;
    }
    default:
      die(`unknown command "${cmd}" — try: help`);
  }
  closeDb();
}

main();
