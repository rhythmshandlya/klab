import process from "node:process";

const rawBaseUrl = process.argv[2] ?? process.env.DEPLOYMENT_URL ?? "https://klab-five.vercel.app";
const baseUrl = new URL(rawBaseUrl.startsWith("http") ? rawBaseUrl : `https://${rawBaseUrl}`);
const checks = [
  { path: "/", method: "GET", status: 200 },
  { path: "/api/health", method: "GET", status: 200, health: true },
  { path: "/api/progress", method: "GET", status: 401 },
  { path: "/api/labs", method: "GET", status: 401 },
  { path: "/api/merge", method: "POST", status: 401 },
  { path: "/api/account/privacy", method: "POST", status: 401 },
];

async function runCheck(check) {
  const response = await fetch(new URL(check.path, baseUrl), {
    method: check.method,
    headers: { "content-type": "application/json", "user-agent": "klab-deployment-smoke" },
    body: check.method === "POST" ? "{}" : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status !== check.status) {
    throw new Error(
      `${check.method} ${check.path}: expected ${check.status}, received ${response.status}`,
    );
  }

  if (check.health) {
    const health = await response.json();
    if (health.status !== "ok" || !health.database?.reachable || !health.auth?.configured) {
      throw new Error(`GET /api/health: production dependencies are not healthy`);
    }
  }

  console.log(`PASS  ${check.method.padEnd(4)} ${check.path} -> ${response.status}`);
}

console.log(`Smoke testing ${baseUrl.origin}`);
for (const check of checks) await runCheck(check);
console.log("Production smoke checks passed.");
