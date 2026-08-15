(function () {
  var currentIdToken = null;
  var boot = null; // { email, role, persons, leaveTypes, defaultFiscalYear }
  var selectedPersonCode = null;
  var selectedFiscalYear = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    waitForGoogleSdk(function () {
      var cfg = window.APP_CONFIG || {};
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
    if (attempts > 100) return;
    setTimeout(function () { waitForGoogleSdk(cb, attempts + 1); }, 100);
  }

  function handleCredentialResponse(response) {
    currentIdToken = response.credential;
    showLoadingScreen('กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...');
    callApi('adminBootstrap', {}).then(onBootstrap).catch(onFail);
  }

  function callApi(action, params) {
    var cfg = window.APP_CONFIG || {};
    var body = Object.assign({ action: action, idToken: currentIdToken }, params || {});
    return fetch(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }

  function signOut() {
    currentIdToken = null;
    boot = null;
    try { google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    document.getElementById('app').innerHTML =
      '<div class="center-screen" id="signinScreen"><div class="box">' +
      '<div class="app-title">ผู้ดูแลระบบวันลา</div>' +
      '<p>เข้าสู่ระบบด้วยบัญชี Gmail ที่มีบทบาท ADMIN หรือ SUPER_ADMIN</p>' +
      '<div id="gsiButton" class="gsi-button-wrap"></div>' +
      '</div></div>';
    init();
  }

  function showLoadingScreen(msg) {
    document.getElementById('app').innerHTML =
      '<div class="center-screen"><div class="box"><div class="spinner"></div><h2>' + escapeHtml(msg) + '</h2></div></div>';
  }

  function onFail(err) {
    document.getElementById('app').innerHTML =
      '<div class="center-screen"><div class="box">' +
      '<h2>เชื่อมต่อ API ไม่สำเร็จ</h2>' +
      '<p>' + escapeHtml(err && err.message ? err.message : String(err)) + '</p>' +
      '<button class="btn-secondary" onclick="location.reload()">ลองใหม่</button>' +
      '</div></div>';
  }

  function onBootstrap(data) {
    if (!data.ok) {
      renderErrorScreen(data);
      return;
    }
    boot = data;
    selectedFiscalYear = data.defaultFiscalYear;
    renderShell();
  }

  function renderErrorScreen(data) {
    var messages = {
      FORBIDDEN: { title: 'ไม่มีสิทธิ์เข้าหน้านี้', body: 'บัญชีนี้ไม่มีบทบาทผู้ดูแลระบบ (ADMIN/SUPER_ADMIN) ในชีต USERS<br>หากควรมีสิทธิ์ กรุณาติดต่อผู้ดูแลระบบให้แก้ไข ROLE ให้ถูกต้อง' },
      NOT_REGISTERED: { title: 'ยังไม่พบบัญชีของคุณในระบบ', body: 'อีเมลนี้ยังไม่ได้ลงทะเบียนไว้ในชีต USERS' },
      INACTIVE: { title: 'บัญชีนี้ถูกปิดใช้งาน', body: 'กรุณาติดต่อผู้ดูแลระบบ' },
      NO_PERSON_LINK: { title: 'ยังไม่เชื่อมโยงข้อมูลบุคลากร', body: 'บัญชีนี้ยังไม่มีรหัสบุคลากร (PERSON_CODE) ผูกไว้' },
      INVALID_OR_EXPIRED_TOKEN: { title: 'เซสชันหมดอายุ', body: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' },
      SERVER_ERROR: { title: 'เกิดข้อผิดพลาดฝั่งเซิร์ฟเวอร์', body: escapeHtml(data.message || '') }
    };
    var m = messages[data.reason] || { title: 'เกิดข้อผิดพลาด', body: 'กรุณาลองใหม่อีกครั้ง' };
    document.getElementById('app').innerHTML =
      '<div class="center-screen"><div class="box">' +
      '<h2>' + escapeHtml(m.title) + '</h2><p>' + m.body + '</p>' +
      '<button class="btn-secondary" onclick="location.reload()">เข้าสู่ระบบใหม่</button>' +
      '</div></div>';
  }

  // ---------------------------------------------------------------
  // Shell
  // ---------------------------------------------------------------

  function fiscalYearOptions() {
    var y = boot.defaultFiscalYear;
    return [y - 1, y, y + 1];
  }

  function renderShell() {
    var personOptions = boot.persons.map(function (p) {
      return '<option value="' + escapeHtml(p.personCode) + '">' + escapeHtml(p.displayName) +
        (p.position ? ' — ' + escapeHtml(p.position) : '') + '</option>';
    }).join('');
    var yearOptions = fiscalYearOptions().map(function (y) {
      return '<option value="' + y + '"' + (y === selectedFiscalYear ? ' selected' : '') + '>ปีงบประมาณ ' + y + '</option>';
    }).join('');

    document.getElementById('app').innerHTML =
      '<div class="topbar">' +
        '<div class="profile"><div>' +
          '<div class="profile-name">ผู้ดูแลระบบ</div>' +
          '<div class="profile-meta">' + escapeHtml(boot.email) + ' &middot; ' + escapeHtml(boot.role) + '</div>' +
          '<a class="admin-link" href="index.html">ไปหน้าดูวันลาของฉัน</a> &middot; ' +
          '<button class="signout-link" id="signoutBtn" style="display:inline;">ออกจากระบบ</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="card">' +
        '<h2>เลือกบุคลากร</h2>' +
        '<div class="form-grid cols-2">' +
          '<div class="form-group"><label>บุคลากร</label>' +
            '<select id="personSelect"><option value="">— เลือกบุคลากร —</option>' + personOptions + '</select></div>' +
          '<div class="form-group"><label>ปีงบประมาณ</label>' +
            '<select id="yearSelect">' + yearOptions + '</select></div>' +
        '</div>' +
      '</div>' +
      '<div id="personSections"></div>';

    document.getElementById('signoutBtn').addEventListener('click', signOut);
    document.getElementById('personSelect').addEventListener('change', function () {
      selectedPersonCode = this.value || null;
      onPersonOrYearChange();
    });
    document.getElementById('yearSelect').addEventListener('change', function () {
      selectedFiscalYear = Number(this.value);
      onPersonOrYearChange();
    });
  }

  function onPersonOrYearChange() {
    var container = document.getElementById('personSections');
    if (!selectedPersonCode) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = '<div class="center-screen" style="min-height:30vh;"><div class="spinner"></div></div>';
    renderPersonSections();
  }

  function renderPersonSections() {
    var container = document.getElementById('personSections');
    container.innerHTML =
      renderAddEntryCard() +
      '<div class="card" id="entriesCard"><h2>รายการที่บันทึกไว้<span class="sub">ปีงบประมาณ ' + selectedFiscalYear + '</span></h2>' +
        '<div id="entriesList" class="empty-state">กำลังโหลด...</div>' +
      '</div>' +
      '<div class="card" id="balancesCard"><h2>จัดการสิทธิวันลา<span class="sub">ปีงบประมาณ ' + selectedFiscalYear + '</span></h2>' +
        '<div id="balancesList" class="empty-state">กำลังโหลด...</div>' +
      '</div>';

    bindAddEntryForm();
    refreshEntries();
    refreshBalances();
  }

  // ---------------------------------------------------------------
  // บันทึกรายการลาใหม่
  // ---------------------------------------------------------------

  function renderAddEntryCard() {
    var typeOptions = boot.leaveTypes.map(function (t) {
      return '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.nameTh) + '</option>';
    }).join('');
    return (
      '<div class="card"><h2>บันทึกรายการลาใหม่</h2>' +
      '<form id="addEntryForm" class="form-grid">' +
        '<div class="form-group"><label>ประเภทการลา</label><select name="leaveTypeId" required>' + typeOptions + '</select></div>' +
        '<div class="form-row-2">' +
          '<div class="form-group"><label>วันที่เริ่ม</label><input class="input" type="date" name="startDate" required></div>' +
          '<div class="form-group"><label>วันที่สิ้นสุด</label><input class="input" type="date" name="endDate" required></div>' +
        '</div>' +
        '<div class="form-group"><label>ช่วงเวลา</label>' +
          '<div class="radio-group">' +
            '<label><input type="radio" name="dayPart" value="FULL" checked> เต็มวัน</label>' +
            '<label><input type="radio" name="dayPart" value="AM"> ครึ่งเช้า</label>' +
            '<label><input type="radio" name="dayPart" value="PM"> ครึ่งบ่าย</label>' +
          '</div>' +
          '<div class="note-text">เต็มวัน = นับทุกวันในช่วงที่เลือก วันละ 1 &middot; ครึ่งเช้า/บ่าย ต้องเลือกวันเดียว (นับ 0.5)</div>' +
          '<div class="note-text">หมายเหตุ: นับทุกวันตามช่วงที่เลือกรวมวันหยุดด้วย ถ้าต้องเว้นวันหยุด กรุณาบันทึกแยกเป็นช่วงย่อย</div>' +
        '</div>' +
        '<div class="form-group"><label>หมายเหตุ (ถ้ามี)</label><textarea name="note"></textarea></div>' +
        '<button type="submit" class="btn-primary">บันทึกรายการลา</button>' +
        '<div id="addEntryMsg" class="form-msg"></div>' +
      '</form></div>'
    );
  }

  function bindAddEntryForm() {
    var form = document.getElementById('addEntryForm');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var fd = new FormData(form);
      var msg = document.getElementById('addEntryMsg');
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      msg.className = 'form-msg';
      msg.textContent = 'กำลังบันทึก...';

      callApi('adminAddLedgerEntry', {
        personCode: selectedPersonCode,
        fiscalYear: selectedFiscalYear,
        leaveTypeId: fd.get('leaveTypeId'),
        startDate: fd.get('startDate'),
        endDate: fd.get('endDate'),
        dayPart: fd.get('dayPart'),
        note: fd.get('note')
      }).then(function (res) {
        btn.disabled = false;
        if (!res.ok) {
          msg.className = 'form-msg error';
          msg.textContent = addEntryErrorMessage(res.reason);
          return;
        }
        msg.className = 'form-msg ok';
        msg.textContent = 'บันทึกแล้ว ' + res.createdCount + ' รายการ';
        form.reset();
        refreshEntries();
        refreshBalances();
      }).catch(function (err) {
        btn.disabled = false;
        msg.className = 'form-msg error';
        msg.textContent = 'เกิดข้อผิดพลาด: ' + (err && err.message ? err.message : String(err));
      });
    });
  }

  function addEntryErrorMessage(reason) {
    var map = {
      PERSON_NOT_FOUND: 'ไม่พบข้อมูลบุคลากรนี้',
      LEAVE_TYPE_NOT_FOUND: 'ไม่พบประเภทการลานี้',
      INVALID_DATE_RANGE: 'ช่วงวันที่ไม่ถูกต้อง',
      AM_PM_MUST_BE_SINGLE_DAY: 'ครึ่งเช้า/ครึ่งบ่าย ต้องเลือกวันเริ่มและวันสิ้นสุดเป็นวันเดียวกัน',
      FORBIDDEN: 'ไม่มีสิทธิ์ทำรายการนี้'
    };
    return map[reason] || ('บันทึกไม่สำเร็จ (' + reason + ')');
  }

  // ---------------------------------------------------------------
  // รายการที่บันทึกไว้
  // ---------------------------------------------------------------

  function refreshEntries() {
    callApi('adminListLedger', { personCode: selectedPersonCode, fiscalYear: selectedFiscalYear })
      .then(function (res) {
        var el = document.getElementById('entriesList');
        if (!el) return;
        if (!res.ok) { el.innerHTML = '<div class="empty-state">โหลดรายการไม่สำเร็จ</div>'; return; }
        if (!res.entries.length) { el.innerHTML = '<div class="empty-state">ยังไม่มีรายการลาบันทึกไว้ในปีนี้</div>'; return; }
        el.innerHTML = res.entries.map(function (e) {
          return (
            '<div class="admin-row">' +
              '<div class="main"><div class="t1">' + escapeHtml(e.leaveTypeNameTh) + ' &middot; ' + fmtNum(e.quantity) + ' ' + escapeHtml(e.unit === 'TIME' ? 'ครั้ง' : 'วัน') + '</div>' +
              '<div class="t2">' + escapeHtml(e.eventDate) + (e.dayPart && e.dayPart !== 'FULL' ? ' &middot; ' + escapeHtml(e.dayPart) : '') +
                (e.note ? ' &middot; ' + escapeHtml(e.note) : '') + '</div></div>' +
              '<div class="side"><button class="link-danger" data-id="' + escapeHtml(e.ledgerId) + '">ลบ</button></div>' +
            '</div>'
          );
        }).join('');
        el.querySelectorAll('.link-danger').forEach(function (btn) {
          btn.addEventListener('click', function () { deleteEntry(btn.getAttribute('data-id')); });
        });
      }).catch(function () {
        var el = document.getElementById('entriesList');
        if (el) el.innerHTML = '<div class="empty-state">โหลดรายการไม่สำเร็จ</div>';
      });
  }

  function deleteEntry(ledgerId) {
    if (!confirm('ยืนยันลบรายการนี้?')) return;
    callApi('adminDeleteLedgerEntry', { ledgerId: ledgerId }).then(function (res) {
      if (res.ok) { refreshEntries(); refreshBalances(); }
      else alert('ลบไม่สำเร็จ: ' + (res.reason || ''));
    });
  }

  // ---------------------------------------------------------------
  // จัดการสิทธิวันลา
  // ---------------------------------------------------------------

  function refreshBalances() {
    callApi('adminGetBalances', { personCode: selectedPersonCode, fiscalYear: selectedFiscalYear })
      .then(function (res) {
        var el = document.getElementById('balancesList');
        if (!el) return;
        if (!res.ok) { el.innerHTML = '<div class="empty-state">โหลดข้อมูลไม่สำเร็จ</div>'; return; }
        el.innerHTML = res.balances.map(function (b, i) {
          return (
            '<div class="type-block">' +
              '<div class="type-block-head"><span class="name">' + escapeHtml(b.leaveTypeNameTh) + '</span>' +
                '<span>ใช้ไป ' + fmtNum(b.used) + (b.available !== null ? ' / สิทธิรวม ' + fmtNum(b.available) : '') + ' ' + escapeHtml(b.unit === 'TIME' ? 'ครั้ง' : 'วัน') + '</span></div>' +
              '<form class="form-grid cols-2 balance-form" data-type="' + escapeHtml(b.leaveTypeId) + '" style="margin-top:8px;">' +
                '<div class="form-group"><label>วันยกมา (Carryover)</label><input class="input" type="number" step="0.5" min="0" name="carryoverDays" value="' + (b.carryover !== null ? b.carryover : '') + '"></div>' +
                '<div class="form-group"><label>สิทธิปีนี้ (Entitlement)</label><input class="input" type="number" step="0.5" min="0" name="entitlementDays" value="' + (b.entitlement !== null ? b.entitlement : '') + '"></div>' +
                '<div class="form-group" style="grid-column:1/-1;"><label>หมายเหตุ</label><input class="input" type="text" name="note" value="' + escapeHtml(b.note || '') + '"></div>' +
                '<div style="grid-column:1/-1;"><button type="submit" class="btn-secondary">บันทึกสิทธิ</button> <span class="form-msg" style="display:inline;"></span></div>' +
              '</form>' +
            '</div>'
          );
        }).join('');
        el.querySelectorAll('.balance-form').forEach(function (form) {
          form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            saveBalance(form);
          });
        });
      }).catch(function () {
        var el = document.getElementById('balancesList');
        if (el) el.innerHTML = '<div class="empty-state">โหลดข้อมูลไม่สำเร็จ</div>';
      });
  }

  function saveBalance(form) {
    var fd = new FormData(form);
    var msg = form.querySelector('.form-msg');
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    msg.className = 'form-msg';
    msg.textContent = 'กำลังบันทึก...';

    callApi('adminSaveBalance', {
      personCode: selectedPersonCode,
      fiscalYear: selectedFiscalYear,
      leaveTypeId: form.getAttribute('data-type'),
      carryoverDays: fd.get('carryoverDays'),
      entitlementDays: fd.get('entitlementDays'),
      note: fd.get('note')
    }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) {
        msg.className = 'form-msg error';
        msg.textContent = 'บันทึกไม่สำเร็จ';
        return;
      }
      msg.className = 'form-msg ok';
      msg.textContent = 'บันทึกแล้ว';
      refreshBalances();
    }).catch(function (err) {
      btn.disabled = false;
      msg.className = 'form-msg error';
      msg.textContent = 'เกิดข้อผิดพลาด';
    });
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
