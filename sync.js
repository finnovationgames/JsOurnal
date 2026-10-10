/* J's Ournal sync engine.
   Everything is encrypted on the device (AES-GCM, key derived from the passphrase with PBKDF2)
   before it is sent. The relay is a private GitHub repository that only ever stores ciphertext.
   Works in browsers and in Node 18+ (for tests). */
(function (root) {
  "use strict";
  const FILE = "journal.enc.json";
  const ITER = 310000;
  const TOMB_DAYS = 180;
  const te = new TextEncoder(), td = new TextDecoder();
  const cryptoApi = root.crypto || (typeof globalThis !== "undefined" && globalThis.crypto);

  const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (str) => Uint8Array.from(atob(String(str).replace(/\s+/g, "")), (c) => c.charCodeAt(0));

  /* ---------- crypto ---------- */
  async function deriveKey(passphrase, salt) {
    const base = await cryptoApi.subtle.importKey("raw", te.encode(passphrase), "PBKDF2", false, ["deriveBits"]);
    const bits = await cryptoApi.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, 256);
    return new Uint8Array(bits);
  }
  const aesKey = (raw) => cryptoApi.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  async function seal(doc, rawKey, salt) {
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await cryptoApi.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(rawKey), te.encode(JSON.stringify(doc))));
    return JSON.stringify({ app: "jsournal", v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) });
  }
  function header(text) {
    const o = JSON.parse(text);
    if (o.app !== "jsournal" || !o.salt || !o.iv || !o.ct) throw err("not_journal", "The sync file isn't a J's Ournal file.");
    return o;
  }
  async function unseal(text, rawKey) {
    const o = header(text);
    let pt;
    try { pt = await cryptoApi.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, await aesKey(rawKey), unb64(o.ct)); }
    catch { throw err("bad_passphrase", "The passphrase doesn't match the saved calendar."); }
    return JSON.parse(td.decode(pt));
  }

  /* ---------- merge: newest change wins per activity; deletions are remembered ---------- */
  const emptyDoc = () => ({ events: {}, tombs: {}, settings: { data: null, at: 0 } });
  const newer = (a, b) => (a.at || 0) > (b.at || 0) || ((a.at || 0) === (b.at || 0) && String(a.by || "") > String(b.by || ""));
  function merge(local, remote, now = Date.now()) {
    local = local || emptyDoc(); remote = remote || emptyDoc();
    const out = emptyDoc(); let changed = false;
    const cutoff = now - TOMB_DAYS * 86400000;
    for (const [id, at] of Object.entries(remote.tombs || {})) out.tombs[id] = at;
    for (const [id, at] of Object.entries(local.tombs || {})) {
      if (!(id in out.tombs) || at > out.tombs[id]) { if ((remote.tombs || {})[id] !== at) changed = true; out.tombs[id] = at; }
    }
    const ids = new Set([...Object.keys(local.events || {}), ...Object.keys(remote.events || {})]);
    for (const id of ids) {
      const l = (local.events || {})[id], r = (remote.events || {})[id];
      let pick = r;
      if (l && (!r || newer(l, r))) { pick = l; changed = true; }
      if (!pick) continue;
      if (id in out.tombs && out.tombs[id] >= (pick.at || 0)) continue;
      out.events[id] = pick;
    }
    for (const [id, at] of Object.entries(out.tombs)) if (at < cutoff) delete out.tombs[id];
    const ls = local.settings || { data: null, at: 0 }, rs = remote.settings || { data: null, at: 0 };
    if (ls.data && (!rs.data || newer(ls, rs))) { out.settings = ls; changed = true; } else out.settings = rs.data ? rs : ls;
    return { doc: out, changed };
  }

  /* ---------- GitHub relay ---------- */
  function err(code, message, status) { const e = new Error(message); e.code = code; e.status = status; return e; }
  function relay(cfg, fetchImpl) {
    const f = fetchImpl || root.fetch.bind(root);
    const repoUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
    const headers = { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    async function fail(r) {
      if (r.status === 401) return err("auth", "GitHub didn't accept the access token. It may have expired: make a new one and paste it in Sync settings.", 401);
      if (r.status === 403 || r.status === 429) {
        const left = r.headers.get("x-ratelimit-remaining");
        return left === "0" ? err("rate", "GitHub asked us to slow down. Syncing will resume shortly.", r.status)
          : err("forbidden", "The token can't write to this repository. Give it Contents: Read and write access.", r.status);
      }
      if (r.status === 404) return err("not_found", `Can't find the repository ${cfg.owner}/${cfg.repo}, or the token can't see it.`, 404);
      return err("http", `GitHub replied with an error (${r.status}). Syncing will try again.`, r.status);
    }
    return {
      async checkRepo() {
        const r = await f(repoUrl, { headers, cache: "no-store" });
        if (!r.ok) throw await fail(r);
        const j = await r.json();
        if (!j.private) throw err("public_repo", "That repository is public. Use a private one so nobody can even see the encrypted file.");
        return j;
      },
      async get() {
        const r = await f(`${repoUrl}/contents/${FILE}`, { headers, cache: "no-store" });
        if (r.status === 404) { await this.checkRepo(); return null; }
        if (!r.ok) throw await fail(r);
        const j = await r.json();
        let content = j.content;
        if (!content && j.git_url) {
          const b = await f(j.git_url, { headers, cache: "no-store" });
          if (!b.ok) throw await fail(b);
          content = (await b.json()).content;
        }
        return { sha: j.sha, text: td.decode(unb64(content)) };
      },
      async put(text, sha) {
        const body = { message: `Sync from ${cfg.deviceName || "a device"}`, content: b64(te.encode(text)) };
        if (sha) body.sha = sha;
        const r = await f(`${repoUrl}/contents/${FILE}`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (r.status === 409 || r.status === 422) return { conflict: true };
        if (!r.ok) throw await fail(r);
        const j = await r.json();
        return { sha: j.content && j.content.sha };
      },
    };
  }

  /* One round: fetch, decrypt, merge with this device, write back if this device had anything new. */
  async function syncOnce(cfg, localDoc, opts = {}) {
    const rl = relay(cfg, opts.fetch);
    const key = unb64(cfg.key), salt = unb64(cfg.salt);
    for (let attempt = 0; attempt < 5; attempt++) {
      const remote = await rl.get();
      const remoteDoc = remote ? await unseal(remote.text, key) : null;
      const { doc, changed } = merge(localDoc, remoteDoc, opts.now);
      if (!remote || changed) {
        const res = await rl.put(await seal(doc, key, salt), remote && remote.sha);
        if (res.conflict) continue; /* another device wrote in between: merge again */
      }
      return doc;
    }
    throw err("busy", "Another device kept syncing at the same moment. Trying again shortly.");
  }

  /* First-time setup or joining existing data with a passphrase. Returns a config to store. */
  async function connect({ owner, repo, token, passphrase, deviceName }, opts = {}) {
    const base = { owner: owner.trim(), repo: repo.trim(), token: token.trim(), deviceName };
    const rl = relay(base, opts.fetch);
    await rl.checkRepo();
    const remote = await rl.get();
    let salt;
    if (remote) salt = unb64(header(remote.text).salt);
    else salt = cryptoApi.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(passphrase, salt);
    if (remote) await unseal(remote.text, key); /* throws bad_passphrase */
    return { ...base, key: b64(key), salt: b64(salt), existing: !!remote };
  }

  /* Link codes carry the repo, token and key, so a second device needs no passphrase typing. */
  const PREFIX = "JSOURNAL1:";
  function linkCode(cfg) { return PREFIX + b64(te.encode(JSON.stringify({ o: cfg.owner, r: cfg.repo, t: cfg.token, k: cfg.key, s: cfg.salt }))); }
  function parseLinkCode(code) {
    const c = String(code || "").trim().replace(/\s+/g, "");
    if (!c.startsWith(PREFIX)) throw err("bad_code", "That isn't a J's Ournal link code. Copy it again from the other device.");
    let o; try { o = JSON.parse(td.decode(unb64(c.slice(PREFIX.length)))); } catch { throw err("bad_code", "The link code is incomplete. Copy it again from the other device."); }
    if (!o.o || !o.r || !o.t || !o.k || !o.s) throw err("bad_code", "The link code is incomplete. Copy it again from the other device.");
    return { owner: o.o, repo: o.r, token: o.t, key: o.k, salt: o.s };
  }
  async function verify(cfg, opts = {}) {
    const rl = relay(cfg, opts.fetch);
    const remote = await rl.get();
    if (remote) await unseal(remote.text, unb64(cfg.key));
    return true;
  }

  const api = { merge, emptyDoc, seal, unseal, deriveKey, syncOnce, connect, linkCode, parseLinkCode, verify, relay, b64, unb64, FILE };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.JSync = api;
})(typeof self !== "undefined" ? self : globalThis);
