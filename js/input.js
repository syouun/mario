// =====================================================================
// input.js — キーボード／ゲームパッド入力（割り当ては config.js）。
// 毎フレーム先頭で poll() し、「押している(held)」と「押した瞬間(pressed)」を確定させる。
// scripted に関数を入れると、その関数の返す入力で上書きできる（自動テスト・入力再生用）。
// =====================================================================
window.SMB = window.SMB || {};

SMB.Input = (function () {
  const BUTTONS = ['left', 'right', 'up', 'down', 'A', 'B', 'start'];

  // code → ボタン名の逆引き表（1 つのキーを複数ボタンに割り当てることも可）
  const codeMap = {};
  for (const b of BUTTONS) {
    for (const code of (SMB.KEY_CONFIG[b] || [])) (codeMap[code] = codeMap[code] || []).push(b);
  }

  const rawKeys = {};    // キーごとの押下状態
  const held = {};
  const pressed = {};
  const prev = {};
  const api = { poll, held, pressed, scripted: null, describe };

  window.addEventListener('keydown', (e) => {
    if (codeMap[e.code]) { rawKeys[e.code] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (codeMap[e.code]) { rawKeys[e.code] = false; e.preventDefault(); }
  });
  window.addEventListener('blur', () => { for (const k in rawKeys) rawKeys[k] = false; });

  function readKeyboard() {
    const s = {};
    for (const code in rawKeys) if (rawKeys[code]) for (const b of codeMap[code]) s[b] = true;
    return s;
  }

  function readGamepad() {
    const s = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const P = SMB.PAD_CONFIG, dz = P.stickDeadZone;
    for (const p of pads) {
      if (!p) continue;
      for (const b of BUTTONS)
        for (const i of (P[b] || [])) if (p.buttons[i] && p.buttons[i].pressed) s[b] = true;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -dz) s.left = true;
      if (ax > dz) s.right = true;
      if (ay < -dz) s.up = true;
      if (ay > dz) s.down = true;
    }
    return s;
  }

  function poll(frame) {
    const s = api.scripted ? (api.scripted(frame) || {}) : Object.assign(readKeyboard(), readGamepad());
    for (const b of BUTTONS) {
      prev[b] = held[b];
      held[b] = !!s[b];
      pressed[b] = held[b] && !prev[b];
    }
    // 左右同時押しは両方無効（実機の十字キーでは起きないため）
    if (held.left && held.right) held.left = held.right = pressed.left = pressed.right = false;
  }

  // 情報パネル用: 「A: KeyA / KeyX / Space」のような説明
  function describe(b) {
    return (SMB.KEY_CONFIG[b] || []).map((c) => c.replace(/^Key/, '').replace(/^Arrow/, '')).join('/');
  }

  return api;
})();
