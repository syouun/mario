// =====================================================================
// vines.js — ツタ（4-2）。
//   ツタ入りのブロックを叩くと、ブロックの上から 1px/f で上へ伸びる。
//   行き先（dest）のあるツタは画面の上まで伸び続け、登り切ると別のエリアへ移る。
//   移った先では地面の下から伸びてきたツタをマリオが自動で登ってくる。
// 1 本のツタ = { x（列の左端 px）, base（根元の y）, top（いまの先端の y）, targetTop, dest }
// =====================================================================
window.SMB = window.SMB || {};

SMB.Vines = class {
  constructor(level) {
    this.level = level;
    this.list = [];
  }

  // col 列の y=base から伸ばし始める。targetTop まで伸びたら止まる
  sprout(col, base, targetTop, dest) {
    const v = { x: col * SMB.C.TILE, base, top: base, targetTop, dest: dest || null };
    this.list.push(v);
    return v;
  }

  get growing() { return this.list.some((v) => v.top > v.targetTop); }

  update() {
    for (const v of this.list) {
      if (v.top > v.targetTop) v.top = Math.max(v.targetTop, v.top - SMB.C.VINE_GROW_SPEED);
    }
  }

  // マリオの体（box）が重なっているツタ
  touching(box) {
    const H = SMB.C.VINE_GRAB_HALF;
    for (const v of this.list) {
      const cx = v.x + 8;
      if (box.r > cx - H && box.l < cx + H && box.b > v.top + 4 && box.t < v.base) return v;
    }
    return null;
  }
};
