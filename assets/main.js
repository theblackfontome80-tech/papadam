/* =========================================================
   PAPADAM FOOD — interactions
   Vanilla JS, sans dépendance. Chaque module est indépendant.
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Écran d'intro puis entrée du hero ---------- */
  const loader = $('[data-loader]');
  const startHero = () => document.body.classList.add('is-loaded');
  let introSeen = false;
  try { introSeen = sessionStorage.getItem('pp-intro') === '1'; } catch (e) { /* stockage indisponible */ }
  if (!loader || reduceMotion || introSeen) {
    if (loader) loader.classList.add('is-skipped');
    requestAnimationFrame(() => requestAnimationFrame(startHero));
  } else {
    document.body.classList.add('intro-running');
    const t0 = performance.now();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setTimeout(() => {
        loader.classList.add('is-done');
        document.body.classList.remove('intro-running');
        setTimeout(startHero, 260);
        setTimeout(() => { loader.hidden = true; loader.classList.add('is-skipped'); }, 1200);
        try { sessionStorage.setItem('pp-intro', '1'); } catch (e) { /* ignore */ }
      }, Math.max(0, 1300 - (performance.now() - t0)));
    };
    if (document.readyState === 'complete') finish();
    else { addEventListener('load', finish, { once: true }); setTimeout(finish, 2400); }
  }

  /* ---------- Titres révélés lettre par lettre ---------- */
  function splitChars(el) {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'word';
            for (const ch of part) {
              const s = document.createElement('span');
              s.className = 'char';
              s.style.setProperty('--ci', i++);
              s.textContent = ch;
              w.appendChild(s);
            }
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    el.setAttribute('aria-label', label);
    [...el.children].forEach((ch) => ch.setAttribute('aria-hidden', 'true'));
    el.classList.add('split');
  }
  if (!reduceMotion) $$('.section-title, .cta-band__title').forEach(splitChars);

  /* ---------- Header : état au défilement + masquage ---------- */
  const header = $('[data-header]');
  const mobileBar = $('[data-mobile-bar]');
  const hero = $('#accueil');
  let lastY = scrollY;
  let ticking = false;

  function onScroll() {
    const y = scrollY;
    header.classList.toggle('is-scrolled', y > 24);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (!document.body.classList.contains('menu-open')) {
      if (goingDown && y > 480) header.classList.add('is-hidden');
      else if (goingUp || y < 480) header.classList.remove('is-hidden');
    }
    document.body.classList.toggle('header-hidden', header.classList.contains('is-hidden'));
    if (mobileBar && hero) mobileBar.classList.toggle('is-visible', y > hero.offsetHeight * 0.6);
    lastY = y;
    updateParallax();
    updateSpin();
    updateStickyTabs();
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });

  /* ---------- Navigation : lien actif ---------- */
  const navLinks = $$('.nav__link');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => {
          const on = a.getAttribute('href') === `#${e.target.id}`;
          a.classList.toggle('is-current', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => navIO.observe(s));
  }

  /* ---------- Menu mobile ---------- */
  const burger = $('[data-burger]');
  const mobileMenu = $('[data-mobile-menu]');
  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    $('.visually-hidden', burger).textContent = open ? 'Fermer le menu' : 'Ouvrir le menu';
    document.body.classList.toggle('menu-open', open);
    if (open) {
      mobileMenu.hidden = false;
      header.classList.remove('is-hidden');
      requestAnimationFrame(() => mobileMenu.classList.add('is-open'));
      setTimeout(() => $('a', mobileMenu)?.focus({ preventScroll: true }), 350);
    } else {
      mobileMenu.classList.remove('is-open');
      setTimeout(() => { if (!mobileMenu.classList.contains('is-open')) mobileMenu.hidden = true; }, 700);
    }
  }
  burger?.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  mobileMenu?.addEventListener('click', (e) => { if (e.target.closest('a, [data-order]')) setMenu(false); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
  });
  matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Apparitions au défilement ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Parallaxe légère ---------- */
  const parallaxEls = reduceMotion ? [] : $$('[data-parallax]').map((el) => ({
    el,
    target: $('img', el) || el,
    k: parseFloat(el.dataset.parallax) || 0.05,
  }));
  function updateParallax() {
    if (!parallaxEls.length || innerWidth < 760) return;
    const vh = innerHeight;
    for (const p of parallaxEls) {
      const r = p.el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      const delta = (r.top + r.height / 2 - vh / 2) * p.k;
      p.target.style.transform = `translate3d(0, ${delta.toFixed(1)}px, 0) scale(1.12)`;
    }
  }
  updateParallax();

  /* ---------- Visuels détourés : rotation au défilement, flottement, curseur ---------- */
  const spinEls = reduceMotion ? [] : $$('[data-spin]').map((el) => ({ el, deg: parseFloat(el.dataset.spin) || 0 }));
  function updateSpin() {
    const vh = innerHeight;
    for (const s of spinEls) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const p = (r.top + r.height / 2 - vh / 2) / vh; // environ -0.5 … 0.5 pendant la traversée de l'écran
      s.el.style.rotate = `${(-p * s.deg).toFixed(2)}deg`;
    }
  }
  updateSpin();
  if (!reduceMotion) $$('[data-float] > img').forEach((img, i) => { img.classList.add('float-bob'); img.style.animationDelay = `${i * -1.7}s`; });

  const pointerEls = $$('[data-pointer]');
  if (!reduceMotion && pointerEls.length && matchMedia('(pointer: fine)').matches) {
    let px = 0, py = 0, raf = 0;
    addEventListener('pointermove', (e) => {
      px = e.clientX / innerWidth - 0.5;
      py = e.clientY / innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        for (const el of pointerEls) {
          const k = parseFloat(el.dataset.pointer) || 10;
          el.style.transform = `translate3d(${(px * k * 2).toFixed(1)}px, ${(py * k * 2).toFixed(1)}px, 0)`;
        }
      });
    }, { passive: true });
  }

  /* ---------- Onglets du menu ---------- */
  const tabsWrap = $('.menu-tabs-wrap');
  const tablist = $('[data-tabs]');
  const tabs = $$('[role="tab"]', tablist);
  const ink = $('[data-tabs-ink]');
  const panels = $$('[data-panel]');

  function moveInk(tab) {
    if (!ink || !tab) return;
    ink.style.width = `${tab.offsetWidth}px`;
    ink.style.transform = `translateX(${tab.offsetLeft}px)`;
  }
  function activateTab(id, { focus = false } = {}) {
    const tab = tabs.find((t) => t.dataset.tab === id);
    if (!tab) return;
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === id));
    moveInk(tab);
    const tl = tablist.getBoundingClientRect();
    const tr = tab.getBoundingClientRect();
    if (tr.left < tl.left || tr.right > tl.right) {
      tablist.scrollTo({ left: tab.offsetLeft - tablist.clientWidth / 2 + tab.offsetWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    if (focus) tab.focus();
  }
  tabs.forEach((tab) => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
  tablist?.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = tabs.length - 1;
    if (n !== null) { e.preventDefault(); activateTab(tabs[n].dataset.tab, { focus: true }); }
  });
  // Liens « Voir les… » depuis les spécialités
  $$('[data-menu-tab]').forEach((a) => a.addEventListener('click', () => activateTab(a.dataset.menuTab)));
  const activeTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
  addEventListener('load', () => moveInk(activeTab));
  document.fonts?.ready.then(() => moveInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true')));
  addEventListener('resize', () => moveInk(tabs.find((t) => t.getAttribute('aria-selected') === 'true')));
  moveInk(activeTab);

  function updateStickyTabs() {
    if (!tabsWrap) return;
    const top = tabsWrap.getBoundingClientRect().top;
    const stuck = top <= header.offsetHeight + 2 && tabsWrap.parentElement.getBoundingClientRect().bottom > 200;
    tabsWrap.classList.toggle('is-stuck', stuck);
  }

  /* ---------- Fenêtre « Commander » ---------- */
  const orderDlg = $('[data-order-dialog]');
  const choice = $('[data-order-choice]');
  function openOrder(btn) {
    if (!orderDlg) return;
    const item = btn?.dataset.item;
    choice.hidden = !item;
    if (item) {
      $('[data-order-item]', choice).textContent = item;
      $('[data-order-price]', choice).textContent = btn.dataset.price || '';
    }
    if (typeof orderDlg.showModal === 'function') {
      orderDlg.showModal();
      document.body.classList.add('dialog-open');
    } else {
      location.href = $('.order-opt--main', orderDlg).href; // repli : appel direct
    }
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-order]');
    if (btn) { e.preventDefault(); openOrder(btn); }
  });
  $('[data-order-close]')?.addEventListener('click', () => orderDlg.close());
  orderDlg?.addEventListener('click', (e) => { if (e.target === orderDlg) orderDlg.close(); });
  orderDlg?.addEventListener('close', () => document.body.classList.remove('dialog-open'));

  /* ---------- Galerie + visionneuse ---------- */
  const lb = $('[data-lightbox]');
  const lbImg = $('[data-lightbox-img]');
  const lbCap = $('[data-lightbox-cap]');
  const lbCount = $('[data-lb-count]');
  const shots = $$('.gal__btn');
  let current = 0;
  let opener = null;

  function show(i) {
    current = (i + shots.length) % shots.length;
    const b = shots[current];
    lbImg.style.animation = 'none';
    void lbImg.offsetWidth; // relance l'animation
    lbImg.style.animation = '';
    lbImg.src = b.dataset.full;
    lbImg.alt = b.dataset.caption;
    lbCap.textContent = b.dataset.caption;
    lbCount.textContent = `${String(current + 1).padStart(2, '0')} / ${String(shots.length).padStart(2, '0')}`;
    // pré-charge la suivante
    const next = new Image(); next.src = shots[(current + 1) % shots.length].dataset.full;
  }
  shots.forEach((b, i) => b.addEventListener('click', () => {
    opener = b; show(i);
    lb.showModal(); document.body.classList.add('dialog-open');
  }));
  $('[data-lb-prev]')?.addEventListener('click', () => show(current - 1));
  $('[data-lb-next]')?.addEventListener('click', () => show(current + 1));
  $('[data-lb-close]')?.addEventListener('click', () => lb.close());
  lb?.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lightbox__fig')) lb.close(); });
  lb?.addEventListener('close', () => { document.body.classList.remove('dialog-open'); opener?.focus(); });
  lb?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') show(current + 1);
    if (e.key === 'ArrowLeft') show(current - 1);
  });
  // balayage tactile
  let touchX = null;
  lb?.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb?.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  /* ---------- Carte Google Maps (chargée à la demande) ---------- */
  const map = $('[data-map]');
  $('[data-map-load]', map)?.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = map.dataset.src;
    iframe.title = 'Carte Google Maps : Papadam Food, Sahloul, Sousse';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.allowFullscreen = true;
    map.appendChild(iframe);
    iframe.addEventListener('load', () => $('.map__placeholder', map)?.remove());
  });

  /* ---------- Divers ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
  onScroll();
})();
