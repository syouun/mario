// =====================================================================
// sprites.js — ゲームの状態から「どのフレームを・どの向きで」描くかを決める。
// フレームの位置は js/sprite_sheet.js（SMB.SPRITE_SHEET.frames）にある。
// 描画そのものは renderer.js。画像がない・フレームが見つからないときは図形で描く。
//
// 命名規則（sprite_sheet.js のキー）
//   hero_<small|super|fire>_<stand|walk0|walk1|walk2|skid|jump|throw|crouch|dead|climb0|climb1>
//   walker_walk0/1, walker_squashed               … クリボーの役
//   beetle_<green|red>_walk0/1, shell_<green|red>[_shake] … ノコノコの役と甲羅
//   plant_open / plant_closed                     … パックンフラワーの役
//   item_grow / item_oneup / item_fire / item_star0/1, coin_spin0〜3
//   fireball0〜3, explode0〜2, fragment
//   tile_<名前>（地下用は tile_<名前>_ug があればそちらを優先）
// 絵はすべて「右向き」で描く。左向きは左右反転して描く。
// =====================================================================
window.SMB = window.SMB || {};

SMB.Sprites = {
  // ---- マリオ（主人公）----
  hero(p, form, anim, h) {
    const FP = SMB.C.FP;
    const f = h <= 16 ? 'small' : (form === 'small' ? 'super' : form);
    let pose;
    switch (anim) {
      case 'dead': pose = 'dead'; break;
      case 'crouch': pose = f === 'small' ? 'stand' : 'crouch'; break;
      case 'throw': pose = 'throw'; break;
      case 'jump': pose = 'jump'; break;
      case 'climb': pose = 'climb' + p.climbFrame; break;
      case 'skid': pose = 'skid'; break;
      case 'walk': pose = 'walk' + (Math.floor(p.x / FP / 5) % 3); break;   // 5px 進むごとにコマ送り
      default: pose = 'stand';
    }
    return { name: `hero_${f}_${pose}`, flipX: anim !== 'dead' && p.facing < 0 };
  },

  // ---- 敵 ----
  enemy(e, frame) {
    const step = Math.floor(frame / 8) % 2;
    const flipY = e.state === 'flipped';
    if (e.type === 'goomba') {
      if (e.state === 'squashed') return { name: 'walker_squashed' };
      return { name: 'walker_walk' + (flipY ? 0 : step), flipY };
    }
    if (e.type === 'buzzy') {
      if (e.isShell || (flipY && e.state !== 'walk')) return { name: `shell_dark${e.shaking ? '_shake' : ''}`, flipY };
      return { name: 'pillbug_walk' + (flipY ? 0 : step), flipX: e.dir < 0, flipY };
    }
    if (e.type === 'squid') return { name: 'squid' + (e.stroking ? 1 : 0), flipY };
    if (e.type === 'podoboo') return { name: 'podoboo', flipX: Math.floor(frame / 4) % 2 === 1, flipY: e.vy > 0 };
    if (e.type === 'firebar') return { name: 'fireball' + (Math.floor(frame / 4) % 4) };
    if (e.type === 'bowser') {
      if (e.disguiseType) {
        return SMB.Sprites.enemy({ type: e.disguiseType, state: 'flipped', dir: e.dir, h: 16 }, frame);
      }
      const bStep = Math.floor((e.t || frame) / 8) % 2;
      const mouth = e.mouthOpen || e.armUp;
      return { name: `boss_${mouth ? 'mouth' : 'walk'}${bStep}`, flipX: e.dir < 0, flipY };
    }
    if (e.type === 'bowser_fire') return { name: 'boss_fire' + (Math.floor((e.t || frame) / 4) % 2), flipX: e.dir < 0 };
    if (e.type === 'cheep_red' || e.type === 'cheep_fly') return { name: 'cheep_red' + step, flipX: e.dir < 0, flipY };
    if (e.type === 'cheep_grey') return { name: 'cheep_grey' + step, flipX: e.dir < 0, flipY };
    if (e.type === 'hammer_bro') return { name: e.armUp ? 'bro_throw' : 'bro_walk' + (Math.floor(frame / 12) % 2), flipX: e.dir < 0, flipY };
    if (e.type === 'hammer') return { name: 'mallet' + (Math.floor(e.t / 3) % 4) };
    if (e.type === 'rocket') return { name: 'rocket' + (Math.floor(frame / 4) % 2), flipX: e.dir < 0, flipY };
    if (e.type === 'koopa_para' || e.type === 'koopa_fly') return { name: 'beetle_green_wing' + step, flipX: e.dir < 0, flipY };
    if (e.type === 'lakitu') return { name: e.throwPose ? 'rider_throw' : 'rider', flipY };
    if (e.state === 'egg') return { name: 'urchin_egg' + (Math.floor(frame / 6) % 2) };
    if (e.type === 'spiny') return { name: 'urchin_walk' + (flipY ? 0 : step), flipX: e.dir < 0, flipY };
    if (e.def && e.def.piranha) return { name: Math.floor(frame / 8) % 2 ? 'plant_closed' : 'plant_open' };
    const color = e.type === 'koopa_red' ? 'red' : 'green';
    if (e.isShell || (flipY && e.h === 16)) return { name: `shell_${color}${e.shaking ? '_shake' : ''}`, flipY };
    return { name: `beetle_${color}_walk${step}`, flipX: e.dir < 0, flipY };
  },

  item(it) {
    switch (it.type) {
      case 'mushroom': return 'item_grow';
      case '1up': return 'item_oneup';
      case 'flower': return 'item_fire';
      case 'star': return 'item_star' + (Math.floor(it.t / 4) % 2);
    }
    return null;
  },

  // タイル文字 → フレーム名（候補を順に試す）
  tile(ch, theme, frame) {
    const blink = [0, 0, 0, 1, 2, 1][Math.floor(frame / 8) % 6];
    const base = {
      '#': 'ground', 'B': 'brick', '?': 'mystery' + blink, 'U': 'used', 'X': 'hard',
      '[': 'pipe_tl', ']': 'pipe_tr', '{': 'pipe_l', '}': 'pipe_r',
      'o': 'coin_tile' + [0, 0, 1, 2, 1][Math.floor(frame / 8) % 5],
      'q': 'side_rim_top', 'Q': 'side_rim_bottom', 'p': 'side_body_top', 'P': 'side_body_bottom',
      'c': 'cannon_top', 'C': 'cannon_body',
      'h': 'cap_l', 'k': 'cap_m', 'j': 'cap_r', 's': 'stem_top', 'S': 'stem',
      '=': 'bridge', '/': 'chain',
    }[ch];
    if (!base && ch !== 'L' && ch !== 'l') return [];
    if (ch === 'L' || ch === 'l') return ch === 'L' ? ['tile_lava_top' + (Math.floor(frame / 14) % 2)] : ['tile_lava'];   // 溶岩（l = 内側）
    if (theme === 'castle') return ['tile_' + base + '_cs', 'tile_' + base];
    if (theme === 'water') return ['tile_' + base + '_wt', 'tile_' + base];
    if (theme === 'underground') return ['tile_' + base + '_ug', 'tile_' + base];
    if (theme === 'mushroom') return ['tile_' + base + '_mush', 'tile_' + base];   // オレンジの土管
    return ['tile_' + base];
  },

  // スター中の色かぶせ（4 色を循環、終わり際は 4 倍ゆっくり）
  starTint(p, frame) {
    if (!(p.starTimer > 0)) return null;
    const slow = p.starTimer < SMB.C.STAR_SLOW_FRAMES;
    return ['#ff3060', '#ffffff', '#30d040', '#ffb000'][Math.floor(frame / (slow ? 8 : 2)) % 4];
  },
};
