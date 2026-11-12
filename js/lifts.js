// =====================================================================
// lifts.js — リフト全般とジャンプ台（座標はピクセル）。
//   ・lift_column : 同じ列に count 枚が等間隔で並び、上下へ一方向に動き続けて画面端で反対側へ戻る（1-2 等）
//   ・lift_v      : 指定した高さの範囲（row1〜row2 または y1〜y2）を上下に往復するリフト（1-3, 1-4, 2-3, 2-4 等）
//   ・lift_h      : 指定した横幅（col〜col+span）を左右に往復するリフト（1-3, 2-4 等）
//   ・lift_fall   : マリオが乗っている間だけ下へ落ちていくリフト（1-3, 2-4 等）
//   ・lift_balance: 滑車とロープで繋がった 2 枚の天秤リフト。片方に乗ると沈み、もう片方が上がる（1-3, 2-4, 3-3, 4-3 等）
//   ・spring      : ジャンプ台（2-1, 3-1, 7-1 等）。上に乗ると縮んでから大ジャンプさせる
// =====================================================================
window.SMB = window.SMB || {};

SMB.Lifts = class {
  constructor(level) {
    const C = SMB.C, T = C.TILE;
    this.list = [];
    this.pulleys = [];
    for (const o of level.objects) {
      if (o.type === 'lift_column') {
        const n = o.count || 2;
        const span = C.LIFT_WRAP_BOTTOM - C.LIFT_WRAP_TOP;
        for (let i = 0; i < n; i++) {
          this.list.push({
            kind: 'column',
            x: o.col * T, w: (o.width || 3) * T, h: 8,
            y: C.LIFT_WRAP_TOP + (span / n) * i + (o.offset || 0),
            vy: (o.dir || 1) * C.LIFT_SPEED, dx: 0, dy: 0, wrapped: false,
          });
        }
      } else if (o.type === 'lift_v') {
        const y1 = o.y1 != null ? o.y1 : (o.row1 != null ? o.row1 * T : 48);
        const y2 = o.y2 != null ? o.y2 : (o.row2 != null ? o.row2 * T : 176);
        const mid = (y1 + y2) / 2, amp = (y2 - y1) / 2;
        const phase = o.phase || 0;
        const y0 = mid + Math.sin(phase) * amp;
        this.list.push({
          kind: 'v',
          x: o.col * T, w: (o.width || 3) * T, h: 8,
          y: y0, y1, y2, mid, amp,
          omega: (o.speed || 1.0) / Math.max(16, amp),
          t: phase, dx: 0, dy: 0, wrapped: false,
        });
      } else if (o.type === 'lift_h') {
        const x1 = o.x1 != null ? o.x1 : o.col * T;
        const x2 = o.x2 != null ? o.x2 : (o.col + (o.span || 4)) * T;
        const mid = (x1 + x2) / 2, amp = (x2 - x1) / 2;
        const phase = o.phase || 0;
        const x0 = mid + Math.sin(phase) * amp;
        this.list.push({
          kind: 'h',
          x: x0, y: o.row * T, w: (o.width || 3) * T, h: 8,
          x1, x2, mid, amp,
          omega: (o.speed || 1.0) / Math.max(16, amp),
          t: phase, dx: 0, dy: 0, wrapped: false,
        });
      } else if (o.type === 'lift_fall') {
        this.list.push({
          kind: 'fall',
          x: o.col * T, y: o.row * T, w: (o.width || 3) * T, h: 8,
          dx: 0, dy: 0, wrapped: false,
        });
      } else if (o.type === 'lift_balance') {
        const w = (o.width || 3) * T;
        const topY = (o.topRow != null ? o.topRow : 2) * T;
        const left = {
          kind: 'balance',
          x: o.col1 * T, y: (o.row1 != null ? o.row1 : 7) * T, w, h: 8,
          dx: 0, dy: 0, wrapped: false,
        };
        const right = {
          kind: 'balance',
          x: o.col2 * T, y: (o.row2 != null ? o.row2 : 7) * T, w, h: 8,
          dx: 0, dy: 0, wrapped: false,
        };
        const pulley = { left, right, topY, v: 0, snapped: false };
        left.pulley = pulley;
        right.pulley = pulley;
        this.pulleys.push(pulley);
        this.list.push(left, right);
      } else if (o.type === 'spring') {
        const baseY = (o.row + 1) * T;
        this.list.push({
          kind: 'spring', isSpring: true,
          x: o.col * T, baseY, y: baseY - 32, w: 16, h: 32,
          t: 0, superJump: false, dx: 0, dy: 0, wrapped: false,
        });
      }
    }
  }

  update(player) {
    const C = SMB.C, top = C.LIFT_WRAP_TOP, bottom = C.LIFT_WRAP_BOTTOM;
    for (const p of this.pulleys) {
      const L = p.left, R = p.right;
      const beforeL = L.y, beforeR = R.y;
      if (p.snapped) {
        L.y += C.LIFT_FALL_SPEED * 1.5;
        R.y += C.LIFT_FALL_SPEED * 1.5;
      } else {
        const onL = player && player.ride === L;
        const onR = player && player.ride === R;
        if (onL && !onR) p.v = Math.min(C.LIFT_BALANCE_MAX, p.v + C.LIFT_BALANCE_ACCEL);
        else if (onR && !onL) p.v = Math.max(-C.LIFT_BALANCE_MAX, p.v - C.LIFT_BALANCE_ACCEL);
        else if (p.v > 0) p.v = Math.max(0, p.v - C.LIFT_BALANCE_ACCEL * 0.5);
        else if (p.v < 0) p.v = Math.min(0, p.v + C.LIFT_BALANCE_ACCEL * 0.5);
        L.y += p.v;
        R.y -= p.v;
        if (L.y <= p.topY + 8 || R.y <= p.topY + 8) {
          p.snapped = true;
          p.v = 0;
        }
      }
      L.dy = L.y - beforeL;
      R.dy = R.y - beforeR;
      L.dx = 0;
      R.dx = 0;
    }

    for (const l of this.list) {
      if (l.kind === 'balance') continue;
      l.wrapped = false;
      const bx = l.x, by = l.y;
      if (l.kind === 'column') {
        l.y += l.vy;
        if (l.y > bottom) { l.y -= bottom - top; l.wrapped = true; }
        if (l.y < top) { l.y += bottom - top; l.wrapped = true; }
      } else if (l.kind === 'v') {
        l.t += l.omega;
        l.y = l.mid + Math.sin(l.t) * l.amp;
      } else if (l.kind === 'h') {
        l.t += l.omega;
        l.x = l.mid + Math.sin(l.t) * l.amp;
      } else if (l.kind === 'fall') {
        if (player && player.ride === l && l.y < C.SCREEN_H + 16) {
          l.y += C.LIFT_FALL_SPEED;
        }
      } else if (l.kind === 'spring') {
        if (player && player.ride === l) {
          l.t++;
          const comp = l.t <= 4 ? 8 : l.t <= 8 ? 16 : 8;
          l.y = l.baseY - 32 + comp;
        } else {
          l.t = 0;
          l.superJump = false;
          l.y = l.baseY - 32;
        }
      }
      l.dx = l.wrapped ? 0 : l.x - bx;
      l.dy = l.wrapped ? 0 : l.y - by;
    }
  }
};
