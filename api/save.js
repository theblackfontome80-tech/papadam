/* =========================================================
   PAPADAM — Enregistrement du menu (fonction Vercel)
   POST /api/save
     { password, action: "login" }         -> vérifie le mot de passe, renvoie une connexion
                                              temporaire (token, 12 h). Le mot de passe
                                              n'est jamais gardé sur le téléphone.
     { token, site, baseVersion, menu, images: [{path,data}] } -> enregistre le menu d'un resto
       site : "sahloul" ou "khezama" (chaque resto a son propre menu et ses prix)

   Variables d'environnement (Vercel > Settings > Environment Variables) :
     ADMIN_PASSWORD  mot de passe du backstage
     GITHUB_TOKEN    clé GitHub (Contents : lecture/écriture sur les dépôts ci-dessous)
     GITHUB_REPOS    facultatif, dépôts séparés par des virgules
     GITHUB_BRANCH   facultatif, "main" par défaut
   Le menu est écrit dans data/menu-<site>.json (et les photos dans media/) de chaque dépôt,
   ce qui met à jour papadam.vercel.app et papadam.rayantriki.com.
   ========================================================= */
const crypto = require('crypto');

const REPOS = (process.env.GITHUB_REPOS || 'theblackfontome80-tech/papadam,theblackfontome80-tech/papadam-food-site')
  .split(',').map((s) => s.trim()).filter(Boolean);
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ORIGINS = ['https://papadam.vercel.app', 'https://papadam.rayantriki.com'];
const SITES = { sahloul: 'Sahloul', khezama: 'Khezama' };
const menuPath = (site) => `data/menu-${site}.json`;

const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
const IMG_SRC = /^\/(assets\/img|media)\/[a-z0-9][a-z0-9-]*\.(webp|jpg|jpeg|png)$/;
const SRCSET = /^(\/(assets\/img|media)\/[a-z0-9][a-z0-9-]*\.(webp|jpg|jpeg|png) \d{2,4}w)(, \/(assets\/img|media)\/[a-z0-9][a-z0-9-]*\.(webp|jpg|jpeg|png) \d{2,4}w)*$/;
const MEDIA_PATH = /^media\/[a-z0-9][a-z0-9-]{0,80}\.(webp|jpg)$/;

const SESSION_HOURS = 12;
const failures = new Map(); // essais ratés par adresse (en plus de la règle du pare-feu Vercel)

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function samePassword(given, expected) {
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

// Clé de signature des connexions : changer le mot de passe (ou la clé GitHub) déconnecte tout le monde.
const sessionKey = () => crypto.createHash('sha256')
  .update(`papadam-session|${String(process.env.ADMIN_PASSWORD).trim()}|${process.env.GITHUB_TOKEN}`).digest();
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sign = (payload) => b64url(crypto.createHmac('sha256', sessionKey()).update(payload).digest());

function makeToken() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = b64url(JSON.stringify({ e: exp }));
  return { token: `${payload}.${sign(payload)}`, exp };
}

function readToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return data.e > Date.now();
  } catch (e) { return false; }
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanMenu(menu) {
  if (!menu || !Array.isArray(menu.categories)) throw new HttpError(400, 'Menu invalide.');
  if (menu.categories.length > 20) throw new HttpError(400, 'Trop de catégories (20 maximum).');
  if (!menu.categories.length) throw new HttpError(400, 'Le menu ne peut pas être vide.');
  const ids = new Set();
  const categories = menu.categories.map((c) => {
    const id = str(c.id, 60);
    if (!SLUG.test(id) || ids.has(id)) throw new HttpError(400, `Identifiant de catégorie invalide : ${id || '(vide)'}`);
    ids.add(id);
    const name = str(c.name, 60);
    if (!name) throw new HttpError(400, 'Une catégorie n’a pas de nom.');
    if (!Array.isArray(c.items) || c.items.length > 80) throw new HttpError(400, `Catégorie « ${name} » : articles invalides.`);
    const cat = { id, name, intro: str(c.intro, 240), items: [] };
    if (c.drinks) cat.drinks = true;
    const itemIds = new Set();
    cat.items = c.items.map((i) => {
      const iname = str(i.name, 80);
      if (!iname) throw new HttpError(400, `Catégorie « ${name} » : un article n’a pas de nom.`);
      const price = Number(i.price);
      if (!Number.isFinite(price) || price < 0.1 || price > 1000) throw new HttpError(400, `Prix invalide pour « ${iname} ».`);
      let iid = str(i.id, 60);
      if (!SLUG.test(iid) || itemIds.has(iid)) iid = `article-${crypto.randomBytes(3).toString('hex')}`;
      itemIds.add(iid);
      const item = { id: iid, name: iname, price: Math.round(price * 1000) / 1000, desc: str(i.desc, 300) };
      const badge = str(i.badge, 24);
      if (badge) item.badge = badge;
      if (['water', 'can', 'naan'].includes(i.glyph)) item.glyph = i.glyph;
      if (i.featured) item.featured = true;
      if (i.img && IMG_SRC.test(i.img.src || '')) {
        item.img = { src: i.img.src };
        if (typeof i.img.srcset === 'string' && SRCSET.test(i.img.srcset)) item.img.srcset = i.img.srcset;
        const w = parseInt(i.img.w, 10), h = parseInt(i.img.h, 10);
        if (w > 0 && w < 5000 && h > 0 && h < 5000) { item.img.w = w; item.img.h = h; }
      }
      return item;
    });
    return cat;
  });
  if (!categories.some((c) => c.items.length)) throw new HttpError(400, 'Le menu ne peut pas être vide.');
  return { categories };
}

function cleanImages(images) {
  if (images == null) return [];
  if (!Array.isArray(images) || images.length > 12) throw new HttpError(400, 'Trop de photos en une fois (12 maximum).');
  return images.map((img) => {
    const path = str(img.path, 120);
    if (!MEDIA_PATH.test(path)) throw new HttpError(400, 'Nom de photo invalide.');
    const buf = Buffer.from(String(img.data || ''), 'base64');
    if (buf.length < 100 || buf.length > 1_500_000) throw new HttpError(400, 'Photo trop lourde ou vide.');
    const isWebp = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    if (!(path.endsWith('.webp') ? isWebp : isJpeg)) throw new HttpError(400, 'Format de photo non accepté.');
    return { path, content: buf.toString('base64'), encoding: 'base64' };
  });
}

async function gh(path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'papadam-backstage',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new HttpError(502, `GitHub a refusé l’enregistrement (${res.status}). ${detail.slice(0, 160)}`);
  }
  return raw ? res.text() : res.json();
}

async function currentVersion(repo, path) {
  try {
    const text = await gh(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`, { raw: true });
    return JSON.parse(text).version || 0;
  } catch (e) {
    return 0;
  }
}

async function commitFiles(repo, files, message) {
  const ref = await gh(`/repos/${repo}/git/ref/heads/${encodeURIComponent(BRANCH)}`);
  const parent = ref.object.sha;
  const parentCommit = await gh(`/repos/${repo}/git/commits/${parent}`);
  const tree = [];
  for (const f of files) {
    const blob = await gh(`/repos/${repo}/git/blobs`, { method: 'POST', body: { content: f.content, encoding: f.encoding } });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const newTree = await gh(`/repos/${repo}/git/trees`, { method: 'POST', body: { base_tree: parentCommit.tree.sha, tree } });
  const commit = await gh(`/repos/${repo}/git/commits`, { method: 'POST', body: { message, tree: newTree.sha, parents: [parent] } });
  await gh(`/repos/${repo}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { method: 'PATCH', body: { sha: commit.sha } });
  return commit.sha;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  try {
    if (!process.env.ADMIN_PASSWORD || !process.env.GITHUB_TOKEN) {
      throw new HttpError(500, 'Le backstage n’est pas encore configuré (mot de passe ou clé GitHub manquant sur Vercel).');
    }
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'inconnu';
    const fails = failures.get(ip) || { n: 0, until: 0 };
    if (fails.until > Date.now()) throw new HttpError(429, 'Trop d’essais. Réessayez dans quelques minutes.');

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // 1) Connexion : mot de passe -> connexion temporaire
    if (body.action === 'login' || body.action === 'check') {
      if (!samePassword(String(body.password || '').trim(), String(process.env.ADMIN_PASSWORD).trim())) {
        fails.n += 1;
        if (fails.n >= 5) { fails.until = Date.now() + 15 * 60 * 1000; fails.n = 0; }
        failures.set(ip, fails);
        await new Promise((r) => setTimeout(r, 1500));
        throw new HttpError(401, 'Mot de passe incorrect.');
      }
      failures.delete(ip);
      return res.status(200).json({ ok: true, ...makeToken() });
    }

    // 2) Enregistrement : connexion temporaire obligatoire
    if (!readToken(body.token)) throw new HttpError(401, 'Connexion expirée. Reconnectez-vous.');

    const site = String(body.site || '');
    if (!Object.prototype.hasOwnProperty.call(SITES, site)) throw new HttpError(400, 'Choisissez le restaurant (Sahloul ou Khezama).');
    const path = menuPath(site);
    const menu = cleanMenu(body.menu);
    const images = cleanImages(body.images);

    const latest = await currentVersion(REPOS[0], path);
    if (latest && Number(body.baseVersion) !== latest) {
      throw new HttpError(409, `Le menu de ${SITES[site]} a été modifié depuis un autre appareil. Rechargez la page pour récupérer la dernière version, puis refaites vos changements.`);
    }

    const version = Date.now();
    const out = { version, updated: new Date(version).toISOString(), categories: menu.categories };
    const files = [{ path, content: JSON.stringify(out, null, 2) + '\n', encoding: 'utf-8' }, ...images];
    const message = `Menu ${SITES[site]} modifié depuis le backstage${images.length ? ` (+${images.length} photo${images.length > 1 ? 's' : ''})` : ''}`;

    const results = [];
    for (const repo of REPOS) {
      try {
        await commitFiles(repo, files, message);
        results.push({ repo, ok: true });
      } catch (e) {
        results.push({ repo, ok: false, error: e.message });
      }
    }
    if (!results.some((r) => r.ok)) throw new HttpError(502, results[0].error);
    return res.status(200).json({ ok: true, site, version, menu: out, results });
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: status === 500 && !e.status ? 'Erreur inattendue.' : e.message });
  }
};
