import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import pg from "pg";

const port = 5099;
const baseUrl = `http://127.0.0.1:${port}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for integration tests");
const pool = new pg.Pool({ connectionString: databaseUrl });
let server: ChildProcess;

async function request(path: string, body?: unknown, cookie?: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { response, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Test server did not become healthy");
}

before(async () => {
  server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), NODE_ENV: "test", SESSION_SECRET: process.env.SESSION_SECRET || "integration-session-secret", DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY || "integration-encryption-key" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();
});

after(async () => {
  server?.kill("SIGTERM");
  await pool.end();
});

test("registration, login, staff approval, OTP transfer, and balances", async () => {
  const suffix = Date.now();
  const memberEmail = `member-${suffix}@example.com`;
  const staffEmail = `staff-${suffix}@example.com`;
  const recipientEmail = `recipient-${suffix}@example.com`;
  const registration = {
    fullName: "Integration Member", email: memberEmail, password: "StrongPass123", ssnLast4: "1234",
    phone: "5551234567", dateOfBirth: "1990-01-01", address: "1 Test Way", city: "Testville", state: "CA", zipCode: "90210",
  };

  const registered = await request("/api/register", { ...registration, role: "staff", status: "active" });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.data.role, "member");
  assert.equal(registered.data.status, "pending");
  assert.equal(registered.data.ssnLast4, undefined);

  const memberRow = (await pool.query(`SELECT id, password, ssn_last4, ssn_last4_encrypted FROM users WHERE email=$1`, [memberEmail])).rows[0];
  assert.equal(memberRow.ssn_last4, null);
  assert.ok(memberRow.ssn_last4_encrypted);

  const recipientRegistered = await request("/api/register", { ...registration, email: recipientEmail, fullName: "Recipient Member", ssnLast4: "5678" });
  assert.equal(recipientRegistered.response.status, 201);
  const recipientId = (await pool.query(`SELECT id FROM users WHERE email=$1`, [recipientEmail])).rows[0].id;

  await request("/api/register", { ...registration, email: staffEmail, fullName: "Integration Staff", ssnLast4: "9999" });
  const staffId = (await pool.query(`SELECT id FROM users WHERE email=$1`, [staffEmail])).rows[0].id;
  await pool.query(`UPDATE users SET status='active' WHERE id=$1`, [staffId]);

  const staffLogin = await request("/api/login", { username: staffEmail, password: registration.password });
  assert.equal(staffLogin.response.status, 200);
  await pool.query(`UPDATE users SET role='staff' WHERE id=$1`, [staffId]);
  // Refresh the serialized user after role promotion.
  const staffLogin2 = await request("/api/login", { username: staffEmail, password: registration.password });
  assert.equal(staffLogin2.response.status, 200);
  const approval = await fetch(`${baseUrl}/api/admin/users/${memberRow.id}/status`, { method: "PATCH", headers: { "content-type": "application/json", cookie: staffLogin2.cookie! }, body: JSON.stringify({ status: "active" }) });
  assert.equal(approval.status, 200);

  const memberLogin = await request("/api/login", { username: memberEmail, password: registration.password });
  assert.equal(memberLogin.response.status, 200);
  assert.ok(memberLogin.cookie);

  const fromAccount = (await pool.query(`INSERT INTO accounts (user_id,account_number,type,balance,available_balance,status) VALUES ($1,$2,'checking','100.00','100.00','active') RETURNING id`, [memberRow.id, `1${String(suffix).slice(-9)}`])).rows[0];
  const recipientNumber = `2${String(suffix).slice(-9)}`;
  const toAccount = (await pool.query(`INSERT INTO accounts (user_id,account_number,type,balance,available_balance,status) VALUES ($1,$2,'checking','20.00','20.00','active') RETURNING id`, [recipientId, recipientNumber])).rows[0];

  const idempotencyKey = "4a847df8-0ab5-41d7-9f4a-801e4993ecbe";
  const transferBody = { fromAccountId: fromAccount.id, toAccountNumber: recipientNumber, amount: "25.00", narration: "Integration test", idempotencyKey };
  const transfer = await request("/api/transactions/transfer", transferBody, memberLogin.cookie);
  assert.equal(transfer.response.status, 201);
  const duplicate = await request("/api/transactions/transfer", transferBody, memberLogin.cookie);
  assert.equal(duplicate.response.status, 201);
  assert.equal(duplicate.data.id, transfer.data.id);
  const balances = await pool.query(`SELECT id,balance FROM accounts WHERE id IN ($1,$2) ORDER BY id`, [fromAccount.id, toAccount.id]);
  assert.deepEqual(balances.rows.map(row => Number(row.balance)), [75, 45]);
});
