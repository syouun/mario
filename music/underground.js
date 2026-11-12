// =====================================================================
// 地下 BGM（仮）— このプロジェクト用に作ったオリジナルのレトロ風曲です（イ短調、まばらで低め）。
// 差し替え方は music/overworld.js の説明を参照。
// テンポ: 8 分音符 = 12 フレーム（1 小節 = 96 フレーム）
// =====================================================================
window.SMB = window.SMB || {};
SMB.MUSIC = SMB.MUSIC || {};

SMB.MUSIC.underground = {
  id: 'underground',
  loopFrom: 0,
  defaults: {
    pulse1: { duty: 2, vol: 10, env: 'hold' },
    pulse2: { duty: 2, vol: 4, env: 'swell' },
  },
  channels: {
    pulse1:
      'A3:6 r:6 A4:6 r:6 r:24 E4:6 r:6 G4:6 r:6 r:24 | F3:6 r:6 F4:6 r:6 r:24 C4:6 r:6 E4:6 r:6 r:24 | ' +
      'D3:6 r:6 D4:6 r:6 r:24 A3:6 r:6 C4:6 r:6 r:24 | E3:6 r:6 E4:6 r:6 G#3:6 r:6 B3:6 r:6 E4:12 r:36',
    pulse2: 'A3:96 | F3:96 | D3:96 | E3:96',
    triangle: 'A2:48 E2:48 | F2:48 C3:48 | D2:48 A2:48 | E2:96',
    noise: '[t:12 r:36 t:12 r:36]x4',
  },
};
