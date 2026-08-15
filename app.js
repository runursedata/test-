(function () {
  var PALETTE = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
                 'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)'];
  var OVERFLOW_COLOR = 'var(--baseline)';

  var currentIdToken = null;
  var currentBootstrap = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    var cfg = window.APP_CONFIG || {};
    if (!cfg.API_URL || cfg.API_URL.indexOf('PUT_YOUR_') === 0 ||
        !cfg.GOOGLE_CLIENT_ID || cfg.GOOGLE_CLIENT_ID.indexOf('PUT_YOUR_') === 0) {
      var hint = document.getElementById('configHint');
      if (hint) hint.style.display = 'block';
    }
    waitForGoogleSdk(function () {
      google.accounts.id.initialize({
        client_id: cfg.GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true
      });
      var btn = document.getElementById('gsiButton');
      if (btn) {
        google.accounts.id.renderButton(btn, {
          theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'th', width: 280
        });
      }
      google.accounts.id.prompt();
    });
  }

  function waitForGoogleSdk(cb, attempts) {
    attempts = attempts || 0;
    if (window.google && google.accounts && google.accounts.id) { cb(); return; }
    if (attempts > 100) return; // ~10s
    setTimeout(function () { waitForGoogleSdk(cb, attempts + 1); }, 100);
  }

  function handleCredentialResponse(response) {
    currentIdToken = response.credential;
    showLoadingScreen('กำลังตรวจสอบบัญชี...');
    callApi('bootstrap', {}).then(function (data) {
      onBootstrap(data);
    }).catch(function (err) {
      onFail(err);
    });
  }

  function callApi(action, params) {
    var cfg = window.APP_CONFIG || {};
    var body = Object.assign({ action: action, idToken: currentIdToken }, params || {});
    return fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // หลีกเลี่ยง CORS preflight
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  function signOut() {
    currentIdToken = null;
    currentBootstrap = null;
    try { google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    renderSignIn();
    init();
  }

  // ---------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------

  function showLoadingScreen(msg) {
    document.getElementById('app').innerHTML =
      '<div class="center-screen"><div class="box">' +
      '<div class="spinner"></div><h2>' + escapeHtml(msg || 'กำลังโหลด...') + '</h2>' +
      '</div></div>';
  }

  function renderSignIn() {
    document.getElementById('app').innerHTML =
      '<div class="center-screen" id="signinScreen"><div class="box">' +
      '<div class="app-title">วันลาของฉัน</div>' +
      '<p>เข้าสู่ระบบด้วยบัญชี Gmail ที่ลงทะเบียนไว้กับฝ่ายบุคคล เพื่อดูวันลาของคุณ</p>' +
      '<div id="gsiButton" class="gsi-button-wrap"></div>' +
      '<p class="hint" id="configHint" style="display:none;">ยังไม่ได้ตั้งค่า API_URL / GOOGLE_CLIENT_ID ใน config.js</p>' +
      '</div></div>';
  }

  function onFail(err) {
    document.getElementById('app').innerHTML =
      '<div class="center-screen"><div class="box">' +
      '<h2>เชื่อมต่อ API ไม่สำเร็จ</h2>' +
      '<p>' + escapeHtml(err && err.message ? err.message : String(err)) + '</p>' +
      '<p>ตรวจสอบว่า API_URL ใน config.js ถูกต้อง และ Apps Script deploy เป็น Web app แล้ว</p>' +
      '<button class="signout-link" onclick="location.reload()">ลองใหม่</button>' +
      '</div></div>';
  }

  function onBootstrap(data) {
    currentBootstrap = data;
    if (!data.ok) {
      renderErrorScreen(data);
      return;
    }
    renderShell(data);
    loadYear(data.defaultFiscalYear);
  }

  function renderErrorScreen(data) {
    var messages = {
      NO_TOKEN: { title: 'ยังไม่ได้เข้าสู่ระบบ', body: 'กรุณาเข้าสู่ระบบด้วยบัญชี Google อีกครั้ง' },
      INVALID_OR_EXPIRED_TOKEN: { title: 'เซสชันหมดอายุ', body: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' },
      TOKEN_AUDIENCE_MISMATCH: { title: 'ตั้งค่า Client ID ไม่ตรงกัน', body: 'GOOGLE_CLIENT_ID ใน config.js ไม่ตรงกับที่ตั้งไว้ในฝั่ง Apps Script (OAUTH_CLIENT_ID) กรุณาตรวจสอบ' },
      EMAIL_NOT_VERIFIED: { title: 'อีเมลยังไม่ได้ยืนยัน', body: 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล กรุณาใช้บัญชีอื่น' },
      NOT_REGISTERED: {
        title: 'ยังไม่พบบัญชีของคุณในระบบ',
        body: 'อีเมล <b>' + escapeHtml(data.email || '') + '</b> ยังไม่ได้ลงทะเบียนไว้ในชีต USERS<br>กรุณาแจ้งผู้ดูแลระบบให้เพิ่มอีเมลนี้พร้อมรหัสบุคลากร (PERSON_CODE)'
      },
      INACTIVE: { title: 'บัญชีนี้ถูกปิดใช้งาน', body: 'กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งานบัญชี ' + escapeHtml(data.email || '') },
      NO_PERSON_LINK: {
        title: 'ยังไม่เชื่อมโยงข้อมูลบุคลากร',
        body: 'บัญชี ' + escapeHtml(data.email || '') + ' ยังไม่มีรหัสบุคลากร (PERSON_CODE) ผูกไว้ในชีต USERS<br>กรุณาติดต่อผู้ดูแลระบบ'
      },
      PERSON_NOT_FOUND: {
        title: 'ไม่พบข้อมูลบุคลากร',
        body: 'ไม่พบรหัสบุคลากร <b>' + escapeHtml(data.personCode || '') + '</b> ในชีต PERSON_MASTER<br>กรุณาติดต่อผู้ดูแลระบบ'
      },
      SERVER_ERROR: { title: 'เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์', body: escapeHtml(data.message || '') }
    };
    var m = messages[data.reason] || { title: 'เกิดข้อผิดพลาด', body: 'กรุณาลองใหม่อีกครั้ง' };
    document.getElementById('app').innerHTML =
      '<div class="center-screen"><div class="box">' +
      '<h2>' + escapeHtml(m.title) + '</h2>' +
      '<p>' + m.body + '</p>' +
      '<button class="signout-link" onclick="location.reload()">เข้าสู่ระบบใหม่</button>' +
      '</div></div>';
  }

  function renderShell(data) {
    var initials = (data.person.displayName || '?').replace(/^(นางสาว|นาง|นาย|ผศ\.|ดร\.|อ\.|รศ\.|ศ\.)+/g, '').trim().charAt(0) || '?';
    var years = data.fiscalYears.slice();
    if (years.indexOf(data.defaultFiscalYear) === -1) years.unshift(data.defaultFiscalYear);
    years.sort(function (a, b) { return b - a; });

    var yearOptions = years.map(function (y) {
      return '<option value="' + y + '"' + (y === data.defaultFiscalYear ? ' selected' : '') + '>ปีงบประมาณ ' + y + '</option>';
    }).join('');

    document.getElementById('app').innerHTML =
      '<div class="topbar">' +
        '<div class="profile">' +
          '<div class="avatar">' + escapeHtml(initials) + '</div>' +
          '<div>' +
            '<div class="profile-name">' + escapeHtml(data.person.displayName || data.email) + '</div>' +
            '<div class="profile-meta">' + escapeHtml([data.person.position, data.person.employeeGroup].filter(Boolean).join(' • ')) + '</div>' +
            '<button class="signout-link" id="signoutBtn">ออกจากระบบ</button>' +
          '</div>' +
        '</div>' +
        '<select id="yearSelect" class="fy-select">' + yearOptions + '</select>' +
      '</div>' +
      '<div id="sections"><div class="center-screen"><div class="spinner"></div></div></div>' +
      '<div class="footer-note">ข้อมูลอ้างอิงจากฐานข้อมูลวันลา &middot; แสดงเฉพาะข้อมูลของคุณเท่านั้น</div>';

    document.getElementById('yearSelect').addEventListener('change', function () { loadYear(this.value); });
    document.getElementById('signoutBtn').addEventListener('click', signOut);
  }

  function loadYear(year) {
    var sections = document.getElementById('sections');
    if (sections) sections.innerHTML = '<div class="center-screen"><div class="spinner"></div></div>';
    callApi('summary', { fiscalYear: year }).then(onSummary).catch(onFail);
  }

  function onSummary(data) {
    if (!data.ok) {
      renderErrorScreen(data);
      return;
    }
    var html = '';
    html += renderBalances(data);
    html += renderUsageByType(data);
    html += renderMonthly(data);
    html += renderLedger(data);
    html += renderRequests(data);
    document.getElementById('sections').innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Renderers
  // ---------------------------------------------------------------

  function renderBalances(data) {
    var body;
    if (!data.balances.length) {
      body = '<div class="empty-state">ยังไม่มีข้อมูลสิทธิวันลาที่บันทึกไว้สำหรับปีนี้</div>';
    } else {
      body = data.balances.map(function (b) {
        var available = b.available;
        var used = b.used || 0;
        var pct = (available && available > 0) ? Math.min(100, Math.round((used / available) * 100)) : 0;
        var badge = (b.dataStatus && b.dataStatus !== 'READY') ? '<span class="badge badge-review">ควรตรวจสอบ</span>' : '';
        var nums = 'ใช้ไป ' + fmtNum(used) + (available !== null ? ' / สิทธิรวม ' + fmtNum(available) : '') + ' ' + escapeHtml(b.unit);
        return (
          '<div class="balance-item">' +
            '<div class="balance-head"><span class="name">' + escapeHtml(b.leaveTypeNameTh) + badge + '</span>' +
              '<span class="nums">' + nums + '</span></div>' +
            '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
            (b.remaining !== null ? '<div class="note-text">คงเหลือ ' + fmtNum(b.remaining) + ' ' + escapeHtml(b.unit) + '</div>' : '') +
            (b.note ? '<div class="note-text">' + escapeHtml(b.note) + '</div>' : '') +
          '</div>'
        );
      }).join('');
    }
    return '<div class="card"><h2>สิทธิและวันลาคงเหลือ<span class="sub">ปีงบประมาณ ' + data.fiscalYear + '</span></h2>' + body + '</div>';
  }

  function renderUsageByType(data) {
    var body;
    if (!data.usageByType.length) {
      body = '<div class="empty-state">ยังไม่มีรายการลาที่อนุมัติแล้วในปีนี้</div>';
    } else {
      var max = Math.max.apply(null, data.usageByType.map(function (t) { return t.total; }));
      body = data.usageByType.map(function (t, i) {
        var color = i < PALETTE.length ? PALETTE[i] : OVERFLOW_COLOR;
        var pct = max > 0 ? Math.max(4, Math.round((t.total / max) * 100)) : 0;
        return (
          '<div class="bar-row">' +
            '<div class="bar-label">' + escapeHtml(t.leaveTypeNameTh) + '</div>' +
            '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
            '<div class="bar-value">' + fmtNum(t.total) + ' ' + escapeHtml(t.unit === 'TIME' ? 'ครั้ง' : 'วัน') + '</div>' +
          '</div>'
        );
      }).join('');
    }
    return '<div class="card"><h2>สรุปการใช้วันลาสะสม<span class="sub">เฉพาะรายการที่อนุมัติแล้ว</span></h2>' + body + '</div>';
  }

  function renderMonthly(data) {
    if (!data.usageByType.length) return '';
    var labels = data.monthNames.map(function (m) { return '<span>' + escapeHtml(m) + '</span>'; }).join('');
    var blocks = data.usageByType.map(function (t, i) {
      var color = i < PALETTE.length ? PALETTE[i] : OVERFLOW_COLOR;
      var monthMax = Math.max.apply(null, t.months);
      var bars = t.months.map(function (v) {
        var h = monthMax > 0 ? Math.max(v > 0 ? 8 : 2, Math.round((v / monthMax) * 100)) : 2;
        return '<div class="month-bar-wrap" title="' + fmtNum(v) + '"><div class="month-bar" style="height:' + h + '%;background:' + color + '"></div></div>';
      }).join('');
      return (
        '<div class="type-block">' +
          '<div class="type-block-head"><span class="name"><span class="dot" style="background:' + color + '"></span>' + escapeHtml(t.leaveTypeNameTh) + '</span>' +
            '<span>' + fmtNum(t.total) + ' ' + escapeHtml(t.unit === 'TIME' ? 'ครั้ง' : 'วัน') + '</span></div>' +
          '<div class="month-grid">' + bars + '</div>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="card"><h2>แนวโน้มรายเดือน<span class="sub">ปีงบประมาณ ' + data.fiscalYear + ' (ต.ค.&ndash;ก.ย.)</span></h2>' +
      '<div class="month-labels">' + labels + '</div>' +
      blocks +
      '</div>'
    );
  }

  function statusPillClass(status) {
    if (status === 'APPROVED') return 'status-approved';
    if (status === 'PENDING' || status === 'DRAFT') return 'status-pending';
    return 'status-other';
  }

  function renderLedger(data) {
    if (!data.ledger.length) {
      return '<div class="card"><h2>รายละเอียดการลารายรายการ</h2><div class="empty-state">ยังไม่มีรายการลาบันทึกไว้ในปีนี้</div></div>';
    }
    var cards = data.ledger.map(function (e) {
      return (
        '<div class="entry-card">' +
          '<div class="entry-main">' +
            '<div class="entry-type">' + escapeHtml(e.leaveTypeNameTh) + '</div>' +
            '<div class="entry-date">' + escapeHtml(e.eventDate || e.fiscalMonthName) + (e.dayPart && e.dayPart !== 'FULL' && e.dayPart !== 'MONTH_SUMMARY' ? ' &middot; ' + escapeHtml(e.dayPart) : '') + '</div>' +
            (e.note ? '<div class="entry-note">' + escapeHtml(e.note) + '</div>' : '') +
          '</div>' +
          '<div class="entry-side">' +
            '<div class="entry-qty">' + fmtNum(e.quantity) + ' ' + escapeHtml(e.unit === 'TIME' ? 'ครั้ง' : 'วัน') + '</div>' +
            '<span class="status-pill ' + statusPillClass(e.status) + '">' + escapeHtml(e.status || '-') + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var rows = data.ledger.map(function (e) {
      return (
        '<tr>' +
          '<td>' + escapeHtml(e.eventDate || e.fiscalMonthName) + '</td>' +
          '<td>' + escapeHtml(e.leaveTypeNameTh) + '</td>' +
          '<td class="num">' + fmtNum(e.quantity) + ' ' + escapeHtml(e.unit === 'TIME' ? 'ครั้ง' : 'วัน') + '</td>' +
          '<td>' + escapeHtml(e.dayPart || '-') + '</td>' +
          '<td><span class="status-pill ' + statusPillClass(e.status) + '">' + escapeHtml(e.status || '-') + '</span></td>' +
          '<td>' + escapeHtml(e.note || '') + '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div class="card"><h2>รายละเอียดการลารายรายการ<span class="sub">' + data.ledger.length + ' รายการ</span></h2>' +
      '<div class="mobile-cards">' + cards + '</div>' +
      '<table class="desktop-table"><thead><tr><th>วันที่</th><th>ประเภท</th><th>จำนวน</th><th>ช่วง</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '</div>'
    );
  }

  function renderRequests(data) {
    if (!data.requests.length) {
      return '<div class="card"><h2>คำขอลาที่ยื่นในระบบ</h2><div class="empty-state">คุณยังไม่มีคำขอลาที่บันทึกในระบบ</div></div>';
    }
    var rows = data.requests.map(function (r) {
      return (
        '<tr>' +
          '<td>' + escapeHtml(r.requestDate) + '</td>' +
          '<td>' + escapeHtml(r.leaveTypeNameTh) + '</td>' +
          '<td>' + escapeHtml(r.startDate) + (r.endDate && r.endDate !== r.startDate ? ' &ndash; ' + escapeHtml(r.endDate) : '') + '</td>' +
          '<td class="num">' + fmtNum(r.requestedDays) + '</td>' +
          '<td><span class="status-pill ' + statusPillClass(r.status) + '">' + escapeHtml(r.status || '-') + '</span></td>' +
        '</tr>'
      );
    }).join('');
    var cards = data.requests.map(function (r) {
      return (
        '<div class="entry-card">' +
          '<div class="entry-main">' +
            '<div class="entry-type">' + escapeHtml(r.leaveTypeNameTh) + '</div>' +
            '<div class="entry-date">' + escapeHtml(r.startDate) + (r.endDate && r.endDate !== r.startDate ? ' &ndash; ' + escapeHtml(r.endDate) : '') + '</div>' +
          '</div>' +
          '<div class="entry-side">' +
            '<div class="entry-qty">' + fmtNum(r.requestedDays) + ' วัน</div>' +
            '<span class="status-pill ' + statusPillClass(r.status) + '">' + escapeHtml(r.status || '-') + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="card"><h2>คำขอลาที่ยื่นในระบบ</h2>' +
      '<div class="mobile-cards">' + cards + '</div>' +
      '<table class="desktop-table"><thead><tr><th>ยื่นวันที่</th><th>ประเภท</th><th>ช่วงวันลา</th><th>จำนวนวัน</th><th>สถานะ</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '</div>'
    );
  }

  // ---------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------

  function fmtNum(n) {
    if (n === null || n === undefined || n === '') return '—';
    var r = Math.round(n * 100) / 100;
    return r.toString();
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return s.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
