// =====================================================================
// audio.js — ファミコン風の音源エンジンとシーケンサ（仕様書 5 章）。
//
// 構成
//   1. 合成部（makeApuCore）: パルス波 ×2・三角波・ノイズを 1 サンプルずつ合成し、
//      実機と同じ非線形ミキサーとフィルタを通す。AudioWorklet の中で動かす。
//      AudioWorklet が使えない環境では ScriptProcessor で同じ合成部を動かす。
//   2. シーケンサ（SMB.Audio）: ゲームの 1 フレーム（60Hz）ごとに tick() で進み、
//      4 チャンネルそれぞれの「音程・音量・音色」を決めて合成部へ送る。
//
// チャンネルの奪い合い（仕様書 5.3）
//   各チャンネルは BGM の声と SE の声を持つ。SE が鳴っている間はそのチャンネルの出力は SE。
//   BGM の声は消えている間も進み続けるので、SE が終わると曲のその時点の音から復帰する。
//   同じチャンネルに SE が重なったら、優先度の高い方（同じなら新しい方）が鳴る。
//   ジングル（ミス・クリアなど）は全チャンネルを使い、鳴っている間は SE を受け付けない。
//
// ブラウザの決まりで、最初のキー入力かクリックまでは音を出せない。
// =====================================================================
window.SMB = window.SMB || {};

// ---------------------------------------------------------------------
// 合成部。この関数はソース文字列として AudioWorklet にも送るので、外の変数を参照しないこと。
// regs: { p1:{f,v,d}, p2:{f,v,d}, tri:{f,on}, noi:{p,v,m}, master }
//   f: 周波数 Hz / v: 音量 0〜15 / d: デューティ 0〜3（12.5/25/50/75%）
//   p: ノイズの周期番号 0〜15 / m: 短周期モード（金属的な音）
// ---------------------------------------------------------------------
function makeApuCore(sampleRate) {
  const DUTY = [
    [0, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 0, 0, 0],
    [1, 0, 0, 1, 1, 1, 1, 1],
  ];
  const TRI = [];
  for (let i = 15; i >= 0; i--) TRI.push(i);
  for (let i = 0; i <= 15; i++) TRI.push(i);
  const NOISE_PERIOD = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
  const CPU = 1789773;
  const s = {
    regs: {
      p1: { f: 0, v: 0, d: 2 }, p2: { f: 0, v: 0, d: 2 },
      tri: { f: 0, on: false }, noi: { p: 0, v: 0, m: false }, master: 0.6,
    },
    ph1: 0, ph2: 0, phT: 0, triStep: 0, noiAcc: 0, lfsr: 1, noiBit: 0,
    hp1: 0, hp1in: 0, hp2: 0, hp2in: 0, lp: 0,
  };
  // 1 次フィルタの係数（実機の出力段: 90Hz と 440Hz のハイパス、14kHz のローパス）
  const hpA = (fc) => { const rc = 1 / (2 * Math.PI * fc), dt = 1 / sampleRate; return rc / (rc + dt); };
  const lpA = (fc) => { const rc = 1 / (2 * Math.PI * fc), dt = 1 / sampleRate; return dt / (rc + dt); };
  const HP1 = hpA(90), HP2 = hpA(440), LP = lpA(14000);

  s.render = function (out) {
    const r = s.regs;
    for (let i = 0; i < out.length; i++) {
      // パルス波
      let p1 = 0, p2 = 0;
      if (r.p1.v > 0 && r.p1.f > 20) {
        s.ph1 = (s.ph1 + r.p1.f / sampleRate) % 1;
        p1 = DUTY[r.p1.d & 3][Math.floor(s.ph1 * 8)] ? r.p1.v : 0;
      }
      if (r.p2.v > 0 && r.p2.f > 20) {
        s.ph2 = (s.ph2 + r.p2.f / sampleRate) % 1;
        p2 = DUTY[r.p2.d & 3][Math.floor(s.ph2 * 8)] ? r.p2.v : 0;
      }
      // 三角波（音量の制御はなく、止めると最後の段の値で止まる＝プチノイズが出ない）
      if (r.tri.on && r.tri.f > 20) {
        s.phT += r.tri.f * 32 / sampleRate;
        while (s.phT >= 1) { s.phT -= 1; s.triStep = (s.triStep + 1) & 31; }
      }
      const t = TRI[s.triStep];
      // ノイズ（15bit LFSR）
      let n = 0;
      if (r.noi.v > 0) {
        s.noiAcc += CPU / NOISE_PERIOD[r.noi.p & 15] / sampleRate;
        while (s.noiAcc >= 1) {
          s.noiAcc -= 1;
          const fb = (s.lfsr & 1) ^ ((s.lfsr >> (r.noi.m ? 6 : 1)) & 1);
          s.lfsr = (s.lfsr >> 1) | (fb << 14);
        }
        n = (s.lfsr & 1) ? 0 : r.noi.v;
      }
      // 非線形ミキサー（仕様書 5.1 の式）
      const pulse = (p1 + p2) > 0 ? 95.88 / (8128 / (p1 + p2) + 100) : 0;
      const tnd = (t + n) > 0 ? 159.79 / (1 / (t / 8227 + n / 12241) + 100) : 0;
      let x = pulse + tnd;
      // ハイパス 2 段 + ローパス
      const y1 = HP1 * (s.hp1 + x - s.hp1in); s.hp1in = x; s.hp1 = y1;
      const y2 = HP2 * (s.hp2 + y1 - s.hp2in); s.hp2in = y1; s.hp2 = y2;
      s.lp += LP * (y2 - s.lp);
      out[i] = s.lp * r.master * 2.4;
    }
  };
  return s;
}

// AudioWorklet 用のソース（file:// でも読めるよう、data URL にして読み込む）
const APU_WORKLET_SRC = `
${makeApuCore.toString()}
class NesApuProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.core = makeApuCore(sampleRate);
    this.port.onmessage = (e) => { this.core.regs = e.data; };
  }
  process(inputs, outputs) {
    const ch = outputs[0];
    this.core.render(ch[0]);
    for (let c = 1; c < ch.length; c++) ch[c].set(ch[0]);
    return true;
  }
}
registerProcessor('nes-apu', NesApuProcessor);
`;

// ---------------------------------------------------------------------
// 音名 → 周波数
// ---------------------------------------------------------------------
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToHz(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 0;
  let semi = NOTE_INDEX[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ノイズの打楽器（周期番号・音量・減衰・長さ）
const DRUMS = {
  k: { p: 12, v: 11, decay: 1, m: false },   // キック風（低いノイズ）
  s: { p: 6, v: 10, decay: 1, m: false },    // スネア風
  h: { p: 1, v: 4, decay: 1, m: false },     // ハイハット風（短く小さく）
  t: { p: 3, v: 6, decay: 1, m: true },      // 金属音
};

// ---------------------------------------------------------------------
// 曲データの読み込み（仕様書 5.2 の形式 + 短縮記法）
//
// 1 チャンネルは「イベントの配列」または「短縮記法の文字列」:
//   配列 : [{ note:'E5', len:8, duty:2, vol:10, env:'pluck' }, { rest:8 }, { drum:'h', len:8 }]
//   文字列: "@d2 @v10 @e:pluck E5:8 r:8 [C5:4 E5:4]x2 | h:8"
//     NOTE:長さ（フレーム）/ r:長さ = 休符 / k s h t:長さ = ノイズの打楽器（キック・スネア・ハット・金属）
//     @dN = デューティ 0〜3 / @vN = 音量 0〜15 / @e:名前 = 音量の形（hold / stac / pluck / swell）
//     [ ... ]xN = 繰り返し / | は小節線（無視される）
// ---------------------------------------------------------------------
function parseTrack(src, defaults) {
  const d = Object.assign({ duty: 2, vol: 10, env: 'hold' }, defaults || {});
  if (Array.isArray(src)) {
    return src.map((e) => {
      if (e.rest != null) return { hz: 0, len: e.rest };
      if (e.drum) return { drum: DRUMS[e.drum] || DRUMS.h, len: e.len };
      return { hz: noteToHz(e.note), len: e.len, duty: e.duty ?? d.duty, vol: e.vol ?? d.vol, env: e.env || d.env };
    });
  }
  // 繰り返しを展開
  let text = String(src);
  const rep = /\[([^\[\]]*)\]x(\d+)/;
  while (rep.test(text)) text = text.replace(rep, (_, body, n) => Array(Number(n)).fill(body).join(' '));
  const out = [];
  let duty = d.duty, vol = d.vol, env = d.env;
  for (const tok of text.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    if (tok.startsWith('@d')) { duty = Number(tok.slice(2)); continue; }
    if (tok.startsWith('@v')) { vol = Number(tok.slice(2)); continue; }
    if (tok.startsWith('@e:')) { env = tok.slice(3); continue; }
    const [name, lenStr] = tok.split(':');
    const len = Number(lenStr);
    if (!len) continue;
    if (name === 'r') out.push({ hz: 0, len });
    else if (DRUMS[name]) out.push({ drum: DRUMS[name], len });
    else out.push({ hz: noteToHz(name), len, duty, vol, env });
  }
  return out;
}

// 音量の形（t: 音の中の経過フレーム, len: 音の長さ, v: 最大音量）
const ENVELOPES = {
  hold: (t, len, v) => (t < len - 2 ? v : 0),                       // 伸ばして最後に 2f 切る
  stac: (t, len, v) => (t < Math.max(2, Math.floor(len * 0.5)) ? v : 0), // 半分で切る
  pluck: (t, len, v) => (t < len - 1 ? Math.max(0, v - Math.floor(t / 3)) : 0), // 弾いて減衰
  swell: (t, len, v) => (t < len - 1 ? Math.min(v, 3 + Math.floor(t / 2)) : 0), // じわっと立ち上がる
};

// ---------------------------------------------------------------------
// 1 チャンネル分の曲の声
// ---------------------------------------------------------------------
class TrackVoice {
  constructor(events, kind, loopFrom, tempoScale) {
    this.ev = events;
    this.kind = kind;            // 'pulse' | 'tri' | 'noise'
    this.loopFrom = loopFrom;    // null = ループしない
    this.scale = tempoScale || 1;
    this.i = 0;
    this.t = 0;
    this.done = events.length === 0;
  }

  // 1 フレーム進めて、このフレームのレジスタ値を返す
  step() {
    if (this.done) return null;
    const e = this.ev[this.i];
    const len = Math.max(1, Math.round(e.len / this.scale));
    let r;
    if (this.kind === 'noise') {
      const dr = e.drum;
      r = dr ? { p: dr.p, v: Math.max(0, dr.v - Math.floor(this.t / dr.decay)), m: dr.m } : { p: 0, v: 0, m: false };
    } else if (this.kind === 'tri') {
      r = { f: e.hz, on: e.hz > 0 && this.t < len - 1 };
    } else {
      const env = ENVELOPES[e.env] || ENVELOPES.hold;
      r = { f: e.hz, v: e.hz > 0 ? env(this.t, len, e.vol) : 0, d: e.duty };
    }
    if (++this.t >= len) {
      this.t = 0;
      if (++this.i >= this.ev.length) {
        if (this.loopFrom != null) this.i = this.loopFrom;
        else this.done = true;
      }
    }
    return r;
  }
}

// ---------------------------------------------------------------------
// シーケンサ（ゲームから使う窓口）
// ---------------------------------------------------------------------
SMB.MUSIC = SMB.MUSIC || {};     // music/*.js が曲を登録する
SMB.SFX = SMB.SFX || {};         // sounds.js が効果音を登録する

SMB.Audio = (function () {
  const CH = ['p1', 'p2', 'tri', 'noi'];
  const SONG_KEY = { p1: 'pulse1', p2: 'pulse2', tri: 'triangle', noi: 'noise' };
  const KIND = { p1: 'pulse', p2: 'pulse', tri: 'tri', noi: 'noise' };
  const SILENT = { p1: { f: 0, v: 0, d: 2 }, p2: { f: 0, v: 0, d: 2 }, tri: { f: 0, on: false }, noi: { p: 0, v: 0, m: false } };

  const st = {
    ctx: null, node: null, core: null, mode: 'なし（キー入力かクリックで開始）',
    music: null,      // { id, voices: {p1:TrackVoice..}, jingle, onEnd, tempoScale }
    se: { p1: null, p2: null, tri: null, noi: null },   // { name, frames, i, priority }
    paused: false,
    muted: false,
    volume: (SMB.SOUND && SMB.SOUND.volume != null) ? SMB.SOUND.volume : 0.6,
    lastRegs: SILENT,
  };

  // ---- 初期化（最初のユーザー操作で呼ぶ）----
  async function unlock() {
    if (st.ctx) { if (st.ctx.state === 'suspended') st.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { st.mode = 'このブラウザは Web Audio 非対応'; return; }
    const ctx = new AC();
    st.ctx = ctx;
    try {
      // file:// では Blob URL が拒否されるため、まず data URL で読み込み、だめなら Blob URL を試す
      try {
        await ctx.audioWorklet.addModule('data:application/javascript,' + encodeURIComponent(APU_WORKLET_SRC));
      } catch (e1) {
        await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([APU_WORKLET_SRC], { type: 'application/javascript' })));
      }
      st.node = new AudioWorkletNode(ctx, 'nes-apu', { outputChannelCount: [1] });
      st.node.connect(ctx.destination);
      st.mode = 'AudioWorklet';
    } catch (err) {
      // file:// などで AudioWorklet が使えないときは ScriptProcessor で同じ合成部を動かす
      st.core = makeApuCore(ctx.sampleRate);
      const sp = ctx.createScriptProcessor(1024, 0, 1);
      sp.onaudioprocess = (e) => st.core.render(e.outputBuffer.getChannelData(0));
      sp.connect(ctx.destination);
      st.node = sp;
      st.mode = 'ScriptProcessor（代替経路）';
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  const onGesture = () => unlock();
  window.addEventListener('keydown', onGesture);
  window.addEventListener('pointerdown', onGesture);

  function send(regs) {
    regs.master = (st.muted || st.paused) ? 0 : st.volume;
    st.lastRegs = regs;
    if (!st.node) return;
    if (st.core) st.core.regs = regs;
    else if (st.node.port) st.node.port.postMessage(regs);
  }

  // ---- 曲 ----
  function makeVoices(song, tempoScale) {
    const voices = {};
    const loop = song.loop === false ? null : (song.loopFrom || 0);
    for (const c of CH) {
      const src = song.channels[SONG_KEY[c]];
      if (!src) continue;
      const def = (song.defaults && song.defaults[SONG_KEY[c]]) || {};
      voices[c] = new TrackVoice(parseTrack(src, def), KIND[c], loop, tempoScale * (song.tempoScale || 1));
    }
    return voices;
  }

  // id: SMB.MUSIC のキー。opts: { tempoScale, restart }
  function playMusic(id, opts) {
    opts = opts || {};
    const song = SMB.MUSIC[id];
    if (!song) { stopMusic(); return; }
    const scale = opts.tempoScale || 1;
    if (!opts.restart && st.music && !st.music.jingle && st.music.id === id && st.music.tempoScale === scale) return;
    st.music = { id, voices: makeVoices(song, scale), jingle: false, tempoScale: scale };
  }

  // ジングル: 全チャンネルを使い、鳴っている間は SE を受け付けない。終わったら onEnd
  function playJingle(id, onEnd) {
    const song = SMB.MUSIC[id];
    if (!song) { if (onEnd) onEnd(); return; }
    for (const c of CH) st.se[c] = null;
    st.music = { id, voices: makeVoices(Object.assign({}, song, { loop: false }), 1), jingle: true, onEnd, tempoScale: 1 };
  }

  function stopMusic() { st.music = null; }

  // ---- 効果音 ----
  function se(name) {
    const def = SMB.SFX[name];
    if (!def || (st.music && st.music.jingle)) return;
    const cur = st.se[def.channel];
    if (cur && cur.priority > def.priority) return;            // 弱い SE は鳴らさない
    st.se[def.channel] = { name, frames: def.frames, i: 0, priority: def.priority };
  }

  // ---- 1 フレーム進める（ゲームの update から毎フレーム呼ぶ）----
  function tick() {
    const regs = {};
    const m = st.music;
    let allDone = !!m;
    for (const c of CH) {
      const v = m && m.voices[c];
      const bgm = v ? v.step() : null;                  // BGM は SE に消されていても進める
      if (v && !v.done) allDone = false;
      const s = st.se[c];
      let out = bgm;
      if (s) {
        out = s.frames[s.i++];
        if (s.i >= s.frames.length) st.se[c] = null;
      }
      regs[c] = Object.assign({}, SILENT[c], out || {});
    }
    if (m && allDone) {
      st.music = null;
      if (m.onEnd) m.onEnd();
    }
    send(regs);
  }

  function setPaused(p) {
    if (st.paused === p) return;
    st.paused = p;
    send(Object.assign({}, st.lastRegs));
  }

  function toggleMute() { st.muted = !st.muted; send(Object.assign({}, st.lastRegs)); }

  // 情報パネル用
  function describe() {
    const m = st.music;
    const ses = CH.map((c) => (st.se[c] ? `${c}:${st.se[c].name}` : null)).filter(Boolean).join(' ');
    return {
      mode: st.mode + (st.muted ? '（消音中）' : ''),
      music: m ? `${m.id}${m.jingle ? '（ジングル）' : ''}${m.tempoScale !== 1 ? ' x' + m.tempoScale : ''}` : '—',
      se: ses || '—',
      owner: CH.map((c) => `${c}=${st.se[c] ? 'SE' : (m && m.voices[c] && !m.voices[c].done ? 'BGM' : '—')}`).join(' '),
    };
  }

  return { unlock, playMusic, playJingle, stopMusic, se, tick, setPaused, toggleMute, describe,
           get currentMusic() { return st.music ? st.music.id : null; },
           get isJingle() { return !!(st.music && st.music.jingle); },
           _state: st, _parseTrack: parseTrack, _noteToHz: noteToHz, _makeApuCore: makeApuCore };
})();
