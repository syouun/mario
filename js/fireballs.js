// =====================================================================
// fireballs.js — ファイアボール（仕様書 2.4）。座標はピクセル（小数あり）。
//   ・FIRE 形態で B を押した瞬間に発射。画面内に同時 2 個まで（爆発中も 1 個と数える）
//   ・向いている方へ 4px/f で直進、下向き 3px/f から重力で落ち、床に当たると上へ跳ねる
//   ・壁に当たる / 敵に当たると爆発して消える。敵は倒れる（メットなど効かない敵は爆発だけ）
//   ・画面の外に出たら爆発せずに消える
// =====================================================================
window.SMB = window.SMB || {};

SMB.Fireballs = class {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  get count() { return this.list.length; }

  // 発射できたら true
  tryThrow(player) {
    const C = SMB.C, FP = C.FP;
    if (this.list.length >= C.FIREBALL_MAX) return false;
    const px = player.x / FP, feet = player.y / FP + player.h;
    this.list.push({
      x: player.facing > 0 ? px + 12 : px - 4,
      y: feet - C.FIREBALL_SPAWN_ABOVE_FEET,
      vx: player.facing * C.FIREBALL_VX,
      vy: C.FIREBALL_VY0,
      t: 0,
      explode: -1,              // 爆発演出の経過フレーム（-1 = 飛行中）
    });
    return true;
  }

  update(level, cam, enemies) {
    const C = SMB.C;
    for (const f of this.list) {
      f.t++;
      if (f.explode >= 0) { f.explode++; continue; }
      // 横移動と壁
      f.x += f.vx;
      const front = f.vx > 0 ? f.x + 7 : f.x;
      if (level.isSolidPx(front, f.y + 4)) { f.explode = 0; SMB.Audio.se('fire_hit'); continue; }
      // 縦移動と床のバウンド
      f.vy = Math.min(f.vy + C.FIREBALL_G, C.FIREBALL_FALL_MAX);
      f.y += f.vy;
      if (f.vy > 0 && (level.isSolidPx(f.x + 1, f.y + 8) || level.isSolidPx(f.x + 6, f.y + 8))) {
        f.y = Math.floor((f.y + 8) / C.TILE) * C.TILE - 8;
        f.vy = -C.FIREBALL_BOUNCE_VY;
      }
      // 敵
      const box = { l: f.x, t: f.y, r: f.x + 8, b: f.y + 8 };
      for (const e of enemies.list) {
        if (!e.alive || !SMB.overlap(box, e.box)) continue;
        f.explode = 0;
        if (e.onFireballHit) { e.onFireballHit(f, this.game); break; }
        SMB.Audio.se(e.def.fireproof ? 'fire_hit' : 'kick');
        if (e.def.fireproof) break;                    // ファイアが効かない敵（メット等）
        e.flip(Math.sign(f.vx));
        const b = e.box;
        this.game.awardPoints(e.def.fireScore || 100, b.l, b.t - 8);
        break;
      }
      // 画面外
      const camPx = cam.px;
      if (f.x < camPx - 16 || f.x > camPx + C.SCREEN_W + 8 || f.y > C.SCREEN_H) f.removed = true;
    }
    this.list = this.list.filter((f) => !f.removed && f.explode < C.FIREBALL_EXPLODE_FRAMES);
  }
};
