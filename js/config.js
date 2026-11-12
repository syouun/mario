// =====================================================================
// config.js — キー割り当て。自由に書き換えてください（複数キーの同時割り当て可）。
// キー名は KeyboardEvent.code（例: 'KeyA', 'ArrowLeft', 'Space', 'ShiftLeft'）。
// 一覧: https://developer.mozilla.org/ja/docs/Web/API/UI_Events/Keyboard_event_code_values
// =====================================================================
window.SMB = window.SMB || {};

SMB.KEY_CONFIG = {
  left:  ['ArrowLeft'],
  right: ['ArrowRight'],
  up:    ['ArrowUp'],
  down:  ['ArrowDown'],                          // しゃがみ（ステップ6で有効）
  A:     ['KeyA', 'KeyX', 'Space'],              // ジャンプ
  B:     ['KeyB', 'KeyZ', 'ShiftLeft', 'ShiftRight'], // ダッシュ（後でファイアボール）
  start: ['Enter'],
};

// サウンド（O キーで消音の切替）
SMB.SOUND = {
  volume: 0.6,   // 0〜1
};

// ゲームパッド（Standard Gamepad 配置のボタン番号）
// 0=下 1=右 2=左 3=上（Xbox なら A/B/X/Y）、12〜15=十字キー、9=START
SMB.PAD_CONFIG = {
  left:  [14],
  right: [15],
  up:    [12],
  down:  [13],
  A:     [0, 1],
  B:     [2, 3],
  start: [9],
  stickDeadZone: 0.5,
};
