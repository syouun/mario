// =====================================================================
// level.js — マップデータ（levels/*.js）を読み込み、タイル参照を提供する。
// 仕様書 4.2 のスキーマ: 1 面 = 複数エリア、各エリア = 15 行の文字列タイル配列 + objects + deco
// =====================================================================
window.SMB = window.SMB || {};

SMB.Level = class {
  constructor(levelId, areaName) {
    const data = SMB.LEVEL_DATA[levelId];
    if (!data) throw new Error('マップデータがありません: ' + levelId);
    this.id = levelId;
    this.data = data;
    this.areaName = areaName || data.startArea;
    const area = data.areas[this.areaName];
    this.area = area;
    this.width = area.width;               // 列数
    this.height = SMB.C.ROWS;              // 15 行
    this.pixelWidth = this.width * SMB.C.TILE;
    this.timeLimit = data.timeLimit;
    // 書き換え可能な 2 次元配列にしておく（ブロック破壊・使用済み化のため）
    this.tiles = area.tiles.map((row) => row.padEnd(this.width, '.').slice(0, this.width).split(''));
    if (this.tiles.length !== this.height) {
      console.warn(`タイル行数が ${this.tiles.length} 行です（期待値 ${this.height}）`);
    }
    this.objects = area.objects || [];
    this.deco = area.deco || [];
    this.start = area.start || { x: 40, y: 192 };
    this.scrollStopX = area.scrollStopCol != null
      ? area.scrollStopCol * SMB.C.TILE
      : this.pixelWidth - SMB.C.SCREEN_W; // カメラ X（px）の上限
  }

  tileAt(col, row) {
    if (row < 0) return '.';                      // 画面より上は空（頭上は抜けられる）
    if (row >= this.height) return '.';           // 画面より下は穴
    if (col < 0 || col >= this.width) return '.';
    return this.tiles[row][col];
  }

  setTile(col, row, ch) {
    if (row >= 0 && row < this.height && col >= 0 && col < this.width) this.tiles[row][col] = ch;
  }

  // その列が動画から抽出した範囲か（videoCoveredCols は [開始, 終了] または その配列）
  isVideoCovered(col) {
    let cov = this.area.videoCoveredCols;
    if (!cov) return false;
    if (typeof cov[0] === 'number') cov = [cov];
    return cov.some((r) => col >= r[0] && col <= r[1]);
  }

  def(ch) { return SMB.TILE_DEFS[ch] || SMB.TILE_DEFS['.']; }
  isSolid(col, row) { return !!this.def(this.tileAt(col, row)).solid; }

  // ピクセル座標から
  tileAtPx(px, py) { return this.tileAt(Math.floor(px / SMB.C.TILE), Math.floor(py / SMB.C.TILE)); }
  isSolidPx(px, py) { return !!this.def(this.tileAtPx(px, py)).solid; }
};
