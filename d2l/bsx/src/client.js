// Layer 1: the only file that knows how to talk to Brightspace.
// Read-only (GET), same-origin, authenticated by the signed-in session.
globalThis.BSX = globalThis.BSX || {};

BSX.client = (() => {
  const TTL = 2 * 60 * 1000;
  const MAX_CONCURRENT = 4;
  const MAX_PAGES = 20;
  const cache = new Map();
  const waiting = [];
  let active = 0;
  let versions = null;

  class ApiError extends Error {
    constructor(status, path) {
      super(`Brightspace returned ${status} for ${path}`);
      this.status = status;
    }
  }

  function slot() {
    return new Promise((resolve) => {
      const go = () => {
        active++;
        resolve();
      };
      if (active < MAX_CONCURRENT) go();
      else waiting.push(go);
    });
  }

  async function raw(path) {
    await slot();
    try {
      const res = await fetch(path, { credentials: 'same-origin' });
      if (!res.ok) throw new ApiError(res.status, path);
      // An expired session answers with a sign-in page instead of data.
      const type = res.headers ? res.headers.get('content-type') : null;
      if (type != null && !/json/i.test(type)) throw new ApiError(401, path);
      return await res.json();
    } finally {
      active--;
      const next = waiting.shift();
      if (next) next();
    }
  }

  // ---- saved answers ---------------------------------------------------------
  // The last answer for each address is kept in extension storage (this browser only), so
  // a freshly opened page shows at once from the previous visit while the real request
  // runs; when the real answer differs, listeners are told and the page redraws.
  const store = (globalThis.browser || globalThis.chrome)?.storage?.local;
  const KEY = `bsxCache:${globalThis.location?.host || ''}`;
  const KEEP = 7 * 864e5;
  const MAX_ENTRY = 400e3; // characters; very long answers (big classlists) are not kept
  const MAX_TOTAL = 4e6;
  const listeners = new Set();
  let saved = new Map(); // path -> { at, json }
  let bypass = false; // after Refresh, this page always waits for Brightspace
  let saveTimer = null;
  let changeTimer = null;

  const ready = (async () => {
    try {
      const v = (await store.get(KEY))?.[KEY];
      if (v && typeof v.entries === 'object') {
        for (const [p, e] of Object.entries(v.entries)) if (e && typeof e.json === 'string' && Date.now() - e.at < KEEP) saved.set(p, e);
      }
    } catch {}
  })();

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const newest = [...saved.entries()].sort((a, b) => b[1].at - a[1].at);
      const entries = {};
      let total = 0;
      for (const [p, e] of newest) {
        if ((total += e.json.length) > MAX_TOTAL) break;
        entries[p] = e;
      }
      try {
        store.set({ [KEY]: { entries } });
      } catch {}
    }, 1000);
  }

  function remember(path, data) {
    const json = JSON.stringify(data);
    if (json.length > MAX_ENTRY) saved.delete(path);
    else saved.set(path, { at: Date.now(), json });
    persist();
  }

  // Signed out, or a different person may sign in next: drop everything kept.
  function forget() {
    saved = new Map();
    persist();
  }

  function changed() {
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => listeners.forEach((fn) => fn()), 300);
  }

  // `path` is an API address; `fetcher` (optional) produces the answer some other way, for
  // facts worked out from a page (see keep).
  function get(path, fetcher = raw) {
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL) return hit.promise;
    const fresh = fetcher(path);
    fresh.then(
      (d) => remember(path, d),
      (e) => e instanceof ApiError && e.status === 401 && forget()
    );
    const entry = { at: Date.now(), promise: null };
    entry.promise = (async () => {
      await ready;
      const old = hit || bypass ? null : saved.get(path);
      if (!old) return fresh;
      let data;
      try {
        data = JSON.parse(old.json);
      } catch {
        return fresh;
      }
      fresh.then(
        (d) => {
          entry.promise = Promise.resolve(d);
          if (JSON.stringify(d) !== old.json) changed();
        },
        () => {
          // The saved answer no longer holds; redraw so the page shows the real outcome.
          saved.delete(path);
          cache.delete(path);
          changed();
        }
      );
      return data;
    })();
    cache.set(path, entry);
    entry.promise.catch(() => cache.delete(path));
    return entry.promise;
  }

  function getVersions() {
    if (!versions) {
      versions = (async () => {
        try {
          const saved = JSON.parse(sessionStorage.getItem('bsx.versions'));
          if (saved && saved.lp && saved.le) return saved;
        } catch {}
        const list = await get('/d2l/api/versions/');
        const latest = (code) => list.find((p) => p.ProductCode === code)?.LatestVersion;
        const found = { lp: latest('lp'), le: latest('le') };
        if (!found.lp || !found.le) throw new Error('Brightspace did not report its lp and le API versions');
        try {
          sessionStorage.setItem('bsx.versions', JSON.stringify(found));
        } catch {}
        return found;
      })();
      versions.catch(() => (versions = null));
    }
    return versions;
  }

  const lpPath = async (tail) => `/d2l/api/lp/${(await getVersions()).lp}/${tail}`;
  const lePath = async (tail) => `/d2l/api/le/${(await getVersions()).le}/${tail}`;
  const lp = async (tail) => get(await lpPath(tail));
  const le = async (tail) => get(await lePath(tail));

  // { PagingInfo: { Bookmark, HasMoreItems }, Items: [] }
  async function lpBookmarked(tail) {
    const items = [];
    let bookmark = '';
    for (let page = 0; page < MAX_PAGES; page++) {
      const sep = tail.includes('?') ? '&' : '?';
      const r = await lp(bookmark ? `${tail}${sep}bookmark=${encodeURIComponent(bookmark)}` : tail);
      items.push(...(r.Items || []));
      if (!r.PagingInfo?.HasMoreItems) break;
      bookmark = r.PagingInfo.Bookmark;
    }
    return items;
  }

  // { Objects: [], Next: url | null }
  async function leObjects(tail) {
    let page = await le(tail);
    const items = [...(page.Objects || [])];
    for (let i = 1; i < MAX_PAGES && page.Next; i++) {
      const next = new URL(page.Next, location.origin);
      if (next.origin !== location.origin) break;
      page = await get(next.pathname + next.search);
      items.push(...(page.Objects || []));
    }
    return items;
  }

  // A Brightspace page's HTML (same origin, GET), for facts the API refuses students.
  const pages = new Map();
  function page(path) {
    const hit = pages.get(path);
    if (hit && Date.now() - hit.at < TTL) return hit.promise;
    const promise = (async () => {
      await slot();
      try {
        const res = await fetch(path, { credentials: 'same-origin' });
        if (!res.ok) throw new ApiError(res.status, path);
        if (/\/d2l\/login/i.test(res.url || '')) throw new ApiError(401, path);
        return await res.text();
      } finally {
        active--;
        const next = waiting.shift();
        if (next) next();
      }
    })();
    pages.set(path, { at: Date.now(), promise });
    promise.catch(() => pages.delete(path));
    return promise;
  }

  // The one write the wrapper makes: handing in an assignment, at the student's request.
  // Brightspace's own pages authorise writes with a short-lived token fetched with the
  // page's anti-forgery token; the session cookie alone is the fallback.
  async function token() {
    let xsrf = null;
    try {
      xsrf = localStorage.getItem('XSRF.Token');
    } catch {}
    if (!xsrf) return { xsrf: null, bearer: null };
    try {
      const res = await fetch('/d2l/lp/auth/oauth2/token', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Csrf-Token': xsrf },
        body: 'scope=*:*:*',
      });
      return { xsrf, bearer: res.ok ? (await res.json()).access_token || null : null };
    } catch {
      return { xsrf, bearer: null };
    }
  }

  async function send(tail, { body, type }) {
    const path = await lePath(tail);
    const t = await token();
    const headers = { 'Content-Type': type };
    if (t.bearer) headers.Authorization = `Bearer ${t.bearer}`;
    else if (t.xsrf) headers['X-Csrf-Token'] = t.xsrf;
    const res = await fetch(path, { method: 'POST', credentials: 'same-origin', headers, body });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
      } catch {}
      const e = new ApiError(res.status, path);
      e.detail = detail;
      throw e;
    }
    return res;
  }

  const clear = () => {
    pages.clear();
    cache.clear();
    bypass = true;
  };
  const onChange = (fn) => listeners.add(fn);

  // A small fact worked out from a Brightspace page (such as the links on a course's home
  // page), kept like an API answer: shown at once from the last visit, then refreshed.
  const keep = (key, fetcher) => get(`keep:${key}`, () => fetcher());

  return { ApiError, lp, le, lpPath, lePath, lpBookmarked, leObjects, page, send, keep, clear, forget, onChange };
})();
