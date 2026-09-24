/**
 * ecosystem.config.js — PM2 alternative for SeedInfer
 * Runs Next.js frontend + payments worker (watch-only, no PRIVATE_KEY)
 * Usage: pm2 start ecosystem.config.js --env production
 *        pm2 logs seedinfer-payments  ; pm2 logs seedinfer
 */

module.exports = {
  apps: [
    {
      name: "seedinfer",
      cwd: "/opt/seedinfer",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
      },
      env_production: {
        NODE_ENV: "production",
      },
      error_file: "/opt/seedinfer/logs/seedinfer-error.log",
      out_file: "/opt/seedinfer/logs/seedinfer-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      kill_timeout: 5000,
    },
    {
      name: "seedinfer-payments",
      cwd: "/opt/seedinfer",
      // Watch-only multi-chain worker — 7 chains (6 EVM + Solana), poll 15s, concurrency 3
      // No PRIVATE_KEY — only verifies on-chain payments to PAYMENT_ADDRESS / SOLANA_ADDRESS
      // Env file: /opt/seedinfer/.env (loaded via systemd EnvironmentFile or pm2 env; dotenv also checks process.env)
      // ReadWritePaths (systemd): /opt/seedinfer /mnt/nvme /mnt/nvme/seedinfer /dev/shm ; MemoryMax 512M ; Restart always
      script: "lib/payments/worker.ts",
      interpreter: "node",
      interpreter_args: "--loader tsx --env-file=/opt/seedinfer/.env",
      // Alternative if tsx installed as binary: script: "node_modules/.bin/tsx", args: "lib/payments/worker.ts --env-file=/opt/seedinfer/.env"
      // Alternative plain: interpreter_args: "--loader tsx" and rely on EnvironmentFile / dotenv
      exec_mode: "fork",
      instances: 1,
      autorestart: true, // Restart always (systemd Restart=always equivalent)
      exp_backoff_restart_delay: 5000, // RestartSec=5
      watch: false,
      max_memory_restart: "512M", // MemoryMax 512M (systemd MemoryMax=512M)
      env: {
        NODE_ENV: "production",
        WORKER_POLL_MS: "15000",
        WORKER_CONCURRENCY: "3",
        // Element requires refinement: set RPC_URL_* and RPC_FALLBACK_* via /opt/seedinfer/.env — no mocks; ensure all 7 chains have live keys
      },
      env_production: {
        NODE_ENV: "production",
      },
      error_file: "/opt/seedinfer/logs/seedinfer-payments-error.log",
      out_file: "/opt/seedinfer/logs/seedinfer-payments-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      kill_timeout: 5000,
    },
  ],
};
