const port = process.env.PORT || process.env.NIYAMSETU_PORT || 8765;
const host = process.env.NIYAMSETU_HEALTH_HOST || "127.0.0.1";
const timeoutMs = Number(process.env.NIYAMSETU_HEALTH_TIMEOUT_MS || 4000);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

fetch(`http://${host}:${port}/api/health`, { signal: controller.signal })
  .then((response) => {
    clearTimeout(timeout);
    process.exit(response.ok ? 0 : 1);
  })
  .catch(() => {
    clearTimeout(timeout);
    process.exit(1);
  });