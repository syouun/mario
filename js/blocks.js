// =====================================================================
// blocks.js — ブロックを叩いたときの処理と、それに伴う演出（仕様書 3.3 / 3.4 / 3.5）。
//   ・揺れ: 叩いたブロックを一時的にスプライト化して 8f で 4px 上下（タイルはソリッドのまま）
//   ・？ブロック: 中身（コイン / パワーアップ）を出して使用済み 'U' へ
//   ・レンガ: SMALL は揺れるだけ、SUPER/FIRE は破壊（破片 4 個、50 点）
//   ・中身入りレンガ: 複数コイン（最初に叩いてから約 4 秒）/ 1UP など
//   ・隠しブロック: 下から叩いたときだけ出現
// アイテムの自律移動はフェーズ2。ここではせり上がって止まり、触れると取れる仮実装。
// =====================================================================
window.SMB = window.SMB || {};

SMB.Blocks = class {
  constructor(game, level) {
    this.game = game;
    this.level = level;
    this.contents = {};        // "col,row" → { content, state }
    for (const o of level.objects) {
      if (o.type === 'qblock' || o.type === 'question' || o.type === 'brick' || o.type === 'hidden_block' || o.type === 'hidden') {
        const raw = o.content || 'coin';
        const content = raw === 'coins10' ? 'multicoin' : raw;
        const hidden = o.type === 'hidden_block' || o.type === 'hidden';
        this.contents[o.col + ',' + o.row] = { content, hidden, timer: -1, dest: o.dest || null, vineTop: o.vineTop };
      }
    }
    this.bumps = [];           // 揺れ中のブロック
    this.coins = [];           // 飛び出すコイン
    this.fragments = [];       // レンガの破片
    this.popups = [];          // 得点表示
    this.items = [];           // パワーアップ（仮）
  }

  // 隠しブロック: 頭上判定のときだけソリッドとして扱う
  isHiddenAt(col, row) {
    const c = this.contents[col + ',' + row];
    return !!(c && c.hidden && this.level.tileAt(col, row) === '.');
  }

  // プレイヤーが天井で叩いたタイルを処理（付録A: プレイヤー移動の直後）
  processBump(player) {
    const t = player.bumpedTile;
    if (!t) return;
    const L = this.level, key = t.col + ',' + t.row;
    const ch = L.tileAt(t.col, t.row);
    const info = this.contents[key];
    const big = player.form !== 'small';
    const bumpable = (info && info.hidden && ch === '.') || ch === '?' || ch === 'B';
    if (bumpable) this.game.onTileBumped(t.col, t.row);   // 上に乗っている敵・アイテムへの突き上げ
    if (!(ch === 'B' && big && !info)) SMB.Audio.se('bump');  // 壊れるレンガ以外は「ゴン」

    if (info && info.hidden && ch === '.') {           // 隠しブロック出現
      L.setTile(t.col, t.row, 'U');
      this.bump(t.col, t.row, 'U');
      this.release(info.content, t.col, t.row, player);
      return;
    }
    if (ch === '?') {
      L.setTile(t.col, t.row, 'U');
      this.bump(t.col, t.row, 'U');
      this.release(info ? info.content : 'coin', t.col, t.row, player);
      return;
    }
    if (ch === 'B') {
      if (info) {                                        // 中身入りレンガ
        if (info.content === 'multicoin') {
          if (info.timer < 0) info.timer = SMB.C.MULTICOIN_FRAMES;
          const last = info.timer === 0;
          if (last) L.setTile(t.col, t.row, 'U');
          this.bump(t.col, t.row, last ? 'U' : 'B');
          this.release('coin', t.col, t.row, player);
        } else {
          L.setTile(t.col, t.row, 'U');
          this.bump(t.col, t.row, 'U');
          this.release(info.content, t.col, t.row, player);
        }
        return;
      }
      if (big) this.breakBrick(t.col, t.row);            // SUPER / FIRE は壊す
      else this.bump(t.col, t.row, 'B');                 // SMALL は揺れるだけ
      return;
    }
    // 'U' や硬いブロック、地面、土管は何も起きない（叩いた音だけ。サウンドは後で）
  }

  bump(col, row, drawAs) {
    this.bumps = this.bumps.filter((b) => !(b.col === col && b.row === row));
    this.bumps.push({ col, row, drawAs, t: 0 });
  }

  release(content, col, row, player) {
    const T = SMB.C.TILE, x = col * T, y = row * T;
    if (content === 'coin') {
      this.coins.push({ x, y: y - 16, vy: -SMB.C.COIN_POP_VY, t: 0 });
      this.game.addCoin();
    } else if (content === 'powerup') {
      // 叩いた瞬間の形態で中身が決まる（SMALL→キノコ、SUPER/FIRE→フラワー）
      this.items.push({ type: player.form === 'small' ? 'mushroom' : 'flower', x, y, baseY: y, t: 0 });
      SMB.Audio.se('item');
    } else if (content === '1up') {
      this.items.push({ type: '1up', x, y, baseY: y, t: 0 });
      SMB.Audio.se('item');
    } else if (content === 'vine') {
      // ツタ: ブロックの上から上へ伸びる（行き先があれば画面の上の外まで）
      const info = this.contents[col + ',' + row] || {};
      const top = info.dest ? SMB.C.VINE_OFFSCREEN_TOP : (info.vineTop != null ? info.vineTop * T : T);
      this.game.area.vines.sprout(col, y, top, info.dest);
      SMB.Audio.se('vine');
    } else if (content === 'star') {
      this.items.push({ type: 'star', x, y, baseY: y, t: 0 });
      SMB.Audio.se('item');
    }
  }

  breakBrick(col, row) {
    const T = SMB.C.TILE, x = col * T, y = row * T;
    this.level.setTile(col, row, '.');
    const C = SMB.C;
    this.fragments.push(
      { x: x, y: y, vx: -C.FRAG_VX, vy: -C.FRAG_VY_TOP },
      { x: x + 8, y: y, vx: C.FRAG_VX, vy: -C.FRAG_VY_TOP },
      { x: x, y: y + 8, vx: -C.FRAG_VX, vy: -C.FRAG_VY_BOTTOM },
      { x: x + 8, y: y + 8, vx: C.FRAG_VX, vy: -C.FRAG_VY_BOTTOM },
    );
    this.game.addScore(50);
    SMB.Audio.se('break');
  }

  // 毎フレームの演出更新（座標はピクセル、小数あり）
  update(player) {
    const C = SMB.C;
    for (const b of this.bumps) b.t++;
    this.bumps = this.bumps.filter((b) => b.t < C.BUMP_OFFSETS.length);

    for (const k in this.contents) {
      const c = this.contents[k];
      if (c.timer > 0) c.timer--;
    }

    for (const c of this.coins) {
      c.t++; c.y += c.vy; c.vy += C.COIN_POP_G;
      if (c.t === C.COIN_POP_FRAMES) this.popup(c.x, c.y, '200');
    }
    this.coins = this.coins.filter((c) => c.t < C.COIN_POP_FRAMES);

    for (const f of this.fragments) { f.x += f.vx; f.y += f.vy; f.vy += C.FRAG_G; }
    this.fragments = this.fragments.filter((f) => f.y < C.SCREEN_H + 16);

    for (const p of this.popups) { p.t++; p.y -= C.POPUP_RISE; }
    this.popups = this.popups.filter((p) => p.t < C.POPUP_FRAMES);

    // アイテム: 16px を 32f かけてせり上がり、その場で待つ（移動はフェーズ2）
    const FP = C.FP;
    const pl = Math.floor(player.x / FP) + 3, pr = pl + 10;
    const pt = Math.floor(player.y / FP) + (player.crouching ? player.h - 12 : 4), pb = Math.floor(player.y / FP) + player.h;
    const camPx = this.game.cam.px;
    for (const it of this.items) {
      it.t++;
      if (it.t <= C.ITEM_EMERGE_FRAMES) { it.y = it.baseY - 16 * it.t / C.ITEM_EMERGE_FRAMES; continue; }
      if (it.t === C.ITEM_EMERGE_FRAMES + 1) { it.vx = it.type === 'flower' ? 0 : C.ITEM_SPEED; it.vy = 0; it.baseY = Infinity; }
      if (it.type !== 'flower' || it.vy) this.moveItem(it);
      if (pr > it.x + 2 && pl < it.x + 14 && pb > it.y + 2 && pt < it.y + 16) {
        it.taken = true;
        this.game.collectItem(it);
      }
      if (it.y > C.SCREEN_H || it.x < camPx - 64) it.taken = true;   // 画面外で消滅（得点なし）
    }
    this.items = this.items.filter((it) => !it.taken);
  }

  // アイテムの簡易移動（仕様書 3.4: 1px/f で横移動、重力あり、壁で反転、崖から落ちる。スターは跳ねる）
  moveItem(it) {
    const C = SMB.C, L = this.level;
    it.x += it.vx;
    const front = it.vx > 0 ? it.x + 15 : it.x;
    if (L.isSolidPx(front, it.y + 8)) { it.x -= it.vx; it.vx = -it.vx; }
    it.vy = Math.min(it.vy + C.ITEM_G, C.ITEM_FALL_MAX);
    it.y += it.vy;
    if (it.vy >= 0 && (L.isSolidPx(it.x + 3, it.y + 16) || L.isSolidPx(it.x + 12, it.y + 16))) {
      it.y = Math.floor((it.y + 16) / 16) * 16 - 16;
      it.vy = it.type === 'star' ? -C.STAR_BOUNCE_VY : 0;
    }
  }

  // 叩かれたブロックの上にいるアイテムを跳ねさせ、マリオから遠い側へ向ける（仕様書 3.4）
  bumpItems(col, row, fromX) {
    const T = SMB.C.TILE, top = row * T, l = col * T;
    for (const it of this.items) {
      if (it.t <= SMB.C.ITEM_EMERGE_FRAMES) continue;
      if (Math.abs(it.y + 16 - top) <= 2 && it.x + 14 > l && it.x + 2 < l + T) {
        it.vy = -SMB.C.ITEM_BUMP_VY;
        if (it.type !== 'flower') it.vx = (it.x + 8 >= fromX ? 1 : -1) * SMB.C.ITEM_SPEED;
      }
    }
  }

  popup(x, y, text) { this.popups.push({ x, y, text, t: 0 }); }

  bumpOffsetAt(col, row) {
    const b = this.bumps.find((q) => q.col === col && q.row === row);
    return b ? SMB.C.BUMP_OFFSETS[b.t] : null;
  }
};
