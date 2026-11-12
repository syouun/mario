// =====================================================================
// renderer.js — 256×240 の内部キャンバスへ描画する。
// フェーズ1は図形によるプレースホルダ。スプライト画像は後でこのファイルだけ差し替える。
// =====================================================================
window.SMB = window.SMB || {};

SMB.Renderer = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.refImages = {};          // 動画から抽出した背景（比較用）をエリアごとに読み込む
    this.K = SMB.COLORS;
    // スプライトシート。読み込めなかったとき・フレームが無いときは図形で描く
    this.sheet = null;
    this.sheetError = false;
    if (SMB.SPRITE_SHEET) {
      const img = new Image();
      img.onload = () => { this.sheet = img; };
      img.onerror = () => { this.sheetError = true; console.info('スプライト画像なし: ' + SMB.SPRITE_SHEET.src + '（図形で描きます）'); };
      img.src = SMB.SPRITE_SHEET.src;
    }
    // スター中の色かぶせ用の作業キャンバス
    this.tintCanvas = document.createElement('canvas');
    this.tintCanvas.width = 32; this.tintCanvas.height = 32;
  }

  get spritesOn() { return !!this.sheet && !(SMB.Debug && SMB.Debug.state.spritesOff); }

  // フレーム name を (x, y) に描く。描けたら true。
  // flipX / flipY で反転、tint で色をかぶせる（スター）。
  spr(name, x, y, flipX, flipY, tint) {
    if (!this.spritesOn) return false;
    const fr = SMB.SPRITE_SHEET.frames[name];
    if (!fr) return false;
    const [sx, sy, w, h] = fr;
    let src = this.sheet, ox = sx, oy = sy;
    if (tint) {
      const tc = this.tintCanvas, tctx = tc.getContext('2d');
      tctx.clearRect(0, 0, tc.width, tc.height);
      tctx.globalCompositeOperation = 'source-over';
      tctx.drawImage(this.sheet, sx, sy, w, h, 0, 0, w, h);
      tctx.globalCompositeOperation = 'source-atop';      // 絵のある部分だけに色を重ねる
      tctx.globalAlpha = 0.55;
      tctx.fillStyle = tint;
      tctx.fillRect(0, 0, w, h);
      tctx.globalAlpha = 1;
      tctx.globalCompositeOperation = 'source-over';
      src = tc; ox = 0; oy = 0;
    }
    const ctx = this.ctx;
    if (flipX || flipY) {
      ctx.save();
      ctx.translate(x + (flipX ? w : 0), y + (flipY ? h : 0));
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(src, ox, oy, w, h, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(src, ox, oy, w, h, Math.round(x), Math.round(y), w, h);
    }
    return true;
  }

  // 候補のフレーム名を順に試す
  sprAny(names, x, y) {
    for (const n of names) if (this.spr(n, x, y)) return true;
    return false;
  }

  // ref/<面>_video_bg.png（main）/ ref/<面>_<エリア>_video_bg.png（それ以外）
  refImageFor(level) {
    const key = level.id + '/' + level.areaName;
    if (!level.area.videoCoveredCols) return null;       // 動画から作っていないマップには画像がない
    if (!(key in this.refImages)) {
      this.refImages[key] = null;
      const img = new Image();
      img.onload = () => { this.refImages[key] = img; };
      img.src = 'ref/' + level.id + (level.areaName === 'main' ? '' : '_' + level.areaName) + '_video_bg.png';
    }
    return this.refImages[key];
  }

  render(s) {
    const ctx = this.ctx, C = SMB.C;
    const camPx = s.cam.px;
    this.frame = s.frame;
    // 面種別の配色（地上・地下…）
    const K = this.K = Object.assign({}, SMB.COLORS, SMB.THEMES[s.level.area.theme] || {});
    this.theme = s.level.area.theme;

    // 面番号画面 / ゲームオーバー（付録B）
    if (s.mode === 'intro' || s.mode === 'gameover') {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
      const label = (s.introMissing || s.levelId || s.level.id).toUpperCase();
      this.drawHud(s.hud, s.level, true, label);
      if (s.mode === 'intro') {
        this.drawText('WORLD ' + label, 88, 80);
        if (s.introMissing) this.drawText('NOT YET BUILT', 76, 144);
        else if (s.worldSelectUnlocked) this.drawText('PUSH B TO SELECT A WORLD', 32, 152);
        this.drawPlayer({ x: 97 * C.FP, y: 104 * C.FP, h: 16, facing: 1, form: 'small', anim: 'stand' }, 0, null, 0);
        this.drawText('x  ' + s.hud.lives, 120, 112);
      } else {
        this.drawText('GAME OVER', 88, 120);
      }
      return;
    }

    ctx.fillStyle = K.sky;
    ctx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
    if (K.topSky) { ctx.fillStyle = K.topSky; ctx.fillRect(0, 0, C.SCREEN_W, 32); }   // 水中: 天井の上は空の色

    this.drawDeco(s.level, camPx);
    this.drawGoal(s.level, camPx, s.flag);                // 城とゴールポール（背景扱い）
    if (s.blocks) this.drawItems(s.blocks, camPx);        // せり上がるアイテムはブロックの後ろ
    if (s.enemies) this.drawEnemies(s.enemies, camPx, s.frame, true);   // パックンは土管の後ろ
    const pl = s.player;
    const blink = pl.invulnTimer > 0 && (s.frame >> 1) & 1;     // 点滅無敵は 2f ごとに消す
    const hidden = (s.flag && s.flag.hidden) || (s.mode === 'dying' && s.lavaDeath);   // 城に入った / 溶岩に沈んだ
    if (s.warp && !blink) this.drawPlayer(pl, camPx, null, s.frame);   // 土管の出入り中は土管の後ろ
    this.drawTiles(s.level, camPx, s.frame, s.blocks);
    if (s.blocks) this.drawBlockEffects(s.blocks, camPx, s.frame);
    if (s.vines) this.drawVines(s.vines, camPx);

    const ref = s.debug.videoOverlay && this.refImageFor(s.level);
    if (ref) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(ref, -camPx, 0);
      ctx.globalAlpha = 1;
    }

    if (s.enemies) this.drawEnemies(s.enemies, camPx, s.frame, false);
    if (s.lifts) this.drawLifts(s.lifts, camPx);
    if (s.warpZoneActive) this.drawWarpZone(s.level, camPx);
    if (s.fireballs) this.drawFireballs(s.fireballs, camPx, s.frame);
    if (s.debug.trail && s.mode === 'play' && !s.flag) this.drawTrail(pl, camPx);
    if (!s.warp && !blink && !hidden) this.drawPlayer(pl, camPx, s.transition, s.frame);
    if (s.flag) this.drawFlagEffects(s.flag, camPx);
    if (s.ending) this.drawEnding(s.ending);
    if (s.blocks) this.drawPopups(s.blocks, camPx);
    if (s.debug.grid) this.drawGrid(s.level, camPx);
    this.drawHud(s.hud, s.level);
  }

  // ---------------- 背景装飾（当たり判定なし）----------------
  drawDeco(level, camPx) {
    const ctx = this.ctx, K = this.K || SMB.COLORS, base = SMB.C.GROUND_Y;
    for (const d of level.deco) {
      const x = d.x - camPx;
      if (x > SMB.C.SCREEN_W || x < -(d.type === 'wall' ? d.n * 16 : 96)) continue;
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000';
      if (d.type === 'hill_big' || d.type === 'hill_small') {
        const w = d.type === 'hill_big' ? 80 : 48;
        const h = d.type === 'hill_big' ? 35 : 19;
        ctx.fillStyle = K.hill;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x + w * 0.38, base - h + 5);
        ctx.quadraticCurveTo(x + w / 2, base - h - 3, x + w * 0.62, base - h + 5);
        ctx.lineTo(x + w, base);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.fillRect(x + w / 2 - 6, base - h + 10, 2, 4);
        ctx.fillRect(x + w / 2 + 3, base - h + 8, 2, 4);
      } else if (d.type === 'wall') {
        // 8-3 の城壁（背景）。n マス幅、上に凸凹（高さ 96px）
        const w = d.n * 16, top = base - 96, B = K.ground;
        ctx.fillStyle = B; ctx.fillRect(x, top + 8, w, 88);
        for (let i = 0; i < d.n; i++) ctx.fillRect(x + i * 16 + 2, top, 12, 8);
        ctx.fillStyle = '#000';
        for (let yy = top + 16; yy < base; yy += 8) ctx.fillRect(x, yy, w, 1);
        for (let row = 0, yy = top + 8; yy < base; row++, yy += 8)
          for (let xx = (row % 2) * 8; xx < w; xx += 16) ctx.fillRect(x + xx, yy, 1, 8);
      } else if (d.type === 'surface') {
        // 水面（n マス幅）。波のギザギザを 1 行目の上半分に描く
        ctx.fillStyle = '#9cb4fc';
        for (let i = 0; i < d.n * 8; i++) ctx.fillRect(x + i * 2, d.y + ((i + (this.frame >> 4)) % 2), 2, 2);
      } else if (d.type === 'tree') {
        // 8-1 の木（n=0: 丸い小さな木 / n=1: 縦長の木）。幹は白っぽく、葉は黄緑
        const tall = d.n === 1, top = base - (tall ? 48 : 32);
        ctx.fillStyle = '#fcfcfc'; ctx.fillRect(x + 6, base - 16, 4, 16);
        ctx.fillStyle = '#000'; ctx.fillRect(x + 5, base - 16, 1, 16); ctx.fillRect(x + 10, base - 16, 1, 16);
        ctx.fillRect(x + 7, base - 11, 2, 1); ctx.fillRect(x + 7, base - 5, 2, 1);
        ctx.fillStyle = this.theme === 'snow' ? '#fcfcfc' : '#7ae500';
        ctx.beginPath(); ctx.ellipse(x + 8, top + (tall ? 16 : 8), 7, tall ? 15 : 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (d.type === 'fence') {
        // 8-1 の柵（n マス分）。柱 2 本 / マスと横木 2 本
        const w = d.n * 16;
        ctx.fillStyle = '#fcbcb0';
        ctx.fillRect(x, base - 12, w, 2); ctx.fillRect(x, base - 6, w, 2);
        for (let i = 0; i < d.n * 2; i++) {
          ctx.fillStyle = '#000'; ctx.fillRect(x + i * 8 + 2, base - 15, 4, 15);
          ctx.fillStyle = '#c84c0c'; ctx.fillRect(x + i * 8 + 3, base - 14, 2, 14);
        }
      } else if (d.type === 'bush' || d.type === 'cloud') {
        const isCloud = d.type === 'cloud';
        const w = (d.n + 1) * 16;
        const y = isCloud ? d.y : base - 16;
        ctx.fillStyle = isCloud ? K.cloud : K.bush;
        ctx.beginPath();
        for (let i = 0; i <= d.n; i++) {
          ctx.moveTo(x + 8 + i * 16 + 8, y + 8);
          ctx.arc(x + 8 + i * 16, y + 8, 8, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillRect(x + 4, y + 8, w - 8, isCloud ? 12 : 8);
        if (isCloud) {
          ctx.fillStyle = K.cloudShade;
          ctx.fillRect(x + 6, y + 18, w - 12, 2);
        }
      }
    }
  }

  // ---------------- タイル ----------------
  drawTiles(level, camPx, frame, blocks) {
    const T = SMB.C.TILE;
    const c0 = Math.floor(camPx / T), c1 = c0 + 17;
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < level.height; r++) {
        const ch = level.tileAt(c, r);
        if (ch === '.') continue;
        if (blocks && blocks.bumpOffsetAt(c, r) !== null) continue;   // 揺れ中は別に描く
        const lava = ch === 'L' && level.tileAt(c, r - 1) === 'L';   // 溶岩の内側（上も溶岩）は 'l' で描く
        this.drawTile(lava ? 'l' : ch, c * T - camPx, r * T, frame);
      }
    }
  }

  // ---------------- ブロックの揺れ・コイン・破片 ----------------
  drawBlockEffects(blocks, camPx, frame) {
    const ctx = this.ctx, K = this.K, C = SMB.C, T = C.TILE;
    for (const b of blocks.bumps) {
      this.drawTile(b.drawAs, b.col * T - camPx, b.row * T + C.BUMP_OFFSETS[b.t], frame);
    }
    for (const c of blocks.coins) {
      const x = Math.round(c.x) - camPx, y = Math.round(c.y);
      if (this.spr('coin_spin' + (Math.floor(c.t / 3) % 4), x, y)) continue;
      const w = [8, 4, 2, 4][Math.floor(c.t / 3) % 4];       // 回転して見えるよう幅を変える
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 8 - w / 2 - 1, y + 1, w + 2, 14);
      ctx.fillStyle = K.question;
      ctx.fillRect(x + 8 - w / 2, y + 2, w, 12);
    }
    for (const f of blocks.fragments) {
      const x = Math.round(f.x) - camPx, y = Math.round(f.y);
      const spin = Math.floor(y / 6) % 2 === 0;           // 落ちながら回って見えるよう反転させる
      if (this.spr('fragment', x, y, spin, !spin)) continue;
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = K.ground;
      ctx.fillRect(x + 1, y + 1, 6, 6);
    }
  }

  drawItems(blocks, camPx) {
    const ctx = this.ctx;
    for (const it of blocks.items) {
      const x = Math.round(it.x) - camPx, y = Math.round(it.y);
      ctx.save();
      ctx.beginPath();
      if (it.baseY !== Infinity) {        // せり上がり中はブロックから出た部分だけ見せる
        ctx.rect(x, 0, 16, it.baseY);
        ctx.clip();
      }
      const iname = SMB.Sprites.item(it);
      if (iname && this.spr(iname, x, y)) { ctx.restore(); continue; }
      if (it.type === 'mushroom' || it.type === '1up') {
        ctx.fillStyle = it.type === '1up' ? '#00a800' : '#e40058';
        ctx.fillRect(x + 1, y + 2, 14, 8);
        ctx.fillStyle = '#fcfcfc';
        ctx.fillRect(x + 4, y + 4, 3, 3); ctx.fillRect(x + 10, y + 4, 3, 3);
        ctx.fillRect(x + 4, y + 10, 8, 6);
      } else if (it.type === 'flower') {
        ctx.fillStyle = '#00a800';
        ctx.fillRect(x + 7, y + 8, 2, 8);
        ctx.fillStyle = '#e40058';
        ctx.fillRect(x + 2, y + 1, 12, 7);
        ctx.fillStyle = '#fcfc00';
        ctx.fillRect(x + 5, y + 3, 6, 3);
      } else {                            // スター（色が明滅する星形）
        const c = ['#fcfc00', '#fc9838', '#fcfcfc', '#fcfc00'][Math.floor(it.t / 4) % 4];
        ctx.fillStyle = '#000';
        this.starPath(x + 8, y + 8, 8.5); ctx.fill();
        ctx.fillStyle = c;
        this.starPath(x + 8, y + 8, 7); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 6, y + 6, 1, 3); ctx.fillRect(x + 9, y + 6, 1, 3);
      }
      ctx.restore();
    }
  }

  starPath(cx, cy, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  // ---------------- リフト・天秤滑車・ジャンプ台 ----------------
  drawLifts(lifts, camPx) {
    const ctx = this.ctx;
    if (lifts.pulleys) {
      for (const p of lifts.pulleys) {
        const lx = Math.round(p.left.x + p.left.w / 2) - camPx;
        const rx = Math.round(p.right.x + p.right.w / 2) - camPx;
        const ty = Math.round(p.topY);
        if (rx < -16 || lx > SMB.C.SCREEN_W + 16) continue;
        // 上部の水平ビームと左右の滑車
        ctx.fillStyle = '#fc9838';
        ctx.fillRect(lx, ty, rx - lx, 2);
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(lx - 3, ty - 2, 6, 6);
        ctx.fillRect(rx - 3, ty - 2, 6, 6);
        if (!p.snapped) {
          ctx.fillStyle = '#fcfcfc';
          ctx.fillRect(lx, ty + 4, 1, Math.max(0, Math.round(p.left.y) - ty - 4));
          ctx.fillRect(rx, ty + 4, 1, Math.max(0, Math.round(p.right.y) - ty - 4));
        }
      }
    }
    for (const l of lifts.list) {
      const x = Math.round(l.x) - camPx, y = Math.round(l.y);
      if (x > SMB.C.SCREEN_W || x + l.w < 0) continue;
      if (l.isSpring) {
        const sy = Math.round(l.baseY - 32);
        const stage = l.t === 0 ? 0 : (l.t <= 4 || l.t > 8 ? 1 : 2);
        if (this.spritesOn && this.spr('spring' + stage, x, sy)) continue;
        const top = sy + stage * 8;
        ctx.fillStyle = '#d82800';
        ctx.fillRect(x + 1, top, 14, 4);
        ctx.fillRect(x + 1, sy + 28, 14, 4);
        ctx.fillStyle = '#fcfcfc';
        ctx.fillRect(x + 4, top + 4, 8, sy + 28 - (top + 4));
        continue;
      }
      if (this.spr('lift', x, y)) continue;
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, l.w, l.h);
      ctx.fillStyle = '#fc9838'; ctx.fillRect(x, y + 1, l.w, l.h - 2);
      ctx.fillStyle = '#c84c0c';
      for (let i = 4; i < l.w; i += 8) ctx.fillRect(x + i, y + 3, 3, 2);   // 穴の模様
    }
  }

  // ---------------- ワープゾーンの文字と行き先の番号 ----------------
  drawWarpZone(level, camPx) {
    const z = level.objects.find((q) => q.type === 'warp_zone');
    if (!z) return;
    this.drawText(z.text, z.textX - camPx, z.textY);
    for (const p of z.pipes) this.drawText(p.label, p.col * 16 + 12 - camPx, p.row * 16 - 24);
  }

  // ---------------- ツタ（4-2）----------------
  // 先端に vine_top、その下に vine を 16px ごとに並べ、根元（ブロックの上面）で切る
  drawVines(vines, camPx) {
    const ctx = this.ctx;
    for (const v of vines.list) {
      const x = v.x - camPx;
      if (x < -16 || x > SMB.C.SCREEN_W || v.base <= v.top) continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, v.top, 16, v.base - v.top); ctx.clip();
      for (let y = v.top, i = 0; y < v.base; y += 16, i++) {
        const name = i === 0 ? 'vine_top' : 'vine';
        if (this.spritesOn && this.spr(name, x, y)) continue;
        ctx.fillStyle = '#009628'; ctx.fillRect(x + 7, y + (i === 0 ? 6 : 0), 2, i === 0 ? 10 : 16);
        ctx.fillStyle = '#78dc3c';
        if (i === 0) ctx.fillRect(x + 5, y + 1, 6, 5);
        else { ctx.fillRect(x + 2, y + 3, 5, 3); ctx.fillRect(x + 9, y + 10, 5, 3); }
      }
      ctx.restore();
    }
  }

  // ---------------- ファイアボール ----------------
  drawFireballs(fb, camPx, frame) {
    const ctx = this.ctx;
    for (const f of fb.list) {
      const x = Math.round(f.x) - camPx, y = Math.round(f.y);
      if (f.explode >= 0 && this.spr('explode' + Math.min(2, Math.floor(f.explode / 4)), x - 4, y - 4)) continue;
      if (f.explode < 0 && this.spr('fireball' + (Math.floor(f.t / 4) % 4), x, y)) continue;
      if (f.explode >= 0) {                               // 爆発: 3 コマで広がる
        const r = 3 + Math.floor(f.explode / 4) * 3;
        ctx.fillStyle = ['#fcfcfc', '#fc9838', '#d82800'][Math.min(2, Math.floor(f.explode / 4))];
        ctx.beginPath(); ctx.arc(x + 4, y + 4, r, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.fillStyle = '#d82800';
      ctx.fillRect(x + 1, y + 1, 6, 6);
      ctx.fillStyle = '#fc9838';
      const spin = Math.floor(f.t / 4) % 4;               // 回転して見えるよう芯の位置を回す
      ctx.fillRect(x + [2, 3, 3, 2][spin], y + [2, 2, 3, 3][spin], 3, 3);
    }
  }

  drawPopups(blocks, camPx) {
    for (const p of blocks.popups) this.drawText(p.text, Math.round(p.x) - camPx, Math.round(p.y), '#fcfcfc');
  }

  drawTile(ch, x, y, frame) {
    if (this.spritesOn && this.sprAny(SMB.Sprites.tile(ch, this.theme, frame), x, y)) return;
    const ctx = this.ctx, K = this.K;
    const rect = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + dx, y + dy, w, h); };
    switch (ch) {
      case '#': // 地面
        rect(0, 0, 16, 16, K.ground);
        rect(0, 0, 16, 1, K.groundLight);
        rect(0, 0, 1, 16, K.groundLight);
        rect(15, 0, 1, 16, '#000');
        rect(0, 15, 16, 1, '#000');
        rect(9, 1, 1, 8, '#000');
        rect(1, 9, 8, 1, '#000');
        break;
      case 'B': // レンガ
        rect(0, 0, 16, 16, K.ground);
        rect(0, 0, 16, 1, K.groundLight);
        for (let i = 0; i < 4; i++) {
          rect(0, i * 4 + 3, 16, 1, '#000');
          rect(i % 2 === 0 ? 15 : 7, i * 4, 1, 3, '#000');
        }
        break;
      case '?': { // ？ブロック（3 色で明滅）
        const phase = [K.question, K.question, K.question, '#e07020', K.questionDark, '#e07020'];
        const glyph = phase[Math.floor(frame / 8) % phase.length];
        rect(0, 0, 16, 16, K.question);
        rect(0, 0, 16, 1, K.questionDark);
        rect(15, 0, 1, 16, '#000');
        rect(0, 15, 16, 1, '#000');
        rect(2, 2, 1, 1, '#000'); rect(13, 2, 1, 1, '#000');
        rect(2, 13, 1, 1, '#000'); rect(13, 13, 1, 1, '#000');
        const Q = ['.####.', '##..##', '....##', '...##.', '..##..', '..##..', '......', '..##..'];
        for (let j = 0; j < Q.length; j++)
          for (let i = 0; i < 6; i++)
            if (Q[j][i] === '#') rect(5 + i, 4 + j, 1, 1, glyph);
        break;
      }
      case 'v': break;                  // 見えない壁
      case '=':                         // 橋（城の最後の部屋）: 白い点線の手すりと赤黒い桁
        rect(0, 0, 16, 3, '#000'); rect(0, 1, 16, 1, '#fcfcfc');
        for (let i = 0; i < 16; i += 4) rect(i, 1, 2, 1, '#bcbcbc');
        rect(0, 3, 16, 5, '#a82020'); rect(0, 8, 16, 2, '#601010');
        break;
      case '/':                         // 橋を吊る鎖（左下→右上）
        for (let i = 0; i < 4; i++) {
          rect(i * 3 + 1, 11 - i * 3, 4, 4, '#000');
          rect(i * 3 + 2, 12 - i * 3, 2, 2, '#ececec');
        }
        break;
      case 'L': case 'l':               // 溶岩（L = 表面 / l = 内側）
        rect(0, 0, 16, 16, '#a80800');
        if (ch === 'L') { rect(0, 0, 16, 4, '#d82808'); for (let i = 0; i < 8; i += 2) rect(i * 2 + ((frame >> 4) & 1), 0, 2, 2, '#fc7848'); }
        break;
      case 'c': case 'C': // 砲台（頭 / 胴）
        rect(0, 0, 16, 16, '#303c78');
        rect(0, 0, 16, 1, '#000'); rect(0, 15, 16, 1, '#000'); rect(0, 0, 1, 16, '#000'); rect(15, 0, 1, 16, '#000');
        if (ch === 'c') { rect(3, 4, 3, 4, '#000'); rect(10, 4, 3, 4, '#000'); rect(1, 1, 14, 1, '#bcbcbc'); }
        else { rect(4, 4, 8, 8, '#000'); rect(6, 6, 4, 4, '#e45c10'); }
        break;
      case 'U': case 'X': // 使用済み / 硬いブロック
        rect(0, 0, 16, 16, K.ground);
        rect(0, 0, 16, 1, '#000'); rect(0, 15, 16, 1, '#000');
        rect(0, 0, 1, 16, '#000'); rect(15, 0, 1, 16, '#000');
        if (ch === 'U') { rect(3, 3, 1, 1, '#000'); rect(12, 3, 1, 1, '#000'); rect(3, 12, 1, 1, '#000'); rect(12, 12, 1, 1, '#000'); }
        else { rect(1, 1, 14, 1, K.groundLight); rect(1, 1, 1, 14, K.groundLight); }
        break;
      case '[': // 土管 上端（左）
        rect(0, 0, 16, 16, K.pipe);
        rect(0, 0, 16, 1, '#000'); rect(0, 15, 16, 1, '#000'); rect(0, 0, 1, 16, '#000');
        rect(3, 1, 3, 14, K.pipeLight);
        break;
      case ']': // 土管 上端（右）
        rect(0, 0, 16, 16, K.pipe);
        rect(0, 0, 16, 1, '#000'); rect(0, 15, 16, 1, '#000'); rect(15, 0, 1, 16, '#000');
        rect(9, 1, 2, 14, K.pipeDark); rect(12, 1, 3, 14, K.pipeDark);
        break;
      case '{': // 土管 胴（左）
        rect(2, 0, 14, 16, K.pipe);
        rect(2, 0, 1, 16, '#000');
        rect(5, 0, 3, 16, K.pipeLight);
        break;
      case '}': // 土管 胴（右）
        rect(0, 0, 14, 16, K.pipe);
        rect(13, 0, 1, 16, '#000');
        rect(7, 0, 2, 16, K.pipeDark); rect(10, 0, 3, 16, K.pipeDark);
        break;
      case 'o': {                       // 配置コイン（明滅）
        const c = ['#fc9838', '#fc9838', '#c84c0c', '#883000', '#c84c0c'][Math.floor(frame / 8) % 5];
        rect(4, 1, 8, 14, '#000'); rect(5, 2, 6, 12, c); rect(7, 4, 2, 8, '#fcbcb0');
        break;
      }
      case 'q': case 'Q': {             // 横向き土管の口（2 行で 1 つ）
        rect(0, 0, 16, 16, K.pipe);
        rect(0, 0, 1, 16, '#000');
        if (ch === 'q') rect(0, 0, 16, 1, '#000'); else rect(0, 15, 16, 1, '#000');
        rect(1, ch === 'q' ? 3 : 0, 16, 3, K.pipeLight);
        rect(15, 0, 1, 16, '#000');
        break;
      }
      case 'p': case 'P':               // 横向き土管の胴
        rect(0, ch === 'p' ? 2 : 0, 16, 14, K.pipe);
        if (ch === 'p') rect(0, 2, 16, 1, '#000'); else rect(0, 13, 16, 1, '#000');
        rect(0, ch === 'p' ? 5 : 0, 16, 3, K.pipeLight);
        rect(0, ch === 'p' ? 11 : 9, 16, 2, K.pipeDark);
        break;
      case 'h': case 'k': case 'j':     // キノコの傘（足場）
        rect(ch === 'h' ? 2 : 0, 0, ch === 'k' ? 16 : 14, 14, '#f08c28');
        rect(0, 0, 16, 1, '#000'); rect(0, 13, 16, 1, '#000');
        rect(ch === 'j' ? 2 : 6, 4, 5, 5, '#c81e14');
        break;
      case 's': case 'S':               // キノコの柄（背景）
        rect(4, 0, 8, 16, '#f8b8b0');
        rect(4, 0, 1, 16, '#000'); rect(11, 0, 1, 16, '#000');
        if (ch === 's') rect(4, 3, 8, 1, '#b0645a');
        break;
      default:
        rect(0, 0, 16, 16, '#f0f');   // 未定義タイルは目立つ色で
    }
  }

  // ---------------- プレイヤー（プレースホルダ）----------------
  // 状態が見分けられるよう形を変える: 地上=四角 / 空中=腕を上げる / スキッド=体を傾ける
  // しゃがみ=低く潰れた形 / FIRE=白い服 / 変身中=4f ごとに新旧の大きさを切替
  drawPlayer(p, camPx, tr, frame) {
    if (!p) return;
    const ctx = this.ctx, FP = SMB.C.FP, K = this.K;
    const x = Math.floor(p.x / FP) - camPx;
    const feet = Math.floor(p.y / FP) + p.h;
    let h = p.h, form = p.form;
    if (tr) {
      const toggle = Math.floor(tr.t / 4) % 2 === 1;
      const H = SMB.C.FORM_HEIGHT;
      if (H[tr.from] !== H[tr.to]) { h = toggle ? H[tr.to] : H[tr.from]; form = toggle ? tr.to : tr.from; }
      else form = toggle ? tr.to : tr.from;            // SUPER⇔FIRE は配色だけ点滅
      if (H[tr.from] !== H[tr.to] && toggle && tr.t % 4 === 0) h = (H[tr.from] + H[tr.to]) / 2;
    }
    const anim = tr ? 'stand' : p.anim;
    if (this.spritesOn) {
      const sel = SMB.Sprites.hero(p, form, anim, h);
      const fr = SMB.SPRITE_SHEET.frames[sel.name];
      const tint = tr ? null : SMB.Sprites.starTint(p, frame);
      if (fr && this.spr(sel.name, x, feet - fr[3], sel.flipX, false, tint)) return;
    }
    if (anim === 'crouch') h = 22;
    const y = feet - h, f = p.facing;
    const lean = anim === 'skid' ? -f * 2 : 0;
    let body = form === 'fire' ? '#fcfcfc' : K.player;
    let trim = form === 'fire' ? K.player : '#000';
    if (p.starTimer > 0 && !tr) {
      // スター: 4 色を循環。終わり際は循環が 4 倍遅くなる（仕様書 2.3）
      const slow = p.starTimer < SMB.C.STAR_SLOW_FRAMES;
      const i = Math.floor(frame / (slow ? 8 : 2)) % 4;
      body = ['#e40058', '#fcfcfc', '#00a800', '#fc9838'][i];
      trim = ['#000', '#e40058', '#000', '#883000'][i];
    }
    ctx.fillStyle = trim;
    ctx.fillRect(x + 1 + lean, y, 14, h);
    ctx.fillStyle = body;
    ctx.fillRect(x + 2 + lean, y + 1, 12, h - 2);
    if (h >= 32) {                                       // SUPER は胴と脚の境目を描く
      ctx.fillStyle = trim;
      ctx.fillRect(x + 2 + lean, y + 16, 12, 2);
    }
    if (anim === 'walk' && (Math.floor(p.x / FP / 4) & 1)) {
      ctx.fillStyle = K.sky;
      ctx.fillRect(x + 6, feet - 4, 4, 4);
    }
    if (anim === 'jump') {
      ctx.fillStyle = trim;
      ctx.fillRect(f > 0 ? x + 12 : x + 1, y - 4, 3, 5);
    }
    if (anim === 'throw') {                               // 投げるポーズ: 腕を前に出す
      ctx.fillStyle = trim;
      ctx.fillRect(f > 0 ? x + 14 : x - 3, y + 6, 5, 3);
    }
    if (anim === 'dead') {                               // ミス: 正面を向いて両手を上げる
      ctx.fillStyle = trim;
      ctx.fillRect(x - 1, y - 4, 3, 6); ctx.fillRect(x + 14, y - 4, 3, 6);
      ctx.fillStyle = '#fcfcfc';
      ctx.fillRect(x + 4, y + 4, 2, 3); ctx.fillRect(x + 10, y + 4, 2, 3);
      return;
    }
    ctx.fillStyle = form === 'fire' ? '#000' : '#fcfcfc';  // 目（向きの目印）
    ctx.fillRect((f > 0 ? x + 10 : x + 4) + lean, y + 4, 2, 3);
  }

  // ---------------- 敵（プレースホルダ）----------------
  // piranhaPass: true ならパックンフラワーだけ（土管より先に描いて土管の後ろに隠す）
  drawEnemies(mgr, camPx, frame, piranhaPass) {
    const ctx = this.ctx, FP = SMB.C.FP;
    for (const e of mgr.list) {
      if (!!e.def.piranha !== !!piranhaPass) continue;
      if (e.type === 'firebar') { this.drawFirebar(e, camPx, frame); continue; }
      if (e.type === 'podoboo' && !e.visible) continue;
      let x = Math.floor(e.x / FP) - camPx;
      const y = Math.floor(e.y / FP);
      if (x < -32 || x > SMB.C.SCREEN_W + 16) continue;
      if (e.shaking && (frame >> 2) & 1) x += 1;          // 復活前の甲羅は震える
      if (this.spritesOn) {
        const sel = SMB.Sprites.enemy(e, frame);
        const fr = SMB.SPRITE_SHEET.frames[sel.name];
        const tint = e.hurtTimer > 0 && (frame & 1) ? '#ff8040' : null;
        // 絵の高さが当たり判定の高さと違う（潰れたクリボーなど）ときは足元で揃える
        if (fr && this.spr(sel.name, x, y + e.h - fr[3], sel.flipX, sel.flipY, tint)) continue;
      }
      if (e.def.piranha) { this.drawPiranha(x, y, frame); continue; }
      const walkStep = (Math.floor(e.x / FP / 4) & 1);
      ctx.save();
      if (e.state === 'flipped') {                          // ひっくり返った敵は上下反転
        ctx.translate(0, 2 * y + e.h);
        ctx.scale(1, -1);
      }
      if (e.type === 'goomba') this.drawGoomba(x, y, e.state === 'squashed', walkStep);
      else if (e.type === 'bowser') this.drawBowser(x, y, e, walkStep);
      else if (e.type === 'bowser_fire') this.drawBowserFire(x, y, e, frame);
      else if (e.type === 'cheep_red' || e.type === 'cheep_grey' || e.type === 'cheep_fly') this.drawCheep(x, y, e, walkStep);
      else if (e.type === 'lakitu') this.drawLakitu(x, y, e);
      else if (e.type === 'hammer_bro') { ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y, 14, 24); ctx.fillStyle = '#00a800'; ctx.fillRect(x + 3, y + 8, 10, 12); ctx.fillStyle = '#fcbc3c'; ctx.fillRect(x + 3, y + 1, 10, 5); }
      else if (e.type === 'hammer') { ctx.fillStyle = '#000'; ctx.fillRect(x + 3, y + 3, 10, 10); ctx.fillStyle = '#ac7c00'; ctx.fillRect(x + 5, y + 5, 6, 6); }
      else if (e.type === 'rocket') { ctx.fillStyle = '#000'; ctx.fillRect(x, y + 3, 16, 10); ctx.fillStyle = '#00a8a8'; ctx.fillRect(x + 2, y + 5, 11, 6); }
      else if (e.type === 'spiny' || e.type === 'spiny_egg') this.drawSpiny(x, y, e, walkStep);
      else this.drawKoopa(x, y, e, walkStep);
      ctx.restore();
    }
  }

  // ファイアバー: 中心から FIREBAR_STEP px おきに火の玉（8x8）を並べる
  drawFirebar(e, camPx, frame) {
    const ctx = this.ctx, C = SMB.C;
    if (e.cx - camPx < -56 || e.cx - camPx > C.SCREEN_W + 56) return;
    for (let i = 0; i < C.FIREBAR_DOTS; i++) {
      const d = e.dotAt(i), x = Math.round(d.x - 4) - camPx, y = Math.round(d.y - 4);
      if (this.spritesOn && this.spr('fireball' + ((Math.floor(frame / 4) + i) % 4), x, y)) continue;
      ctx.fillStyle = '#000'; ctx.fillRect(x, y, 8, 8);
      ctx.fillStyle = '#fc9838'; ctx.fillRect(x + 1, y + 1, 6, 6);
      ctx.fillStyle = '#fcfc00'; ctx.fillRect(x + 3, y + 3, 2, 2);
    }
  }

  drawPiranha(x, y, frame) {
    const ctx = this.ctx;
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    const open = Math.floor(frame / 8) % 2 === 0;       // 口をパクパク
    r(7, 12, 2, 12, '#00a800');                          // 茎
    r(1, 16, 6, 3, '#00a800'); r(9, 18, 6, 3, '#00a800'); // 葉
    r(1, 0, 14, 13, '#000');
    r(2, 1, 12, 11, '#d82800');                          // 頭
    r(4, 3, 2, 2, '#fcfcfc'); r(10, 3, 2, 2, '#fcfcfc'); r(7, 8, 2, 2, '#fcfcfc');
    if (open) r(5, 0, 6, 4, '#000');
  }

  // ---------------- ゴールポールと城（背景扱い）----------------
  drawGoal(level, camPx, flag) {
    const ctx = this.ctx, T = SMB.C.TILE;
    const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    for (const o of level.objects) {
      if (o.type === 'castle' && o.big) {                   // 大きな城（8-3 のゴール）。入口の中央が x+40
        const x = o.col * T - camPx, base = SMB.C.GROUND_Y;
        if (x > SMB.C.SCREEN_W || x < -128) continue;
        this.drawBigCastle(x);
        if (flag && flag.castleFlag > 0) {
          const fy = base - 176 - 16 * flag.castleFlag;
          r(x + 39, fy, 1, 16 * flag.castleFlag + 2, '#fcfcfc');
          r(x + 40, fy, 12, 10, '#fcfcfc');
          r(x + 44, fy + 3, 4, 4, '#d82800');
        }
        continue;
      }
      if (o.type === 'castle') {
        const x = o.col * T - camPx, base = SMB.C.GROUND_Y;
        if (x > SMB.C.SCREEN_W || x < -96) continue;
        const B = this.K.ground;
        r(x, base - 48, 80, 48, B);                         // 下段
        r(x + 16, base - 80, 48, 32, B);                    // 上段
        for (let i = 0; i < 5; i++) r(x + i * 16 + 2, base - 56, 12, 8, B);   // 下段の凸凹
        for (let i = 0; i < 3; i++) r(x + 16 + i * 16 + 2, base - 88, 12, 8, B);
        ctx.fillStyle = '#000';
        for (let yy = base - 80; yy < base; yy += 8) {        // レンガの目地（上段は上段の幅だけ）
          if (yy < base - 48) ctx.fillRect(x + 16, yy, 48, 1); else ctx.fillRect(x, yy, 80, 1);
        }
        r(x + 32, base - 32, 16, 32, '#000');               // 入口
        ctx.beginPath(); ctx.arc(x + 40, base - 32, 8, Math.PI, 0); ctx.fill();
        r(x + 24, base - 72, 8, 16, '#000'); r(x + 48, base - 72, 8, 16, '#000');   // 窓
        if (flag && flag.castleFlag > 0) {                  // クリア後に上がる城の旗
          const fy = base - 88 - 16 * flag.castleFlag;
          r(x + 39, fy, 1, 16 * flag.castleFlag + 2, '#fcfcfc');
          r(x + 40, fy, 12, 10, '#fcfcfc');
          r(x + 44, fy + 3, 4, 4, '#d82800');
        }
      }
      if (o.type === 'castle_big') this.drawBigCastle(o.col * T - camPx);
      if (o.type === 'axe') {                               // 斧（橋の右端）: 金色の両刃の斧
        if (o.removed) continue;
        const x = o.col * T - camPx, y = o.row * T;
        if (x > SMB.C.SCREEN_W || x < -16) continue;
        if (this.spritesOn && this.spr('axe' + ((this.frame >> 3) & 1), x, y)) continue;
        r(x + 7, y + 4, 2, 12, '#a85800');                    // 柄
        r(x + 1, y, 14, 8, '#000');
        r(x + 2, y + 1, 12, 6, ((this.frame >> 3) & 1) ? '#fcd000' : '#fc9838');
        r(x + 7, y + 1, 2, 6, '#fcfcfc');
      }
      if (o.type === 'princess') {                          // 囚われの姫（8-4 最後の部屋）
        const x = o.col * T - camPx, y = (o.row + 1) * T - 24;
        if (x > SMB.C.SCREEN_W || x < -16) continue;
        if (this.spritesOn && this.spr('princess', x, y, true, false)) continue;
        r(x + 4, y, 8, 3, '#fcd000');                         // 王冠
        r(x + 3, y + 3, 10, 7, '#e45c10');                    // 髪
        r(x + 4, y + 4, 7, 5, '#f0e0b0');                     // 顔
        r(x + 2, y + 10, 12, 14, '#f878c8');                  // ドレス
        r(x + 4, y + 14, 8, 10, '#fcfcfc');
      }
      if (o.type === 'retainer') {                          // 囚われのキノピオ（1-4〜7-4 の最後の部屋）
        const x = o.col * T - camPx, y = (o.row + 1) * T - 24;
        if (x > SMB.C.SCREEN_W || x < -16) continue;
        if (this.spritesOn && this.spr('retainer', x, y, false, false)) continue;
        r(x + 2, y + 1, 12, 7, '#fcfcfc');                    // キノコ帽
        r(x + 4, y + 2, 3, 4, '#d82800'); r(x + 9, y + 2, 3, 4, '#d82800');
        r(x + 4, y + 8, 8, 5, '#f0e0b0');                     // 顔
        r(x + 3, y + 13, 10, 9, '#d82800');                   // ベスト
        r(x + 5, y + 13, 6, 9, '#fcfcfc');
      }
      if (o.type === 'flagpole') {
        const px = o.col * T + 7 - camPx;
        if (px > SMB.C.SCREEN_W + 16 || px < -32) continue;
        const baseY = (13 - 1) * T;
        r(px, o.topY, 2, baseY - o.topY, '#80d010');        // ポール
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(px + 1, o.topY - 3, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#00a800'; ctx.beginPath(); ctx.arc(px + 1, o.topY - 3, 3, 0, Math.PI * 2); ctx.fill();
        const fy = flag ? flag.flagY : o.topY + 8;          // 旗（ポールの左側）
        ctx.fillStyle = '#fcfcfc';
        ctx.beginPath(); ctx.moveTo(px, fy); ctx.lineTo(px - 16, fy); ctx.lineTo(px, fy + 16); ctx.fill();
        r(px - 9, fy + 3, 5, 5, '#00a800');
      }
    }
  }

  // スタート地点の大きな城（4-1 などの背景。当たり判定なし）
  //   下段 112x88 / 中段 80x48 / 上段 48x32、それぞれに 8px の凸凹
  drawBigCastle(x) {
    if (x > SMB.C.SCREEN_W || x < -128) return;
    const ctx = this.ctx, base = SMB.C.GROUND_Y, B = this.K.ground;
    const r = (dx, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y, w, h); };
    const tier = (dx, top, w, bottom) => {
      r(dx, top + 8, w, bottom - top - 8, B);
      for (let i = 0; i < w / 16; i++) r(dx + i * 16 + 2, top, 12, 8, B);
      ctx.fillStyle = '#000';
      for (let yy = top + 8; yy < bottom; yy += 8) ctx.fillRect(x + dx, yy, w, 1);
    };
    tier(0, base - 96, 112, base);
    tier(0, base - 144, 80, base - 88);
    tier(16, base - 176, 48, base - 136);
    const arch = (dx, y, w, h) => {
      r(dx, y + w / 2, w, h - w / 2, '#000');
      ctx.beginPath(); ctx.arc(x + dx + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.fill();
    };
    arch(0, base - 32, 16, 32); arch(32, base - 32, 16, 32); arch(64, base - 32, 16, 32);   // 入口
    arch(16, base - 80, 16, 32); arch(48, base - 80, 16, 32);                                // 下段の窓
    arch(32, base - 128, 16, 28);                                                           // 中段の窓
    r(24, base - 160, 8, 14, '#000'); r(48, base - 160, 8, 14, '#000');                     // 上段の窓
  }

  // ゴール後の演出: ポールを上がる得点表示と花火
  drawFlagEffects(f, camPx) {
    const ctx = this.ctx;
    if (f.phase === 'slide' || f.phase === 'turn') this.drawText(String(f.score), f.poleX + 6 - camPx, f.scoreY - 8);
    for (const b of f.bursts) {
      if (b.t > 24) continue;
      const rad = 2 + b.t * 0.6, x = b.x - camPx;
      ctx.fillStyle = ['#fcfcfc', '#fc9838', '#d82800'][Math.floor(b.t / 8) % 3];
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.fillRect(Math.round(x + Math.cos(a) * rad) - 1, Math.round(b.y + Math.sin(a) * rad) - 1, 3, 3);
      }
    }
  }

  // エンディング／城クリアのメッセージ表示（8-4 は姫救出、1-4〜7-4 はキノピオ救出）
  drawEnding(ending) {
    const n = ending.msgLines || 0;
    if (ending.isFinal === false) {
      if (n >= 1) this.drawText('THANK YOU MARIO!', 64, 88);
      if (n >= 2) {
        this.drawText('BUT OUR PRINCESS IS IN', 40, 120);
        this.drawText('ANOTHER CASTLE!', 68, 136);
      }
      return;
    }
    if (n >= 1) this.drawText('THANK YOU MARIO!', 64, 80);
    if (n >= 2) this.drawText('YOUR QUEST IS OVER.', 56, 104);
    if (n >= 3) this.drawText('WE PRESENT YOU A NEW QUEST.', 24, 120);
    if (n >= 4) this.drawText('PUSH BUTTON B', 80, 144);
    if (n >= 5) this.drawText('TO SELECT A WORLD', 64, 160);
  }

  // 図形モード（Y キー）用の大魔王と火炎・プクプク
  drawBowser(x, y, e, step) {
    if (e.disguiseType === 'goomba') { this.drawGoomba(x + 8, y + 8, false, step); return; }
    if (e.disguiseType) { this.drawKoopa(x + 8, y + 4, { type: e.disguiseType, dir: e.dir }, step); return; }
    const ctx = this.ctx, f = e.dir < 0 ? -1 : 1;
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    r(4, 4, 24, 24, '#000');
    r(6, 6, 20, 20, '#00a800');                             // 胴・甲羅
    r(10, 10, 12, 14, '#f0e0b0');                           // 腹
    const hx = f < 0 ? 0 : 18;
    r(hx, 2, 14, 12, '#00a800');                            // 頭
    r(hx + (f < 0 ? 6 : 2), 0, 4, 3, '#fcd000');            // 角
    r(hx + (f < 0 ? 2 : 8), 5, 3, 2, '#d82800');            // 目
    if (e.mouthOpen) r(hx + (f < 0 ? 0 : 6), 9, 8, 4, '#fc9838'); // 開いた口
    r(step ? 6 : 8, 26, 6, 6, '#fcbc3c');
    r(step ? 18 : 16, 26, 6, 6, '#fcbc3c');
  }

  drawBowserFire(x, y, e, frame) {
    const ctx = this.ctx;
    ctx.fillStyle = ((frame >> 2) & 1) ? '#d82800' : '#fc9838';
    ctx.fillRect(x, y + 1, 24, 6);
    ctx.fillStyle = '#fcfc00';
    ctx.fillRect(x + 3, y + 2, 16, 4);
  }

  drawCheep(x, y, e, step) {
    const ctx = this.ctx;
    ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y + 2, 14, 12);
    ctx.fillStyle = e.type === 'cheep_grey' ? '#bcbcbc' : '#d82800';
    ctx.fillRect(x + 2, y + 3, 12, 8);
    ctx.fillStyle = '#fcfcfc';
    ctx.fillRect(x + 4, y + 10, 8, 3);
    ctx.fillRect(x + (e.dir < 0 ? 3 : 11), y + 4, 2, 2);
    ctx.fillRect(x + 6, y + (step ? 6 : 5), 4, 3);
  }

  drawGoomba(x, y, squashed, step) {
    const ctx = this.ctx;
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    if (squashed) {
      r(1, 8, 14, 8, '#000'); r(2, 9, 12, 5, '#c84c0c'); r(4, 11, 2, 1, '#fcfcfc'); r(10, 11, 2, 1, '#fcfcfc');
      return;
    }
    r(1, 1, 14, 11, '#000');
    r(2, 2, 12, 9, '#c84c0c');                               // 頭
    r(4, 5, 3, 3, '#fcfcfc'); r(9, 5, 3, 3, '#fcfcfc');      // 目
    r(5, 6, 1, 2, '#000'); r(10, 6, 1, 2, '#000');
    r(5, 11, 6, 3, '#fcbcb0');                               // 胴
    r(step ? 1 : 2, 13, 5, 3, '#000'); r(step ? 10 : 9, 13, 5, 3, '#000');  // 足
  }

  // スプライトを使わないときの仮の図形: ジュゲム（雲に乗った小鬼）とトゲゾー（トゲのあるウニ）
  drawLakitu(x, y, e) {
    const ctx = this.ctx;
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    r(4, 1, 8, 8, '#000'); r(5, 2, 6, 6, '#8840c8');      // 頭
    r(6, 4, 1, 2, '#fcfcfc'); r(9, 4, 1, 2, '#fcfcfc');
    if (e.throwPose) { r(2, 0, 2, 4, '#8840c8'); r(12, 0, 2, 4, '#8840c8'); }   // 手を上げる
    r(0, 11, 16, 9, '#fcfcfc'); r(2, 9, 4, 3, '#fcfcfc'); r(9, 9, 5, 3, '#fcfcfc');   // 雲
    r(3, 14, 1, 2, '#000'); r(11, 14, 1, 2, '#000');
    r(1, 20, 14, 2, '#bcbcbc');
  }

  drawSpiny(x, y, e, step) {
    const ctx = this.ctx;
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    if (e.state === 'egg') {
      r(3, 6, 10, 10, '#000'); r(4, 7, 8, 8, '#8840c8');
      r(7, 4, 2, 2, '#fcbc3c'); r(1, 10, 2, 2, '#fcbc3c'); r(13, 10, 2, 2, '#fcbc3c');
      return;
    }
    r(2, 5, 12, 8, '#000'); r(3, 6, 10, 6, '#8840c8');
    for (let i = 0; i < 4; i++) r(2 + i * 3, 2, 2, 3, '#fcbc3c');   // トゲ
    const ex = e.dir < 0 ? 4 : 10; r(ex, 8, 2, 2, '#fcfcfc');
    r(step ? 3 : 4, 13, 4, 3, '#f8b080'); r(step ? 10 : 9, 13, 4, 3, '#f8b080');
  }

  drawKoopa(x, y, e, step) {
    const ctx = this.ctx;
    const shellCol = e.type === 'koopa_red' ? '#d82800' : '#00a800';
    const r = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    if (e.isShell) {
      r(1, 3, 14, 12, '#000'); r(2, 4, 12, 10, shellCol); r(2, 11, 12, 3, '#fcfcfc');
      r(5, 6, 6, 2, '#fcfcfc');
      if (e.shaking) { r(2, 14, 3, 2, '#fca044'); r(11, 14, 3, 2, '#fca044'); }  // 足が出かかる
      return;
    }
    const f = e.dir;
    // 頭（進行方向側）
    r(f < 0 ? 0 : 10, 0, 6, 9, '#000'); r(f < 0 ? 1 : 11, 1, 4, 7, '#fca044');
    r(f < 0 ? 1 : 13, 3, 2, 2, '#000');
    // 甲羅
    r(2, 8, 12, 12, '#000'); r(3, 9, 10, 10, shellCol); r(3, 16, 10, 3, '#fcfcfc');
    // 足
    r(step ? 3 : 5, 20, 4, 4, '#fca044'); r(step ? 10 : 8, 20, 4, 4, '#fca044');
  }

  // ---------------- デバッグ: ジャンプ軌跡と最高到達点 ----------------
  drawTrail(p, camPx) {
    if (!p || !p.trail.length) return;
    const ctx = this.ctx, FP = SMB.C.FP;
    ctx.fillStyle = '#ffff00';
    for (let i = 0; i < p.trail.length; i += 2) {
      const t = p.trail[i];
      ctx.fillRect(Math.floor(t.x / FP) - camPx + 7, Math.floor(t.y / FP) + p.h - 1, 2, 2);
    }
    // 最高到達点（足元の高さ）に水平線
    const peak = Math.floor(p.peakY / FP) + p.h;
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(0, peak, SMB.C.SCREEN_W, 1);
  }

  // ---------------- デバッグ: タイル格子と列番号 ----------------
  drawGrid(level, camPx) {
    const ctx = this.ctx, T = SMB.C.TILE;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    const off = -(camPx % T);
    for (let x = off; x < SMB.C.SCREEN_W; x += T) ctx.fillRect(x, 0, 1, SMB.C.SCREEN_H);
    for (let y = 0; y < SMB.C.SCREEN_H; y += T) ctx.fillRect(0, y, SMB.C.SCREEN_W, 1);
    ctx.globalAlpha = 1;
    ctx.font = '6px monospace';
    ctx.textBaseline = 'top';
    const c0 = Math.floor(camPx / T);
    for (let c = c0; c <= c0 + 16; c++) {
      if (c % 4) continue;
      const inVideo = level.isVideoCovered(c);
      ctx.fillStyle = inVideo ? '#ffff00' : '#ff8080';
      ctx.fillText(String(c), c * T - camPx + 1, 34);
    }
    ctx.restore();
  }

  // ---------------- HUD ----------------
  // 8×8 セルのビットマップ文字。5×7 の字形を横に 7px へ広げて太らせる。
  drawText(str, x, y, color) {
    const ctx = this.ctx, F = SMB.Renderer.FONT, COLS = [0, 1, 1, 2, 3, 3, 4];
    ctx.fillStyle = color || SMB.COLORS.text;
    for (let i = 0; i < str.length; i++) {
      const g = F[str[i]];
      const cx = x + i * 8;
      if (!g) { if (str[i] !== ' ') { ctx.font = '8px monospace'; ctx.textBaseline = 'top'; ctx.fillText(str[i], cx, y); } continue; }
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 7; c++)
          if (g[r][COLS[c]] === '#') ctx.fillRect(cx + c, y + r, 1, 1);
    }
  }

  drawHud(hud, level, hideTime, worldLabel) {
    if (level.area.noTimer) hideTime = true;              // 1-2 の入口などは TIME を出さない
    const text = (str, x, y) => this.drawText(str, x, y);
    const ctx = this.ctx;
    text('MARIO', 24, 16);
    text(String(hud.score).padStart(6, '0'), 24, 24);
    text('x' + String(hud.coins).padStart(2, '0'), 96, 24);
    ctx.fillStyle = SMB.COLORS.question;
    ctx.fillRect(89, 25, 5, 7);
    text('WORLD', 144, 16);
    text(worldLabel || level.id.toUpperCase(), 152, 24);
    text('TIME', 200, 16);
    if (!hideTime) text(String(hud.time).padStart(3, " "), 208, 24);   // 面番号画面では TIME の数字を出さない
  }
};

// 5×7 字形（必要な文字から順に追加する。未定義の文字は通常フォントで代用）
SMB.Renderer.FONT = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'S': ['.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
};
