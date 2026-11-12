// =====================================================================
// player.js — マリオの移動と当たり判定（仕様書 1.2 / 1.3 / 1.4）。
// 座標・速度は固定小数点（1px = SMB.C.FP）。x, y はスプライト左上。
// 1 フレームの順序: 水平速度 → 垂直速度 → X 移動と壁 → Y 移動と床・天井
// =====================================================================
window.SMB = window.SMB || {};

SMB.Player = class {
  constructor(level, start) {
    const C = SMB.C;
    this.level = level;
    this.x = start.x * C.FP;
    this.y = start.y * C.FP;
    this.prevX = this.x;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.w = 16;
    this.form = 'small';         // 'small' | 'super' | 'fire'
    this.h = C.FORM_HEIGHT.small;
    this.crouching = false;      // SUPER/FIRE のみ。当たり判定は下半分（16px）だけになる
    this.blocks = null;          // 隠しブロック判定のため Game から渡される
    this.onGround = true;
    this.runTimer = 0;           // B を離してからダッシュ上限を保つ残りフレーム
    this.skidding = false;

    // 空中のパラメータ（踏み切りで決まる）
    this.takeoffSpeed = 0;
    this.airMax = C.WALK_MAX;
    this.holdG = C.JUMP_TABLE[0][2];
    this.fallG = C.JUMP_TABLE[0][3];
    this.jumpRow = -1;

    this.fellInPit = false;
    this.invulnTimer = 0;        // 被弾後の点滅無敵（仕様書 2.3）
    this.starTimer = 0;          // スター無敵の残りフレーム
    this.throwTimer = 0;         // ファイアボールを投げるポーズの残りフレーム
    this.dead = false;           // ミス演出中
    this.bumpedTile = null;      // 天井で叩いたタイル {col,row}（ブロック処理はステップ5で）
    this.vines = null;           // いるエリアのツタ（Game から渡される）
    this.climb = null;           // ツタに掴まっている間 { vine, side: -1=ツタの左 / 1=右, auto }
    this.climbMoved = 0;         // 登り降りした距離（手足のコマ送り用）
    this.regrab = 0;             // 飛び降りた直後、ツタに掴まらない残りフレーム

    // 検証用の記録
    this.trail = [];
    this.jumpStartY = this.y;
    this.peakY = this.y;
    this.airFrames = 0;
    this.lastJump = null;
  }

  update(input, freeFly) {
    this.prevX = this.x;
    this.bumpedTile = null;
    this.wantsCrouch = !!input.held.down;
    if (freeFly) { this.updateFreeFly(input); return; }

    // 乗っているリフトと一緒に動く（リフトが画面の端で反対側へ戻ったら降ろす）
    if (this.ride) {
      if (this.ride.wrapped || !this.platforms || !this.platforms.includes(this.ride)) this.ride = null;
      else {
        if (this.ride.dx) this.x += Math.round(this.ride.dx * SMB.C.FP);
        this.y += Math.round(this.ride.dy * SMB.C.FP);
        if (this.ride.isSpring) {
          if (input.pressed.A || input.held.A) this.ride.superJump = true;
          if (this.ride.t >= 8) {
            const C = SMB.C, sp = this.ride;
            const boost = (input.held.A || sp.superJump) ? C.SPRING_SUPER_VY : C.SPRING_VY;
            this.vy = -boost;
            this.holdG = C.JUMP_TABLE[0][2];
            this.fallG = C.JUMP_TABLE[0][3];
            this.onGround = false;
            this.ride = null;
            sp.t = 0; sp.superJump = false; sp.y = sp.baseY - 32;
            this.beginAir(Math.abs(this.vx));
            SMB.Audio.se(this.big ? 'jump_super' : 'jump_small');
          }
        }
      }
    }
    this.feetPrev = Math.floor(this.y / SMB.C.FP) + this.h;

    // ツタ: 空中で触れるか、地上で ↑ を押すと掴まる
    if (this.regrab > 0) this.regrab--;
    if (!this.climb && this.vines && this.regrab === 0 && !this.dead) {
      const v = this.vines.touching(this.box);
      if (v && (!this.onGround || input.held.up)) this.grabVine(v);
    }
    if (this.climb) { this.updateClimb(input); return; }

    if (this.level.area.water) {                       // 水中: 泳ぎ（浮力・A 連打）
      this.updateSwim(input);
      this.moveX();
      this.moveY();
      this.record();
      if (this.y > SMB.C.SCREEN_H * SMB.C.FP) this.fellInPit = true;
      return;
    }
    this.updateCrouch(input);
    if (this.onGround) this.updateGroundX(input);
    else this.updateAirX(input);
    this.updateY(input);

    this.moveX();
    this.moveY();
    this.record();

    if (this.y > SMB.C.SCREEN_H * SMB.C.FP) this.fellInPit = true;
  }


  // ------------------------------------------------------------------
  // ツタ登り（4-2）
  //   掴まると重力も慣性もなくなり、ツタの左右どちらかに体を寄せてぶら下がる
  //   ↑ / ↓: 登る 1px/f・降りる 1.5px/f（先端より上・根元より下へは行かない）
  //   ← / →: ツタの反対側へ持ち替える（ツタの方へ押したとき。向きも入れ替わる）
  //   A    : 飛び降りる（小ジャンプ。押している方向へ跳ぶ）
  //   降りていって足が床に着いたら手を離して立つ。根元より下に床がなければ手を離して落ちる
  // ------------------------------------------------------------------
  grabVine(v, side, auto) {
    const cx = this.x / SMB.C.FP + 8;
    this.climb = { vine: v, side: side || (cx < v.x + 8 ? -1 : 1), auto: !!auto };
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.ride = null; this.crouching = false; this.skidding = false;
    this.snapToVine();
  }

  snapToVine() {
    const c = this.climb, FP = SMB.C.FP;
    this.x = (c.vine.x + 8 + c.side * SMB.C.VINE_SIDE_OFFSET - 8) * FP;
    this.facing = -c.side;                       // ツタの方を向く
  }

  updateClimb(input) {
    const C = SMB.C, FP = C.FP, T = C.TILE, L = this.level, c = this.climb, v = c.vine;
    this.vx = 0; this.vy = 0;
    if (c.auto) {                                // 下から登ってきた: ツタが伸び切ってから先端近くまで自動で登る
      if (v.top > v.targetTop) return;
      this.y -= C.CLIMB_UP_SPEED; this.climbMoved++;
      if (this.y / FP <= v.top + C.VINE_AUTO_STOP) c.auto = false;
      return;
    }
    if (input.pressed.A) {                        // 飛び降りる
      const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
      this.climb = null;
      this.regrab = C.VINE_REGRAB_FRAMES;
      const r = C.JUMP_TABLE[0];
      this.jumpRow = 0;
      this.vy = -r[1]; this.holdG = r[2]; this.fallG = r[3];
      this.vx = dir * C.WALK_MAX;
      if (dir) this.facing = dir;
      this.beginAir(Math.abs(this.vx));
      SMB.Audio.se(this.big ? 'jump_super' : 'jump_small');
      return;
    }
    // 持ち替え: ツタの方へ押すと反対側へ（反対側が壁なら持ち替えない）
    const push = input.pressed.right ? 1 : input.pressed.left ? -1 : 0;
    if (push && push === -c.side) {
      const nx = v.x + 8 - c.side * C.VINE_SIDE_OFFSET - 8, py = Math.floor(this.y / FP) + 8;
      if (!L.isSolidPx(nx + 2, py) && !L.isSolidPx(nx + 13, py)) { c.side = -c.side; this.snapToVine(); }
    }
    const px = Math.floor(this.x / FP);
    if (input.held.up && !input.held.down) {
      const ny = this.y - C.CLIMB_UP_SPEED;
      const headHit = L.isSolidPx(px + 8, Math.floor(ny / FP) + C.HEAD_PROBE_Y);
      const limit = v.dest ? -Infinity : (v.top - 2) * FP;   // 行き先のあるツタは画面の上へ抜けられる
      if (!headHit && ny >= limit) { this.y = ny; this.climbMoved++; }
    } else if (input.held.down) {
      this.y += C.CLIMB_DOWN_SPEED; this.climbMoved += 1.5;
      const feet = Math.floor(this.y / FP) + this.h;
      if (L.isSolidPx(px + 3, feet) || L.isSolidPx(px + 12, feet)) {   // 床に着いた: 手を離して立つ
        this.y = (Math.floor(feet / T) * T - this.h) * FP;
        this.climb = null; this.onGround = true; this.regrab = C.VINE_REGRAB_FRAMES;
        return;
      }
      if (feet > v.base + 8) {                    // 根元より下: 手を離して落ちる
        this.climb = null; this.regrab = C.VINE_REGRAB_FRAMES;
        this.holdG = C.JUMP_TABLE[0][2]; this.fallG = C.JUMP_TABLE[0][3]; this.jumpRow = -1;
        this.beginAir(0);
      }
    }
  }

  get climbFrame() { return Math.floor(this.climbMoved / SMB.C.CLIMB_STEP_PX) % 2; }

  // ------------------------------------------------------------------
  // 形態としゃがみ 仕様書 2.1 / 2.2
  // ------------------------------------------------------------------
  get big() { return this.form !== 'small'; }

  // 足元の位置を保ったまま形態を変える
  setForm(form) {
    const C = SMB.C;
    const newH = C.FORM_HEIGHT[form];
    this.y += (this.h - newH) * C.FP;
    this.h = newH;
    this.form = form;
    if (!this.big) this.crouching = false;
  }

  // しゃがみ: 接地中に↓で開始・↓を離すと解除。空中では姿勢を保つ（しゃがみジャンプ）
  updateCrouch(input) {
    if (!this.big) { this.crouching = false; return; }
    if (this.onGround) this.crouching = !!input.held.down;
  }

  // ------------------------------------------------------------------
  // 水中（8-4）: ゆるい重力と浮力。A を押すたびに上へひと漕ぎ（連打で上昇）、押しっぱなしの間は上昇が少し伸びる。
  //   水平は地上より遅い上限（WATER_WALK_MAX）、入力を離すとゆっくり止まる。底に足がつけば歩ける。
  // ------------------------------------------------------------------
  updateSwim(input) {
    const C = SMB.C, S = C.SWIM;
    this.updateCrouch(input);
    const dir = this.crouching ? 0 : (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    this.skidding = false;
    if (dir) {
      this.vx = clamp(this.vx + dir * (this.onGround ? C.WALK_ACCEL : C.SWIM_ACCEL), -C.WATER_WALK_MAX, C.WATER_WALK_MAX);
      this.facing = dir;
    } else {
      this.vx = approachZero(this.vx, this.onGround ? C.RELEASE_DECEL : C.SWIM_DRAG);
    }
    if (input.pressed.A) {                             // ひと漕ぎ
      this.vy = -S.v0;
      this.onGround = false;
      this.ride = null;
      this.swimStroke = 12;                            // 漕いだ直後はポーズを変える
      this.beginAir(Math.abs(this.vx));
      SMB.Audio.se('swim');
    }
    if (this.swimStroke > 0) this.swimStroke--;
    if (!this.onGround) {
      const g = (this.vy < 0 && input.held.A) ? S.hold : S.fall;
      this.vy = Math.min(this.vy + g, S.maxDown);
    }
  }

  // ------------------------------------------------------------------
  // 水平移動（地上） 仕様書 1.2
  // ------------------------------------------------------------------
  updateGroundX(input) {
    const C = SMB.C;
    // しゃがみ中は左右入力を受け付けない（摩擦だけで減速＝滑り込み）
    const dir = this.crouching ? 0 : (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);

    if (input.held.B) this.runTimer = C.RUN_HOLD_FRAMES;
    else if (this.runTimer > 0) this.runTimer--;
    const maxV = this.runTimer > 0 ? C.RUN_MAX : C.WALK_MAX;

    const s = Math.sign(this.vx), a = Math.abs(this.vx);
    this.skidding = false;

    if (dir === 0) {
      // 入力なし: 摩擦で減速
      this.vx = approachZero(this.vx, C.RELEASE_DECEL);
    } else if (s !== 0 && s !== dir) {
      // 進行方向と逆の入力: スキッド
      this.skidding = true;
      this.vx = approachZero(this.vx, C.SKID_DECEL);
      if (Math.abs(this.vx) < C.SKID_TURN_SPEED) this.facing = dir;
    } else {
      // 加速
      if (this.vx === 0) this.vx = dir * C.WALK_MIN_START;
      const acc = input.held.B ? C.RUN_ACCEL : C.WALK_ACCEL;
      if (Math.abs(this.vx) > maxV) {
        // ダッシュ速度のまま B を離した: 歩行の上限まで摩擦と同じ割合で落とす
        this.vx = Math.sign(this.vx) * Math.max(maxV, Math.abs(this.vx) - C.RELEASE_DECEL);
      } else {
        this.vx = clamp(this.vx + dir * acc, -maxV, maxV);
      }
      this.facing = dir;
    }
  }

  // ------------------------------------------------------------------
  // 水平移動（空中） 仕様書 1.2「空中制御」— 向きは変えない、摩擦なし
  // ------------------------------------------------------------------
  updateAirX(input) {
    const C = SMB.C;
    const dir = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    if (dir === 0) return;
    const s = Math.sign(this.vx), a = Math.abs(this.vx);
    let acc;
    if (s === 0 || s === dir) acc = a < C.WALK_MAX ? C.WALK_ACCEL : C.RUN_ACCEL;   // 前方入力
    else if (a >= C.WALK_MAX) acc = C.RUN_ACCEL;                                   // 後方入力
    else if (this.takeoffSpeed >= C.AIR_BACK_FAST_START) acc = C.RELEASE_DECEL;
    else acc = C.WALK_ACCEL;
    this.vx = clamp(this.vx + dir * acc, -this.airMax, this.airMax);
  }

  // ------------------------------------------------------------------
  // 垂直移動 仕様書 1.3
  // ------------------------------------------------------------------
  updateY(input) {
    const C = SMB.C;
    if (this.onGround && input.pressed.A) {
      const a = Math.abs(this.vx);
      this.jumpRow = C.JUMP_TABLE.findIndex((r) => a < r[0]);
      const r = C.JUMP_TABLE[this.jumpRow];
      this.vy = -r[1];
      this.holdG = r[2];
      this.fallG = r[3];
      this.onGround = false;
      this.ride = null;
      this.beginAir(a);
      SMB.Audio.se(this.big ? 'jump_super' : 'jump_small');
    }
    if (!this.onGround) {
      // 上昇中に A を押し続けている間だけ弱い重力（可変ジャンプの正体）
      const g = (this.vy < 0 && input.held.A) ? this.holdG : this.fallG;
      this.vy += g;
      if (this.vy >= C.FALL_CAP) this.vy = C.FALL_RESET;
    }
  }

  // 踏み切り（ジャンプ・足場から落ちる）の共通処理
  beginAir(speed) {
    const C = SMB.C;
    this.takeoffSpeed = speed;
    this.airMax = speed < C.WALK_MAX ? C.WALK_MAX : C.RUN_MAX;
    this.jumpStartY = this.y;
    this.peakY = this.y;
    this.airFrames = 0;
    this.trail = [];
  }

  // ------------------------------------------------------------------
  // X 移動と壁 仕様書 1.4（左右の判定点: x+2 / x+13、高さ y+8〔SUPER は y+24 も〕）
  // ------------------------------------------------------------------
  moveX() {
    const FP = SMB.C.FP, T = SMB.C.TILE, L = this.level;
    this.x += this.vx;
    // 判定する高さ: SMALL は y+8、SUPER は y+8 と y+24、しゃがみ中は y+24 のみ
    const sideYs = !this.big ? [8] : this.crouching ? [24] : [8, 24];
    for (const oy of sideYs) {
      const px = Math.floor(this.x / FP), py = Math.floor(this.y / FP) + oy;
      const hitR = L.isSolidPx(px + 13, py);
      const hitL = L.isSolidPx(px + 2, py);
      if (hitR && !hitL) {
        const tileLeft = Math.floor((px + 13) / T) * T;
        this.x = (tileLeft - 14) * FP;
        if (this.vx > 0) this.vx = 0;
      } else if (hitL && !hitR) {
        const tileRight = Math.floor((px + 2) / T) * T + T;
        this.x = (tileRight - 2) * FP;
        if (this.vx < 0) this.vx = 0;
      } else if (hitL && hitR) {
        // 左右とも埋まっている（低い隙間でしゃがみを解いた等）: 向いている方へ 1px/f ずつ押し出す
        this.x += this.facing * SMB.C.EMBED_PUSH_PX * FP;
        this.vx = 0;
        this.embedded = true;
        return;
      }
    }
    this.embedded = false;
  }

  // ------------------------------------------------------------------
  // Y 移動と床・天井 仕様書 1.4
  //   足元の判定点: x+3 と x+12 で y+h / 頭上の判定点: x+8 で y+2
  //   床へのめり込みが 5px 以上なら床として扱わない（壁の側面で着地しない）
  // ------------------------------------------------------------------
  moveY() {
    const C = SMB.C, FP = C.FP, T = C.TILE, L = this.level;
    this.y += this.vy;
    const px = Math.floor(this.x / FP), py = Math.floor(this.y / FP);

    if (this.vy >= 0) {
      const fy = py + this.h;
      const hit = L.isSolidPx(px + 3, fy) || L.isSolidPx(px + 12, fy);
      const top = Math.floor(fy / T) * T;
      const onTile = hit && (fy - top < 5 || this.onGround);
      const lift = onTile ? null : this.liftUnder(px, fy);
      if (onTile || lift) {
        this.y = ((onTile ? top : lift.y) - this.h) * FP;
        this.vy = 0;
        if (!this.onGround) this.land();
        this.onGround = true;
        this.ride = lift;
        if (this.big && !this.wantsCrouch) this.crouching = false;   // 着地でしゃがみジャンプ終了
      } else if (this.onGround) {
        this.ride = null;
        // 足場から歩いて外れた: 初速 0 で落下
        this.onGround = false;
        const a = Math.abs(this.vx);
        const r = C.JUMP_TABLE[C.JUMP_TABLE.findIndex((row) => a < row[0])];
        this.holdG = r[2];
        this.fallG = r[3];
        this.jumpRow = -1;
        this.beginAir(a);
      }
    } else {
      const hy = py + (this.crouching ? C.HEAD_PROBE_Y_CROUCH : C.HEAD_PROBE_Y);
      const hc = Math.floor((px + 8) / T), hr = Math.floor(hy / T);
      if (L.isSolidPx(px + 8, hy) || (this.blocks && this.blocks.isHiddenAt(hc, hr))) {
        const bottom = Math.floor(hy / T) * T + T;
        this.y = (bottom - (hy - py)) * FP;
        this.vy = C.CEILING_BOUNCE_VY;           // 下向き 1px/f、以後は落下重力
        this.bumpedTile = { col: Math.floor((px + 8) / T), row: Math.floor(hy / T) };
      }
    }
  }

  // 足元にあるリフト（上面だけ乗れる）。前のフレームで足がリフトの上面より上にあったときだけ着地する
  liftUnder(px, feetNow) {
    if (!this.platforms) return null;
    for (const l of this.platforms) {
      if (px + 12 >= l.x && px + 3 < l.x + l.w && this.feetPrev <= l.y + 1 && feetNow >= l.y) return l;
    }
    return null;
  }

  land() {
    this.lastJump = {
      height: (this.jumpStartY - this.peakY) / SMB.C.FP,
      frames: this.airFrames,
      row: this.jumpRow,
      takeoffSpeed: this.takeoffSpeed,
    };
  }

  record() {
    if (this.onGround) return;
    this.airFrames++;
    if (this.y < this.peakY) this.peakY = this.y;
    if (this.trail.length < 600) this.trail.push({ x: this.x, y: this.y });
  }

  updateFreeFly(input) {
    const C = SMB.C;
    const sp = input.held.B ? C.RUN_MAX : C.WALK_MAX;
    const dx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const dy = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    this.vx = dx * sp;
    this.vy = 0;
    this.x += this.vx;
    this.y = clamp(this.y + dy * sp, 0, (C.SCREEN_H - this.h) * C.FP);
    if (dx) this.facing = dx;
    this.onGround = false;
  }

  // 敵との当たり判定（仕様書 1.5、ピクセル）
  get box() {
    const FP = SMB.C.FP, l = this.x / FP + 3;
    const t = this.y / FP + (this.crouching ? this.h - 12 : 4);
    return { l, t, r: l + 10, b: this.y / FP + this.h };
  }

  // 敵を踏んだ反動（4px/f。A を押していれば保持重力で高く跳ぶ）
  stompBounce() {
    const C = SMB.C;
    this.vy = -C.STOMP_BOUNCE_VY;
    this.holdG = C.JUMP_TABLE[0][2];
    this.fallG = C.JUMP_TABLE[0][3];
    this.onGround = false;
  }

  get anim() {
    if (this.dead) return 'dead';
    if (this.climb) return 'climb';
    if (this.crouching) return 'crouch';
    if (this.throwTimer > 0) return 'throw';
    if (!this.onGround) return 'jump';
    if (this.skidding) return 'skid';
    return this.vx !== 0 ? 'walk' : 'stand';
  }
};

function approachZero(v, d) {
  if (v > 0) return Math.max(0, v - d);
  if (v < 0) return Math.min(0, v + d);
  return 0;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
