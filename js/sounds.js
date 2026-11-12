// =====================================================================
// sounds.js — 効果音（SE）の定義。すべてこのプロジェクト用に作ったファミコン風の音です。
//
// 1 つの SE = { channel, priority, frames }
//   channel : 'p1'（パルス 1）/ 'p2'（パルス 2）/ 'noi'（ノイズ）… 仕様書 5.3 の割り当て
//   priority: 同じチャンネルで重なったとき、大きい方が勝つ（同じなら新しい方）
//   frames  : 1 フレームごとの音。パルスは { f: 周波数Hz, v: 音量0〜15, d: デューティ0〜3 }、
//             ノイズは { p: 周期番号0〜15, v: 音量, m: 短周期モード }
// 音を変えたいときは、下の helper を組み合わせて frames を作り直すだけでよい。
// =====================================================================
window.SMB = window.SMB || {};

(function () {
  const hz = (n) => SMB.Audio._noteToHz(n);

  // 周波数を f0 → f1 へ指数的に動かす（v0 → v1 へ音量も変える）
  function sweep(f0, f1, frames, v0, v1, d) {
    const out = [];
    for (let i = 0; i < frames; i++) {
      const k = frames > 1 ? i / (frames - 1) : 0;
      out.push({ f: f0 * Math.pow(f1 / f0, k), v: Math.round(v0 + (v1 - v0) * k), d });
    }
    return out;
  }
  // 音を順に鳴らす（notes: [音名, フレーム数, 音量?]）。音量はそれぞれ減衰させる
  function seq(notes, d, decay) {
    const out = [];
    for (const [n, len, vol] of notes) {
      for (let i = 0; i < len; i++) {
        out.push({ f: n ? hz(n) : 0, v: n ? Math.max(0, (vol || 12) - Math.floor(i / (decay || 99))) : 0, d });
      }
    }
    return out;
  }
  function noise(p, frames, v0, decayEvery, m) {
    const out = [];
    for (let i = 0; i < frames; i++) out.push({ p, v: Math.max(0, v0 - Math.floor(i / decayEvery)), m: !!m });
    return out;
  }
  const def = (channel, priority, frames) => ({ channel, priority, frames });

  SMB.SFX = {
    // ---- パルス 1: マリオ自身の動き（仕様書 5.3）----
    jump_small: def('p1', 2, sweep(330, 990, 14, 12, 6, 2)),          // チビのジャンプ: 速く上がる
    jump_super: def('p1', 2, sweep(220, 660, 16, 12, 6, 1)),          // スーパーのジャンプ: 低めでゆっくり
    swim:       def('p1', 2, sweep(520, 300, 9, 10, 3, 2)),            // 水中のひと漕ぎ: 低くやわらかい下降音
    stomp:      def('p1', 3, sweep(880, 330, 8, 13, 5, 2)),           // 踏みつけ: 下がる短い音
    kick:       def('p1', 3, [...sweep(1400, 900, 3, 13, 10, 3), ...sweep(1100, 700, 4, 10, 4, 3)]),  // 蹴る・倒す
    bump:       def('p1', 1, sweep(150, 110, 8, 14, 4, 2)),           // 固いものを叩いた
    fireball:   def('p1', 2, sweep(1600, 700, 5, 12, 6, 3)),          // ファイアボールを投げる
    pipe:       def('p1', 3, [...sweep(500, 250, 6, 12, 8, 2), ...seq([[null, 3]], 2),
                              ...sweep(500, 250, 6, 12, 8, 2), ...seq([[null, 3]], 2),
                              ...sweep(500, 250, 6, 12, 6, 2)]),       // 土管・被弾（縮む）
    flagpole:   def('p1', 4, (() => {                                 // 旗が降りる: 階段状に下がる長い音
      const out = [];
      for (let i = 0; i < 64; i++) out.push({ f: 1400 * Math.pow(0.5, Math.floor(i / 4) / 6), v: i < 56 ? 10 : 10 - (i - 56), d: 1 });
      return out;
    })()),

    // ---- パルス 2: アイテム・得点 ----
    coin:       def('p2', 3, seq([['C6', 4, 11], ['G6', 22, 11]], 1, 3)),      // コイン: 2 音
    item:       def('p2', 2, (() => {                                         // アイテムが出る: 上がる分散和音
      const ns = ['C4', 'E4', 'G4', 'C5', 'D4', 'F#4', 'A4', 'D5', 'E4', 'G#4', 'B4', 'E5'];
      return seq(ns.map((n) => [n, 3, 10]), 2);
    })()),
    powerup:    def('p2', 4, (() => {                                         // パワーアップ: 上がって下がる
      const ns = ['G4', 'B4', 'D5', 'G5', 'A4', 'C#5', 'E5', 'A5', 'B4', 'D#5', 'F#5', 'B5', 'C#6', 'B5'];
      return seq(ns.map((n) => [n, 3, 11]), 2);
    })()),
    oneup:      def('p2', 5, seq([['E6', 5, 11], ['G6', 5, 11], ['E7', 5, 11], ['C7', 5, 11], ['D7', 5, 11], ['G7', 8, 11]], 1, 4)),
    vine:       def('p2', 3, (() => {                                         // ツタが伸びる: ゆっくり上がる長い分散和音
      const ns = ['C4', 'G4', 'C5', 'E5', 'D4', 'A4', 'D5', 'F#5', 'E4', 'B4', 'E5', 'G#5', 'F4', 'C5', 'F5', 'A5'];
      return seq(ns.map((n) => [n, 4, 10]), 2, 6);
    })()),
    cannon:     def('noi', 2, noise(6, 14, 11, 2)),                           // 砲台が弾を撃つ「ボッ」
    tally:      def('p2', 1, seq([['A6', 2, 8]], 2)),                         // TIME を得点に換えるときの「ピッ」

    // ---- ノイズ ----
    break:      def('noi', 3, noise(10, 24, 13, 2)),                          // レンガが壊れる
    fire_hit:   def('noi', 2, noise(4, 8, 10, 1)),                            // ファイアボールが弾ける
    firework:   def('noi', 4, noise(13, 36, 14, 3)),                          // 花火

    // ---- 8-4 最終決戦（クッパ・橋崩落）----
    bowser_fire: def('noi', 3, (() => {                                       // クッパの火炎: 激しい炎の噴射音
      const out = [];
      for (let i = 0; i < 28; i++) out.push({ p: 5 + Math.floor(i / 4), v: Math.max(2, 13 - Math.floor(i / 3)), m: (i & 1) === 0 });
      return out;
    })()),
    bridge_break: def('noi', 4, [...noise(3, 2, 13, 2, true), ...noise(9, 2, 11, 2, false)]), // 鎖・橋がカタカタと崩れる音
    bowser_fall:  def('p1', 5, sweep(560, 90, 56, 14, 5, 1)),                 // クッパが溶岩へ落ちていく咆哮
  };
})();
