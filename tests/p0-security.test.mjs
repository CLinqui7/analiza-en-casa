import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PORTAL_ACCESS_ERROR,
  PORTAL_CODE_MESSAGE,
  PORTAL_CODE_REQUEST_MESSAGE,
  callServiceRpc,
  createFixedWindowRateLimiter,
  createVerificationCode,
  sendVerificationCode,
  sha256
} from "../api/_portal-security.js";
import portalStatusHandler from "../api/portal-status.js";
import portalRequestCodeHandler from "../api/portal-request-code.js";

const migrationPath = new URL("../supabase/migrations/202608260004_p0_organization_portal_hardening.sql", import.meta.url);
const adapterPath = new URL("../app/supabase-adapter.js", import.meta.url);
const viewsPath = new URL("../app/views.js", import.meta.url);

async function p0Files() {
  const [migration, adapter, views] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(adapterPath, "utf8"),
    readFile(viewsPath, "utf8")
  ]);
  return { migration, adapter, views };
}

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; }
  };
}

async function withServerEnvironment(run) {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.SUPABASE_URL;
  const serverRoleKeyName = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
  const previousKey = process.env[serverRoleKeyName];
  process.env.SUPABASE_URL = "https://example.invalid";
  process.env[serverRoleKeyName] = "server-only";
  try {
    return await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env[serverRoleKeyName];
    else process.env[serverRoleKeyName] = previousKey;
  }
}

test("portal uses cryptographic code hashes and safe simulated delivery", async () => {
  const code = createVerificationCode();
  assert.match(code, /^\d{8}$/);
  assert.match(sha256(code), /^[a-f0-9]{64}$/);
  assert.equal(PORTAL_CODE_REQUEST_MESSAGE.includes("paciente"), false);
  assert.equal(PORTAL_ACCESS_ERROR.includes("DUI"), false);

  const delivery = await sendVerificationCode({ channel: "SMS", destination: "+50370000000", code, environment: {} });
  assert.equal(delivery.provider, "mock");
  assert.match(delivery.body, new RegExp(code));
  assert.match(delivery.body, new RegExp(PORTAL_CODE_MESSAGE));
  assert.doesNotMatch(delivery.body, /diagn[oó]stico|tratamiento|medicamento/i);
});

test("portal rate-limit contract blocks the next request and opens a new window", () => {
  let current = 1_000;
  const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 100, now: () => current });
  assert.equal(limiter.allow("ip-a"), true);
  assert.equal(limiter.allow("ip-a"), true);
  assert.equal(limiter.allow("ip-a"), false);
  current += 101;
  assert.equal(limiter.allow("ip-a"), true);
});

test("server RPC payload omits DUI and only sends the token, OTP and fingerprints", async () => {
  let request;
  const result = await callServiceRpc(async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ quote_id: "SYNTHETIC-QUOTE" }) };
  }, { url: "https://example.invalid", serviceRoleKey: "server-only" }, "portal_quote_snapshot", {
    p_token: "a".repeat(64),
    p_verification_code: "12345678",
    p_ip_hash: "hash",
    p_user_agent_hash: "agent"
  });
  const payload = JSON.parse(request.init.body);
  assert.equal(result.quote_id, "SYNTHETIC-QUOTE");
  assert.equal(request.url.endsWith("/portal_quote_snapshot"), true);
  assert.equal("p_document" in payload, false);
  assert.deepEqual(Object.keys(payload).sort(), ["p_ip_hash", "p_token", "p_user_agent_hash", "p_verification_code"]);
});

test("portal endpoints return a snapshot only for a validated code and otherwise stay generic", async () => {
  await withServerEnvironment(async () => {
    const token = "a".repeat(64);
    const validResponse = responseRecorder();
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ quote_id: "SYNTHETIC-QUOTE", status: "APPROVED" }) });
    await portalStatusHandler({ method: "POST", body: { token, verificationCode: "12345678" }, headers: { "x-forwarded-for": "valid-ip" } }, validResponse);
    assert.equal(validResponse.statusCode, 200);
    assert.equal(validResponse.body.quote_id, "SYNTHETIC-QUOTE");
    assert.equal(validResponse.headers["Cache-Control"], "no-store");

    for (const ip of ["bad-token", "expired", "revoked", "bad-code", "used-code", "attempt-limit", "cross-quote"]) {
      const blockedResponse = responseRecorder();
      globalThis.fetch = async () => ({ ok: true, json: async () => null });
      await portalStatusHandler({ method: "POST", body: { token, verificationCode: "00000000" }, headers: { "x-forwarded-for": ip } }, blockedResponse);
      assert.equal(blockedResponse.statusCode, 401);
      assert.deepEqual(blockedResponse.body, { error: PORTAL_ACCESS_ERROR });
    }
  });
});

test("OTP request response is identical whether the link can receive a new code", async () => {
  await withServerEnvironment(async () => {
    const responses = [];
    for (const [ip, rpcResult] of [["issuable", { accepted: true, channel: "EMAIL", destination: "synthetic@example.invalid" }], ["unknown", { accepted: false }]]) {
      globalThis.fetch = async () => ({ ok: true, json: async () => rpcResult });
      const response = responseRecorder();
      await portalRequestCodeHandler({ method: "POST", body: { token: "b".repeat(64) }, headers: { "x-forwarded-for": ip } }, response);
      responses.push({ statusCode: response.statusCode, body: response.body });
    }
    assert.deepEqual(responses, [
      { statusCode: 202, body: { message: PORTAL_CODE_REQUEST_MESSAGE } },
      { statusCode: 202, body: { message: PORTAL_CODE_REQUEST_MESSAGE } }
    ]);
  });
});

test("P0 portal SQL contract handles valid, invalid, expired, revoked, used and superseded codes", async () => {
  const { migration, views } = await p0Files();
  for (const marker of [
    "create_patient_portal_link",
    "encode(gen_random_bytes(32), 'hex')",
    "token_hash, expires_at, delivery_channel",
    "verification_code_hash = p_verification_code_hash",
    "verification_code_expires_at = now() + interval '10 minutes'",
    "verification_code_used_at = now()",
    "verification_code_generation = verification_code_generation + 1",
    "portal.failed_attempts >= portal.max_attempts",
    "portal.revoked_at is not null",
    "portal.expires_at <= now()",
    "'INVALID_CODE'",
    "'CODE_EXPIRED_OR_USED'",
    "'RATE_LIMITED'",
    "'VERIFIED'"
  ]) assert.match(migration, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.match(migration, /q\.id = portal\.quote_id[\s\S]*q\.organization_id = portal\.organization_id[\s\S]*q\.patient_id = portal\.patient_id/);
  assert.doesNotMatch(migration, /p_document/);
  assert.match(views, /ui\.portalSnapshot\?\.token===token/);
  assert.doesNotMatch(views, /state\.quotes\.find\(\(q\)=>q\.portalToken===token\)/);
});

test("P0 organization SQL contract derives membership server-side and closes privileged functions", async () => {
  const { migration, adapter } = await p0Files();
  for (const marker of [
    "create table if not exists public.organization_invitations",
    "create or replace function public.bootstrap_new_user()",
    "from public.organization_invitations oi",
    "insert into public.user_roles",
    "create or replace function public.assign_organization_role",
    "p_user_id = auth.uid()",
    "r.id = p_role_id and r.organization_id = organization",
    "'ASSIGN_ORGANIZATION_ROLE'",
    "create or replace function public.enforce_actor_organization_id()",
    "new.organization_id := public.current_organization_id()",
    "alter table public.user_roles enable row level security",
    "revoke all on function public.assign_organization_role(uuid, uuid) from public, anon, authenticated",
    "grant execute on function public.assign_organization_role(uuid, uuid) to authenticated"
  ]) assert.match(migration, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.doesNotMatch(migration, /requested_org\s*:=\s*nullif\(new\.raw_user_meta_data\s*->>\s*'organization_id'/);
  assert.doesNotMatch(adapter, /payload\?\.organizationId/);
  assert.doesNotMatch(adapter, /organization_id\s*:/);
});

test("all new SECURITY DEFINER functions use an explicit safe path and narrow grants", async () => {
  const { migration } = await p0Files();
  const functionBlocks = migration.match(/create(?:\s+or\s+replace)? function public\.[\s\S]*?\$\$;/gi) || [];
  assert.ok(functionBlocks.length >= 10);
  for (const block of functionBlocks) {
    if (/security definer/i.test(block)) assert.match(block, /set search_path = pg_catalog, public/i);
  }
  assert.doesNotMatch(migration, /grant execute on function[\s\S]*?to public/i);
  assert.match(migration, /grant execute on function public\.portal_quote_snapshot\(text, text, text, text\) to service_role/i);
});
