// =====================================================================
// debug.js — 検証用の機能。ゲームのボタン入力とは別に、キーを直接見る。
//   H: 情報パネル表示切替   G: タイル格子と列番号   V: 動画の背景を半透明で重ねる
//   T: ジャンプ軌跡と最高到達点の表示
//   P: 一時停止             N: 一時停止中に 1 フレーム進める
//   1 / 2 / 3: 速度 等倍 / 1/2 / 1/4   R: 面の最初からやり直す
//   F: 自由移動（地形を無視して上下左右に動く）切替
//   M: 形態を SMALL → SUPER → FIRE → SMALL の順に切替（変身演出つき）
//   L: マップ切替（1-1 前半 ⇔ 検証用テストマップ）
//   I: ダメージを受けない（敵の配置確認用）  K: わざと被弾する
//   J: 決まった地点へ飛ぶ（マップデータの debugSpots を順に）
//   E: 敵の崖の挙動を 原作どおり → 全員折り返す → 全員落ちる の順に切替
// ゲームのボタン（config.js）と同じキーは割り当てないこと。
// =====================================================================
window.SMB = window.SMB || {};

SMB.Debug = (function () {
  const state = {
    panel: true,
    grid: false,
    videoOverlay: false,
    trail: true,
    paused: false,
    stepRequests: 0,
    speed: 1,
    freeFly: false,
    resetRequested: false,
    formCycleRequested: false,
    levelSwitchRequested: false,
    hurtRequested: false,
    invincible: false,                       // 敵に当たってもダメージを受けない
    edgeOverride: SMB.C.ENEMY_EDGE_OVERRIDE, // null=原作どおり / 'turn' / 'fall'
    teleportRequested: false,
  };
  const EDGE_CYCLE = [null, 'turn', 'fall'];
  const EDGE_NAME = { null: '原作どおり', turn: '全員折り返す', fall: '全員落ちる' };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyH': state.panel = !state.panel; break;
      case 'KeyG': state.grid = !state.grid; break;
      case 'KeyV': state.videoOverlay = !state.videoOverlay; break;
      case 'KeyT': state.trail = !state.trail; break;
      case 'KeyP': state.paused = !state.paused; break;
      case 'KeyN': if (state.paused) state.stepRequests++; break;
      case 'Digit1': state.speed = 1; break;
      case 'Digit2': state.speed = 0.5; break;
      case 'Digit3': state.speed = 0.25; break;
      case 'KeyR': state.resetRequested = true; break;
      case 'KeyF': state.freeFly = !state.freeFly; break;
      case 'KeyM': state.formCycleRequested = true; if (state.paused) state.stepRequests++; break;
      case 'KeyL': state.levelSwitchRequested = true; break;
      case 'KeyI': state.invincible = !state.invincible; break;
      case 'KeyK': state.hurtRequested = true; break;
      case 'KeyJ': state.teleportRequested = true; break;
      case 'KeyO': SMB.Audio.toggleMute(); break;
      case 'KeyY': state.spritesOff = !state.spritesOff; break;
      case 'KeyE': state.edgeOverride = EDGE_CYCLE[(EDGE_CYCLE.indexOf(state.edgeOverride) + 1) % EDGE_CYCLE.length]; break;
      default: return;
    }
    e.preventDefault();
  });

  const hex = (v) => (v < 0 ? '-' : ' ') + '0x' + Math.abs(v).toString(16).toUpperCase().padStart(5, '0');
  const px = (v) => (v / SMB.C.FP).toFixed(3).padStart(8);
  const ROW_NAME = ['低速(<1.0)', '中速(<2.31)', '高速(≥2.31)'];

  let fpsFrames = 0, fpsTime = performance.now(), fps = 0;

  function updatePanel(el, g) {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsTime >= 500) { fps = fpsFrames * 1000 / (now - fpsTime); fpsFrames = 0; fpsTime = now; }
    el.style.display = state.panel ? 'block' : 'none';
    if (!state.panel) return;
    const p = g.player, T = SMB.C.TILE, FP = SMB.C.FP, I = SMB.Input;
    const col = Math.floor(p.x / FP / T), row = Math.floor(p.y / FP / T);
    const src = g.level.isVideoCovered(col) ? '動画から抽出' : '補完';
    const j = p.lastJump;
    const au = SMB.Audio.describe();
    const btn = (b) => (I.held[b] ? b : '·');
    el.textContent = [
      `frame   ${String(g.frame).padStart(8)}   描画 ${fps.toFixed(1)} fps`,
      `状態    ${state.paused ? '一時停止 (N で 1f)' : '実行中'}  速度 x${state.speed}${state.freeFly ? '  自由移動' : ''}`,
      `入力    ${btn('left')} ${btn('right')} ${btn('up')} ${btn('down')} ${btn('A')} ${btn('B')}`,
      `cam.x   ${hex(g.cam.x)} =${px(g.cam.x)} px`,
      `x       ${hex(p.x)} =${px(p.x)} px`,
      `y       ${hex(p.y)} =${px(p.y)} px`,
      `vx      ${hex(p.vx)} =${px(p.vx)} px/f`,
      `vy      ${hex(p.vy)} =${px(p.vy)} px/f`,
      `形態    ${p.form.toUpperCase().padEnd(5)} 高さ ${p.h}px${p.crouching ? '  しゃがみ' : ''}${p.embedded ? '  埋まり→押出し中' : ''}${g.transition ? '  変身中 ' + g.transition.t + '/' + g.transition.frames : ''}`,
      `状態    ${p.anim.padEnd(6)} ${p.onGround ? '接地' : '空中'}  runTimer ${p.runTimer}`,
      `空中上限 ${hex(p.airMax)}  重力 保持${hex(p.holdG)} 落下${hex(p.fallG)}`,
      `tile    col ${col}, row ${row}  [${src}]  ${g.level.id} / ${g.areaName}`,
      `中間地点 ${g.midpointReached ? '通過済み' : '未通過'}${g.warp ? '  土管 ' + g.warp.kind + ' ' + g.warp.phase : ''}${g.flag ? '  ゴール ' + g.flag.phase : ''}${g.ending ? '  エンディング ' + g.ending.phase : ''}`,
      `SCORE   ${g.hud.score}  COIN ${g.hud.coins}  残機 ${g.hud.lives}  画面 ${g.mode}`,
      `無敵    点滅 ${p.invulnTimer} f  スター ${p.starTimer} f${state.invincible ? '  [I] ダメージなし' : ''}  踏み連鎖 ${g.stompChain}`,
      `火の玉  ${g.fireballs ? g.fireballs.count : 0} / ${SMB.C.FIREBALL_MAX}`,
      `絵      ${g.renderer.sheet ? (state.spritesOff ? '図形（Y で画像に戻す）' : 'スプライト画像') : (g.renderer.sheetError ? '画像なし → 図形' : '読み込み中')}`,
      `音      ${au.mode}`,
      `  曲 ${au.music}  SE ${au.se}`,
      `  ${au.owner}`,
      `敵      ${g.enemies.list.length} 体  崖: ${EDGE_NAME[state.edgeOverride]}`,
      ...g.enemies.list.slice(0, 5).map((e) => `  ${e.type.padEnd(11)} ${e.state.padEnd(12)} x${(e.x / FP).toFixed(0).padStart(5)}${e.state === 'shell' ? ' 復活まで ' + e.timer : ''}${e.hp != null ? ' HP ' + e.hp : ''}`),
      `TIME    ${g.hud.time}  (次の減少まで ${SMB.C.TIME_TICK_FRAMES - g.timeSub} f)`,
      '',
      '[直前のジャンプ]',
      j ? ` 高さ ${j.height.toFixed(2)} px = ${(j.height / 16).toFixed(2)} ブロック` : ' （まだありません）',
      j ? ` 滞空 ${j.frames} f  踏切り ${px(j.takeoffSpeed).trim()} px/f` : '',
      j ? ` 初速表 ${j.row >= 0 ? ROW_NAME[j.row] : '落下（ジャンプなし）'}` : '',
      '',
      '[操作]',
      ` ←→ 移動  ↓ しゃがみ（SUPER/FIRE）`,
      ` A: ${I.describe('A')}  ジャンプ`,
      ` B: ${I.describe('B')}  ダッシュ`,
      '[検証]',
      ' H パネル  G 格子  V 動画重ね  T 軌跡',
      ' P 停止  N コマ送り  1/2/3 速度',
      ' R やり直し  F 自由移動',
      ' M 形態切替  L マップ切替(1-1⇔テスト)',
      ' I ダメージなし  K 被弾  E 敵の崖の挙動',
      ' Y 画像 ⇔ 図形の切替',
      ' O 消音の切替（最初のキー入力で音が出始めます）',
      ' J 地点ジャンプ（土管前→中間→スター→階段→後半→ゴール前→地下）',
    ].join('\n');
  }

  return { state, updatePanel };
})();
