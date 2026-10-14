/* Nika Pilates Studio — site script (no dependencies) */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ------------------------------------------------------------------
     ONLINE BOOKING
     Paste the public link of your booking page here, for example
     'https://YOUR-STUDIO.simplybook.me/v2/' (SimplyBook.me) or your
     Setmore booking page link. When it is set:
       - the Schedule page shows your booking system instead of the
         sample timetable below,
       - the home page "Today" card links to it.
     While it is empty, the site shows the sample timetable and every
     "Book" button opens the contact form with the class filled in.
     ------------------------------------------------------------------ */
  const BOOKING_URL = '';

  /* ------------------------------------------------------------------
     Class types and weekly timetable (sample data, used while
     BOOKING_URL is empty). 3 reformers = 3 places per class.
     ------------------------------------------------------------------ */
  const CAPACITY = 3;
  const CLASSES = {
    foundations: { name: { sr: 'Reformer osnove', en: 'Reformer Foundations' }, level: { sr: 'Početni', en: 'Beginner' }, mins: 50 },
    sculpt: { name: { sr: 'Reformer sculpt', en: 'Reformer Sculpt' }, level: { sr: 'Svi nivoi', en: 'All levels' }, mins: 50 },
    power: { name: { sr: 'Reformer power', en: 'Reformer Power' }, level: { sr: 'Napredni', en: 'Advanced' }, mins: 50 },
    stretch: { name: { sr: 'Slow flow i istezanje', en: 'Slow Flow & Stretch' }, level: { sr: 'Svi nivoi', en: 'All levels' }, mins: 50 },
  };

  // Day index follows Date#getDay(): 0 = Sunday … 6 = Saturday. Sunday is closed.
  const WEEK = {
    1: [['08:00', 'sculpt'], ['10:00', 'foundations'], ['18:00', 'sculpt'], ['19:15', 'power']],
    2: [['07:30', 'power'], ['09:30', 'stretch'], ['17:30', 'foundations'], ['18:45', 'sculpt'], ['20:00', 'stretch']],
    3: [['08:00', 'sculpt'], ['10:00', 'foundations'], ['18:00', 'power'], ['19:15', 'sculpt']],
    4: [['07:30', 'sculpt'], ['09:30', 'stretch'], ['17:30', 'foundations'], ['18:45', 'power'], ['20:00', 'sculpt']],
    5: [['08:00', 'foundations'], ['10:00', 'sculpt'], ['17:30', 'sculpt'], ['18:45', 'stretch']],
    6: [['09:00', 'sculpt'], ['10:15', 'foundations'], ['11:30', 'stretch']],
    0: [],
  };

  // Demo availability: a stable pseudo-random number of free places (0–3).
  const SPOT_TABLE = [0, 1, 1, 2, 2, 3, 3, 3];

  /* ---------- Language ---------- */
  const I18N = window.NIKA_I18N || { en: {}, ui: { sr: {}, en: {} } };
  const LANG_KEY = 'nika-lang';
  let lang = 'sr';
  try {
    if (localStorage.getItem(LANG_KEY) === 'en') lang = 'en';
  } catch (e) {
    /* storage unavailable: stay on Serbian */
  }

  const ui = () => I18N.ui[lang] || I18N.ui.sr;
  const t = (key, vars = {}) => {
    const s = ui()[key] ?? I18N.ui.sr[key] ?? key;
    return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Serbian text lives in the HTML; remember it so the page can switch back.
  const saved = new WeakMap();
  const remember = (el) => {
    if (!saved.has(el)) saved.set(el, { text: el.textContent, html: el.innerHTML, attrs: {} });
    return saved.get(el);
  };
  const metaDesc = $('meta[name="description"]');
  const original = { title: document.title, desc: metaDesc ? metaDesc.content : '' };

  function applyStatic() {
    const en = lang === 'en' ? I18N.en : {};
    $$('[data-i18n]').forEach((el) => {
      const s = remember(el);
      el.textContent = en[el.dataset.i18n] ?? s.text;
    });
    $$('[data-i18n-html]').forEach((el) => {
      const s = remember(el);
      el.innerHTML = en[el.dataset.i18nHtml] ?? s.html;
    });
    $$('[data-i18n-attr]').forEach((el) => {
      const s = remember(el);
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((x) => x.trim());
        if (!(attr in s.attrs)) s.attrs[attr] = el.getAttribute(attr);
        el.setAttribute(attr, en[key] ?? s.attrs[attr]);
      });
    });
    const page = document.body.dataset.page || 'home';
    document.title = en[`meta.${page}.title`] ?? original.title;
    if (metaDesc) metaDesc.content = en[`meta.${page}.desc`] ?? original.desc;
    document.documentElement.lang = lang === 'en' ? 'en' : 'sr-Latn';
    $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }

  const rerenders = [];
  function setLang(next) {
    if (next === lang) return;
    lang = next;
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch (e) {
      /* the choice just won't be remembered */
    }
    applyStatic();
    rerenders.forEach((fn) => fn());
  }
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));

  /* ---------- Dates ---------- */
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const fmtShort = (d) =>
    lang === 'en'
      ? `${ui().daysShort[d.getDay()]} ${d.getDate()} ${ui().monthsShort[d.getMonth()]}`
      : `${ui().daysShort[d.getDay()]} ${d.getDate()}. ${ui().monthsShort[d.getMonth()]}`;
  const fmtLong = (d) =>
    lang === 'en'
      ? `${ui().daysLong[d.getDay()]} ${d.getDate()} ${ui().monthsLong[d.getMonth()]}`
      : cap(`${ui().daysLong[d.getDay()]}, ${d.getDate()}. ${ui().monthsLong[d.getMonth()]}`);
  const fmtMonth = (d) => `${ui().monthsLong[d.getMonth()]} ${d.getFullYear()}`;
  const pad = (n) => String(n).padStart(2, '0');

  function spotsFor(date, time) {
    let h = 2166136261;
    for (const ch of date.toDateString() + time) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return SPOT_TABLE[(h >>> 0) % SPOT_TABLE.length];
  }

  function classesOn(date) {
    return (WEEK[date.getDay()] || []).map(([time, key]) => {
      const [hh, mm] = time.split(':').map(Number);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm);
      const c = CLASSES[key];
      return { time, key, start, spots: spotsFor(date, time), mins: c.mins, name: c.name[lang], level: c.level[lang] };
    });
  }

  // Booking links carry the class in the hash, e.g. contact.html#book-sculpt-20261013-0930,
  // so they work on any static host without a server reading query strings.
  function bookingUrl(cls, waitlist = false) {
    const d = cls.start;
    const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    return `contact.html#${waitlist ? 'waitlist' : 'book'}-${cls.key}-${ymd}-${cls.time.replace(':', '')}`;
  }

  function spotsLabel(spots) {
    if (spots === 0) return { text: t('full'), cls: 'is-full' };
    if (spots === 1) return { text: t('oneLeft'), cls: 'is-low' };
    return { text: t('spotsFree', { n: spots, cap: CAPACITY }), cls: '' };
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Footer year ---------- */
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Header state ---------- */
  const header = $('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  const toggle = $('.menu-toggle');
  const menu = $('#mobile-menu');
  if (toggle && menu) {
    const label = $('[data-menu-label]', toggle);
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      label.textContent = open ? t('menuClose') : t('menuOpen');
      menu.hidden = !open;
      header.classList.toggle('menu-open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    toggle.addEventListener('click', () => setOpen(menu.hidden));
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => {
      if (e.matches) setOpen(false);
    });
    rerenders.push(() => (label.textContent = menu.hidden ? t('menuOpen') : t('menuClose')));
  }

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Home: "Today at Nika" ---------- */
  const todayList = $('[data-today-list]');
  if (todayList) {
    const renderToday = () => {
      if (BOOKING_URL) {
        $('[data-today-label]').textContent = t('bookOnline');
        $('[data-today-date]').textContent = '';
        todayList.innerHTML = `<li><span class="t-empty">${esc(t('bookOnlineText'))}</span></li>
          <li><a class="btn btn--outline btn--sm" href="schedule.html">${esc(t('bookOnline'))}</a></li>`;
        return;
      }
      const now = new Date();
      let day = startOfDay(now);
      let upcoming = classesOn(day).filter((c) => c.start > now);
      let label = t('todayAt');
      for (let i = 1; !upcoming.length && i <= 7; i++) {
        day = addDays(startOfDay(now), i);
        upcoming = classesOn(day);
        label = i === 1 ? t('tomorrowAt') : cap(fmtShort(day));
      }
      $('[data-today-label]').textContent = label;
      $('[data-today-date]').textContent = fmtShort(day);
      todayList.innerHTML = upcoming
        .slice(0, 4)
        .map((c) => {
          const s = spotsLabel(c.spots);
          const action = c.spots
            ? `<a class="btn btn--outline btn--sm" href="${bookingUrl(c)}" aria-label="${esc(t('bookAria', { cls: c.name, time: c.time }))}">${esc(t('book'))}</a>`
            : `<a class="btn btn--outline btn--sm" href="${bookingUrl(c, true)}" aria-label="${esc(t('waitlistAria', { cls: c.name, time: c.time }))}">${esc(t('waitlist'))}</a>`;
          return `<li>
            <span class="t-time">${c.time}</span>
            <span class="t-class"><strong>${esc(c.name)}</strong><span>${c.mins} min · ${esc(s.text)}</span></span>
            ${action}
          </li>`;
        })
        .join('');
    };
    renderToday();
    rerenders.push(renderToday);
  }

  /* ---------- Schedule page ---------- */
  const schedList = $('[data-sched-list]');
  const bookingHost = $('[data-booking-host]');
  if (bookingHost && BOOKING_URL) {
    // A real booking system is connected: show it instead of the sample timetable.
    const renderEmbed = () => {
      bookingHost.innerHTML = `
        <iframe class="sched-embed" src="${esc(BOOKING_URL)}" title="${esc(t('bookingFrame'))}" loading="lazy"></iframe>
        <p class="note"><a href="${esc(BOOKING_URL)}" target="_blank" rel="noopener">${esc(t('openBooking'))}</a></p>`;
    };
    renderEmbed();
    rerenders.push(renderEmbed);
  } else if (schedList) {
    const today = startOfDay(new Date());
    const MAX_WEEKS_AHEAD = 3;
    const state = { weekStart: today, selected: today, cls: '' };

    const classSel = $('#filter-class');
    const fillClassOptions = () => {
      const current = classSel.value;
      $$('option[data-class]', classSel).forEach((o) => o.remove());
      Object.entries(CLASSES).forEach(([key, c]) => {
        const o = new Option(c.name[lang], key);
        o.dataset.class = key;
        classSel.add(o);
      });
      classSel.value = current;
    };

    const prevBtn = $('[data-week-prev]');
    const nextBtn = $('[data-week-next]');
    const daysEl = $('[data-days]');

    function renderDays() {
      $('[data-month]').textContent = fmtMonth(state.selected);
      prevBtn.disabled = state.weekStart <= today;
      nextBtn.disabled = state.weekStart >= addDays(today, 7 * MAX_WEEKS_AHEAD);
      daysEl.innerHTML = '';
      for (let i = 0; i < 7; i++) {
        const d = addDays(state.weekStart, i);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'day-btn' + (WEEK[d.getDay()].length ? '' : ' is-closed');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', String(sameDay(d, state.selected)));
        btn.setAttribute('aria-label', fmtLong(d));
        btn.tabIndex = sameDay(d, state.selected) ? 0 : -1;
        btn.innerHTML = `<span class="d-name">${esc(sameDay(d, today) ? t('today') : ui().daysShort[d.getDay()])}</span><span class="d-num">${d.getDate()}</span>`;
        btn.addEventListener('click', () => {
          state.selected = d;
          renderDays();
          renderList();
        });
        daysEl.appendChild(btn);
      }
    }

    daysEl.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const btns = $$('.day-btn', daysEl);
      const i = btns.indexOf(document.activeElement);
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
      btns[next].click();
      $$('.day-btn', daysEl)[next].focus();
    });

    function renderList() {
      const now = new Date();
      $('[data-day-title]').textContent = fmtLong(state.selected);
      const all = classesOn(state.selected);
      const rows = all.filter((c) => !state.cls || c.key === state.cls);
      if (!all.length) {
        schedList.innerHTML = `<li class="sched-empty"><p>${esc(t('closed'))}</p></li>`;
        return;
      }
      if (!rows.length) {
        schedList.innerHTML = `<li class="sched-empty"><p>${esc(t('emptyFilter'))}</p><button type="button" class="btn btn--outline btn--sm" data-clear>${esc(t('clearFilter'))}</button></li>`;
        $('[data-clear]', schedList).addEventListener('click', () => {
          state.cls = '';
          classSel.value = '';
          renderList();
        });
        return;
      }
      schedList.innerHTML = rows
        .map((c) => {
          const past = c.start <= now;
          const s = spotsLabel(c.spots);
          let action;
          if (past) action = `<span class="sr-started">${esc(t('started'))}</span>`;
          else if (c.spots) action = `<a class="btn btn--sm" href="${bookingUrl(c)}" aria-label="${esc(t('bookAria', { cls: c.name, time: c.time }))}">${esc(t('book'))}</a>`;
          else action = `<a class="btn btn--outline btn--sm" href="${bookingUrl(c, true)}" aria-label="${esc(t('waitlistAria', { cls: c.name, time: c.time }))}">${esc(t('waitlist'))}</a>`;
          return `<li class="sched-row${past ? ' is-past' : ''}">
            <div class="sr-time"><strong>${c.time}</strong><span>${c.mins} min</span></div>
            <div class="sr-class"><strong>${esc(c.name)}</strong></div>
            <div class="sr-level">${esc(c.level)}</div>
            <div class="sr-spots ${past ? '' : s.cls}">${past ? '' : esc(s.text)}</div>
            ${action}
          </li>`;
        })
        .join('');
    }

    prevBtn.addEventListener('click', () => {
      state.weekStart = addDays(state.weekStart, -7);
      if (state.weekStart < today) state.weekStart = today;
      state.selected = state.weekStart;
      renderDays();
      renderList();
    });
    nextBtn.addEventListener('click', () => {
      state.weekStart = addDays(state.weekStart, 7);
      state.selected = state.weekStart;
      renderDays();
      renderList();
    });
    classSel.addEventListener('change', () => {
      state.cls = classSel.value;
      renderList();
    });

    fillClassOptions();
    renderDays();
    renderList();
    rerenders.push(() => {
      fillClassOptions();
      renderDays();
      renderList();
    });
  }

  /* ---------- Gallery: filters + lightbox ---------- */
  const grid = $('[data-gallery]');
  if (grid) {
    const items = $$('.g-item', grid);
    const chips = $$('[data-filter]');
    chips.forEach((chip) =>
      chip.addEventListener('click', () => {
        const f = chip.dataset.filter;
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        items.forEach((it) => (it.hidden = f !== 'all' && it.dataset.cat !== f));
      })
    );

    const lb = $('#lightbox');
    const lbImg = $('.lb-figure img', lb);
    const capEl = $('[data-lb-caption]', lb);
    const countEl = $('[data-lb-count]', lb);
    let visible = [];
    let index = 0;

    function show(i) {
      index = (i + visible.length) % visible.length;
      const item = visible[index];
      const img = $('img', item);
      lbImg.src = item.dataset.full || img.currentSrc || img.src;
      lbImg.alt = img.alt;
      capEl.textContent = $('figcaption span', item).textContent;
      countEl.textContent = `${index + 1} / ${visible.length}`;
    }

    items.forEach((item) =>
      $('button', item).addEventListener('click', () => {
        visible = items.filter((it) => !it.hidden);
        show(visible.indexOf(item));
        lb.showModal();
        document.body.style.overflow = 'hidden';
      })
    );
    $('.lb-prev', lb).addEventListener('click', () => show(index - 1));
    $('.lb-next', lb).addEventListener('click', () => show(index + 1));
    $('.lb-close', lb).addEventListener('click', () => lb.close());
    lb.addEventListener('close', () => (document.body.style.overflow = ''));
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.classList.contains('lb-inner')) lb.close();
    });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(index + 1);
      if (e.key === 'ArrowLeft') show(index - 1);
    });
  }

  /* ---------- Contact form ---------- */
  const form = $('#contact-form');
  if (form) {
    const msg = $('#message');
    let autoText = '';

    // Prefill from the link that brought the visitor here:
    // #free-class, #private, #plan-nika-8, #book-sculpt-20261013-0930, #waitlist-…
    const applyHash = () => {
      const hash = location.hash.slice(1);
      let topic = '';
      let text = '';
      let m;
      if ((m = hash.match(/^(book|waitlist)-([a-z]+)-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/)) && CLASSES[m[2]]) {
        const date = new Date(+m[3], +m[4] - 1, +m[5]);
        const vars = { cls: CLASSES[m[2]].name[lang], date: fmtShort(date), time: `${m[6]}:${m[7]}` };
        topic = 'book';
        text = t(m[1] === 'waitlist' ? 'msgWaitlist' : 'msgBook', vars);
      } else if ((m = hash.match(/^plan-nika-(\d+)$/))) {
        topic = 'membership';
        text = t('msgPlan', { n: m[1] });
      } else if (hash === 'free-class') {
        topic = 'free-class';
        text = t('msgFree');
      } else if (hash === 'private') {
        topic = 'private';
        text = t('msgPrivate');
      } else if (['book', 'membership', 'other'].includes(hash)) {
        topic = hash;
      }
      if (!topic) return;
      const radio = $(`input[name="topic"][value="${topic}"]`, form);
      if (radio) radio.checked = true;
      // Only replace the message if the visitor hasn't written their own.
      if (text && (!msg.value || msg.value === autoText)) {
        msg.value = text;
        autoText = text;
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    rerenders.push(applyHash);

    const errorEl = $('[data-form-error]', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const invalid = $$('input, textarea, select', form).find((el) => !el.checkValidity());
      if (invalid) {
        const name = invalid.closest('.field')?.querySelector('label [data-i18n], legend')?.textContent.trim() || '';
        const problem = invalid.validity.valueMissing ? t('errRequired') : t('errEmail');
        errorEl.textContent = name ? `${name}: ${problem}` : problem;
        errorEl.hidden = false;
        invalid.focus();
        return;
      }
      errorEl.hidden = true;
      // The site is static, so nothing is sent yet. Connect a form service
      // (for example Formspree, or your booking system's contact form) here.
      $('[data-success-name]').textContent = $('#first-name').value.trim();
      form.hidden = true;
      const success = $('#form-success');
      success.hidden = false;
      success.focus();
    });
  }

  /* ---------- Apply the saved language last, then reveal the page ---------- */
  document.documentElement.lang = lang === 'en' ? 'en' : 'sr-Latn';
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  if (lang === 'en') {
    applyStatic();
    rerenders.forEach((fn) => fn());
  }
  document.documentElement.classList.remove('i18n-pending');
})();
