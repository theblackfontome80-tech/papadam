/* =========================================================
   PAPADAM — Menu généré depuis /data/menu.json
   Le fichier est modifié depuis le backstage (/admin).
   Si le chargement échoue, le menu écrit dans la page reste affiché.
   ========================================================= */
(() => {
  'use strict';
  const menuSection = document.getElementById('menu');
  if (!menuSection) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toFixed(3).replace('.', ',');
  const SIZES = '(max-width: 640px) 92vw, (max-width: 1100px) 45vw, 360px';

  function media(item, drinks) {
    const img = item.img;
    if (img && img.src) {
      const srcset = img.srcset ? ` srcset="${esc(img.srcset)}" sizes="${SIZES}"` : '';
      const dims = img.w && img.h ? ` width="${+img.w}" height="${+img.h}"` : '';
      return `<figure class="dish__media"><img src="${esc(img.src)}"${srcset}${dims} alt="${esc(item.name)}" loading="lazy" decoding="async"></figure>`;
    }
    const glyph = item.glyph || (drinks ? 'can' : 'naan');
    return `<div class="dish__media dish__media--glyph" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="#i-${esc(glyph)}"/></svg></div>`;
  }

  function dish(item, i, drinks) {
    const price = `${fmt(item.price)} DT`;
    return `<li class="dish${drinks ? ' dish--drink' : ''}" style="--i:${i}">
  ${media(item, drinks)}
  ${item.badge ? `<span class="dish__badge">${esc(item.badge)}</span>` : ''}
  <div class="dish__body">
    <div class="dish__top">
      <h3 class="dish__name">${esc(item.name)}</h3>
      <p class="dish__price"><span>${fmt(item.price)}</span> DT</p>
    </div>
    ${item.desc ? `<p class="dish__desc">${esc(item.desc)}</p>` : ''}
    <button class="dish__order" type="button" data-order data-item="${esc(item.name)}" data-price="${esc(price)}">Commander<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow"/></svg></button>
  </div>
</li>`;
  }

  function panel(id, title, intro, items, drinks, active) {
    return `<div class="menu-panel${active ? ' is-active' : ''}" role="tabpanel" id="panel-${esc(id)}" aria-labelledby="tab-${esc(id)}" tabindex="0" data-panel="${esc(id)}">
  <div class="menu-panel__head"><h3 class="menu-panel__title">${esc(title)}</h3><p>${esc(intro)}</p></div>
  <ul class="dish-grid${drinks ? ' dish-grid--drinks' : ''}">${items.map((it, i) => dish(it, i, drinks)).join('\n')}</ul>
</div>`;
  }

  function tab(id, name, active) {
    return `<button class="menu-tab" role="tab" id="tab-${esc(id)}" aria-controls="panel-${esc(id)}" aria-selected="${active}" tabindex="${active ? 0 : -1}" data-tab="${esc(id)}">${esc(name)}</button>`;
  }

  function render(menu) {
    const cats = (menu.categories || []).filter((c) => c && c.id && Array.isArray(c.items));
    if (!cats.length) return;
    const tablist = menuSection.querySelector('[data-tabs]');
    const ink = tablist.querySelector('[data-tabs-ink]');
    const note = menuSection.querySelector('.menu__note');
    const accompagnements = menuSection.querySelector('[data-panel="accompagnements"]');
    const currentId = tablist.querySelector('[aria-selected="true"]')?.dataset.tab;

    // Ordre : catégories de plats, puis « Nos spécialités », « Accompagnements », puis les boissons
    const food = cats.filter((c) => !c.drinks);
    const drinks = cats.filter((c) => c.drinks);
    const featured = food.flatMap((c) => c.items.filter((i) => i.featured));
    const entries = [
      ...food.map((c) => ({ id: c.id, name: c.name, html: (a) => panel(c.id, c.name, c.intro, c.items, false, a) })),
      ...(featured.length ? [{ id: 'specialites', name: 'Nos spécialités',
        html: (a) => panel('specialites', 'Nos spécialités', "Ce que l'on vient chercher chez Papadam : nos produits phares, réunis ici.", featured, false, a) }] : []),
      ...(accompagnements ? [{ id: 'accompagnements', name: 'Accompagnements', node: accompagnements }] : []),
      ...drinks.map((c) => ({ id: c.id, name: c.name, html: (a) => panel(c.id, c.name, c.intro, c.items, true, a) })),
    ];
    const activeId = entries.some((e) => e.id === currentId) ? currentId : entries[0].id;

    // Onglets
    tablist.querySelectorAll('[role="tab"]').forEach((t) => t.remove());
    tablist.insertAdjacentHTML('afterbegin', entries.map((e) => tab(e.id, e.name, e.id === activeId)).join(''));
    if (ink) tablist.appendChild(ink);

    // Panneaux
    menuSection.querySelectorAll('.menu-panel').forEach((p) => { if (p !== accompagnements) p.remove(); });
    entries.forEach((e) => {
      if (e.node) {
        e.node.classList.toggle('is-active', e.id === activeId);
        note.before(e.node);
      } else {
        note.insertAdjacentHTML('beforebegin', e.html(e.id === activeId));
      }
    });

    // Prix du Plat Papadam dans la section « signature »
    const signature = cats.flatMap((c) => c.items).find((i) => i.id === 'plat-papadam');
    if (signature) {
      const span = document.querySelector('.spot__price span');
      if (span) span.textContent = fmt(signature.price);
      const btn = document.querySelector('.spot__buy [data-order]');
      if (btn) { btn.dataset.item = signature.name; btn.dataset.price = `${fmt(signature.price)} DT`; }
    }

    // Données Google (menu et prix)
    const ld = document.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        const data = JSON.parse(ld.textContent);
        data.hasMenu = {
          '@type': 'Menu', name: 'Menu Papadam Food', inLanguage: 'fr',
          hasMenuSection: cats.map((c) => ({
            '@type': 'MenuSection', name: c.name,
            hasMenuItem: c.items.map((i) => ({
              '@type': 'MenuItem', name: i.name, description: i.desc || undefined,
              offers: { '@type': 'Offer', price: Number(i.price).toFixed(3), priceCurrency: 'TND' },
            })),
          })),
        };
        ld.textContent = JSON.stringify(data);
      } catch (e) { /* données Google laissées telles quelles */ }
    }

    dispatchEvent(new CustomEvent('papadam:menu'));
  }

  fetch(`/data/menu.json?t=${Date.now()}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then(render)
    .catch(() => { /* on garde le menu écrit dans la page */ });
})();
