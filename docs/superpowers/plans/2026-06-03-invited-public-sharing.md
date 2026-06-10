# Invited Public Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe invited sharing mode via Cloudflare Tunnel/Access while preserving the current local startup behavior.

**Architecture:** `server.mjs` remains the local HTTP server and defaults to `127.0.0.1`. A new PowerShell script starts the same local server and launches `cloudflared tunnel run`, while Cloudflare Access handles invited-user authentication outside the app. The frontend sends same-origin credentials on API requests so Access cookies are included.

**Tech Stack:** Node HTTP server, browser fetch, PowerShell, Cloudflare Tunnel/Access, Node `node:test`.

---

### Task 1: Local-Only Bind Defaults and Rate Limit Helpers

**Files:**
- Modify: `server.mjs`
- Test: `tests/server.test.mjs`

- [ ] **Step 1: Write failing tests**

Add imports:

```js
  checkRateLimit,
  resolveListenOptions,
```

Add tests:

```js
test('resolveListenOptions defaults to localhost and honors explicit HOST', () => {
  assert.deepEqual(resolveListenOptions({}), { port: 8788, host: '127.0.0.1', publicUrl: 'http://localhost:8788' });
  assert.deepEqual(resolveListenOptions({ PORT: '9000', HOST: '0.0.0.0' }), { port: 9000, host: '0.0.0.0', publicUrl: 'http://localhost:9000' });
});

test('checkRateLimit blocks bursts per client key', () => {
  const bucket = new Map();
  const now = 1000;
  assert.equal(checkRateLimit(bucket, 'client-a', { now, limit: 2, windowMs: 1000 }), true);
  assert.equal(checkRateLimit(bucket, 'client-a', { now: now + 100, limit: 2, windowMs: 1000 }), true);
  assert.equal(checkRateLimit(bucket, 'client-a', { now: now + 200, limit: 2, windowMs: 1000 }), false);
  assert.equal(checkRateLimit(bucket, 'client-a', { now: now + 1201, limit: 2, windowMs: 1000 }), true);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test .\tests\server.test.mjs`

Expected: fail because helpers are not exported.

- [ ] **Step 3: Implement helpers and listen options**

Add exported `resolveListenOptions(env)` and `checkRateLimit(bucket, key, options)` to `server.mjs`. Use `resolveListenOptions(process.env)` in direct startup:

```js
const listenOptions = resolveListenOptions(process.env);
createTrainerServer().listen(listenOptions.port, listenOptions.host, () => {
  console.log(`ChessPrep Lab running at ${listenOptions.publicUrl}`);
});
```

- [ ] **Step 4: Verify green**

Run: `node --test .\tests\server.test.mjs`

Expected: pass.

### Task 2: Protect Engine Endpoint from Bursts

**Files:**
- Modify: `server.mjs`
- Test: `tests/server.test.mjs`

- [ ] **Step 1: Write failing static test**

Add:

```js
test('engine endpoint applies per-client rate limiting', () => {
  const source = readFileSync(join(root, 'server.mjs'), 'utf8');
  assert.match(source, /const engineRateLimitBucket = new Map\(\)/);
  assert.match(source, /checkRateLimit\(engineRateLimitBucket,\s*clientKey/);
  assert.match(source, /429/);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test .\tests\server.test.mjs`

Expected: fail because endpoint rate limiting is missing.

- [ ] **Step 3: Add endpoint rate limiting**

Before reading `/engine-move` request body, identify the client from `cf-connecting-ip`, `x-forwarded-for`, or socket address. If `checkRateLimit` returns false, respond with HTTP 429 JSON.

- [ ] **Step 4: Verify green**

Run: `node --test .\tests\server.test.mjs`

Expected: pass.

### Task 3: Cloudflare Access-Compatible Fetch and Sharing Script

**Files:**
- Modify: `app.js`
- Create: `start-share-trainer.ps1`
- Create: `cloudflare-tunnel.example.yml`
- Test: `tests/installer.test.mjs`

- [ ] **Step 1: Write failing tests**

Add assertions that `app.js` fetch calls include `credentials: 'same-origin'`, and that the sharing script exists with `cloudflared tunnel run`.

- [ ] **Step 2: Verify red**

Run: `node --test .\tests\installer.test.mjs`

Expected: fail because script/config and fetch credentials are absent.

- [ ] **Step 3: Implement**

Add `credentials: 'same-origin'` to the `/lichess-study` fetch and `/engine-move` fetch calls. Create `start-share-trainer.ps1` that:

- Starts the trainer locally on `127.0.0.1`.
- Requires `cloudflared`.
- Requires `$env:CLOUDFLARE_TUNNEL_NAME` or `-TunnelName`.
- Runs `cloudflared tunnel run <name>`.

Create `cloudflare-tunnel.example.yml` showing `service: http://localhost:8788`.

- [ ] **Step 4: Verify green**

Run: `node --test .\tests\installer.test.mjs`

Expected: pass.

### Task 4: Documentation, Package Sync, Full Verification

**Files:**
- Modify: `README.md`
- Modify: `installer/package/app/app.js`
- Modify: `installer/package/app/server.mjs`
- Modify: `installer/package/app/README.md`
- Copy: `start-share-trainer.ps1`
- Copy: `cloudflare-tunnel.example.yml`

- [ ] **Step 1: Update README**

Document:

- Local startup remains unchanged.
- Invited sharing uses Cloudflare Tunnel and Cloudflare Access.
- Friends only open the HTTPS link.
- Do not port-forward `8788`.

- [ ] **Step 2: Sync installer package**

Copy changed app files into `installer/package/app`.

- [ ] **Step 3: Run full verification**

Run:

```powershell
node --test .\tests\endgames.test.mjs .\tests\trainer-core.test.mjs .\tests\installer.test.mjs .\tests\server.test.mjs
```

Expected: all tests pass.
