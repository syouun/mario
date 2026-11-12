// =====================================================================
// スター BGM（仮）— このプロジェクト用に作ったオリジナルのレトロ風曲です（速く、せき立てる感じ）。
// 差し替え方は music/overworld.js の説明を参照。
// テンポ: 8 分音符 = 8 フレーム（1 小節 = 64 フレーム）
// =====================================================================
window.SMB = window.SMB || {};
SMB.MUSIC = SMB.MUSIC || {};

SMB.MUSIC.star = {
  id: 'star',
  loopFrom: 0,
  defaults: {
    pulse1: { duty: 2, vol: 11, env: 'stac' },
    pulse2: { duty: 1, vol: 7, env: 'stac' },
  },
  channels: {
    pulse1:
      'F5:8 A5:8 C6:8 A5:8 F5:8 A5:8 C6:16 | E5:8 G5:8 C6:8 G5:8 E5:8 G5:8 C6:16 | ' +
      'D5:8 F5:8 Bb5:8 F5:8 D5:8 F5:8 Bb5:16 | C5:8 E5:8 G5:8 C6:8 G5:8 E5:8 C5:16',
    pulse2: '[r:8 A4:8 r:8 C5:8]x2 | [r:8 G4:8 r:8 C5:8]x2 | [r:8 F4:8 r:8 Bb4:8]x2 | [r:8 E4:8 r:8 G4:8]x2',
    triangle: '[F2:8 F3:8]x4 | [C2:8 C3:8]x4 | [Bb1:8 Bb2:8]x4 | [C2:8 C3:8]x4',
    noise: '[k:8 h:8 s:8 h:8 k:8 k:8 s:8 h:8]x4',
  },
};
