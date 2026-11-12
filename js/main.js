// =====================================================================
// main.js — 60fps 固定タイムステップのゲームループと、ゲーム全体の状態。
//
// ゲームの流れ（仕様書 付録B）:
//   intro（WORLD 1-1 と残機）→ play → dying（ミス演出）→ 残機あり: intro / 残機 0: gameover → intro
//   play の中の特別な状態: warp（土管の出入り）/ flag（ゴールポール〜城〜TIME 加算〜花火）
// 1 フレームの処理順（仕様書 付録A）:
//   入力 → TIME → 土管の入口判定 → プレイヤー → 叩かれたブロック → コイン → カメラ → 敵の出現
//   → 敵の移動・敵同士 → 演出・アイテム → マリオと敵 → 中間地点・ゴール・穴・時間切れ
// 1 つの面は複数のエリア（main / bonus1 …）でできている。エリアの状態（使ったブロック、
// 取ったコイン、出現済みの敵）はその面を遊んでいる間は保持する。
// =====================================================================
window.SMB = window.SMB || {};

SMB.Game = class {
  constructor(canvas, debugEl) {
    this.renderer = new SMB.Renderer(canvas);
    this.debugEl = debugEl;
    this.levelId = '1-1';
    this.newGame();
  }

  newGame() {
    this.levelId = '1-1';                 // ゲームオーバー後は 1-1 から
    this.hud = { score: 0, coins: 0, lives: SMB.C.START_LIVES, time: 0 };
    this.player = null;
    this.midpointReached = false;
    this.loadLevel(this.levelId);
    this.enterIntro(false);
  }

  // keepForm: 形態を引き継ぐか（R / L キーとクリア後は引き継ぐ。ミス後は SMALL）
  // fromMidpoint: 中間地点から始めるか
  loadLevel(id, keepForm, fromMidpoint) {
    const form = keepForm && this.player ? this.player.form : 'small';
    if (id !== this.levelId) this.midpointReached = false;
    this.levelId = id;
    this.levelData = SMB.LEVEL_DATA[id];
    this.areas = {};
    this.player = null;
    this.hurry = false;       // 残り時間 100 を切った（BGM を速くする）
    const mp = this.levelData.midpoint;
    let areaName = this.levelData.startArea, spawn;
    if (fromMidpoint && mp) {
      areaName = mp.area;
      spawn = { x: mp.col * SMB.C.TILE, y: SMB.C.GROUND_Y - 16, entry: 'stand' };
    }
    const area = this.levelData.areas[areaName];
    spawn = spawn || { x: area.start.x, y: area.start.y, entry: 'stand' };
    this.player = new SMB.Player(null, { x: spawn.x, y: spawn.y });
    if (form !== 'small') this.player.setForm(form);
    this.enterArea(areaName, spawn);
    this.transition = null;   // 変身演出中は { from, to, t, frames, onEnd }
    this.warp = null;         // 土管の出入り中は { kind, phase, t, dest, obj }
    this.flag = null;         // ゴール後の流れ
    this.ending = null;       // 8-4 の斧〜橋崩落〜ピーチ救出エンディング
    this.stompChain = 0;
    this.starChain = 0;       // スター中に体当たりで倒した数（着地しても切れない）
    this.frame = 0;
    this.timeSub = 0;
    this.hud.time = this.levelData.timeLimit;
    this.mode = 'play';
    this.modeT = 0;
    this.startAreaMusic();
  }

  // いまの状況に合った BGM（スター中ならスター、そうでなければエリアの曲。残り時間警告後は速く）
  startAreaMusic() {
    if (this.mode !== 'play' || this.flag || this.ending) return;
    if (this.player && this.player.starTimer > 0) { SMB.Audio.playMusic('star'); return; }
    SMB.Audio.playMusic(this.level.area.bgm, { tempoScale: this.hurry ? 1.25 : 1 });
  }

  // エリアに入る。spawn: { x, y（SMALL の左上）, entry: 'stand'|'fall'|'rise', camX? }
  enterArea(name, spawn) {
    const C = SMB.C, FP = C.FP;
    let A = this.areas[name];
    if (!A) {
      const level = new SMB.Level(this.levelId, name);
      A = { level };
      A.blocks = new SMB.Blocks(this, level);
      A.enemies = new SMB.EnemyManager(this, level);
      A.lifts = new SMB.Lifts(level);
      A.vines = new SMB.Vines(level);
      A.warpZoneActive = false;
      this.areas[name] = A;
    }
    this.area = A;
    this.areaName = name;
    this.level = A.level;
    this.blocks = A.blocks;
    this.enemies = A.enemies;
    this.fireballs = new SMB.Fireballs(this);          // エリアを移ると消える
    this.cam = new SMB.Camera(this.level);

    const p = this.player;
    p.level = this.level;
    p.blocks = this.blocks;
    p.platforms = A.lifts.list;
    p.vines = A.vines;
    p.climb = null;
    p.ride = null;
    p.x = spawn.x * FP;
    p.y = (spawn.y + 16 - p.h) * FP;                     // 足元を合わせる
    p.vx = 0; p.vy = 0; p.prevX = p.x;
    p.onGround = spawn.entry === 'stand';
    p.crouching = false;
    p.trail = [];
    const camX = spawn.camX != null ? spawn.camX : spawn.x - 40;
    this.cam.x = Math.max(0, Math.min(camX, this.level.scrollStopX)) * FP;
    if (spawn.entry === 'rise') {
      // 土管から出てくる: 口の中（スプライト上端 = 口の y）から 1px/f でせり上がる
      p.y = spawn.y * FP;
      this.warp = { kind: 'rise', phase: 'exit', t: 0 };
    }
    if (spawn.entry === 'vine') {
      // ツタで登ってきた: エリアの vine 配置から、地面の下から伸びるツタを出してマリオが自動で登る
      const vo = this.level.objects.find((q) => q.type === 'vine');
      const v = A.vines.list[0] || A.vines.sprout(vo.col, C.SCREEN_H + 16, vo.topRow * C.TILE, null);
      p.grabVine(v, -1, true);
      p.y = (C.SCREEN_H + 8) * FP;
      p.facing = 1;
    }
    if (this.mode === 'play') this.startAreaMusic();
  }

  // missing: まだマップデータがない面の名前（その面の番号画面に「NOT YET BUILT」を出して 1-1 へ戻る）
  enterIntro(keepForm, missing) {
    this.mode = 'intro'; this.modeT = 0; this.introKeepForm = keepForm;
    this.introMissing = missing || null;
    SMB.Audio.stopMusic();
  }

  // 次の面へ（ゴール後・ワープゾーンの土管）。形態・スコア・残機は引き継ぐ
  goToLevel(id) {
    this.midpointReached = false;
    if (SMB.LEVEL_DATA[id]) { this.levelId = id; this.enterIntro(true); }
    else this.enterIntro(true, id);
  }

  // ---- 1 フレーム分の更新 ----
  update() {
    const D = SMB.Debug.state;
    SMB.Input.poll(this.frame);
    SMB.Audio.tick();                       // 音も 60Hz でゲームと同期して進める
    this.modeT++;

    if (this.mode === 'intro') {
      if (this.worldSelectUnlocked && !this.introMissing && SMB.Input.pressed.B) {
        const worlds = Object.keys(SMB.LEVEL_DATA).filter((id) => id !== 'test');
        this.levelId = worlds[(worlds.indexOf(this.levelId) + 1) % worlds.length];
        this.modeT = 0;
        SMB.Audio.se('coin');
        return;
      }
      if (this.introMissing && (this.modeT >= SMB.C.INTRO_FRAMES * 1.5 || SMB.Input.pressed.start)) {
        this.levelId = '1-1';               // まだ作っていない面: 1-1 へ戻る
        this.enterIntro(true);
        return;
      }
      if (!this.introMissing && (this.modeT >= SMB.C.INTRO_FRAMES || SMB.Input.pressed.start)) {
        this.loadLevel(this.levelId, this.introKeepForm, this.midpointReached && !this.introKeepForm);
      }
      return;
    }
    if (this.mode === 'gameover') {
      if (this.modeT >= SMB.C.GAMEOVER_FRAMES) this.newGame();
      return;
    }
    if (this.mode === 'dying') { this.updateDeath(); this.frame++; return; }

    if (D.formCycleRequested) { D.formCycleRequested = false; this.cycleForm(); }
    if (D.hurtRequested) { D.hurtRequested = false; this.hurtPlayer(); }
    if (D.teleportRequested) { D.teleportRequested = false; this.debugTeleport(); }

    if (this.transition) { this.updateTransition(); this.frame++; return; }   // 変身演出中は全体停止
    if (this.warp) { this.tickTimer(); this.updateWarp(); this.frame++; return; }
    if (this.flag) { this.updateFlag(); this.frame++; return; }
    if (this.ending) { this.updateEnding(); this.frame++; return; }

    const p = this.player;
    // 入口の地上（1-2 など）は自動で右へ歩く
    const input = this.level.area.autoWalk ? { held: { right: true }, pressed: {} } : SMB.Input;
    this.tickTimer();                                   // TIME
    this.area.lifts.update(p);                          // リフト・ジャンプ台（プレイヤーより先に動かす）
    this.area.vines.update();                           // ツタが伸びる
    if (!D.freeFly && this.checkPipeEntry(input)) { this.frame++; return; }   // 土管に入る
    p.update(input, D.freeFly);                         // プレイヤー
    if (p.invulnTimer > 0) p.invulnTimer--;
    if (p.starTimer > 0 && --p.starTimer === 0) { this.starChain = 0; this.startAreaMusic(); }
    if (p.throwTimer > 0) p.throwTimer--;
    // ファイアボール: FIRE 形態で B を押した瞬間（しゃがみ中は投げない）
    if (p.form === 'fire' && SMB.Input.pressed.B && !p.crouching && !D.freeFly && this.fireballs.tryThrow(p)) {
      p.throwTimer = SMB.C.THROW_POSE_FRAMES;
      SMB.Audio.se('fireball');
    }
    if (p.onGround) this.stompChain = 0;
    if (this.checkVineExit()) { this.frame++; return; } // ツタで画面の上へ
    this.blocks.processBump(p);                         // 叩かれたブロック
    this.collectTileCoins();                            // 配置コイン
    this.cam.update(p);                                 // カメラ
    this.enemies.spawn(this.cam.px);                    // 敵の出現
    this.enemies.update();                              // 敵の移動・敵同士・消滅
    this.fireballs.update(this.level, this.cam, this.enemies);   // ファイアボール
    this.blocks.update(p);                              // 演出・アイテム
    if (!D.freeFly) this.collidePlayerEnemies();        // マリオと敵
    this.checkAxe();
    this.checkLoopGates();
    this.checkMidpoint();
    this.checkWarpZone();
    if (this.checkFlagpole()) { this.frame++; return; } // ゴール
    if (!D.freeFly && this.touchingLava()) p.fellInPit = true;       // 溶岩に落ちたらミス
    if (p.fellInPit && !p.climb) {
      if (this.level.area.fallExit) {
        p.fellInPit = false;
        this.enterArea(this.level.area.fallExit.area, this.level.area.fallExit);
        this.frame++;
        return;
      }
      this.startDeath('pit');
    }
    else if (this.hud.time <= 0) this.startDeath('time');
    this.frame++;
  }

  // ------------------------------------------------------------------
  // 斧（8-4 の橋の右端）と橋の崩落・ピーチ姫救出エンディング
  //   collapse   : 斧が消え、鎖 → 橋（右端から左端へ 13 マス）が 4f おきにカタカタと崩れる
  //   bowser_fall: クッパがまだ生きていれば、咆哮とともに溶岩へ落下する
  //   walk       : スクロール制限が外れ、エンディングファンファーレとともに右の姫の部屋へ自動歩行
  //   message    : 姫の前で立ち止まり、THANK YOU MARIO! 等のクリアメッセージを順に表示
  // ------------------------------------------------------------------
  checkAxe() {
    const ax = this.level.objects.find((q) => q.type === 'axe' && !q.removed);
    if (!ax || this.player.dead || this.ending) return;
    const T = SMB.C.TILE, pb = this.player.box;
    if (pb.r > ax.col * T && pb.l < ax.col * T + T && pb.b > ax.row * T && pb.t < ax.row * T + T) {
      ax.removed = true;
      // 画面上のハンマー・火炎・バブル・ファイアボールを消去
      this.enemies.list = this.enemies.list.filter((e) => e.type !== 'hammer' && e.type !== 'bowser_fire' && e.type !== 'podoboo');
      this.fireballs.list = [];
      const bowser = this.enemies.list.find((e) => e.type === 'bowser' && e.alive) || null;
      const bridgeCols = [];
      for (let c = ax.col - 1; c >= 0; c--) {
        if (this.level.tileAt(c, 10) === '=') bridgeCols.push(c);
      }
      const p = this.player;
      p.vx = 0; p.vy = 0; p.starTimer = 0;
      SMB.Audio.stopMusic();
      const npc = this.level.objects.find((q) => q.type === 'princess' || q.type === 'retainer');
      this.ending = {
        phase: 'collapse',
        t: 0,
        chainCol: ax.col - 1,
        chainRow: ax.row + 1,
        bridgeCols,
        bridgeIdx: -1,
        bowser,
        msgLines: 0,
        isFinal: this.levelData.next === 'END',
        stopCol: npc ? npc.col - 1 : SMB.C.ENDING_WALK_STOP_COL,
      };
    }
  }

  updateEnding() {
    const C = SMB.C, FP = C.FP, e = this.ending, p = this.player;
    e.t++;
    switch (e.phase) {
      case 'collapse': {
        if (e.bowser && e.bowser.alive) e.bowser.t++;
        if (e.t % C.BRIDGE_COLLAPSE_STEP === 0) {
          if (e.bridgeIdx < 0) {
            if (this.level.tileAt(e.chainCol, e.chainRow) === '/') {
              this.level.setTile(e.chainCol, e.chainRow, '.');
            }
            SMB.Audio.se('bridge_break');
            e.bridgeIdx = 0;
          } else if (e.bridgeIdx < e.bridgeCols.length) {
            this.level.setTile(e.bridgeCols[e.bridgeIdx], 10, '.');
            SMB.Audio.se('bridge_break');
            e.bridgeIdx++;
          } else {
            if (e.bowser && e.bowser.alive) {
              e.phase = 'bowser_fall';
              e.t = 0;
              e.bowser.vy = 0;
              SMB.Audio.se('bowser_fall');
            } else {
              this.startEndingWalk();
            }
          }
        }
        break;
      }
      case 'bowser_fall': {
        const b = e.bowser;
        b.t++;
        b.vy = Math.min(b.vy + C.BOWSER_FALL_G, C.ENEMY_FALL_MAX);
        b.y += b.vy;
        if (b.y > C.SCREEN_H * FP) {
          b.removed = true;
          this.enemies.list = this.enemies.list.filter((x) => !x.removed);
          this.startEndingWalk();
        }
        break;
      }
      case 'walk': {
        const stopX = ((e.stopCol || C.ENDING_WALK_STOP_COL) * C.TILE - 2) * FP;
        if (p.x < stopX) {
          const fake = { held: { right: true }, pressed: {} };
          p.update(fake, false);
          if (p.x >= stopX) {
            p.x = stopX; p.vx = 0; p.vy = 0; p.onGround = true; p.facing = 1;
          }
        } else {
          p.vx = 0; p.vy = 0; p.onGround = true; p.facing = 1;
        }
        this.cam.update(p);
        const targetCamX = this.level.scrollStopX * FP;
        if (this.cam.x < targetCamX) {
          this.cam.x = Math.min(targetCamX, this.cam.x + 0x01400);
        }
        if (p.x >= stopX && this.cam.x >= targetCamX) {
          e.phase = 'message';
          e.t = 0;
        }
        break;
      }
      case 'message': {
        p.vx = 0; p.vy = 0; p.facing = 1;
        if (!e.isFinal) {
          if (e.t >= 30 && e.msgLines < 1) e.msgLines = 1;
          if (e.t >= 100 && e.msgLines < 2) e.msgLines = 2;
          if (e.t >= C.RETAINER_CLEAR_WAIT || (e.msgLines >= 2 && (SMB.Input.pressed.B || SMB.Input.pressed.start || SMB.Input.pressed.A))) {
            this.goToLevel(this.levelData.next || '1-1');
          }
          break;
        }
        if (e.t >= 30 && e.msgLines < 1) e.msgLines = 1;
        if (e.t >= 110 && e.msgLines < 2) e.msgLines = 2;
        if (e.t >= 190 && e.msgLines < 3) e.msgLines = 3;
        if (e.t >= 250 && e.msgLines < 4) { e.msgLines = 4; this.worldSelectUnlocked = true; }
        if (e.t >= 290 && e.msgLines < 5) e.msgLines = 5;
        if (e.msgLines >= 4 && (SMB.Input.pressed.B || SMB.Input.pressed.start || SMB.Input.pressed.A)) {
          this.levelId = '1-1';
          this.midpointReached = false;
          this.enterIntro(true);
        }
        break;
      }
    }
  }

  startEndingWalk() {
    const e = this.ending;
    e.phase = 'walk';
    e.t = 0;
    this.level.scrollStopX = this.level.pixelWidth - SMB.C.SCREEN_W;
    SMB.Audio.playJingle('ending');
  }

  // 足元（体の中心の少し下）が溶岩のタイルに入ったか
  touchingLava() {
    const p = this.player, FP = SMB.C.FP;
    const px = p.x / FP + 8, fy = p.y / FP + p.h - 2;
    return !!this.level.def(this.level.tileAtPx(px, fy)).deadly;
  }

  tickTimer() {
    if (this.hud.time <= 0 || this.level.area.noTimer) return;
    if (++this.timeSub >= SMB.C.TIME_TICK_FRAMES) {
      this.timeSub = 0;
      this.hud.time--;
      // 残り 100: 警告のジングルのあと、BGM を速くして再開（仕様書 4.1）
      if (this.hud.time === 100 && this.mode === 'play' && !this.flag) {
        this.hurry = true;
        SMB.Audio.playJingle('hurry', () => this.startAreaMusic());
      }
    }
  }

  // ------------------------------------------------------------------
  // 配置コイン（タイル 'o'）: マリオの当たり判定に重なったら取る
  // ------------------------------------------------------------------
  collectTileCoins() {
    const T = SMB.C.TILE, b = this.player.box, L = this.level;
    const top = Math.floor(this.player.y / SMB.C.FP) + 2;   // コインは体全体で取る
    for (let c = Math.floor(b.l / T); c <= Math.floor((b.r - 1) / T); c++) {
      for (let r = Math.floor(top / T); r <= Math.floor((b.b - 1) / T); r++) {
        if (L.tileAt(c, r) === 'o') { L.setTile(c, r, '.'); this.addCoin(); }
      }
    }
  }

  // ------------------------------------------------------------------
  // 土管ワープ
  //   下向きの土管: 口の上に立ち（マリオの中心が口の内側 8〜24px）↓ で入る
  //   横向きの土管: 接地中に → で口に押し付けると入る
  //   入ったら 1px/f で沈み（横なら進み）、入り切ってから少し待ってエリアを切り替える
  // ------------------------------------------------------------------
  checkPipeEntry(I) {
    const p = this.player, FP = SMB.C.FP, T = SMB.C.TILE;
    if (!p.onGround) return false;
    const px = p.x / FP, feet = Math.round(p.y / FP) + p.h;
    // ワープゾーンの土管（ゾーンに入って文字が出てから有効）
    const zone = this.area.warpZoneActive && this.level.objects.find((q) => q.type === 'warp_zone');
    if (zone && I.held.down) {
      for (const z of zone.pipes) {
        const left = z.col * T, c = px + 8;
        if (feet === z.row * T && c >= left + 8 && c <= left + 24) {
          p.crouching = false;
          this.warp = { kind: 'down', phase: 'enter', t: 0, dest: { level: z.level } };
          SMB.Audio.se('pipe');
          return true;
        }
      }
    }
    for (const o of this.level.objects) {
      if (o.type === 'pipe_warp' && I.held.down) {
        const left = o.col * T, c = px + 8;
        if (feet === o.row * T && c >= left + 8 && c <= left + 24) {
          p.crouching = false;
          this.warp = { kind: 'down', phase: 'enter', t: 0, dest: o.dest };
          SMB.Audio.se('pipe');
          return true;
        }
      }
      if (o.type === 'pipe_side_warp' && I.held.right) {
        const rimX = o.col * T;
        if (px + 14 >= rimX - 1 && feet === (o.row + 2) * T) {
          p.facing = 1;
          this.warp = { kind: 'side', phase: 'enter', t: 0, dest: o.dest };
          SMB.Audio.se('pipe');
          return true;
        }
      }
    }
    return false;
  }

  // 行き先のあるツタを画面の上まで登り切ったら、少し登り続けてから次のエリアへ
  checkVineExit() {
    const p = this.player, c = p.climb;
    if (!c || !c.vine.dest || p.y / SMB.C.FP + p.h >= SMB.C.VINE_EXIT_FEET) return false;
    this.warp = { kind: 'vine', phase: 'enter', t: 0, dest: c.vine.dest };
    return true;
  }

  updateWarp() {
    const C = SMB.C, FP = C.FP, w = this.warp, p = this.player;
    w.t++;
    if (w.kind === 'vine') {
      p.y -= C.CLIMB_UP_SPEED; p.climbMoved++;
      if (w.t >= C.PIPE_FADE_FRAMES + 16) {
        this.warp = null;
        this.enterArea(w.dest.area, { x: w.dest.x || 0, y: 0, entry: 'vine', camX: w.dest.camX || 0 });
      }
      return;
    }
    if (w.phase === 'enter') {
      const dist = w.kind === 'down' ? p.h : 16;
      if (w.t <= dist) {
        if (w.kind === 'down') p.y += C.PIPE_SPEED * FP;
        else p.x += C.PIPE_SPEED * FP;
      } else if (w.t >= dist + C.PIPE_FADE_FRAMES) {
        this.warp = null;
        if (w.dest.level) this.goToLevel(w.dest.level);      // ワープゾーン: 別の面へ
        else this.enterArea(w.dest.area, w.dest);
      }
    } else if (w.phase === 'exit') {
      if (w.t <= p.h) p.y -= C.PIPE_SPEED * FP;
      else { this.warp = null; p.onGround = true; p.vy = 0; }
    }
  }

  // ------------------------------------------------------------------
  // 中間地点: その列を通過していれば、ミス後はそこから再開する
  // ------------------------------------------------------------------
  // ワープゾーン: 中に入ったら土管のパックンフラワーを消し、文字と行き先の番号を出す
  checkWarpZone() {
    if (this.area.warpZoneActive) return;
    const zone = this.level.objects.find((q) => q.type === 'warp_zone');
    if (!zone || this.player.x / SMB.C.FP < zone.col * SMB.C.TILE) return;
    this.area.warpZoneActive = true;
    for (const e of this.enemies.list) if (e.placed && e.placed.warpZone) e.removed = true;
    this.enemies.pending = this.enemies.pending.filter((q) => !q.o.warpZone);
    this.enemies.list = this.enemies.list.filter((e) => !e.removed);
  }

  checkMidpoint() {
    const mp = this.levelData.midpoint;
    if (!mp || this.midpointReached || this.areaName !== mp.area) return;
    if (this.player.x / SMB.C.FP >= mp.col * SMB.C.TILE) this.midpointReached = true;
  }

  // 4-4・7-4 のループ迷路ゲート: 指定の行範囲（passRows）を通過していなければ backCols 列ぶん手前へシームレスに戻す
  checkLoopGates() {
    const p = this.player, C = SMB.C, FP = C.FP, T = C.TILE;
    const px = p.x / FP + 8;
    const prow = Math.floor((p.y / FP + p.h - 2) / T);
    for (const g of this.level.objects) {
      if (g.type !== 'loop_gate' || g.passed) continue;
      if (px >= g.col * T) {
        const [rMin, rMax] = g.passRows;
        if (prow >= rMin && prow <= rMax) {
          g.passed = true;
        } else {
          const shiftPx = (g.backCols || 32) * T;
          p.x -= shiftPx * FP;
          p.prevX = p.x;
          this.cam.x = Math.max(0, this.cam.x - shiftPx * FP);
          for (const f of this.fireballs.list) f.x -= shiftPx;
          return;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // ゴールポール（仕様書 3.5）
  //   slide: ポールを掴み、マリオと旗が 2px/f で降りる（得点は掴んだ高さで決まる）
  //   turn : ポールの反対側に回って待つ → walk: 城の入口まで歩く → tally: 残り TIME を得点へ
  //   castle: 城の旗が上がる → fireworks: TIME の下 1 桁が 1/3/6 なら花火 → end: 次へ
  // ------------------------------------------------------------------
  checkFlagpole() {
    const o = this.level.objects.find((q) => q.type === 'flagpole');
    if (!o) return false;
    const C = SMB.C, FP = C.FP, p = this.player;
    const poleX = o.col * C.TILE + 7;
    // ポールの列（台のブロックを含む）に触れたら掴む。地面から台に押し付けても掴める（100 点）
    if (p.box.r + 1 < o.col * C.TILE || p.dead) return false;
    const feet = p.y / FP + p.h;
    const pts = C.FLAG_SCORE_TABLE.find((row) => feet <= row[0])[1];
    this.addScore(pts);
    const lastDigit = this.hud.time % 10;
    this.flag = {
      phase: 'slide', t: 0, poleX, baseY: (13 - 1) * C.TILE, topY: o.topY,
      flagY: o.topY + 8, score: pts, scoreY: (13 - 1) * C.TILE,
      fireworks: [1, 3, 6].includes(lastDigit) ? lastDigit : 0, fired: 0, bursts: [],
      castleFlag: 0, hidden: false,
    };
    p.x = (poleX - 14) * FP;
    p.vx = 0; p.vy = 0; p.crouching = false; p.facing = 1;
    p.starTimer = 0;
    SMB.Audio.stopMusic();
    SMB.Audio.se('flagpole');
    p.onGround = false;
    return true;
  }

  updateFlag() {
    const C = SMB.C, FP = C.FP, f = this.flag, p = this.player;
    f.t++;
    const castle = this.level.objects.find((q) => q.type === 'castle');
    switch (f.phase) {
      case 'slide': {
        const feetTarget = f.baseY;
        const feet = p.y / FP + p.h;
        if (feet < feetTarget) p.y = Math.min(feet + C.FLAG_SLIDE_SPEED, feetTarget) * FP - p.h * FP;
        if (f.flagY < f.baseY - 16) f.flagY = Math.min(f.flagY + C.FLAG_SLIDE_SPEED, f.baseY - 16);
        if (f.scoreY > f.topY) f.scoreY -= C.FLAG_SLIDE_SPEED;
        if (p.y / FP + p.h >= feetTarget && f.flagY >= f.baseY - 16) {
          f.phase = 'turn'; f.t = 0;
          p.x = (f.poleX + 2) * FP;            // ポールの右側へ回る
          p.facing = -1;
        }
        break;
      }
      case 'turn':
        if (f.t >= C.FLAG_TURN_FRAMES) { f.phase = 'walk'; f.t = 0; SMB.Audio.playJingle('clear'); }
        break;
      case 'walk': {
        const fake = { held: { right: true }, pressed: {} };
        p.update(fake, false);
        this.cam.update(p);
        const door = castle ? castle.col * C.TILE + 40 : f.poleX + 80;
        if (p.x / FP + 8 >= door) { f.hidden = true; f.phase = 'tally'; f.t = 0; }
        break;
      }
      case 'tally':
        if (SMB.Audio.isJingle) break;               // クリアのジングルが終わってから数える
        if (this.hud.time > 0) {
          if (f.t % 4 === 0) SMB.Audio.se('tally');
          const n = Math.min(C.TIME_TALLY_PER_FRAME, this.hud.time);
          this.hud.time -= n;
          this.addScore(n * C.TIME_TALLY_SCORE);
        } else { f.phase = 'castle'; f.t = 0; }
        break;
      case 'castle':
        f.castleFlag = Math.min(1, f.t / C.CASTLE_FLAG_FRAMES);
        if (f.t >= C.CASTLE_FLAG_FRAMES) { f.phase = 'fireworks'; f.t = 0; }
        break;
      case 'fireworks':
        if (f.fired < f.fireworks && f.t % C.FIREWORK_INTERVAL === 1) {
          const spots = [[-24, 40], [40, 56], [8, 24], [-40, 64], [56, 32], [24, 72]];
          const s = spots[f.fired % spots.length];
          const cx = (castle ? castle.col * C.TILE + 40 : f.poleX) + s[0];
          f.bursts.push({ x: cx, y: s[1], t: 0 });
          f.fired++;
          this.addScore(C.FIREWORK_SCORE);
          SMB.Audio.se('firework');
        }
        for (const b of f.bursts) b.t++;
        if (f.fired >= f.fireworks && f.t > f.fireworks * C.FIREWORK_INTERVAL + 20) { f.phase = 'end'; f.t = 0; }
        break;
      case 'end':
        if (f.t >= C.CLEAR_END_WAIT) {
          // 次の面へ（マップデータがなければ「NOT YET BUILT」を出して 1-1 へ）
          this.goToLevel(this.levelData.next || '1-1');
        }
        break;
    }
  }

  // ------------------------------------------------------------------
  // マリオと敵（仕様書 1.5）。踏みつけを先に全部処理してから被弾を判定する
  // ------------------------------------------------------------------
  collidePlayerEnemies() {
    const p = this.player, C = SMB.C;
    if (p.dead) return;
    const pb = p.box;
    const hits = this.enemies.list.filter((e) => e.alive && (e.hitsBox ? e.hitsBox(pb) : SMB.overlap(pb, e.box)));
    if (p.starTimer > 0) {
      // スター中: 触れた敵はすべてひっくり返って倒れる（パックン・甲羅も）。被弾しない
      for (const e of hits) {
        if (e.def.hazard || e.def.boss) continue;                     // ファイアバーや大魔王はスターで即死しない
        const eb = e.box;
        e.flip(eb.l + 6 >= pb.l + 5 ? 1 : -1);
        SMB.Audio.se('kick');
        const pts = C.STOMP_CHAIN_SCORES[Math.min(this.starChain, C.STOMP_CHAIN_SCORES.length - 1)];
        this.starChain++;
        this.awardPoints(pts, eb.l, eb.t - 8);
      }
      return;
    }
    let hurt = false;
    for (const e of hits) {
      const eb = e.box;
      if (e.def.stompable === false) { hurt = true; continue; }       // パックンフラワー等
      const fromAbove = p.vy > 0 && pb.b < eb.t + 8;
      if (e.state === 'shell') {
        const pc = pb.l + 5, ec = eb.l + 6;
        e.kick(pc < ec ? 1 : -1);
        SMB.Audio.se('kick');
        this.awardPoints(C.KICK_SCORE, eb.l, eb.t - 8);
        if (fromAbove) p.stompBounce();
        continue;
      }
      if (fromAbove) {
        if (e.state === 'shell_moving') e.toShell();
        else if (e.def.para) e.loseWings();
        else if (e.def.shellable) e.toShell();
        else e.squash();
        p.stompBounce();
        SMB.Audio.se('stomp');
        const pts = e.def.killScore || C.STOMP_CHAIN_SCORES[Math.min(this.stompChain, C.STOMP_CHAIN_SCORES.length - 1)];
        this.stompChain++;
        this.awardPoints(pts, eb.l, eb.t - 8);
        continue;
      }
      if (e.state === 'shell_moving' && e.kickGrace > 0) continue;
      hurt = true;
    }
    if (hurt) this.hurtPlayer();
  }

  hurtPlayer() {
    const p = this.player, D = SMB.Debug.state;
    if (p.invulnTimer > 0 || p.starTimer > 0 || p.dead || D.invincible || this.transition || this.flag || this.warp || this.ending) return;
    if (p.big) { this.startTransition('small', () => { p.invulnTimer = SMB.C.INVULN_FRAMES; }); SMB.Audio.se('pipe'); }
    else this.startDeath('enemy');
  }

  // ------------------------------------------------------------------
  // ミス演出（仕様書 2.3）
  // ------------------------------------------------------------------
  startDeath(kind) {
    if (this.mode === 'dying') return;
    const p = this.player;
    this.mode = 'dying';
    this.modeT = 0;
    this.deathKind = kind;
    this.lavaDeath = kind === 'pit' && this.touchingLava();
    p.dead = true;
    p.vx = 0;
    p.vy = 0;
    p.starTimer = 0;
    SMB.Audio.playJingle('death');
    if (kind !== 'pit' && p.big) p.setForm('small');
  }

  updateDeath() {
    const C = SMB.C, p = this.player, t = this.modeT;
    const total = this.deathKind === 'pit' ? C.PIT_DEATH_FRAMES : C.DEATH_TOTAL_FRAMES;
    if (this.deathKind !== 'pit') {
      if (t === C.DEATH_PAUSE_FRAMES) p.vy = -C.DEATH_JUMP_VY;
      if (t > C.DEATH_PAUSE_FRAMES) { p.vy += C.DEATH_GRAVITY; p.y += p.vy; }
    }
    if (t >= total) this.finishDeath();
  }

  finishDeath() {
    this.hud.lives--;
    if (this.hud.lives <= 0) { this.mode = 'gameover'; this.modeT = 0; SMB.Audio.playJingle('gameover'); }
    else this.enterIntro(false);
  }

  // ---- 得点 ----
  addScore(n) { this.hud.score += n; }
  addCoin() {
    this.addScore(200);
    SMB.Audio.se('coin');
    if (++this.hud.coins >= SMB.C.COINS_PER_1UP) { this.hud.coins = 0; this.hud.lives++; SMB.Audio.se('oneup'); }
  }
  awardPoints(pts, x, y) {
    if (pts === '1UP') { this.hud.lives++; this.blocks.popup(x, y, '1UP'); SMB.Audio.se('oneup'); return; }
    this.addScore(pts);
    this.blocks.popup(x, y, String(pts));
  }

  collectItem(it) {
    const p = this.player, x = it.x, y = it.y;
    if (it.type === '1up') { this.awardPoints('1UP', x, y); return; }
    this.awardPoints(1000, x, y);
    SMB.Audio.se('powerup');
    if (it.type === 'mushroom' && p.form === 'small') this.startTransition('super');
    else if (it.type === 'flower') this.startTransition(p.form === 'small' ? 'super' : 'fire');
    else if (it.type === 'star') { p.starTimer = SMB.C.STAR_FRAMES; this.starChain = 0; SMB.Audio.playMusic('star'); }
  }

  onTileBumped(col, row) {
    const fromX = this.player.x / SMB.C.FP + 8;
    this.enemies.bumpKill(col, row, fromX);
    this.blocks.bumpItems(col, row, fromX);
  }

  // ---- 変身演出（仕様書 2.3）----
  startTransition(to, onEnd) {
    const from = this.player.form;
    if (from === to) return;
    const C = SMB.C;
    const frames = to === 'small' ? C.SHRINK_FRAMES : C.GROW_FRAMES;
    this.transition = { from, to, t: 0, frames, onEnd };
  }

  updateTransition() {
    const tr = this.transition;
    tr.t++;
    if (tr.t >= tr.frames) {
      this.player.setForm(tr.to);
      this.transition = null;
      if (tr.onEnd) tr.onEnd();
    }
  }

  cycleForm() {
    if (this.transition) return;
    const next = { small: 'super', super: 'fire', fire: 'small' }[this.player.form];
    this.startTransition(next);
  }

  // ---- 検証用: J キーで決まった地点へ飛ぶ ----
  debugTeleport() {
    const spots = (this.levelData.debugSpots || []);
    if (!spots.length) return;
    this.teleportIndex = ((this.teleportIndex == null ? -1 : this.teleportIndex) + 1) % spots.length;
    const s = spots[this.teleportIndex];
    if (s.area !== this.areaName) this.enterArea(s.area, { x: s.col * 16, y: 0, entry: 'fall' });
    else {
      const p = this.player, FP = SMB.C.FP;
      p.x = s.col * 16 * FP; p.y = 0; p.vx = 0; p.vy = 0; p.onGround = false;
      this.cam.x = Math.max(0, Math.min(s.col * 16 - 40, this.level.scrollStopX)) * FP;
    }
  }

  draw() {
    this.renderer.render({
      mode: this.mode, modeT: this.modeT,
      level: this.level, cam: this.cam, player: this.player, blocks: this.blocks,
      enemies: this.enemies, fireballs: this.fireballs, lifts: this.area.lifts, vines: this.area.vines,
      warpZoneActive: this.area.warpZoneActive, introMissing: this.introMissing, levelId: this.levelId,
      transition: this.transition, warp: this.warp, flag: this.flag, ending: this.ending,
      worldSelectUnlocked: this.worldSelectUnlocked,
      hud: this.hud, frame: this.frame, debug: SMB.Debug.state,
    });
    SMB.Debug.updatePanel(this.debugEl, this);
  }
};

// ---------------------------------------------------------------------
// ループ: requestAnimationFrame で時間を測り、1/60 秒ごとに update を回す。
// ---------------------------------------------------------------------
(function boot() {
  const canvas = document.getElementById('screen');
  const debugEl = document.getElementById('debug');
  const game = new SMB.Game(canvas, debugEl);
  const STEP = 1000 / SMB.C.FPS;
  let acc = 0, last = performance.now();

  function fit() {
    const panelW = SMB.Debug.state.panel ? 412 : 0;
    const s = Math.max(1, Math.floor(Math.min(
      (window.innerWidth - 16 - panelW) / SMB.C.SCREEN_W,
      (window.innerHeight - 16) / SMB.C.SCREEN_H)));
    canvas.style.width = SMB.C.SCREEN_W * s + 'px';
    canvas.style.height = SMB.C.SCREEN_H * s + 'px';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyH') setTimeout(fit, 0); });
  fit();

  function frame(now) {
    const D = SMB.Debug.state;
    let dt = now - last;
    last = now;
    if (dt > 250) dt = 250;

    // R / L は面番号画面を飛ばしてすぐ遊べる状態にする（検証用）
    if (D.resetRequested) { D.resetRequested = false; game.loadLevel(game.levelId, true); acc = 0; }
    if (D.levelSwitchRequested) {
      D.levelSwitchRequested = false;
      const ids = Object.keys(SMB.LEVEL_DATA);
      game.loadLevel(ids[(ids.indexOf(game.levelId) + 1) % ids.length], true);
      acc = 0;
    }

    SMB.Audio.setPaused(D.paused);          // 一時停止中は音を止める
    if (D.paused) {
      acc = 0;
      while (D.stepRequests > 0) { game.update(); D.stepRequests--; }
    } else {
      acc += dt * D.speed;
      let n = 0;
      while (acc >= STEP && n < SMB.C.MAX_CATCHUP_FRAMES) { game.update(); acc -= STEP; n++; }
      if (n === SMB.C.MAX_CATCHUP_FRAMES) acc = 0;
    }
    game.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  SMB.game = game;
})();
