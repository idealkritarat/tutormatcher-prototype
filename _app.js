/* TutorMatcher prototype — shared front-end behaviour.
   No backend. Everything here is client-side only and resets on reload:
   toasts, tabs, segmented controls, star rating, chat, modals, pickers. */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var toastWrap;
  function toast(msg) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'toast-wrap';
      document.body.appendChild(toastWrap);
    }
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toastWrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 250);
    }, 2600);
  }
  window.tmToast = toast;

  function nowTime() {
    var d = new Date();
    var h = d.getHours() % 12 || 12;
    var m = ('0' + d.getMinutes()).slice(-2);
    return h + ':' + m + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
  }
  window.tmNowTime = nowTime;
  window.tmEsc = esc;

  /* ---- URL query param helper ---- */
  window.tmParam = function (name, def) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : (def === undefined ? '' : def);
  };

  /* ---- wallet balance (the ONE thing that persists, via localStorage) ---- */
  var WALLET_KEY = 'tm_balance';
  function walletGet() {
    try { var v = parseInt(localStorage.getItem(WALLET_KEY), 10); return isNaN(v) ? 250 : v; }
    catch (e) { return 250; }
  }
  function walletRender() {
    var v = walletGet();
    document.querySelectorAll('[data-wallet]').forEach(function (el) {
      el.textContent = v.toLocaleString('en-US');
    });
  }
  function walletSet(v) {
    v = Math.max(0, Math.round(v));
    try { localStorage.setItem(WALLET_KEY, String(v)); } catch (e) {}
    walletRender();
  }
  window.tmWallet = {
    get: walletGet,
    set: walletSet,
    add: function (n) { walletSet(walletGet() + n); },
    sub: function (n) { walletSet(walletGet() - n); },
    reset: function () { walletSet(250); }
  };

  /* ---- account state (client-side, localStorage) ----
     tm_auth  : '' logged out | 'user' logged in (everyone starts as a plain student)
     tm_tutor : '' not a tutor | 'pending' applied, awaiting admin | 'approved' is a tutor
     Logout clears ALL tm_* keys — like signing up fresh.                              */
  var AUTH_KEY = 'tm_auth';
  var TUTOR_KEY = 'tm_tutor';
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  window.tmAuth = {
    isIn: function () { return !!lsGet(AUTH_KEY); },
    login: function () { lsSet(AUTH_KEY, 'user'); },
    // wipe EVERY tm_* key — logging back in is a brand-new account
    logout: function () {
      try {
        Object.keys(localStorage)
          .filter(function (k) { return k.indexOf('tm_') === 0; })
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) {}
    }
  };
  window.tmTutor = {
    status: function () { return lsGet(TUTOR_KEY); },
    isTutor: function () { return lsGet(TUTOR_KEY) === 'approved'; },
    apply: function () { lsSet(TUTOR_KEY, 'pending'); },
    cancel: function () { lsDel(TUTOR_KEY); },
    approve: function () { lsSet(TUTOR_KEY, 'approved'); }
  };

  /* ---- the tutor's own subjects — each carries its own hourly rate + blurb.
     Created in /settings/tutor; ticked per open slot in the availability editor.
     tm_subjects : [{ id, name, rate, desc }]   (seeded so the demo isn't blank) */
  var SUBJ_KEY = 'tm_subjects';
  var SUBJ_SEED = [
    { id: 's1', name: 'IELTS Speaking', rate: 480, desc: 'Band 7+ speaking practice with detailed feedback on fluency and pronunciation.' },
    { id: 's2', name: 'Business English', rate: 520, desc: 'Meetings, email and presentation language for working professionals.' }
  ];
  function subjRead() {
    try { var v = JSON.parse(localStorage.getItem(SUBJ_KEY)); return Array.isArray(v) ? v : SUBJ_SEED.slice(); }
    catch (e) { return SUBJ_SEED.slice(); }
  }
  function subjWrite(a) { try { localStorage.setItem(SUBJ_KEY, JSON.stringify(a)); } catch (e) {} }
  window.tmSubjects = {
    list: subjRead,
    add: function (s) {
      var a = subjRead();
      a.push({ id: 's' + Date.now(), name: s.name, rate: +s.rate || 0, desc: s.desc || '' });
      subjWrite(a); return a;
    },
    update: function (id, patch) {
      subjWrite(subjRead().map(function (x) {
        return x.id === id ? { id: x.id, name: patch.name, rate: +patch.rate || 0, desc: patch.desc || '' } : x;
      }));
    },
    remove: function (id) { subjWrite(subjRead().filter(function (x) { return x.id !== id; })); }
  };

  /* ---- tutor availability — which 30-min slots are open + what they'll teach in each.
     tm_avail : { "2026-8-15": { "09:00": { subs: ["s1"] }, "09:30": { subs: [] } } }
     a present slot key === "open"; absent === "not available". Subjects are per slot.   */
  var AVAIL_KEY = 'tm_avail';
  function availRead() { try { return JSON.parse(localStorage.getItem(AVAIL_KEY)) || {}; } catch (e) { return {}; } }
  function availWrite(o) { try { localStorage.setItem(AVAIL_KEY, JSON.stringify(o)); } catch (e) {} }
  window.tmAvail = {
    all: availRead,
    day: function (key) { return availRead()[key] || {}; },
    open: function (key, slot, subs) {
      var o = availRead(); (o[key] = o[key] || {})[slot] = { subs: subs || [] }; availWrite(o);
    },
    close: function (key, slot) {
      var o = availRead();
      if (o[key]) { delete o[key][slot]; if (!Object.keys(o[key]).length) delete o[key]; availWrite(o); }
    },
    setSubs: function (key, slot, subs) {
      var o = availRead();
      if (o[key] && o[key][slot]) { o[key][slot] = { subs: subs.slice() }; availWrite(o); }
    },
    setAllSubs: function (key, subs) {
      var o = availRead(), day = o[key]; if (!day) return;
      Object.keys(day).forEach(function (s) { day[s] = { subs: subs.slice() }; });
      availWrite(o);
    }
  };

  /* ---- tutor listing + verification: goes through admin review.
     Subjects (above) are live instantly; the public listing is not — the tutor SUBMITS
     it, an admin approves, and the approved copy overwrites what's live.
     tm_listing         : the live/approved listing
     tm_listing_pending : a submitted listing awaiting admin approval (null if none)      */
  var LISTING_KEY = 'tm_listing';
  var LISTING_PENDING_KEY = 'tm_listing_pending';
  var LISTING_DEFAULT = {
    published: true,
    name: 'Mina Kittikul',
    headline: 'IELTS & Business English coach · 8 years experience',
    bio: "I help students reach Band 7+ in IELTS with weekly speaking practice and detailed feedback. I've prepared over 300 students for IELTS, TOEFL and job interviews.",
    video: 'https://youtu.be/intro-anong',
    docs: 'Verified 4 Mar 2025'
  };
  function jsonOr(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v || def; } catch (e) { return def; } }
  window.tmListing = {
    live: function () { return jsonOr(LISTING_KEY, LISTING_DEFAULT); },
    pending: function () { try { return JSON.parse(localStorage.getItem(LISTING_PENDING_KEY)); } catch (e) { return null; } },
    submit: function (data) { try { localStorage.setItem(LISTING_PENDING_KEY, JSON.stringify(data)); } catch (e) {} },
    approve: function () {
      var p = this.pending(); if (!p) return;
      try { localStorage.setItem(LISTING_KEY, JSON.stringify(p)); localStorage.removeItem(LISTING_PENDING_KEY); } catch (e) {}
    },
    reject: function () { try { localStorage.removeItem(LISTING_PENDING_KEY); } catch (e) {} }
  };

  /* ---- route guards (run before render) ----
     data-requires-auth       -> logged out  ⇒ login.html?next=…
     data-requires-tutor      -> not approved ⇒ enroll-tutor.html
     data-redirect-if-tutor=X -> already a tutor ⇒ X                                   */
  (function () {
    try {
      var b = document.body; if (!b) return;
      if (b.hasAttribute('data-requires-auth') && !window.tmAuth.isIn()) {
        var here = location.pathname.split('/').pop() + location.search;
        location.replace('login.html?next=' + encodeURIComponent(here)); return;
      }
      if (b.hasAttribute('data-requires-tutor') && !window.tmTutor.isTutor()) {
        location.replace('enroll-tutor.html'); return;
      }
      var doneRedir = b.getAttribute('data-redirect-if-tutor');
      if (doneRedir && window.tmTutor.isTutor()) { location.replace(doneRedir); return; }
    } catch (e) {}
  })();

  document.addEventListener('DOMContentLoaded', function () {
    /* ---- fake route bar: turn the "on the real site" label into a route picker ---- */
    (function () {
      var bar = document.querySelector('.chrome .bar');
      if (!bar) return;
      var routes = [
        { file: 'index.html', path: '/', title: 'Home', access: 'public' },
        { file: 'search.html', path: '/search', title: 'Find tutors', access: 'public' },
        { file: 'tutor-detail.html', path: '/tutors/:id', title: 'Tutor profile', access: 'public' },
        { file: 'login.html', path: '/(auth)/login', title: 'Login', access: 'public' },
        { file: 'enroll-tutor.html', path: '/(auth)/enroll-tutor', title: 'Tutor application', access: 'requires login' },
        { file: 'dashboard-student.html', path: '/dashboard', title: 'Student dashboard', access: 'requires login' },
        { file: 'dashboard-tutor.html', path: '/dashboard/tutor', title: 'Tutor dashboard', access: 'role: tutor' },
        { file: 'booking-detail.html', path: '/bookings/:id', title: 'Booking detail', access: 'requires login' },
        { file: 'bookings.html', path: '/bookings', title: 'Bookings', access: 'requires login' },
        { file: 'messages.html', path: '/messages/:id', title: 'Messages', access: 'requires login' },
        { file: 'payments.html', path: '/wallet', title: 'Wallet', access: 'requires login' },
        { file: 'payment-detail.html', path: '/wallet/transactions/:id', title: 'Transaction', access: 'requires login' },
        { file: 'topup.html', path: '/wallet/topup', title: 'Top up wallet', access: 'requires login' },
        { file: 'settings-account.html', path: '/settings/account', title: 'Account settings', access: 'requires login' },
        { file: 'settings-notifications.html', path: '/settings/notifications', title: 'Notifications', access: 'requires login' },
        { file: 'settings-wallet.html', path: '/settings/wallet', title: 'Wallet settings', access: 'requires login' },
        { file: 'settings-tutor.html', path: '/settings/tutor', title: 'Tutor settings', access: 'role: tutor' },
        { file: 'reviews.html', path: '/reviews/:tutorId', title: 'Reviews', access: 'requires login' },
        { file: 'admin.html', path: '/admin/tutor-requests', title: 'Admin review', access: 'role: admin' }
      ];
      var file = location.pathname.split('/').pop() || 'index.html';
      var current = routes.filter(function (r) { return r.file === file; })[0] || routes[0];
      if (file === 'tutor-detail.html' && location.search.indexOf('subject=') !== -1) {
        current = { file: 'tutor-detail.html', path: '/tutors/:id/:subjectId', title: 'Tutor subject', access: 'public' };
      }
      bar.classList.add('routebar');
      bar.innerHTML =
        '<span class="routebar-label">on the real site</span>' +
        '<div class="route-picker menu-wrap">' +
          '<button class="route-trigger" type="button" data-menu="route-menu">' +
            '<b>' + esc(current.path) + '</b><span class="tag">' + esc(current.access) + '</span><span class="chev">&#9662;</span>' +
          '</button>' +
          '<div class="menu route-menu" id="route-menu" hidden>' +
            routes.map(function (r) {
              return '<a href="' + esc(r.file) + '" class="' + (r.file === current.file ? 'active' : '') + '">' +
                '<span><b>' + esc(r.path) + '</b><small>' + esc(r.title) + '</small></span>' +
                '<em class="tag">' + esc(r.access) + '</em>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</div>';
    })();

    walletRender();
    document.querySelectorAll('a.wallet[href="topup.html"]').forEach(function (el) {
      el.setAttribute('href', 'payments.html');
    });
    document.querySelectorAll('#usermenu').forEach(function (menu) {
      if (menu.querySelector('a[href="payments.html"]')) {
        menu.querySelector('a[href="payments.html"]').textContent = 'Wallet';
        return;
      }
      var topup = menu.querySelector('a[href="topup.html"]');
      if (!topup) return;
      var payments = document.createElement('a');
      payments.href = 'payments.html';
      payments.textContent = 'Wallet';
      menu.insertBefore(payments, topup);
    });

    /* ---- reflect auth state in the shared header ---- */
    var loggedIn = window.tmAuth.isIn();
    document.querySelectorAll('[data-auth="in"]').forEach(function (el) { el.hidden = !loggedIn; });
    document.querySelectorAll('[data-auth="out"]').forEach(function (el) { el.hidden = loggedIn; });

    /* ---- until you're an approved tutor, every "tutor" link routes through enrollment,
           and tutor-only affordances (e.g. the Settings → Tutor tab) are removed outright ---- */
    if (!window.tmTutor.isTutor()) {
      document.querySelectorAll(
        'a[href="dashboard-tutor.html"], a[href="settings-tutor.html"], [data-nav="dashboard-tutor.html"]'
      ).forEach(function (el) {
        if (el.hasAttribute('href')) el.setAttribute('href', 'enroll-tutor.html');
        if (el.hasAttribute('data-nav')) el.setAttribute('data-nav', 'enroll-tutor.html');
      });
      document.querySelectorAll('[data-tutor-only]').forEach(function (el) { el.remove(); });
    }
    document.querySelectorAll('.tutor-cta').forEach(function (el) {
      el.textContent = window.tmTutor.isTutor() ? 'Tutor dashboard' : 'Become a tutor';
    });

    /* ---- unread-messages red dot on the Messages nav link (prototype: always 1 unread) ---- */
    var TM_HAS_UNREAD = true;
    if (loggedIn && TM_HAS_UNREAD && !/messages\.html/.test(location.pathname + location.href)) {
      var mlink = document.querySelector('.appnav a[href="messages.html"]');
      if (mlink && !mlink.querySelector('.navdot')) {
        var d = document.createElement('span');
        d.className = 'navdot';
        d.title = 'Unread messages';
        mlink.appendChild(d);
      }
    }
    document.querySelectorAll('[data-logout]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        window.tmAuth.logout();
        toast('Signed out.');
        setTimeout(function () { location.href = 'index.html'; }, 500);
      });
    });

    /* ---- fake forms: never really submit, just toast + optional redirect ---- */
    document.querySelectorAll('form[data-toast], form[data-go]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = f.getAttribute('data-toast');
        var go = f.getAttribute('data-go');
        if (msg) toast(msg);
        if (go) setTimeout(function () { location.href = go; }, msg ? 700 : 0);
      });
    });

    /* ---- [data-nav] -> navigate on click ---- */
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { location.href = b.getAttribute('data-nav'); });
    });

    /* ---- [data-toast-btn] -> just toast ---- */
    document.querySelectorAll('[data-toast-btn]').forEach(function (b) {
      b.addEventListener('click', function () { toast(b.getAttribute('data-toast-btn')); });
    });

    /* ---- segmented controls (role toggles, view switches) ---- */
    document.querySelectorAll('.segmented').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        seg.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === btn); });
        var group = seg.getAttribute('data-group');
        var val = btn.getAttribute('data-value');
        if (group) {
          document.querySelectorAll('[data-show="' + group + '"]').forEach(function (el) {
            el.hidden = el.getAttribute('data-when') !== val;
          });
        }
        seg.dispatchEvent(new CustomEvent('segchange', { detail: { value: val }, bubbles: true }));
      });
    });

    /* ---- tabs ---- */
    document.querySelectorAll('.tabs').forEach(function (tabs) {
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var id = btn.getAttribute('data-tab');
        tabs.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === btn); });
        (tabs.parentElement || document).querySelectorAll('.tabpanel').forEach(function (p) {
          p.hidden = p.id !== id;
        });
      });
    });

    /* ---- interactive star rating ---- */
    document.querySelectorAll('.rate').forEach(function (rate) {
      var btns = Array.prototype.slice.call(rate.querySelectorAll('button'));
      function paint(n) { btns.forEach(function (b, i) { b.classList.toggle('on', i < n); }); }
      btns.forEach(function (b, i) {
        b.setAttribute('type', 'button');
        b.addEventListener('mouseenter', function () { paint(i + 1); });
        b.addEventListener('click', function () { rate.dataset.value = i + 1; paint(i + 1); });
      });
      rate.addEventListener('mouseleave', function () { paint(parseInt(rate.dataset.value, 10) || 0); });
    });

    /* ---- chat: switch conversation + send message (every .chat on the page) ---- */
    document.querySelectorAll('.chat').forEach(function (chat) {
      chat.querySelectorAll('.conv').forEach(function (c) {
        c.addEventListener('click', function () {
          chat.querySelectorAll('.conv').forEach(function (x) { x.classList.toggle('active', x === c); });
          var id = c.getAttribute('data-thread');
          chat.querySelectorAll('[data-threadpanel]').forEach(function (p) {
            p.hidden = p.getAttribute('data-threadpanel') !== id;
          });
          var head = chat.querySelector('[data-panehead]');
          var nameEl = c.querySelector('.cv-name');
          if (head && nameEl) head.textContent = nameEl.textContent;
          var t = chat.querySelector('[data-threadpanel]:not([hidden]) .thread');
          if (t) t.scrollTop = t.scrollHeight;
        });
      });
      var composer = chat.querySelector('.composer');
      if (composer) {
        var send = function () {
          var ta = composer.querySelector('textarea');
          var txt = ta.value.trim();
          if (!txt) return;
          var thread = chat.querySelector('[data-threadpanel]:not([hidden]) .thread') || chat.querySelector('.thread');
          var b = document.createElement('div');
          b.className = 'bubble me';
          b.innerHTML = esc(txt) + '<span class="t">' + nowTime() + '</span>';
          thread.appendChild(b);
          ta.value = '';
          thread.scrollTop = thread.scrollHeight;
          setTimeout(function () {
            var r = document.createElement('div');
            r.className = 'bubble them';
            r.innerHTML = 'Got it — thanks for the message! I’ll reply properly soon 🙂<span class="t">' + nowTime() + '</span>';
            thread.appendChild(r);
            thread.scrollTop = thread.scrollHeight;
          }, 1200);
        };
        var sendBtn = composer.querySelector('[data-send]');
        if (sendBtn) sendBtn.addEventListener('click', send);
        var ta = composer.querySelector('textarea');
        if (ta) ta.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
      }
      var t0 = chat.querySelector('[data-threadpanel]:not([hidden]) .thread') || chat.querySelector('.thread');
      if (t0) t0.scrollTop = t0.scrollHeight;
    });

    /* ---- modals ---- */
    document.querySelectorAll('[data-open-modal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = document.getElementById(b.getAttribute('data-open-modal'));
        if (m) m.hidden = false;
      });
    });
    document.querySelectorAll('.modal-backdrop').forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target === m || e.target.closest('[data-close-modal]')) m.hidden = true;
      });
    });

    /* ---- avatar / dropdown menus ---- */
    document.querySelectorAll('[data-menu]').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.stopPropagation();
        var m = document.getElementById(t.getAttribute('data-menu'));
        if (m) m.hidden = !m.hidden;
      });
    });
    document.addEventListener('click', function () {
      document.querySelectorAll('.menu:not([hidden])').forEach(function (m) { m.hidden = true; });
    });

    /* ---- generic single-select pickers (weekstrip, slots, format) ---- */
    document.querySelectorAll('[data-pick]').forEach(function (grp) {
      grp.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn || btn.disabled) return;
        grp.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === btn); });
        grp.dispatchEvent(new CustomEvent('pick', {
          detail: { value: btn.getAttribute('data-value') || btn.textContent.trim(), el: btn },
          bubbles: true
        }));
      });
    });
  });
})();
