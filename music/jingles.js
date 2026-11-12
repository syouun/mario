// =====================================================================
// ジングル（ループしない短い曲）— すべてこのプロジェクト用に作ったオリジナルです。
//   death    : ミス
//   clear    : コースクリア（ゴールで旗を降りたあと）
//   gameover : ゲームオーバー
//   hurry    : 残り時間 100 の警告（鳴り終わると BGM が 1.25 倍速で再開）
// ジングルの間は全チャンネルを使い、効果音は鳴りません（仕様書 5.3）。
// =====================================================================
window.SMB = window.SMB || {};
SMB.MUSIC = SMB.MUSIC || {};

SMB.MUSIC.death = {
  id: 'death', loop: false,
  channels: {
    pulse1: '@e:hold C5:6 B4:6 r:4 G4:10 r:6 F4:8 E4:8 D4:8 C4:30',
    pulse2: '@e:hold @v6 E4:6 D4:6 r:4 B3:10 r:6 A3:8 G3:8 F3:8 E3:30',
    triangle: 'C3:16 r:6 G2:16 B2:16 C3:30',
  },
};

SMB.MUSIC.clear = {
  id: 'clear', loop: false,
  channels: {
    pulse1: '@e:hold C5:6 E5:6 G5:6 C6:18 r:6 A5:6 C6:6 E6:18 r:6 F5:6 A5:6 C6:6 F6:12 G6:12 C7:36',
    pulse2: '@e:hold @v6 G4:6 C5:6 E5:6 G5:18 r:6 E5:6 A5:6 C6:18 r:6 C5:6 F5:6 A5:6 C6:12 D6:12 E6:36',
    triangle: 'C3:36 r:6 A2:36 r:6 F2:30 G2:12 C3:36',
    noise: 'r:36 s:6 r:36 s:6 r:24 k:6 k:6 s:36',
  },
};

SMB.MUSIC.gameover = {
  id: 'gameover', loop: false,
  channels: {
    pulse1: '@e:hold E5:16 C5:16 A4:16 r:8 F4:12 E4:12 D4:12 C4:40',
    pulse2: '@e:hold @v5 C5:16 A4:16 E4:16 r:8 D4:12 C4:12 B3:12 G3:40',
    triangle: 'A2:48 r:8 F2:36 C2:40',
  },
};

SMB.MUSIC.hurry = {
  id: 'hurry', loop: false,
  channels: {
    pulse1: '@e:hold [C6:4 E6:4 G6:4 r:4]x3 C7:16',
    pulse2: '@e:hold @v7 [G5:4 C6:4 E6:4 r:4]x3 G6:16',
    triangle: '[C3:8 r:8]x3 C3:16',
  },
};

// エンディングファンファーレ（8-4 で大魔王を倒し、姫の部屋へ向かうとき〜クリアメッセージ）
SMB.MUSIC.ending = {
  id: 'ending', loop: false,
  channels: {
    pulse1: [
      '@d2 @v11 @e:hold',
      'G4:8 C5:8 E5:8 G5:16 E5:8 C6:24 |',
      'A4:8 C5:8 F5:8 A5:16 F5:8 D6:24 |',
      'G4:8 B4:8 D5:8 G5:12 A5:12 B5:16 G5:8 |',
      'C6:12 G5:12 E5:12 C5:12 D5:12 E5:12 F5:12 F#5:12 |',
      'G5:16 E5:8 C6:24 A5:16 F5:8 D6:24 |',
      'B5:12 C6:12 D6:16 G5:8 C6:48 r:12',
    ].join(' '),
    pulse2: [
      '@d1 @v7 @e:hold',
      'E4:8 G4:8 C5:8 E5:16 C5:8 E5:24 |',
      'F4:8 A4:8 C5:8 F5:16 C5:8 F#5:24 |',
      'D4:8 G4:8 B4:8 D5:12 E5:12 F5:16 D5:8 |',
      'E5:12 E5:12 C5:12 G4:12 A4:12 B4:12 C5:12 C5:12 |',
      'E5:16 C5:8 E5:24 F5:16 C5:8 F#5:24 |',
      'F5:12 E5:12 F5:16 B4:8 E5:48 r:12',
    ].join(' '),
    triangle: [
      'C3:24 E3:24 G3:24 |',
      'F3:24 A3:24 D3:24 |',
      'G3:24 B2:24 G2:24 |',
      'C3:24 E3:24 F3:24 D3:24 |',
      'G3:24 A3:24 F3:24 D3:24 |',
      'G2:24 G3:24 C3:48 r:12',
    ].join(' '),
    noise: [
      '[k:12 h:12 s:12 h:12 k:12 s:12]x3 |',
      'k:12 s:12 k:12 s:12 k:12 s:12 k:12 s:12 |',
      '[k:12 h:12 s:12 h:12]x2 |',
      'k:12 k:12 s:24 k:48 r:12',
    ].join(' '),
  },
};
