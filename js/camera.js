// =====================================================================
// camera.js — 仕様書 1.1 のカメラ規則。右方向のみスクロール、左端は壁。
// 座標は固定小数点（FP 単位）で保持する。
// =====================================================================
window.SMB = window.SMB || {};

SMB.Camera = class {
  constructor(level) {
    this.level = level;
    this.x = 0;   // FP 単位
  }

  get px() { return Math.floor(this.x / SMB.C.FP); }

  // target: { x, prevX }（FP 単位）。プレイヤー更新の後に呼ぶ。
  update(target) {
    const C = SMB.C;
    const screenX = (target.x - this.x) / C.FP;
    const dx = target.x - target.prevX;
    if (dx > 0) {
      if (screenX > C.CAM_FULL_X) this.x += dx;
      else if (screenX > C.CAM_HALF_X) this.x += dx >> 1;
    }
    const maxX = this.level.scrollStopX * C.FP;
    if (this.x > maxX) this.x = maxX;
    if (this.x < 0) this.x = 0;
    // 画面左端は壁
    if (target.x < this.x) { target.x = this.x; if (target.vx < 0) target.vx = 0; }
  }
};
