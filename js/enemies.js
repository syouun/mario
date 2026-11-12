// =====================================================================
// enemies.js — 敵キャラクター（仕様書 3.1 / 3.2）。
//   クリボー / 緑ノコノコ / 赤ノコノコ と、ノコノコの甲羅。
//   トゲゾー / パイポ（トゲゾーの卵）/ ジュゲム（4-1）。
//   座標・速度は固定小数点（1px = FP）。x, y はスプライト左上。
//
// 状態:
//   walk          歩行（壁で反転、崖は ENEMY_DEFS[type].edge に従う）
//   squashed      クリボーが踏まれて潰れた（30f 後に消える）
//   shell         止まっている甲羅（一定時間で復活）
//   shell_moving  蹴られて滑る甲羅（壁で反転、崖から落ちる、他の敵を倒す）
//   flipped       ひっくり返って画面下へ落ちていく（甲羅・突き上げで倒された）
//   egg           パイポ: 投げ上げられて落ちてくる。着地するとトゲゾー（walk）になる
// =====================================================================
window.SMB = window.SMB || {};

// 敵の種類ごとの既定値（仕様書 3.2）。edge: 崖で "fall"（落ちる）/ "turn"（折り返す）
// hit: 当たり判定の矩形 [左からの距離, 上からの距離, 幅, 高さ]（px）
SMB.ENEMY_DEFS = {
  goomba:      { h: 16, hit: [2, 4, 12, 12], speed: 0x0800, edge: 'fall', shellable: false, bumpScore: 100, fireScore: 100 },
  koopa_green: { h: 24, hit: [2, 12, 12, 12], speed: 0x0800, edge: 'fall', shellable: true, bumpScore: 200, fireScore: 200 },
  koopa_red:   { h: 24, hit: [2, 12, 12, 12], speed: 0x0800, edge: 'turn', shellable: true, bumpScore: 200, fireScore: 200 },
};
SMB.SHELL_HIT = [2, 4, 12, 12];
// パックンフラワー（踏めない。土管の左列を col、土管の上端の行を row に配置する）
SMB.ENEMY_DEFS.piranha = { h: 24, hit: [3, 6, 10, 18], stompable: false, piranha: true, bumpScore: 0, fireScore: 200 };
// トゲゾー（踏めない。ファイア・甲羅・突き上げ・スター）と、ジュゲムが投げるパイポ（トゲゾーの卵）
SMB.ENEMY_DEFS.spiny     = { h: 16, hit: [2, 4, 12, 12], speed: 0x0800, edge: 'fall', shellable: false, stompable: false, bumpScore: 200, fireScore: 200 };
SMB.ENEMY_DEFS.spiny_egg = { h: 16, hit: [3, 6, 10, 10], stompable: false, egg: true, bumpScore: 200, fireScore: 200 };
// 8-1: パタパタ（羽のある緑ノコノコ。跳ねながら進み、踏むと羽が取れて普通の緑ノコノコになる）
SMB.ENEMY_DEFS.koopa_para = { h: 24, hit: [2, 12, 12, 12], speed: 0x0800, edge: 'fall', shellable: true, para: true, bumpScore: 200, fireScore: 200 };
// 8-1: メット（踏むと甲羅になる。ファイアボールが効かない）
SMB.ENEMY_DEFS.buzzy = { h: 16, hit: [2, 4, 12, 12], speed: 0x0800, edge: 'fall', shellable: true, fireproof: true, bumpScore: 200, fireScore: 0 };
// 8-2: 飛ぶパタパタ（羽ばたいて左へ進みながら上下にゆれる。踏むと羽が取れて落ちる）
SMB.ENEMY_DEFS.koopa_fly = { h: 24, hit: [2, 12, 12, 12], speed: 0x0800, edge: 'fall', shellable: true, para: true, fly: true, bumpScore: 200, fireScore: 200 };
// 8-2: 砲台の弾（まっすぐ飛ぶ。踏める／ファイア・スターで倒せる）
SMB.ENEMY_DEFS.rocket = { h: 16, hit: [1, 3, 14, 10], flying: true, shellable: false, bumpScore: 0, fireScore: 200 };
// 8-3: ハンマーを投げる戦士（踏む・ファイア・スターで倒せる。1000 点）と、そのハンマー
SMB.ENEMY_DEFS.hammer_bro = { h: 24, hit: [2, 6, 12, 18], speed: 0x0800, edge: 'turn', shellable: false, bro: true, killScore: 1000, bumpScore: 1000, fireScore: 1000 };
SMB.ENEMY_DEFS.hammer = { h: 16, hit: [3, 3, 10, 10], flying: true, stompable: false, fireproof: true, shellable: false, bumpScore: 0, fireScore: 0 };
// 8-4: 水中のイカ（踏めない。ファイア・スターで倒せる）/ 溶岩から跳ぶ火の玉（倒せない）/ ファイアバー（回転する火の玉の棒。倒せない）
SMB.ENEMY_DEFS.squid    = { h: 24, hit: [2, 3, 12, 17], flying: true, stompable: false, shellable: false, bumpScore: 0, fireScore: 200 };
SMB.ENEMY_DEFS.podoboo  = { h: 16, hit: [3, 3, 10, 10], flying: true, stompable: false, fireproof: true, shellable: false, bumpScore: 0, fireScore: 0 };
SMB.ENEMY_DEFS.firebar  = { h: 8, hit: [0, 0, 8, 8], flying: true, stompable: false, fireproof: true, hazard: true, shellable: false, bumpScore: 0, fireScore: 0 };
// 8-4: 大魔王クッパ（橋の上で前後ステップ・ジャンプ・火炎・無数のハンマー）と、口から吐く火炎
SMB.ENEMY_DEFS.bowser      = { h: 32, w: 32, hit: [4, 4, 24, 28], stompable: false, shellable: false, boss: true, killScore: 5000, bumpScore: 0, fireScore: 5000 };
SMB.ENEMY_DEFS.bowser_fire = { h: 8, w: 24, hit: [2, 1, 20, 6], flying: true, stompable: false, fireproof: true, hazard: true, shellable: false, bumpScore: 0, fireScore: 0 };
// ジュゲム（雲に乗って画面上部を飛ぶ。踏める／ファイア・スターで倒せる）
SMB.ENEMY_DEFS.lakitu    = { h: 24, hit: [2, 4, 12, 16], flying: true, shellable: false, bumpScore: 0, fireScore: 200 };
// 2-2・7-2・8-4: 水中のプクプク（赤＝速い、灰＝遅い。水中では踏めない。ファイア・スターで 200 点）
SMB.ENEMY_DEFS.cheep_red  = { h: 16, hit: [2, 3, 12, 11], flying: true, stompable: false, shellable: false, bumpScore: 0, fireScore: 200 };
SMB.ENEMY_DEFS.cheep_grey = { h: 16, hit: [2, 3, 12, 11], flying: true, stompable: false, shellable: false, bumpScore: 0, fireScore: 200 };
// 2-3・7-3: 橋の下から放物線を描いて飛び跳ねる赤プクプク（踏める・ファイア・スターで 200 点）
SMB.ENEMY_DEFS.cheep_fly  = { h: 16, hit: [2, 2, 12, 12], flying: true, stompable: true, shellable: false, killScore: 200, bumpScore: 200, fireScore: 200 };

SMB.Enemy = class {
  constructor(type, col, row, placed) {
    const C = SMB.C, FP = C.FP;
    this.type = type;
    this.def = SMB.ENEMY_DEFS[type];
    this.placed = placed || {};
    this.h = this.def.h;
    this.x = Math.round(col * C.TILE) * FP;
    this.y = ((row + 1) * C.TILE - this.h) * FP;   // 足元を配置行の下端に合わせる
    this.dir = -1;                                  // 出現時は左（マリオ側）へ
    this.vy = 0;
    this.onGround = false;
    this.state = 'walk';
    this.timer = 0;
    this.kickGrace = 0;      // 蹴った直後はマリオに当たらない
    this.killChain = 0;      // 甲羅で倒した数（得点の連鎖）
    this.removed = false;
    this.flyBase = this.y;                          // 飛ぶ敵の基準の高さ
    this.flyT = 0;
  }

  get alive() { return this.state === 'walk' || this.state === 'shell' || this.state === 'shell_moving' || this.state === 'egg'; }
  get isShell() { return this.state === 'shell' || this.state === 'shell_moving'; }

  // 当たり判定（ピクセル）
  get box() {
    const FP = SMB.C.FP;
    const hb = this.isShell ? SMB.SHELL_HIT : this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }

  // 崖の挙動: 配置データの指定 > ゲーム全体の上書き設定 > 種類ごとの既定値（仕様書 3.2）
  edgeBehavior() {
    const D = SMB.Debug && SMB.Debug.state;
    const override = D && D.edgeOverride !== undefined ? D.edgeOverride : SMB.C.ENEMY_EDGE_OVERRIDE;
    return this.placed.edge || override || this.def.edge;
  }

  update(level, player, mgr) {
    const C = SMB.C;
    if (this.kickGrace > 0) this.kickGrace--;
    switch (this.state) {
      case 'egg':                                     // パイポ: 放物線で落ち、着地したらトゲゾーになる
        this.x += this.vx;
        this.fall(level);
        if (this.onGround) this.hatch(player);
        break;
      case 'walk': {
        if (this.def.bro) { this.updateBro(level, player, mgr); break; }
        if (this.def.fly) {                           // 飛ぶパタパタ: 左へ進みながら上下にゆれる
          this.x += this.dir * C.FLY_SPEED;
          this.flyT++;
          this.y = this.flyBase + Math.sin(this.flyT * 2 * Math.PI / C.FLY_PERIOD) * C.FLY_AMP * C.FP;
          break;
        }
        if (this.def.para && this.onGround) { this.vy = -C.PARA_JUMP_VY; this.onGround = false; }   // パタパタは着地するたびに跳ねる
        if (this.onGround && this.edgeBehavior() === 'turn' && this.edgeAhead(level)) this.dir = -this.dir;
        this.moveX(level, this.def.speed);
        this.fall(level);
        break;
      }
      case 'shell':
        this.fall(level);
        if (--this.timer <= 0) this.revive();
        break;
      case 'shell_moving':
        this.moveX(level, C.SHELL_SPEED);
        this.fall(level);
        break;
      case 'squashed':
        if (--this.timer <= 0) this.removed = true;
        break;
      case 'flipped':
        this.x += this.vx;
        this.vy = Math.min(this.vy + C.ENEMY_GRAVITY, C.ENEMY_FALL_MAX);
        this.y += this.vy;
        break;
    }
    if (this.y > C.SCREEN_H * C.FP) this.removed = true;   // 画面下に落ちたら消滅（得点なし）
  }

  // ハンマーを投げる戦士: 出現位置の近くを行ったり来たりし、マリオの方を向いて、腕を上げてからハンマーを投げる。ときどき跳ねる
  updateBro(level, player, mgr) {
    const C = SMB.C, FP = C.FP;
    if (this.homeX === undefined) { this.homeX = this.x; this.patrolDir = 1; this.patrolT = 0; this.jumpT = (this.placed.col * 7) % 60; this.throwT = 50 + (this.placed.col * 13) % 40; }
    this.dir = player.x < this.x ? -1 : 1;
    if (this.onGround) {
      const pd = this.patrolDir, nx = this.x + pd * C.BRO_SPEED;
      const b = this.box, probeX = pd > 0 ? b.r + 1 : b.l - 1;
      const noFloor = !level.isSolidPx(probeX, this.y / FP + this.h + 1);
      const wall = level.isSolidPx(pd > 0 ? b.r + 1 : b.l - 1, this.y / FP + this.h - 8);
      if (Math.abs(nx - this.homeX) > C.BRO_RANGE * FP || noFloor || wall) this.patrolDir = -pd;
      else this.x = nx;
      if (++this.jumpT >= C.BRO_JUMP_FRAMES && !level.isSolidPx(this.x / FP + 8, this.y / FP - 40)) { this.vy = -C.BRO_JUMP_VY; this.onGround = false; this.jumpT = 0; }
    }
    this.fall(level);
    this.armUp = this.throwT <= C.BRO_ARM_FRAMES;
    if (--this.throwT <= 0) {
      if (mgr) mgr.throwHammer(this, player);
      this.throwT = C.BRO_THROW_FRAMES;
    }
  }

  // 足元の前方 1px 先に床がなければ「崖」
  edgeAhead(level) {
    const FP = SMB.C.FP, b = this.box;
    const probeX = this.dir > 0 ? b.r + 1 : b.l - 1;
    return !level.isSolidPx(probeX, this.y / FP + this.h + 1);
  }

  moveX(level, speed) {
    const FP = SMB.C.FP;
    const dx = this.dir * speed;
    this.x += dx;
    const px = this.x / FP, py = this.y / FP + this.h - 8;
    const front = this.dir > 0 ? px + 15 : px;
    if (level.isSolidPx(front, py)) {
      this.x -= dx;
      this.dir = -this.dir;
    }
  }

  fall(level) {
    const C = SMB.C, FP = C.FP;
    this.vy = Math.min(this.vy + C.ENEMY_GRAVITY, C.ENEMY_FALL_MAX);
    this.y += this.vy;
    const px = this.x / FP, fy = this.y / FP + this.h;
    if (this.vy >= 0 && (level.isSolidPx(px + 3, fy) || level.isSolidPx(px + 12, fy))) {
      this.y = (Math.floor(fy / C.TILE) * C.TILE - this.h) * FP;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  // ---- 状態変化 ----
  // パタパタが踏まれた: 羽が取れて普通の緑ノコノコとして歩く
  loseWings() {
    this.type = 'koopa_green';
    this.def = SMB.ENEMY_DEFS.koopa_green;
    this.vy = 0;
  }

  // パイポがかえってトゲゾーになる。マリオのいる方へ歩き出す
  hatch(player) {
    this.type = 'spiny';
    this.def = SMB.ENEMY_DEFS.spiny;
    this.h = this.def.h;
    this.state = 'walk';
    const pc = player ? player.x / SMB.C.FP + 8 : 0;
    this.dir = pc < this.x / SMB.C.FP + 8 ? -1 : 1;
  }

  toShell() {
    const C = SMB.C;
    if (!this.isShell) this.y += (this.h - 16) * C.FP;  // 足元を保って 16px の甲羅へ
    this.h = 16;
    this.state = 'shell';
    this.timer = C.SHELL_REVIVE_FRAMES;
  }

  kick(dir) {
    this.state = 'shell_moving';
    this.dir = dir;
    this.kickGrace = SMB.C.SHELL_KICK_GRACE;
    this.killChain = 0;
  }

  revive() {
    const C = SMB.C;
    this.y -= (this.def.h - 16) * C.FP;
    this.h = this.def.h;
    this.state = 'walk';
    this.dir = -1;
  }

  squash() {
    if (this.def.bro) { this.flip(this.dir); return; }   // ハンマーの戦士は踏まれると倒れて落ちる
    this.state = 'squashed';
    this.timer = SMB.C.SQUASH_FRAMES;
  }

  // 甲羅・突き上げ・ファイアで倒されたとき: 上に弾んでから画面下へ
  flip(dir) {
    const C = SMB.C;
    this.state = 'flipped';
    this.vx = (dir || 1) * C.FLIP_VX;
    this.vy = -C.FLIP_VY;
  }

  // 甲羅が震える（復活が近い）
  get shaking() { return this.state === 'shell' && this.timer < SMB.C.SHELL_SHAKE_FRAMES; }
};

// ---------------------------------------------------------------------
// 出現・消滅（仕様書 3.1）
// ---------------------------------------------------------------------
SMB.EnemyManager = class {
  constructor(game, level) {
    this.game = game;
    this.level = level;
    this.list = [];
    // 配置データを左から順に並べ、未出現のものを順に見る
    this.cannons = level.objects.filter((o) => o.type === 'cannon').map((o, i) => ({ o, timer: 40 + (i * 37) % 60 }));
    this.cheepZones = level.objects.filter((o) => o.type === 'cheep_zone');
    this.cheepTimer = 30;
    this.cheepSeq = 0;
    this.bulletZones = level.objects.filter((o) => o.type === 'bullet_zone');
    this.bulletZoneTimer = 70;
    this.bulletSeq = 0;
    this.pending = level.objects
      .filter((o) => SMB.ENEMY_DEFS[o.type])
      .map((o) => ({ o }))
      .sort((a, b) => spawnKey(a.o) - spawnKey(b.o));
  }

  spawn(camPx) {
    const C = SMB.C;
    const limit = camPx + C.SCREEN_W + C.TILE;          // 画面右端の 1 タイル先
    while (this.pending.length && spawnKey(this.pending[0].o) <= limit) {
      const nextType = this.pending[0].o.type;
      if (this.list.filter((e) => !e.removed && !e.def.hazard).length >= C.MAX_ENEMIES && nextType !== 'firebar' && nextType !== 'bowser') break;   // 満席なら保留（ファイアバー・ボスは枠に数えない）
      const { o } = this.pending.shift();
      if ((o.col + 1) * C.TILE + (o.type === 'firebar' ? 56 : o.type === 'bowser' ? 96 : 0) < camPx) continue;      // 既に画面左に過ぎた配置は出さない
      if (o.type === 'firebar') { this.list.push(new SMB.Firebar(o)); continue; }
      if (o.type === 'bowser') { this.list.push(new SMB.Bowser(o)); continue; }
      if (o.type === 'squid') { this.list.push(new SMB.Squid(o)); continue; }
      if (o.type === 'cheep_red' || o.type === 'cheep_grey') { this.list.push(new SMB.CheepSwim(o)); continue; }
      if (o.type === 'podoboo') { this.list.push(new SMB.Podoboo(o)); continue; }
      if (o.type === 'lakitu') { this.lakituPlaced = o; this.list.push(new SMB.Lakitu(o)); continue; }
      this.list.push(o.type === 'piranha' ? new SMB.Piranha(o) : new SMB.Enemy(o.type, o.col, o.row, o));
    }
  }

  update() {
    for (const e of this.list) e.update(this.level, this.game.player, this);
    this.collideEnemies();
    this.despawn();
    this.updateLakitu();
    this.updateCannons();
    this.updateCheepZones();
    this.updateBulletZones();
  }

  // 5-3・6-3: bullet_zone の範囲内にマリオがいる間、画面右端から水平に砲台の弾（キラー）が飛来する
  updateBulletZones() {
    if (!this.bulletZones.length) return;
    const C = SMB.C, FP = C.FP, p = this.game.player;
    const px = p.x / FP + 8;
    const inZone = this.bulletZones.some((z) => px >= z.colStart * C.TILE && px <= z.colEnd * C.TILE);
    if (!inZone) return;
    if (--this.bulletZoneTimer > 0) return;
    this.bulletZoneTimer = 92 + ((this.bulletSeq * 19) % 28);
    if (this.count((e) => e.type === 'rocket') >= C.BULLET_MAX) return;
    const idx = this.bulletSeq++;
    const py = Math.max(40, Math.min(168, Math.round(p.y / FP) + ((idx % 3) - 1) * 16));
    this.list.push(new SMB.Rocket(this.game.cam.px + C.SCREEN_W + 8, py, -1));
    SMB.Audio.se('cannon');
  }

  // 2-3・7-3: cheep_zone の範囲内にマリオがいる間、画面下端から放物線で飛び跳ねる赤プクプクを定期出現させる
  updateCheepZones() {
    if (!this.cheepZones.length) return;
    const C = SMB.C, FP = C.FP, p = this.game.player;
    const px = p.x / FP + 8;
    const inZone = this.cheepZones.some((z) => px >= z.colStart * C.TILE && px <= z.colEnd * C.TILE);
    if (!inZone) return;
    if (--this.cheepTimer > 0) return;
    this.cheepTimer = C.CHEEP_SPAWN_FRAMES + ((this.cheepSeq * 11) % 18);
    if (this.count((e) => e.type === 'cheep_fly') >= 3) return;
    const camPx = this.game.cam.px;
    const idx = this.cheepSeq++;
    const offsets = [-32, 16, 64, -16, 48, 96];
    const spawnX = Math.max(camPx + 16, Math.min(camPx + C.SCREEN_W - 24, px + offsets[idx % offsets.length]));
    const dir = (idx % 3 === 0 && p.vx >= 0) ? 1 : (spawnX > px + 24 ? -1 : 1);
    const vx = dir * (C.CHEEP_FLY_VX + ((idx % 3) * 0x00300));
    const vy = -(C.CHEEP_FLY_VY + ((idx % 2) * 0x00400));
    this.list.push(new SMB.CheepFly(spawnX, C.SCREEN_H - 8, vx, vy, dir));
  }

  // ハンマーを投げる（画面内にいる戦士だけ）。マリオのいる側へ、弧を描いて飛ぶ
  throwHammer(bro, player) {
    const C = SMB.C, FP = C.FP, sx = bro.x / FP - this.game.cam.px;
    if (sx < -8 || sx > C.SCREEN_W) return;
    const h = new SMB.Hammer(bro.x / FP + bro.dir * 4, bro.y / FP, bro.dir);
    this.list.push(h);
  }

  // 砲台: 画面内にある間、一定間隔でマリオのいる側へ弾を撃つ（マリオが近すぎるときは撃たない）
  updateCannons() {
    const C = SMB.C, FP = C.FP, camPx = this.game.cam.px, p = this.game.player;
    for (const c of this.cannons) {
      const cx = c.o.col * C.TILE, sx = cx - camPx;
      if (c.timer > 0) c.timer--;
      if (c.timer > 0 || sx < 0 || sx > C.SCREEN_W - C.TILE) continue;
      const pc = p.x / FP + 8;
      if (Math.abs(pc - (cx + 8)) < C.BULLET_NEAR) continue;
      if (this.count((e) => e.type === 'rocket') >= C.BULLET_MAX) continue;
      const dir = pc < cx + 8 ? -1 : 1;
      const b = new SMB.Rocket(cx + dir * 12, c.o.row * C.TILE, dir);
      this.list.push(b);
      SMB.Audio.se('cannon');
      c.timer = C.BULLET_INTERVAL;
    }
  }

  // 生きている敵の数（消滅待ちを除く）
  count(filter) { return this.list.filter((e) => !e.removed && (!filter || filter(e))).length; }

  // ジュゲムの退場と再出現
  //   lakitu_stop の列をマリオが越えたら、以後ジュゲムは左へ去って二度と来ない
  //   倒された（画面から消えた）ら LAKITU_RESPAWN_FRAMES 後に画面右上から次のジュゲムが来る
  updateLakitu() {
    if (!this.lakituPlaced) return;
    const C = SMB.C, p = this.game.player;
    const stop = this.level.objects.find((q) => q.type === 'lakitu_stop');
    if (stop && p.x / C.FP + 8 >= stop.col * C.TILE) this.lakituStopped = true;
    if (this.lakituStopped) return;
    if (this.list.some((e) => e.type === 'lakitu' && !e.removed)) { this.lakituRespawn = C.LAKITU_RESPAWN_FRAMES; return; }
    if (this.lakituRespawn === undefined) this.lakituRespawn = C.LAKITU_RESPAWN_FRAMES;
    if (--this.lakituRespawn > 0) return;
    if (this.count() >= C.MAX_ENEMIES) { this.lakituRespawn = 1; return; }
    this.list.push(new SMB.Lakitu(this.lakituPlaced, (this.game.cam.px + C.SCREEN_W + 8) * C.FP));
    this.lakituRespawn = C.LAKITU_RESPAWN_FRAMES;
  }

  // ジュゲムがパイポを投げる（敵の数に空きがあるときだけ）
  throwEgg(lakitu, player) {
    const C = SMB.C, FP = C.FP;
    if (this.count((e) => e.type !== 'lakitu' && !e.def.piranha) >= C.SPINY_LIMIT || this.count() >= C.MAX_ENEMIES) return false;
    const egg = new SMB.Enemy('spiny_egg', 0, 0, {});
    egg.x = lakitu.x;
    egg.y = lakitu.y - 8 * FP;
    egg.state = 'egg';
    egg.vy = -C.EGG_VY;
    egg.vx = (player.x < lakitu.x ? -1 : 1) * C.EGG_VX;
    this.list.push(egg);
    return true;
  }

  // 敵同士: 歩く敵どうしは向きを変え、滑る甲羅は相手を倒す
  collideEnemies() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j];
        if (!a.alive || !b.alive || a.def.piranha || b.def.piranha || a.def.flying || b.def.flying || !overlap(a.box, b.box)) continue;
        const aMoving = a.state === 'shell_moving', bMoving = b.state === 'shell_moving';
        if (aMoving || bMoving) {
          if (aMoving) this.shellKill(a, b);
          if (bMoving && a.alive) this.shellKill(b, a);
          continue;
        }
        if (a.state === 'egg' || b.state === 'egg') continue;   // 落下中のパイポは素通り
        // 歩く敵・止まった甲羅どうし: 互いに離れる向きへ
        const aLeft = a.x <= b.x;
        if (a.state === 'walk') a.dir = aLeft ? -1 : 1;
        if (b.state === 'walk') b.dir = aLeft ? 1 : -1;
      }
    }
  }

  shellKill(shell, target) {
    const C = SMB.C;
    SMB.Audio.se('kick');
    target.flip(shell.dir);
    const pts = C.SHELL_CHAIN_SCORES[Math.min(shell.killChain, C.SHELL_CHAIN_SCORES.length - 1)];
    shell.killChain++;
    const b = target.box;
    this.game.awardPoints(pts, b.l, b.t - 8);
  }

  despawn() {
    const C = SMB.C, camPx = this.game.cam.px;
    for (const e of this.list) {
      const b = e.homeBox || e.box;
      if (b.r < camPx - C.DESPAWN_LEFT) e.removed = true;
      if (e.state === 'shell_moving' && b.l > camPx + C.SCREEN_W + C.SHELL_DESPAWN_RIGHT) e.removed = true;
    }
    this.list = this.list.filter((e) => !e.removed);
  }

  // ブロックを下から叩かれた: そのタイルの上に立っている敵をひっくり返す（仕様書 1.5）
  bumpKill(col, row, fromX) {
    const T = SMB.C.TILE, tileTop = row * T, l = col * T, r = l + T;
    for (const e of this.list) {
      if (!e.alive || e.def.piranha || e.def.flying) continue;
      const b = e.box, feet = e.y / SMB.C.FP + e.h;
      if (Math.abs(feet - tileTop) <= 2 && b.r > l && b.l < r) {
        e.flip(b.l + 6 >= fromX ? 1 : -1);
        SMB.Audio.se('kick');
        this.game.awardPoints(e.def.bumpScore, b.l, b.t - 8);
      }
    }
  }
};

// ---------------------------------------------------------------------
// パックンフラワー（仕様書 3.2）
//   土管の中で待機 → 24f かけて 24px せり上がる → 60f 出たまま → 24f で引っ込む → 待機 60f
//   待機が終わる時点でマリオの中心が土管の中心から ±24px 以内なら、出てこずに待ち直す
//   踏めない（触れると被弾）。当たり判定は土管の口より上に出ている部分だけ
// ---------------------------------------------------------------------
SMB.Piranha = class {
  constructor(placed) {
    const C = SMB.C, FP = C.FP;
    this.type = 'piranha';
    this.def = SMB.ENEMY_DEFS.piranha;
    this.placed = placed;
    this.h = this.def.h;
    this.pipeTop = placed.row * C.TILE;                 // 土管の口の y
    this.centerX = placed.col * C.TILE + C.TILE;        // 土管の中心 x
    this.x = (this.centerX - 8) * FP;
    this.hiddenY = this.pipeTop * FP;
    this.y = this.hiddenY;
    this.state = 'p_wait';
    this.timer = C.PIRANHA_WAIT_FRAMES;
    this.removed = false;
    this.dir = -1;
  }

  get alive() { return this.state.startsWith('p_'); }
  get isShell() { return false; }

  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    const b = Math.min(t + hb[3], this.pipeTop);         // 土管の中に隠れている部分は判定なし
    return { l, t, r: l + hb[2], b: Math.max(t, b) };
  }

  update(level, player) {
    const C = SMB.C, FP = C.FP;
    if (this.state === 'flipped') { this.removed = true; return; }   // 倒された（ファイア等、フェーズ3）
    this.timer--;
    switch (this.state) {
      case 'p_wait':
        if (this.timer <= 0) {
          const pc = player.x / FP + 8;
          if (Math.abs(pc - this.centerX) <= C.PIRANHA_NEAR_PX) this.timer = 1;   // 近くにいる間は出ない
          else { this.state = 'p_rise'; this.timer = C.PIRANHA_MOVE_FRAMES; }
        }
        break;
      case 'p_rise':
        this.y -= (24 / C.PIRANHA_MOVE_FRAMES) * FP;
        if (this.timer <= 0) { this.y = this.hiddenY - 24 * FP; this.state = 'p_up'; this.timer = C.PIRANHA_UP_FRAMES; }
        break;
      case 'p_up':
        if (this.timer <= 0) { this.state = 'p_sink'; this.timer = C.PIRANHA_MOVE_FRAMES; }
        break;
      case 'p_sink':
        this.y += (24 / C.PIRANHA_MOVE_FRAMES) * FP;
        if (this.timer <= 0) { this.y = this.hiddenY; this.state = 'p_wait'; this.timer = C.PIRANHA_WAIT_FRAMES; }
        break;
    }
  }

  flip() { this.state = 'flipped'; }
  get shaking() { return false; }
};

// ---------------------------------------------------------------------
// ジュゲム（4-1）
//   画面上部の一定の高さ（LAKITU_Y）を雲に乗って飛び、マリオの少し先を目指して加減速する。
//   加速度が小さいので行き過ぎては戻り、マリオの上空を左右に揺れる。マリオが走ると先回りする。
//   LAKITU_THROW_FRAMES ごとに手を上げてからパイポを投げ上げる（敵の数に空きがあるとき）。
//   踏む・ファイア・スター・甲羅で倒せる。倒されると落ちていき、しばらくすると次のジュゲムが来る。
// ---------------------------------------------------------------------
SMB.Lakitu = class {
  constructor(placed, xFP) {
    const C = SMB.C, FP = C.FP;
    this.type = 'lakitu';
    this.def = SMB.ENEMY_DEFS.lakitu;
    this.placed = placed;
    this.h = this.def.h;
    this.x = xFP !== undefined ? xFP : placed.col * C.TILE * FP;
    this.y = C.LAKITU_Y * FP;
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.state = 'walk';
    this.throwTimer = C.LAKITU_THROW_FRAMES;
    this.leaving = false;
    this.removed = false;
  }

  get alive() { return this.state === 'walk'; }
  get isShell() { return false; }
  get shaking() { return false; }
  get throwPose() { return this.state === 'walk' && !this.leaving && this.throwTimer <= SMB.C.LAKITU_THROW_POSE; }

  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }

  update(level, player, mgr) {
    const C = SMB.C, FP = C.FP;
    if (this.state === 'flipped') {
      this.x += this.vx;
      this.vy = Math.min(this.vy + C.ENEMY_GRAVITY, C.ENEMY_FALL_MAX);
      this.y += this.vy;
      if (this.y > C.SCREEN_H * FP) this.removed = true;
      return;
    }
    if (mgr && mgr.lakituStopped) this.leaving = true;
    if (this.leaving) {                                  // 退場: 左へ飛び去る（画面外で消える）
      this.vx = Math.max(this.vx - C.LAKITU_ACCEL * 2, -C.LAKITU_LEAVE_SPEED);
      this.x += this.vx;
      this.dir = -1;
      return;
    }
    // マリオの少し先（速度 × LAKITU_LEAD）を目指す
    const target = player.x / FP + 8 + (player.vx / FP) * C.LAKITU_LEAD;
    const dx = target - (this.x / FP + 8);
    const vmax = Math.min(C.LAKITU_MAX_SPEED, Math.max(C.LAKITU_MIN_SPEED, Math.abs(player.vx) + C.LAKITU_SPEED_MARGIN));
    this.vx += Math.sign(dx) * C.LAKITU_ACCEL;
    this.vx = Math.max(-vmax, Math.min(vmax, this.vx));
    this.x += this.vx;
    this.dir = dx < 0 ? -1 : 1;
    // 投げる（画面内にいるときだけ）
    const camPx = mgr ? mgr.game.cam.px : 0, sx = this.x / FP - camPx;
    if (--this.throwTimer <= 0) {
      const onScreen = sx > 0 && sx < C.SCREEN_W - 16;
      if (onScreen && mgr && mgr.throwEgg(this, player)) this.throwTimer = C.LAKITU_THROW_FRAMES;
      else this.throwTimer = C.LAKITU_THROW_FRAMES >> 1;   // 投げられなければ半分の間隔で出直す
    }
  }

  squash() { this.flip(1); }                            // 踏まれたら雲から落ちる
  flip(dir) {
    const C = SMB.C;
    this.state = 'flipped';
    this.vx = (dir || 1) * C.FLIP_VX;
    this.vy = -C.FLIP_VY;
  }
};

// ---------------------------------------------------------------------
// 砲台の弾（8-2）: 発射された向きにまっすぐ飛ぶ。地形は素通り。踏めば落ちる。
// ---------------------------------------------------------------------
SMB.Rocket = class {
  constructor(xPx, yPx, dir) {
    const FP = SMB.C.FP;
    this.type = 'rocket';
    this.def = SMB.ENEMY_DEFS.rocket;
    this.placed = {};
    this.h = this.def.h;
    this.x = xPx * FP;
    this.y = yPx * FP;
    this.vx = 0; this.vy = 0;
    this.dir = dir;
    this.state = 'walk';
    this.removed = false;
  }
  get alive() { return this.state === 'walk'; }
  get isShell() { return false; }
  get shaking() { return false; }
  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }
  update(level, player, mgr) {
    const C = SMB.C;
    if (this.state === 'flipped') {
      this.x += this.vx;
      this.vy = Math.min(this.vy + C.ENEMY_GRAVITY, C.ENEMY_FALL_MAX);
      this.y += this.vy;
      if (this.y > C.SCREEN_H * C.FP) this.removed = true;
      return;
    }
    this.x += this.dir * C.BULLET_SPEED;
    const camPx = mgr ? mgr.game.cam.px : 0, sx = this.x / C.FP - camPx;
    if (sx > C.SCREEN_W + 32 || sx < -48) this.removed = true;
  }
  squash() { this.flip(this.dir); }
  flip(dir) {
    const C = SMB.C;
    this.state = 'flipped';
    this.vx = (dir || 1) * C.FLIP_VX * 0.5;
    this.vy = -C.FLIP_VY * 0.5;
  }
};

// ---------------------------------------------------------------------
// ハンマー（8-3）: 投げ上げられて弧を描いて落ちる。地形は素通り。踏めない・ファイアも効かない（スターでは消える）
// ---------------------------------------------------------------------
SMB.Hammer = class {
  constructor(xPx, yPx, dir) {
    const C = SMB.C, FP = C.FP;
    this.type = 'hammer';
    this.def = SMB.ENEMY_DEFS.hammer;
    this.placed = {};
    this.h = this.def.h;
    this.x = xPx * FP; this.y = yPx * FP;
    this.vx = dir * C.HAMMER_VX; this.vy = -C.HAMMER_VY;
    this.dir = dir;
    this.t = 0;
    this.state = 'walk';
    this.removed = false;
  }
  get alive() { return this.state === 'walk'; }
  get isShell() { return false; }
  get shaking() { return false; }
  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }
  update(level, player, mgr) {
    const C = SMB.C;
    this.t++;
    this.x += this.vx;
    this.vy = Math.min(this.vy + C.ENEMY_GRAVITY, C.ENEMY_FALL_MAX);
    this.y += this.vy;
    if (this.state === 'flipped') this.vx = 0;
    if (this.y > C.SCREEN_H * C.FP) this.removed = true;
  }
  squash() { this.flip(1); }
  flip() { this.state = 'flipped'; this.vy = -SMB.C.FLIP_VY * 0.5; }
};

// 出現の目安の x（ファイアバーは棒の長さ分、大魔王は橋の手前から火炎が飛んでくる分だけ早めに出す）
function spawnKey(o) { return o.col * SMB.C.TILE - (o.type === 'firebar' ? 56 : o.type === 'bowser' ? 96 : 0); }

// ---------------------------------------------------------------------
// ファイアバー（8-4）: 中心のタイルの中心を軸に、火の玉が一列に並んで一定の速さで回る。
//   角度 = 初期角 + 向き × FIREBAR_DEG × 経過フレーム。触れると被弾。踏めない・倒せない。
//   box は中心の 1 玉分（ファイアボールの当たり・消滅判定用）。マリオとの判定は hitsBox で全部の玉を調べる。
// ---------------------------------------------------------------------
SMB.Firebar = class {
  constructor(placed) {
    this.type = 'firebar';
    this.def = SMB.ENEMY_DEFS.firebar;
    this.placed = placed;
    this.h = 8;
    this.cx = placed.col * SMB.C.TILE + 8;
    this.cy = placed.row * SMB.C.TILE + 8;
    this.x = (this.cx - 4) * SMB.C.FP; this.y = (this.cy - 4) * SMB.C.FP;
    this.dirSign = placed.dir === -1 ? -1 : 1;           // 1 = 時計回り（画面上）/ -1 = 反時計回り
    this.angle = placed.angle || 0;                      // 度（0 = 右、90 = 下）
    this.state = 'walk';
    this.removed = false;
    this.dir = -1;
  }
  get alive() { return true; }
  get isShell() { return false; }
  get shaking() { return false; }
  get box() { return { l: this.cx - 4, t: this.cy - 4, r: this.cx + 4, b: this.cy + 4 }; }
  // i 番目の火の玉の中心座標
  dotAt(i) {
    const C = SMB.C, a = this.angle * Math.PI / 180, r = i * C.FIREBAR_STEP;
    return { x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r };
  }
  hitsBox(b) {
    for (let i = 0; i < SMB.C.FIREBAR_DOTS; i++) {
      const d = this.dotAt(i);
      if (d.x + 3 > b.l && d.x - 3 < b.r && d.y + 3 > b.t && d.y - 3 < b.b) return true;   // 6x6 の判定
    }
    return false;
  }
  update() { this.angle = (this.angle + this.dirSign * SMB.C.FIREBAR_DEG) % 360; }
  squash() {} flip() {}
};

// ---------------------------------------------------------------------
// イカ（8-4・水中）: 上に向かってひと泳ぎ（マリオの方へ斜め上）→ ゆっくり沈みながらマリオに寄る、を繰り返す。
//   沈んでいる間にマリオが自分より上にいて、一定時間が過ぎたらまた泳ぐ。壁・床は通り抜けない。
//   踏めない（触れると被弾）。ファイア・スターで倒せる。
// ---------------------------------------------------------------------
SMB.Squid = class {
  constructor(placed) {
    const C = SMB.C, FP = C.FP;
    this.type = 'squid';
    this.def = SMB.ENEMY_DEFS.squid;
    this.placed = placed;
    this.h = this.def.h;
    this.x = placed.col * C.TILE * FP;
    this.y = placed.row * C.TILE * FP;
    this.vx = 0; this.vy = 0;
    this.dir = -1;
    this.state = 'walk';
    this.phase = 'sink';
    this.t = 0;
    this.removed = false;
  }
  get alive() { return this.state === 'walk'; }
  get isShell() { return false; }
  get shaking() { return false; }
  get stroking() { return this.phase === 'rise'; }
  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }
  update(level, player, mgr) {
    const C = SMB.C, FP = C.FP;
    if (this.state === 'flipped') {
      this.x += this.vx;
      this.vy = Math.min(this.vy + C.ENEMY_GRAVITY, C.ENEMY_FALL_MAX);
      this.y += this.vy;
      if (this.y > C.SCREEN_H * FP) this.removed = true;
      return;
    }
    this.t++;
    const pcx = player.x / FP + 8, pcy = player.y / FP + player.h / 2;
    const cx = this.x / FP + 8, cy = this.y / FP + 12;
    const toward = pcx < cx ? -1 : 1;
    if (this.phase === 'rise') {
      this.dir = toward;
      this.vx = toward * C.SQUID_RISE_VX; this.vy = -C.SQUID_RISE_VY;
      if (this.t >= C.SQUID_RISE_FRAMES) { this.phase = 'sink'; this.t = 0; }
    } else {
      this.vx = Math.abs(pcx - cx) > 6 ? toward * C.SQUID_SINK_VX : 0;
      this.vy = C.SQUID_SINK_VY;
      if (Math.abs(pcx - cx) > 6) this.dir = toward;
      if (this.t >= C.SQUID_SINK_MIN && pcy < cy - 10) { this.phase = 'rise'; this.t = 0; }
    }
    // 壁・床・天井（体の四隅の少し内側で判定）
    const nx = this.x + this.vx, ny = this.y + this.vy;
    const solid = (x, y) => level.isSolidPx(x, y);
    const blockedX = (px) => { const l = px / FP + 2, r = px / FP + 14, t = this.y / FP + 2, b = this.y / FP + 21; return solid(l, t) || solid(r, t) || solid(l, b) || solid(r, b); };
    const blockedY = (py) => { const l = this.x / FP + 2, r = this.x / FP + 14, t = py / FP + 2, b = py / FP + 22; return solid(l, t) || solid(r, t) || solid(l, b) || solid(r, b); };
    if (!blockedX(nx)) this.x = nx;
    if (!blockedY(ny)) this.y = ny;
  }
  squash() { this.flip(1); }
  flip(dir) {
    const C = SMB.C;
    this.state = 'flipped';
    this.vx = (dir || 1) * C.FLIP_VX * 0.5;
    this.vy = -C.FLIP_VY * 0.5;
  }
};

// ---------------------------------------------------------------------
// 溶岩の火の玉（8-4）: 溶岩の中で待ち、一定間隔で真上へ跳び上がって落ちる。倒せない。
//   placed.col/row は溶岩の表面の行（row = 13）。画面下端より下に隠れている間は判定・描画なし。
// ---------------------------------------------------------------------
SMB.Podoboo = class {
  constructor(placed) {
    const C = SMB.C, FP = C.FP;
    this.type = 'podoboo';
    this.def = SMB.ENEMY_DEFS.podoboo;
    this.placed = placed;
    this.h = 16;
    this.baseY = (placed.row * C.TILE + 8) * FP;         // 溶岩の中（表面より少し下）
    this.x = placed.col * C.TILE * FP;
    this.y = this.baseY;
    this.vy = 0;
    this.state = 'walk';
    this.dir = -1;
    this.timer = C.PODOBOO_WAIT + ((placed.col * 11) % 40);
    this.jumping = false;
    this.removed = false;
  }
  get alive() { return this.state === 'walk'; }
  get isShell() { return false; }
  get shaking() { return false; }
  get visible() { return this.jumping && this.y < this.baseY - 16 * SMB.C.FP; }
  get homeBox() { const l = this.x / SMB.C.FP; return { l, t: 0, r: l + 16, b: 16 }; }
  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    if (!this.visible) return { l: -9999, t: -9999, r: -9999, b: -9999 };
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }
  update(level, player, mgr) {
    const C = SMB.C;
    if (this.state === 'flipped') { this.removed = true; return; }
    if (!this.jumping) {
      if (--this.timer <= 0) { this.jumping = true; this.vy = -C.PODOBOO_VY; }
      return;
    }
    this.vy += C.PODOBOO_G;
    this.y += this.vy;
    if (this.y >= this.baseY && this.vy > 0) { this.y = this.baseY; this.jumping = false; this.timer = C.PODOBOO_WAIT; }
  }
  squash() {} flip() {}
};

// ---------------------------------------------------------------------
// 大魔王クッパ（8-4 のボス）
//   ・橋の上で前後ステップしながらジャンプを繰り返す（ジャンプの下をくぐり抜けて斧へ走れる）
//   ・口を開けて予告したあと、水平に流れる火炎（BowserFire）を吐く
//   ・山なりの軌道で無数のハンマー（Hammer）を連投する
//   ・撃破方法: (1) 橋の右端の斧に触れて橋を落とす / (2) ファイアボールを BOWSER_HP 発当てて 5000 点
// ---------------------------------------------------------------------
SMB.Bowser = class {
  constructor(placed) {
    const C = SMB.C, FP = C.FP;
    this.type = 'bowser';
    this.def = SMB.ENEMY_DEFS.bowser;
    this.placed = placed;
    this.w = 32;
    this.h = 32;
    this.x = placed.col * C.TILE * FP;
    this.y = ((placed.row + 1) * C.TILE - 32) * FP;
    this.homeX = this.x;
    this.minX = ((placed.minCol != null ? placed.minCol : placed.col - 6) * C.TILE) * FP;
    this.maxX = ((placed.maxCol != null ? placed.maxCol : placed.col + 3) * C.TILE) * FP;
    this.useHammers = placed.hammers !== undefined ? !!placed.hammers : !placed.disguise;
    this.disguiseType = null;
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.patrolDir = -1;
    this.stepT = C.BOWSER_STEP_FRAMES;
    this.jumpT = 48;
    this.fireT = 36;
    this.fireCount = 0;
    this.volleyT = 70;
    this.volleyLeft = 0;
    this.hammerDelay = 0;
    this.mouthOpen = false;
    this.armUp = false;
    this.hp = C.BOWSER_HP;
    this.hurtTimer = 0;
    this.t = 0;
    this.onGround = true;
    this.state = 'walk';
    this.removed = false;
  }
  get alive() { return this.state === 'walk'; }
  get isShell() { return false; }
  get shaking() { return false; }
  get homeBox() { const l = this.x / SMB.C.FP; return { l, t: 0, r: l + 32, b: 32 }; }
  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }
  update(level, player, mgr) {
    const C = SMB.C, FP = C.FP;
    this.t++;
    if (this.hurtTimer > 0) this.hurtTimer--;
    if (this.state === 'flipped') {
      this.x += this.vx;
      this.vy = Math.min(this.vy + C.ENEMY_GRAVITY, C.ENEMY_FALL_MAX);
      this.y += this.vy;
      if (this.y > C.SCREEN_H * FP) this.removed = true;
      return;
    }
    this.dir = player.x + 8 * FP < this.x + 16 * FP ? -1 : 1;

    // 橋の上で前後にステップ移動
    this.x += this.patrolDir * C.BOWSER_SPEED;
    const lo = Math.max(this.minX, this.homeX - C.BOWSER_RANGE * FP);
    const hi = Math.min(this.maxX, this.homeX + C.BOWSER_RANGE * FP);
    if (this.x <= lo) { this.x = lo; this.patrolDir = 1; this.stepT = C.BOWSER_STEP_FRAMES; }
    else if (this.x >= hi) { this.x = hi; this.patrolDir = -1; this.stepT = C.BOWSER_STEP_FRAMES; }
    else if (--this.stepT <= 0) {
      this.patrolDir = -this.patrolDir;
      this.stepT = C.BOWSER_STEP_FRAMES + ((this.t * 13) % 32);
    }

    // 定期的な大ジャンプ（マリオが下をくぐり抜けられる高さと滞空時間）
    if (this.onGround && --this.jumpT <= 0) {
      this.vy = -C.BOWSER_JUMP_VY;
      this.onGround = false;
      this.jumpT = C.BOWSER_JUMP_FRAMES + ((this.t * 7) % 24);
    }
    this.vy = Math.min(this.vy + C.BOWSER_GRAVITY, C.ENEMY_FALL_MAX);
    this.y += this.vy;
    const px = this.x / FP, fy = this.y / FP + this.h;
    if (this.vy >= 0 && (level.isSolidPx(px + 6, fy) || level.isSolidPx(px + 16, fy) || level.isSolidPx(px + 26, fy))) {
      this.y = (Math.floor(fy / C.TILE) * C.TILE - this.h) * FP;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // 口から吐く火炎（橋の手前に近づいたときから撃つ）
    const distPx = Math.abs((this.x - player.x) / FP);
    this.mouthOpen = this.fireT <= C.BOWSER_MOUTH_FRAMES && distPx < 248;
    if (--this.fireT <= 0) {
      if (mgr && distPx < 248) {
        const targets = [148, 128, 160];
        const targetY = targets[(this.fireCount++) % targets.length];
        const fx = this.dir < 0 ? px - 18 : px + 26;
        mgr.list.push(new SMB.BowserFire(fx, this.y / FP + 10, targetY, this.dir));
        SMB.Audio.se('bowser_fire');
      }
      this.fireT = C.BOWSER_FIRE_FRAMES;
    }

    // 山なりの無数のハンマー連投（6-4〜8-4 または hammers: true のとき、画面内〜画面端近くで連投）
    const sx = px - (mgr ? mgr.game.cam.px : 0);
    if (this.useHammers && sx < C.SCREEN_W + 16 && sx > -32) {
      if (this.volleyLeft > 0) {
        this.armUp = this.hammerDelay <= 3;
        if (--this.hammerDelay <= 0) {
          if (mgr) {
            const idx = C.BOWSER_VOLLEY_COUNT - this.volleyLeft;
            const h = new SMB.Hammer(px + (this.dir < 0 ? 2 : 14), this.y / FP - 4, this.dir);
            h.vx = this.dir * (C.HAMMER_VX + ((idx % 3) - 1) * 0x00240);
            h.vy = -(C.HAMMER_VY + (idx % 2) * 0x00480);
            mgr.list.push(h);
          }
          this.volleyLeft--;
          this.hammerDelay = C.BOWSER_HAMMER_INTERVAL;
        }
      } else {
        this.armUp = false;
        if (--this.volleyT <= 0) {
          this.volleyLeft = C.BOWSER_VOLLEY_COUNT;
          this.hammerDelay = 1;
          this.volleyT = C.BOWSER_VOLLEY_FRAMES;
        }
      }
    }
  }
  onFireballHit(fb, game) {
    this.hp--;
    this.hurtTimer = 8;
    if (this.hp > 0) {
      SMB.Audio.se('bump');
    } else {
      if (this.placed && this.placed.disguise) {
        this.disguiseType = this.placed.disguise;
      }
      this.flip(Math.sign(fb.vx));
      SMB.Audio.se('bowser_fall');
      const b = this.box;
      game.awardPoints(this.def.fireScore, b.l + 4, b.t - 8);
    }
  }
  squash() {}
  flip(dir) {
    const C = SMB.C;
    this.state = 'flipped';
    this.vx = (dir || 1) * C.FLIP_VX * 0.5;
    this.vy = -C.FLIP_VY * 0.6;
  }
};

// ---------------------------------------------------------------------
// クッパが口から吐く火炎（24×8 px）
//   発射された向きへ水平に飛びながら、狙いの高さ（targetY）へ滑らかに寄る。地形は素通り。
// ---------------------------------------------------------------------
SMB.BowserFire = class {
  constructor(xPx, yPx, targetYPx, dir) {
    const FP = SMB.C.FP;
    this.type = 'bowser_fire';
    this.def = SMB.ENEMY_DEFS.bowser_fire;
    this.placed = {};
    this.w = 24;
    this.h = 8;
    this.x = xPx * FP;
    this.y = yPx * FP;
    this.targetY = targetYPx * FP;
    this.dir = dir;
    this.t = 0;
    this.state = 'walk';
    this.removed = false;
  }
  get alive() { return true; }
  get isShell() { return false; }
  get shaking() { return false; }
  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }
  update(level, player, mgr) {
    const C = SMB.C, FP = C.FP;
    this.t++;
    this.x += this.dir * C.BOWSER_FIRE_VX;
    if (this.y < this.targetY) this.y = Math.min(this.targetY, this.y + C.BOWSER_FIRE_VY);
    else if (this.y > this.targetY) this.y = Math.max(this.targetY, this.y - C.BOWSER_FIRE_VY);
    const camPx = mgr ? mgr.game.cam.px : 0, sx = this.x / FP - camPx;
    if (sx < -40 || sx > C.SCREEN_W + 64) this.removed = true;
  }
  squash() {} flip() {}
};

// ---------------------------------------------------------------------
// 水中のプクプク（2-2・7-2・8-4）
//   赤（cheep_red）は速く、灰（cheep_grey）はゆっくり左へ泳ぎ、わずかに上下へ揺れる。
//   水中では踏めない（触れると被弾）。ファイア・スターで倒せる（200 点）。
// ---------------------------------------------------------------------
SMB.CheepSwim = class {
  constructor(placed) {
    const C = SMB.C, FP = C.FP;
    this.type = placed.type;
    this.def = SMB.ENEMY_DEFS[placed.type];
    this.placed = placed;
    this.h = this.def.h;
    this.x = placed.col * C.TILE * FP;
    this.y = placed.row * C.TILE * FP;
    this.baseY = this.y;
    this.vx = -(placed.type === 'cheep_red' ? C.CHEEP_RED_SPEED : C.CHEEP_GREY_SPEED);
    this.vy = 0;
    this.dir = -1;
    this.t = (placed.col * 7) % 60;
    this.state = 'walk';
    this.removed = false;
  }
  get alive() { return this.state === 'walk'; }
  get isShell() { return false; }
  get shaking() { return false; }
  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }
  update(level, player, mgr) {
    const C = SMB.C, FP = C.FP;
    if (this.state === 'flipped') {
      this.x += this.vx;
      this.vy = Math.min(this.vy + C.ENEMY_GRAVITY, C.ENEMY_FALL_MAX);
      this.y += this.vy;
      if (this.y > C.SCREEN_H * FP) this.removed = true;
      return;
    }
    this.t++;
    this.x += this.vx;
    this.y = this.baseY + Math.round(Math.sin(this.t * 0.06) * 4 * FP);
  }
  squash() { this.flip(1); }
  flip(dir) {
    const C = SMB.C;
    this.state = 'flipped';
    this.vx = (dir || 1) * C.FLIP_VX * 0.5;
    this.vy = -C.FLIP_VY * 0.5;
  }
};

// ---------------------------------------------------------------------
// 橋の下から飛び跳ねるプクプク（2-3・7-3）
//   画面下端から大きな放物線を描いて橋の上を飛び越える。上から踏むと倒せる（200 点）。
// ---------------------------------------------------------------------
SMB.CheepFly = class {
  constructor(xPx, yPx, vx, vy, dir) {
    const FP = SMB.C.FP;
    this.type = 'cheep_fly';
    this.def = SMB.ENEMY_DEFS.cheep_fly;
    this.placed = {};
    this.h = this.def.h;
    this.x = xPx * FP;
    this.y = yPx * FP;
    this.vx = vx;
    this.vy = vy;
    this.dir = dir || -1;
    this.t = 0;
    this.state = 'walk';
    this.removed = false;
  }
  get alive() { return this.state === 'walk'; }
  get isShell() { return false; }
  get shaking() { return false; }
  get box() {
    const FP = SMB.C.FP, hb = this.def.hit;
    const l = this.x / FP + hb[0], t = this.y / FP + hb[1];
    return { l, t, r: l + hb[2], b: t + hb[3] };
  }
  update(level, player, mgr) {
    const C = SMB.C, FP = C.FP;
    this.t++;
    this.x += this.vx;
    this.vy = Math.min(this.vy + C.CHEEP_FLY_G, C.ENEMY_FALL_MAX);
    this.y += this.vy;
    if (this.vy > 0 && this.y > (C.SCREEN_H + 16) * FP) this.removed = true;
  }
  squash() { this.flip(this.dir); }
  flip(dir) {
    const C = SMB.C;
    this.state = 'flipped';
    this.vx = (dir || 1) * C.FLIP_VX * 0.5;
    this.vy = -C.FLIP_VY * 0.4;
  }
};

function overlap(a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; }
SMB.overlap = overlap;
