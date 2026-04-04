(function () {
  "use strict";

  const CONFIG = {
    appName: "Elite Turbo",
    storageKey: "vsh_license_key",
    storageDevice: "vsh_license_device",
    checkUrl: "/check",   
    activateUrl: "/activate", 
    contactUrl: "https://zalo.me/0787056720",
    timezone: "Asia/Ho_Chi_Minh",
    autoCheckOnLoad: false, 
    relockWhenInvalid: true,
  };

  const state = {
    key: "",
    deviceId: "",
    verified: false,
    expiresAt: "",
    mounted: false,
  };

  function qs(sel) { return document.querySelector(sel); }
  function ce(tag, props = {}, html = "") { const el = document.createElement(tag); Object.assign(el, props); if (html) el.innerHTML = html; return el; }
  function escapeHtml(str) { return String(str ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }

  function formatDateVN(value) {
    if (!value) return "VĨNH VIỄN";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: CONFIG.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(d).replace(',', ' //');
  }

  function toast(message, type = "ok", raw = null) {
    const box = qs("#vgMsg"); const rawWrap = qs("#vgDtl"); const rawBox = qs("#vgRaw");
    if (!box) return;
    box.className = `vg-msg ${type}`; box.innerHTML = message;
    if (rawWrap && rawBox) { if (raw == null) { rawWrap.hidden = true; rawBox.textContent = ""; } else { rawWrap.hidden = false; rawBox.textContent = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2); } }
  }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(CONFIG.storageDevice);
    if (id) return id;
    if (window.crypto?.randomUUID) { id = crypto.randomUUID().toUpperCase(); } else { id = "SYS-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 10).toUpperCase(); }
    localStorage.setItem(CONFIG.storageDevice, id);
    return id;
  }

  function saveKey(key) { localStorage.setItem(CONFIG.storageKey, key); state.key = key; }
  function clearKey() { localStorage.removeItem(CONFIG.storageKey); state.key = ""; }
  function loadSavedKey() { state.key = localStorage.getItem(CONFIG.storageKey) || ""; return state.key; }

  function updateFooter(exp = "") {
    const sta = qs("#vgSta");
    if (!sta) return;
    sta.innerHTML = exp ? `HẠN DÙNG: <span style="color:var(--neon-green)">${formatDateVN(exp)}</span>` : "TRẠNG THÁI: <span style='color:var(--neon-red)'>CHƯA XÁC THỰC</span>";
  }

  function dispatchLicenseChange(detail) { window.dispatchEvent(new CustomEvent("vsh-license-change", { detail })); }
  
  function controlDoors(isOpen) {
      const gate = qs("#vgGate");
      if (!gate) return;
      let doorWrap = qs(".cyber-door-wrap");
      if (!doorWrap) {
         doorWrap = ce("div", {className: "cyber-door-wrap is-closed"}, `
           <div class="c-door-left"><i class="fas fa-fingerprint door-icon-left"></i></div>
           <div class="c-door-right"><i class="fas fa-lock door-icon-right"></i></div>
         `);
         gate.appendChild(doorWrap);
      }
      if (isOpen) { doorWrap.classList.remove("is-closed"); } else { doorWrap.classList.add("is-closed"); }
  }

  function lockUI() {
    document.body.classList.add("vg-locked");
    const gate = qs("#vgGate"); const panel = qs("#main-panel"); const intro = qs("#home-intro");
    if (intro) intro.style.display = "none";
    if (panel) panel.style.display = "none";
    if (gate) {
      gate.style.display = "grid"; gate.style.opacity = "1";
      const loginPanel = qs('#vgGate .vg-panel');
      if (loginPanel) { loginPanel.style.display = 'block'; loginPanel.style.opacity = '1'; }
      controlDoors(false);
    }
  }

  function unlockUI(isAutoBoot) {
    const gate = qs("#vgGate"); const panel = qs("#main-panel"); const loginPanel = qs('#vgGate .vg-panel');
    if (gate && panel) {
      if (isAutoBoot) {
          gate.style.display = 'none'; panel.style.display = "block"; document.body.classList.remove("vg-locked");
      } else {
          if (loginPanel) { loginPanel.style.transition = 'opacity 0.4s ease'; loginPanel.style.opacity = '0'; }
          setTimeout(() => {
              if (loginPanel) loginPanel.style.display = 'none';
              panel.style.display = "block"; document.body.classList.remove("vg-locked");
              controlDoors(true);
              setTimeout(() => { gate.style.display = "none"; if (loginPanel) { loginPanel.style.display = 'block'; loginPanel.style.opacity = '1'; } }, 1200); 
          }, 400); 
      }
    }
  }

  function normalizeResponse(data) {
    const status = String(data?.status || data?.code || data?.state || "").toUpperCase();
    const valid = data?.valid === true || data?.ok === true || data?.success === true || status === "OK" || status === "VALID" || status === "SUCCESS" || status === "ACTIVATED";
    return { ok: valid, status, expiresAt: data?.expiresAt || data?.expire || data?.expired_at || data?.expiry || "", raw: data };
  }

  async function apiGet(url, params) {
    const u = new URL(url, window.location.origin);
    Object.entries(params).forEach(([k, v]) => { if (v != null) u.searchParams.set(k, v); });
    const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json, text/plain, */*" } });
    const rawText = await res.text(); let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { status: "INVALID_JSON", body: rawText, contentType: res.headers.get("content-type"), httpStatus: res.status }; }
    if (!res.ok) { return { ok: false, status: String(data?.status || `HTTP_${res.status}`).toUpperCase(), raw: { httpStatus: res.status, contentType: res.headers.get("content-type"), body: rawText, data } }; }
    return normalizeResponse(data);
  }

  async function checkLicense(key, deviceId) { return apiGet(CONFIG.checkUrl, { key, hwid: deviceId, deviceId }); }

  async function activateLicense(key, deviceId) {
    const res = await fetch(CONFIG.activateUrl, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/plain, */*" }, body: JSON.stringify({ key, hwid: deviceId, deviceId }) });
    const rawText = await res.text(); let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { status: "INVALID_JSON", body: rawText, httpStatus: res.status }; }
    if (!res.ok) { return { ok: false, status: String(data?.status || `HTTP_${res.status}`).toUpperCase(), raw: data }; }
    return normalizeResponse(data);
  }

  function renderGate() {
    if (state.mounted) return;
    state.mounted = true;
    const style = ce("style");
    style.textContent = `
      #vgGate { position:fixed; inset:0; z-index:2147483647; display:grid; place-items:center; background:rgba(5, 8, 16, 0.9); backdrop-filter:blur(16px); font-family: 'Rajdhani', sans-serif; }
      .cyber-door-wrap { position:absolute; inset:0; z-index:99; display:flex; pointer-events:none; overflow: hidden; }
      .c-door-left, .c-door-right { width:50%; height:100%; background:rgba(5,8,16,0.98); backdrop-filter: blur(20px); transition:transform 1.2s cubic-bezier(0.77, 0, 0.175, 1); position:relative; overflow: hidden; }
      .c-door-left { border-right:2px solid var(--neon-cyan); box-shadow: 10px 0 30px rgba(0, 229, 255, 0.2); transform:translateX(-100%); }
      .c-door-right { border-left:2px solid var(--neon-cyan); box-shadow:-10px 0 30px rgba(0, 229, 255, 0.2); transform:translateX(100%); }
      .door-icon-left, .door-icon-right { position: absolute; top: 50%; transform: translateY(-50%); font-size: 80px; z-index: 10; color: rgba(0, 229, 255, 0.6); filter: drop-shadow(0 0 15px rgba(0, 229, 255, 0.5)); }
      .door-icon-left { right: 40px; } .door-icon-right { left: 40px; }
      .cyber-door-wrap.is-closed .c-door-left, .cyber-door-wrap.is-closed .c-door-right { transform:translateX(0); pointer-events:all; }
      #vgGate .vg-panel { width:min(540px, 92vw); background: rgba(12, 18, 30, 0.6); backdrop-filter: blur(20px); border: 1px solid rgba(0,229,255,0.3); padding: 30px; box-shadow: 0 0 40px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 229, 255, 0.1); border-radius: 16px; position:relative; z-index:100; color: #fff; }
      #vgGate .vg-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom: 25px; border-bottom: 1px solid rgba(0, 229, 255, 0.2); padding-bottom: 15px; }
      #vgGate .vg-brand { font-family: 'Orbitron', sans-serif; font-size: 20px; color: var(--neon-cyan); font-weight: 900; letter-spacing: 2px; text-shadow: 0 0 10px rgba(0,229,255,0.5); }
      #vgGate .vg-btn { font-family: 'Orbitron', sans-serif; padding: 12px 18px; background: rgba(0, 229, 255, 0.1); border: 1px solid var(--neon-cyan); color: var(--neon-cyan); cursor: pointer; transition: 0.3s; font-size: 14px; font-weight: bold; border-radius: 10px; }
      #vgGate .vg-btn:hover { background: var(--neon-cyan); color: #000; box-shadow: 0 0 15px rgba(0,229,255,0.6); }
      #vgGate .vg-btn--pri { font-size: 16px; padding: 14px; margin-top: 15px; }
      #vgGate .vg-label { font-family: 'Share Tech Mono', monospace; font-size: 15px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; }
      #vgGate .vg-field { display: flex; gap: 12px; margin-bottom: 20px; }
      #vgGate .vg-input { flex: 1; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 10px; color: #fff; font-family: 'Share Tech Mono', monospace; padding: 14px; font-size: 16px; outline: none; transition: 0.3s; }
      #vgGate .vg-input:focus { border-color: var(--neon-cyan); box-shadow: 0 0 15px rgba(0, 229, 255, 0.2) inset; }
      #vgGate .vg-icon { padding: 0 18px; background: rgba(0, 229, 255, 0.05); border: 1px solid rgba(0, 229, 255, 0.3); border-radius: 10px; color: var(--neon-cyan); cursor: pointer; font-family: 'Share Tech Mono', monospace; font-weight: bold; transition: 0.2s; }
      #vgGate .vg-icon:hover { background: rgba(0, 229, 255, 0.2); }
      #vgGate .vg-actions { display: flex; gap: 15px; margin-top: 25px; }
      #vgGate .vg-msg { margin-top: 20px; padding: 15px; background: rgba(0, 0, 0, 0.6); border-radius: 10px; border-left: 4px solid var(--text-muted); font-family: 'Share Tech Mono', monospace; font-size: 15px; }
      #vgGate .vg-msg.ok { border-color: var(--neon-green); color: var(--neon-green); text-shadow: 0 0 5px rgba(0,255,136,0.3); }
      #vgGate .vg-msg.warn { border-color: var(--neon-yellow); color: var(--neon-yellow); text-shadow: 0 0 5px rgba(252,238,10,0.3); }
      #vgGate .vg-msg.err { border-color: var(--neon-red); color: var(--neon-red); text-shadow: 0 0 5px rgba(255,51,102,0.3); }
      #vgGate .vg-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 30px; padding-top: 20px; border-top: 1px dashed rgba(255, 255, 255, 0.1); font-family: 'Share Tech Mono', monospace; font-size: 14px; color: var(--text-muted); }
      #vgGate details { margin-top: 15px; font-family: 'Share Tech Mono', monospace; }
      #vgGate summary { cursor: pointer; color: var(--neon-cyan); outline: none; }
      #vgGate .vg-pre { margin-top: 10px; padding: 12px; background: rgba(0,0,0,0.8); border: 1px solid rgba(0, 229, 255, 0.2); border-radius: 8px; color: var(--text-muted); font-size: 13px; max-height: 150px; overflow-y: auto; }
      @media (max-width:520px){ #vgGate .vg-field { flex-direction: column; } #vgGate .vg-icon { padding: 12px; } .door-icon-left, .door-icon-right { font-size: 50px; } }
    `;
    document.head.appendChild(style);

    const wrap = ce("div", { id: "vgGate" }, `
      <div class="vg-panel">
        <div class="vg-hd">
          <div class="vg-brand">Đăng Nhập</div>
          <div><button class="vg-btn hover-sound click-sound" id="vgReset">ĐẶT LẠI</button></div>
        </div>
        <div class="vg-bd">
          <div class="vg-label">MÃ KÍCH HOẠT</div>
          <div class="vg-field">
            <input id="vgKey" class="vg-input" type="text" placeholder="Nhập mã kích hoạt của bạn..." autocomplete="one-time-code" inputmode="latin">
            <button class="vg-icon hover-sound click-sound" id="vgPasteKey">DÁN</button>
            <button class="vg-icon hover-sound click-sound" id="vgDelKey" style="color:var(--neon-red); border-color:var(--neon-red)">XÓA</button>
          </div>
          <div class="vg-label">MÃ THIẾT BỊ</div>
          <div class="vg-field">
            <input id="vgDev" class="vg-input" type="text" readonly>
            <button class="vg-icon hover-sound click-sound" id="vgCopyDev">SAO CHÉP</button>
          </div>
          <div class="vg-actions">
            <button class="vg-btn vg-btn--pri hover-sound click-sound" id="vgCheck" style="flex:1;">KIỂM TRA MÃ</button>
            <button class="vg-btn vg-btn--pri hover-sound click-sound" id="vgActive" style="flex:1">KÍCH HOẠT</button>
          </div>
          <div class="vg-msg" id="vgMsg">ĐANG CHỜ XÁC THỰC TỪ HỆ THỐNG...</div>
          <details id="vgDtl" hidden><summary>NHẬT KÝ KIỂM TRA</summary><pre class="vg-pre" id="vgRaw"></pre></details>
          <div class="vg-foot">
            <span id="vgSta">TRẠNG THÁI: CHƯA XÁC THỰC</span>
            <button class="vg-btn hover-sound click-sound" id="vgContact">NHẬN MÃ</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(wrap);

    qs("#vgKey").value = loadSavedKey();
    qs("#vgDev").value = state.deviceId;
    updateFooter("");

    qs("#vgPasteKey").onclick = async () => { try { const text = await navigator.clipboard.readText(); qs("#vgKey").value = (text || "").trim(); toast("ĐÃ DÁN MÃ VÀO KHUNG.", "ok"); } catch { qs("#vgKey").value = (prompt("VUI LÒNG NHẬP MÃ THỦ CÔNG:", "") || "").trim(); } qs("#vgKey").focus(); };
    qs("#vgDelKey").onclick = () => { qs("#vgKey").value = ""; clearKey(); state.verified = false; updateFooter(""); toast("ĐÃ XÓA MÃ KHỎI THIẾT BỊ NÀY.", "ok"); if (CONFIG.relockWhenInvalid) lockUI(); };
    qs("#vgCopyDev").onclick = async () => { try { await navigator.clipboard.writeText(state.deviceId); toast("ĐÃ SAO CHÉP MÃ THIẾT BỊ.", "ok"); } catch { toast("SAO CHÉP THẤT BẠI. VUI LÒNG CHỌN VÀ COPY.", "warn"); } };
    qs("#vgReset").onclick = () => { qs("#vgKey").value = ""; clearKey(); state.verified = false; updateFooter(""); lockUI(); toast("ĐÃ ĐẶT LẠI HỆ THỐNG THÀNH CÔNG.", "ok"); };
    qs("#vgContact").onclick = () => { window.open(CONFIG.contactUrl, "_blank"); };
    qs("#vgCheck").onclick = onCheck;
    qs("#vgActive").onclick = onActivate;
  }

  async function safeCall(fn) {
    try { return await fn(); } catch (err) { console.error(err); toast("LỖI KẾT NỐI MÁY CHỦ ⚠️", "err", String(err)); return null; }
  }

  async function onCheck() {
    const key = qs("#vgKey").value.trim();
    if (!key) return toast("VUI LÒNG NHẬP MÃ KÍCH HOẠT.", "warn");
    toast("ĐANG KIỂM TRA MÃ...", "warn");
    const result = await safeCall(() => checkLicense(key, state.deviceId));

    if (result && result.ok) {
        state.verified = false; updateFooter(result.expiresAt);
        toast(`XÁC NHẬN THÀNH CÔNG<br>HẠN SỬ DỤNG: <b style="color:var(--neon-cyan)">${escapeHtml(formatDateVN(result.expiresAt))}</b><br>NHẤN 'KÍCH HOẠT' ĐỂ ĐĂNG NHẬP.`, "ok", result.raw);
    } else if (result) {
        handleLicenseResult(result, key, "check");
    }
  }

  async function onActivate() {
    const key = qs("#vgKey").value.trim();
    if (!key) return toast("VUI LÒNG NHẬP MÃ KÍCH HOẠT.", "warn");
    toast("ĐANG THIẾT LẬP KẾT NỐI BẢO MẬT...", "warn");
    const result = await safeCall(() => activateLicense(key, state.deviceId));
    if (result) handleLicenseResult(result, key, "activate");
  }

  function handleLicenseResult(result, key, mode) {
    const status = result.status || "";
    const expiresAt = result.expiresAt || "";

    if (result.ok) {
      saveKey(key); state.verified = true; state.expiresAt = expiresAt; updateFooter(expiresAt);
      if (mode === "activate") {
          unlockUI(false); 
          toast(`✅ KẾT NỐI THÀNH CÔNG<br>HẠN SỬ DỤNG: <b style="color:var(--neon-cyan)">${escapeHtml(formatDateVN(expiresAt))}</b>`, "ok", result.raw);
      } else if (mode === "boot" || mode === "check") {
          unlockUI(true);
      }
      dispatchLicenseChange({ state: mode, verified: true, key, deviceId: state.deviceId, expiresAt, raw: result.raw });
      return;
    }

    state.verified = false; updateFooter("");
    const messageMap = { EXPIRED: "LỖI: MÃ ĐÃ HẾT HẠN ⛔", REVOKED: "LỖI: MÃ BỊ THU HỒI 🚫", NOT_FOUND: "LỖI: KHÔNG TÌM THẤY MÃ ⚠️", INVALID_KEY: "LỖI: SAI ĐỊNH DẠNG ❌", HWID_MISMATCH: "LỖI: THIẾT BỊ KHÔNG KHỚP 📱", BOUND_TO_ANOTHER_DEVICE: "LỖI: MÃ ĐÃ ĐƯỢC GẮN VỚI THIẾT BỊ KHÁC.", INVALID_JSON: "LỖI: DỮ LIỆU PHẢN HỒI LỖI." };
    toast(messageMap[status] || `❌ MÃ LỖI: ${escapeHtml(status || "KHÔNG_XÁC_ĐỊNH")}`, "err", result.raw);
    
    if (CONFIG.relockWhenInvalid) lockUI();
    dispatchLicenseChange({ state: "invalid", verified: false, key, deviceId: state.deviceId, expiresAt: "", raw: result.raw });
  }

  async function autoBootCheck() {
    const savedKey = loadSavedKey();
    if (!savedKey || !CONFIG.autoCheckOnLoad) { lockUI(); return; }
    const result = await safeCall(() => checkLicense(savedKey, state.deviceId));
    if (!result) { lockUI(); return; }
    handleLicenseResult(result, savedKey, "boot");
  }

  function init() {
    state.deviceId = getOrCreateDeviceId(); renderGate(); autoBootCheck();
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || !state.verified) return; 
      const savedKey = loadSavedKey();
      if (!savedKey) return;
      const result = await safeCall(() => checkLicense(savedKey, state.deviceId));
      if (result) handleLicenseResult(result, savedKey, "check");
    });

    window.VSHKeyGate = {
      show: lockUI, hide: unlockUI,
      reset() { clearKey(); state.verified = false; updateFooter(""); lockUI(); },
      getState() { return { ...state }; },
      async check() { return onCheck(); },
      async activate() { return onActivate(); },
    };
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init, { once: true }); } 
  else { init(); }
})();