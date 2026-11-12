// =====================================================================
// constants.js — 仕様書の数値をすべてここに集約する（調整はこのファイルだけで行う）
// 座標・速度は固定小数点: 1px = FP (4096) 単位。仕様書の 0x01900 形式はそのまま使える。
// =====================================================================
window.SMB = window.SMB || {};

SMB.C = Object.freeze({
  // ---- 画面・ループ（仕様書 1.1）----
  SCREEN_W: 256,
  SCREEN_H: 240,
  FPS: 60,
  MAX_CATCHUP_FRAMES: 5,      // 処理落ち時に一度に追いつく最大フレーム数
  TILE: 16,
  ROWS: 15,
  GROUND_Y: 208,              // 地面上面（13 行目）
  HUD_H: 32,

  // ---- 固定小数点 ----
  FP: 0x1000,                 // 1px = 4096 単位

  // ---- カメラ（仕様書 1.1）----
  CAM_HALF_X: 80,             // 画面内 X がこれを超えると移動量の半分だけ追従
  CAM_FULL_X: 112,            // これを超えると移動量と同じだけ追従

  // ---- タイマー ----
  TIME_TICK_FRAMES: 24,       // TIME が 1 減るフレーム数（動画で実測）

  // ---- 水平移動（仕様書 1.2）※ステップ3で使用 ----
  WALK_MIN_START: 0x00130,
  WALK_ACCEL: 0x00098,
  RUN_ACCEL: 0x000E4,
  WALK_MAX: 0x01900,
  RUN_MAX: 0x02900,
  WATER_WALK_MAX: 0x01100,
  RELEASE_DECEL: 0x000D0,
  SKID_DECEL: 0x001A0,
  SKID_TURN_SPEED: 0x00900,
  RUN_HOLD_FRAMES: 10,
  AIR_BACK_FAST_START: 0x01D00,

  // ---- 垂直移動（仕様書 1.3）※ステップ4で使用 ----
  // 踏切り時の |vx| で選ぶ: [上限(未満), 初速, 保持重力, 落下重力]
  JUMP_TABLE: [
    [0x01000, 0x04000, 0x00200, 0x00700],
    [0x02500, 0x04000, 0x001E0, 0x00600],
    [Infinity, 0x05000, 0x00280, 0x00900],
  ],
  SWIM: { v0: 0x01800, hold: 0x000D0, fall: 0x000A0, maxDown: 0x01800 },
  // ---- 8-4 ----
  SWIM_ACCEL: 0x00098,        // 水中の横加速
  SWIM_DRAG: 0x00040,         // 水中で入力を離したときの減速（地上より小さい＝ゆっくり止まる）
  FIREBAR_DEG: 1.85,          // ファイアバーの回転（度/フレーム。動画から実測）
  FIREBAR_DOTS: 6,            // 火の玉の数（中心を含む）
  FIREBAR_STEP: 8,            // 火の玉の間隔（px）
  SQUID_RISE_FRAMES: 22, SQUID_RISE_VX: 0x0B00, SQUID_RISE_VY: 0x0F00,
  SQUID_SINK_VY: 0x0780, SQUID_SINK_VX: 0x0500, SQUID_SINK_MIN: 26,
  PODOBOO_G: 0x0333, PODOBOO_VY: 0x7000, PODOBOO_WAIT: 70,
  // ---- 8-4 最終決戦（クッパ・橋落とし・エンディング）----
  BOWSER_HP: 5,               // ファイアボールで倒すのに必要な弾数
  BOWSER_SPEED: 0x00600,      // 橋の上で前後する速さ（0.375px/f）
  BOWSER_RANGE: 32,           // 初期位置から前後に動く幅（px）
  BOWSER_STEP_FRAMES: 64,     // 前後の向きを切り替える基準フレーム数
  BOWSER_JUMP_FRAMES: 90,     // ジャンプする間隔
  BOWSER_JUMP_VY: 0x02600,    // ジャンプ初速（マリオが下をくぐれる高さ）
  BOWSER_GRAVITY: 0x00130,    // ジャンプ中の重力（ゆっくり滞空する）
  BOWSER_FIRE_FRAMES: 135,    // 火炎を吐く間隔
  BOWSER_MOUTH_FRAMES: 24,    // 吐く前に口を開けるフレーム数
  BOWSER_FIRE_VX: 0x01800,    // 火炎の横速度（1.5px/f）
  BOWSER_FIRE_VY: 0x01000,    // 狙いの高さへ寄る縦速度（1.0px/f）
  BOWSER_VOLLEY_FRAMES: 110,  // ハンマー連投の間隔
  BOWSER_VOLLEY_COUNT: 6,     // 1 回の連投で投げるハンマーの数
  BOWSER_HAMMER_INTERVAL: 6,  // 連投中のハンマー 1 発ごとの間隔（f）
  BRIDGE_COLLAPSE_STEP: 4,    // 鎖・橋が 1 マスずつ消える間隔（4f、動画で実測）
  BOWSER_FALL_G: 0x00300,     // 橋が落ちてクッパが落下するときの重力
  ENDING_WALK_STOP_COL: 56,   // ピーチ姫／キノピオの前でマリオが立ち止まる列
  RETAINER_CLEAR_WAIT: 250,   // 1-4〜7-4 のメッセージ表示後に次のワールドへ進むまでのフレーム数
  // ---- プクプク（2-2 水中 / 2-3・7-3 橋の飛び跳ね）----
  CHEEP_GREY_SPEED: 0x00600,  // 水中の灰色プクプクの横速度（0.375px/f）
  CHEEP_RED_SPEED: 0x00A00,   // 水中の赤プクプクの横速度（0.625px/f）
  CHEEP_FLY_VX: 0x01300,      // 橋面で下から飛び跳ねるプクプクの基準横速度
  CHEEP_FLY_VY: 0x04D00,      // 飛び跳ねるプクプクの上向き初速
  CHEEP_FLY_G: 0x00120,       // 飛び跳ねるプクプクの重力
  CHEEP_SPAWN_FRAMES: 42,     // 橋面でプクプクが飛び出す間隔（f）
  // ---- ジャンプ台（2-1 / 3-1 / 7-1）----
  SPRING_VY: 0x04800,         // ジャンプ台（A を押さないとき）の反発初速
  SPRING_SUPER_VY: 0x07000,   // ジャンプ台（A を押しているとき）の大ジャンプ初速
  FALL_CAP: 0x04800,          // これ以上になったら
  FALL_RESET: 0x04000,        // この値に戻す
  CEILING_BOUNCE_VY: 0x01000, // 天井に当たった直後の下向き速度
  STOMP_BOUNCE_VY: 0x04000,

  // ---- 演出フレーム数（近似値・仕様書 2.3）----
  GROW_FRAMES: 60,
  SHRINK_FRAMES: 60,
  INVULN_FRAMES: 128,
  STAR_FRAMES: 480,           // スター無敵の長さ（ご指定の 400〜500f。仕様書の近似値は 690f）
  STAR_SLOW_FRAMES: 120,      // 終わり際（残りこのフレーム数）は点滅が遅くなる
  THROW_POSE_FRAMES: 8,       // ファイアボールを投げるポーズ
  DEATH_PAUSE_FRAMES: 30,

  // ---- ブロック・演出（仕様書 3.3 / 3.4 / 3.5、ピクセル単位）----
  BUMP_OFFSETS: [-2, -3, -4, -4, -3, -2, -1, 0],  // 叩かれたブロックの縦ずれ（1f ごと、合計 8f）
  COIN_POP_VY: 5.0,           // ブロックから飛び出すコインの初速（上向き）
  COIN_POP_G: 0.375,
  COIN_POP_FRAMES: 30,
  FRAG_VX: 1.0,               // レンガ破片
  FRAG_VY_TOP: 6.0,
  FRAG_VY_BOTTOM: 4.0,
  FRAG_G: 0.375,
  POPUP_RISE: 1.0,            // 得点表示の上昇速度
  POPUP_FRAMES: 48,
  ITEM_EMERGE_FRAMES: 32,     // アイテムが 16px せり上がるフレーム数
  ITEM_SPEED: 1.0,            // キノコ・スターの横移動
  ITEM_G: 0.25,               // アイテムの重力（近似）
  ITEM_FALL_MAX: 4.0,
  STAR_BOUNCE_VY: 4.0,
  ITEM_BUMP_VY: 3.0,          // 下から突き上げられたアイテムの跳ね上がり
  MULTICOIN_FRAMES: 240,      // 複数コインレンガの受付時間（約 4 秒）
  COINS_PER_1UP: 100,

  // ---- 形態・しゃがみ（仕様書 2.1 / 2.2 / 1.4）----
  FORM_HEIGHT: { small: 16, super: 32, fire: 32 },
  HEAD_PROBE_Y: 2,            // 頭上の判定点（スプライト上端から）
  HEAD_PROBE_Y_CROUCH: 18,    // しゃがみ中（SUPER/FIRE）
  EMBED_PUSH_PX: 1,           // 壁に埋まったとき 1f に押し出す量

  // ---- 敵（仕様書 3.1 / 3.2、固定小数点）----
  ENEMY_EDGE_OVERRIDE: null,  // null=原作どおり / "turn" / "fall"（デバッグの E キーでも切替）
  MAX_ENEMIES: 5,             // 同時に存在できる敵の数
  DESPAWN_LEFT: 64,           // 画面左端からこれだけ外に出たら消す（px）
  SHELL_DESPAWN_RIGHT: 128,   // 滑る甲羅が画面右端からこれだけ外に出たら消す（px）
  ENEMY_GRAVITY: 0x00400,     // 敵の重力（近似）
  ENEMY_FALL_MAX: 0x04000,
  SHELL_SPEED: 0x03000,       // 蹴られた甲羅 3.0 px/f
  SHELL_REVIVE_FRAMES: 300,   // 甲羅になってから復活まで（近似、最後の 60f は震える）
  SHELL_SHAKE_FRAMES: 60,
  SHELL_KICK_GRACE: 8,        // 蹴った直後にマリオへ当たらないフレーム数
  SQUASH_FRAMES: 30,          // 潰れたクリボーが消えるまで
  FLIP_VX: 0x00800,           // ひっくり返って落ちる敵の横速度
  FLIP_VY: 0x03000,           // 同 上向き初速
  PIRANHA_MOVE_FRAMES: 24,    // パックンフラワーが 24px 出入りするフレーム数（近似）
  PIRANHA_UP_FRAMES: 60,      // 出たままのフレーム数（近似）
  PIRANHA_WAIT_FRAMES: 60,    // 土管の中で待つフレーム数（近似）
  PIRANHA_NEAR_PX: 24,        // マリオの中心が土管の中心からこの範囲にいると出てこない
  // ジュゲム / トゲゾー（4-1。動画からの実測＋近似）
  BRO_SPEED: 0x00800,         // ハンマーを投げる敵が行ったり来たりする速さ（0.5px/f）
  BRO_RANGE: 24,              // 出現位置から左右にこの距離（px）まで
  BRO_THROW_FRAMES: 90,       // ハンマーを投げる間隔
  BRO_ARM_FRAMES: 16,         // 投げる前に腕を上げているフレーム数
  BRO_JUMP_FRAMES: 130,       // 跳ねる間隔
  BRO_JUMP_VY: 0x03800,       // 跳ねる初速
  HAMMER_VX: 0x00C00,         // ハンマーの横速度（0.75px/f）
  HAMMER_VY: 0x04000,         // ハンマーを投げ上げる初速
  BULLET_SPEED: 0x01800,      // 砲台の弾の速さ（1.5px/f）
  BULLET_INTERVAL: 100,       // 同じ砲台が次の弾を撃つまでのフレーム数
  BULLET_NEAR: 48,            // マリオがこの距離（px）より近いと撃たない
  BULLET_MAX: 3,              // 同時に飛べる弾の数
  FLY_SPEED: 0x00800,         // 飛ぶパタパタが左へ進む速さ（0.5px/f）
  FLY_AMP: 28,                // 飛ぶパタパタの上下の振れ幅（px）
  FLY_PERIOD: 110,            // 上下 1 往復のフレーム数
  PARA_JUMP_VY: 0x04800,      // パタパタが跳ねる初速（約 2.5 マス。動画の跳ね方からの近似）
  LAKITU_Y: 40,               // 雲に乗って飛ぶ高さ（スプライト上端の y、動画で 40 前後）
  LAKITU_ACCEL: 0x00040,      // マリオへ向かう加速度（行き過ぎて左右に揺れる）
  LAKITU_MIN_SPEED: 0x01000,  // 最高速度の下限（マリオが走るとマリオの速さ + 0.5px/f まで上がる）
  LAKITU_SPEED_MARGIN: 0x00800,
  LAKITU_MAX_SPEED: 0x03800,
  LAKITU_LEAD: 24,            // マリオの速度 × これだけ先回りする（f）
  LAKITU_THROW_FRAMES: 128,   // パイポを投げる間隔（動画で約 128f）
  LAKITU_THROW_POSE: 16,      // 投げる前に手を上げるフレーム数
  LAKITU_LEAVE_SPEED: 0x02000,// 退場するとき左へ飛ぶ速さ
  LAKITU_RESPAWN_FRAMES: 360, // 倒されてから次のジュゲムが来るまで（近似）
  EGG_VY: 0x03000,            // パイポを投げ上げる初速（上向き）
  EGG_VX: 0x00600,            // パイポの横速度（マリオの方へ）
 // ツタ（4-2。速さは動画から実測、つかまりの細部は近似）
  VINE_GROW_SPEED: 1,         // ツタが伸びる速さ（px/f）
  VINE_GRAB_HALF: 6,          // ツタの中心からこの範囲にマリオの体が重なると掴まれる（px）
  VINE_SIDE_OFFSET: 5,        // 掴まっているときのマリオの中心とツタの中心のずれ（px）
  CLIMB_UP_SPEED: 0x01000,    // 登る速さ 1px/f
  CLIMB_DOWN_SPEED: 0x01800,  // 降りる速さ 1.5px/f
  CLIMB_STEP_PX: 8,           // この距離を動くごとに手足のコマを切り替える
  VINE_REGRAB_FRAMES: 16,     // 飛び降りた直後はツタに掴まらない
  VINE_EXIT_FEET: 8,          // 行き先のあるツタ: 足元がこの y より上に出たら次のエリアへ
  VINE_OFFSCREEN_TOP: -48,    // 行き先のあるツタはここ（画面の上の外）まで伸びる
  VINE_AUTO_STOP: 16,         // 下から登ってきたとき、頭がツタの先端 + これに来るまで自動で登る
  SPINY_LIMIT: 4,             // ジュゲム以外の敵がこれ以上いると投げない（敵の枠 MAX_ENEMIES の中）

  // ---- ファイアボール（仕様書 2.4、ピクセル単位。初速・重力・バウンドは近似）----
  FIREBALL_MAX: 2,            // 画面内に同時に存在できる数（爆発中も数える）
  FIREBALL_VX: 4.0,           // 横速度（向いている方へ一定）
  FIREBALL_VY0: 3.0,          // 発射時の縦速度（下向き）
  FIREBALL_G: 0.3125,
  FIREBALL_FALL_MAX: 4.0,
  FIREBALL_BOUNCE_VY: 3.0,    // 床で跳ねたときの上向き速度
  FIREBALL_SPAWN_ABOVE_FEET: 24,
  FIREBALL_EXPLODE_FRAMES: 12,// 爆発演出（3 コマ × 4f）

  // ---- リフト（縦ループ・上下往復・左右往復・落下・天秤リフト。ピクセル単位）----
  LIFT_SPEED: 1,              // 1px/f（動画で実測）
  LIFT_WRAP_TOP: -16,         // この範囲を出ると反対側から戻る
  LIFT_WRAP_BOTTOM: 248,
  LIFT_FALL_SPEED: 2.0,       // 乗ると落ちるリフトの落下速度（px/f）
  LIFT_BALANCE_ACCEL: 0.06,   // 天秤リフトの加速度（px/f^2）
  LIFT_BALANCE_MAX: 2.0,      // 天秤リフトの最大速度（px/f）

  // ---- ワープゾーン ----
  WARPZONE_TEXT_ROW: 6,

  // ---- 土管ワープ（ピクセル / フレーム）----
  PIPE_SPEED: 1,              // 土管に出入りするときの移動 1px/f
  PIPE_FADE_FRAMES: 20,       // 土管に入り切ってから画面が切り替わるまで

  // ---- ゴールポールとクリア（近似、仕様書 3.5）----
  FLAG_SLIDE_SPEED: 2,        // マリオと旗がポールを降りる速さ px/f
  FLAG_SCORE_TABLE: [[72, 5000], [104, 2000], [136, 800], [168, 400], [Infinity, 100]],  // 掴んだ足元の y 以下 → 得点
  FLAG_TURN_FRAMES: 30,       // 降り切ってからポールの反対側で待つフレーム数
  CLEAR_WALK_SPEED: 0x01000,  // 城へ歩く速さ（1.0 px/f、近似）
  TIME_TALLY_PER_FRAME: 1,    // 残り TIME を 1f に 1 ずつ得点へ（1 カウント 50 点）
  TIME_TALLY_SCORE: 50,
  FIREWORK_INTERVAL: 32,      // 花火の間隔
  FIREWORK_SCORE: 500,
  CASTLE_FLAG_FRAMES: 32,     // 城の旗が上がるフレーム数
  CLEAR_END_WAIT: 90,         // すべて終わってから次へ進むまで

  // ---- 得点（仕様書 3.5）'1UP' は残機 +1 ----
  STOMP_CHAIN_SCORES: [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000, '1UP'],
  SHELL_CHAIN_SCORES: [500, 800, 1000, 2000, 4000, 5000, 8000, '1UP'],
  KICK_SCORE: 400,

  // ---- ミス・残機（仕様書 2.3 / 付録B、近似）----
  START_LIVES: 3,
  DEATH_JUMP_VY: 0x04000,     // ミス時に跳ね上がる初速（上向き）
  DEATH_GRAVITY: 0x00400,
  DEATH_TOTAL_FRAMES: 180,    // ミスしてから残機が減るまで（約 3 秒）
  PIT_DEATH_FRAMES: 150,      // 穴に落ちたとき
  INTRO_FRAMES: 150,          // 面番号画面（WORLD 1-1 と残機）約 2.5 秒
  GAMEOVER_FRAMES: 180,
});

// タイル定義（仕様書 4.2 の文字凡例）
// solid: 当たり判定あり / bumpable: 下から叩ける / topOnly: 上面のみ乗れる
SMB.TILE_DEFS = Object.freeze({
  '.': { name: 'air' },
  '#': { name: 'ground', solid: true },
  'B': { name: 'brick', solid: true, bumpable: true },
  '?': { name: 'question', solid: true, bumpable: true },
  'U': { name: 'used', solid: true },
  'X': { name: 'hard', solid: true },
  '[': { name: 'pipe_tl', solid: true },
  ']': { name: 'pipe_tr', solid: true },
  '{': { name: 'pipe_l', solid: true },
  '}': { name: 'pipe_r', solid: true },
  'o': { name: 'coin', coin: true },
  'q': { name: 'pipe_side_rim_top', solid: true },   // 横向き土管の口（上）
  'Q': { name: 'pipe_side_rim_bottom', solid: true },// 横向き土管の口（下）
  'p': { name: 'pipe_side_body_top', solid: true },  // 横向き土管の胴（上）
  'P': { name: 'pipe_side_body_bottom', solid: true },
  'L': { name: 'lava', deadly: true },
  '=': { name: 'bridge', solid: true },
  '/': { name: 'chain' },                            // 8-4: 橋を吊る鎖
  'T': { name: 'platform', topOnly: true },
  // キノコの足場（4-2 の上空）。傘は地面と同じく全面ソリッド、柄は背景
  'h': { name: 'cap_l', solid: true },
  'k': { name: 'cap_m', solid: true },
  'j': { name: 'cap_r', solid: true },
  's': { name: 'stem_top' },
  'S': { name: 'stem' },
  'c': { name: 'cannon_top', solid: true },          // 8-2: 砲台（頭）
  'C': { name: 'cannon_body', solid: true },         // 8-2: 砲台（胴）
  'v': { name: 'barrier', solid: true },             // 8-4: 見えない壁（水面の上へ出ないため）
});

// 面種別ごとの配色（仕様書 4.1）。COLORS の一部を上書きする
SMB.THEMES = Object.freeze({
  overworld:   { sky: '#5c94fc', ground: '#c84c0c', groundLight: '#fcbcb0' },
  underground: { sky: '#000000', ground: '#00808b', groundLight: '#9cfcf0' },
  // キノコの国（4-2 の上空）: 地上と同じ配色で、土管だけオレンジ
  // 8-4: 城（黒い背景・灰色の石積み・灰色の土管）と水中（青い水・緑の石積み・ピンクの土管）
  castle:      { sky: '#000000', ground: '#a8a8a8', groundLight: '#ececec', pipe: '#a8a8a8', pipeLight: '#ececec', pipeDark: '#5c5c5c' },
  water:       { sky: '#3420fe', topSky: '#8577fc', ground: '#00a000', groundLight: '#88e430', pipe: '#d838a0', pipeLight: '#fc9ce4', pipeDark: '#781058' },
  mushroom:    { sky: '#5c94fc', ground: '#c84c0c', groundLight: '#fcbcb0', pipe: '#d86400', pipeLight: '#fca044', pipeDark: '#7c2800' },
  night:       { sky: '#000000', ground: '#c84c0c', groundLight: '#fcbcb0' },
  snow:        { sky: '#000000', ground: '#bcbcbc', groundLight: '#fcfcfc', hill: '#fcfcfc', bush: '#fcfcfc', pipe: '#bcbcbc', pipeLight: '#fcfcfc', pipeDark: '#5c5c5c' },
});

// 仮の配色（スプライト差し替えまでのプレースホルダ）
SMB.COLORS = Object.freeze({
  sky: '#5c94fc',
  ground: '#c84c0c',
  groundDark: '#000000',
  groundLight: '#fcbcb0',
  question: '#fc9838',
  questionDark: '#c84c0c',
  pipe: '#00a800',
  pipeLight: '#80d010',
  pipeDark: '#005000',
  hill: '#00a800',
  hillDark: '#005000',
  bush: '#80d010',
  cloud: '#fcfcfc',
  cloudShade: '#3cbcfc',
  player: '#e40058',
  text: '#fcfcfc',
});
