/**
 * 手続き的な動きの部品。詳しくは docs/avatar-motion.md。
 */

/**
 * 2次系の動き（t3ssel8r "Giving Personality to Procedural Animations using Math"）。目標値に、性格のある動きで追従する。
 *
 * - f: 周波数。目標へ向かう速さ
 * - zeta: 減衰。1 で行き過ぎなし、1 未満で行き過ぎて戻る
 * - r: 応答。0 でゆっくり動き出す、1 で即座に、負だと最初に反対へ動く（予備動作）
 *
 * 描画の遅い端末で1コマが長くても崩れないよう、細かく刻んで計算し、k2 も安定な範囲に引き上げる。
 */
/** 1回の計算で進める最大の秒数 */
const MAX_STEP_S = 1 / 120;

export class SecondOrder {
  private k1 = 0;
  private k2 = 0;
  private k3 = 0;
  private previousTarget: number | null = null;
  value = 0;
  velocity = 0;

  constructor(f: number, zeta: number, r: number) {
    this.setParameters(f, zeta, r);
  }

  setParameters(f: number, zeta: number, r: number) {
    this.k1 = zeta / (Math.PI * f);
    this.k2 = 1 / (2 * Math.PI * f) ** 2;
    this.k3 = (r * zeta) / (2 * Math.PI * f);
  }

  update(delta: number, target: number): number {
    if (this.previousTarget === null) {
      // 最初は目標の位置から始める（読み込み直後にTポーズから腕を振り下ろさないように）
      this.previousTarget = target;
      this.value = target;
    }
    if (delta <= 0) return this.value;
    // 1コマが長い（描画の遅い端末・引っかかり）と、大きな刻みの計算では行き過ぎが極端になるので、細かく刻んで進める。
    // その間、目標はこのコマの前の値から直線的に動いたものとする
    const from = this.previousTarget;
    const targetVelocity = (target - from) / delta;
    const steps = Math.max(1, Math.ceil(delta / MAX_STEP_S));
    const h = delta / steps;
    const k2 = Math.max(this.k2, (h * h) / 2 + (h * this.k1) / 2, h * this.k1);
    for (let i = 1; i <= steps; i++) {
      const x = from + ((target - from) * i) / steps;
      this.value += h * this.velocity;
      this.velocity += (h * (x + this.k3 * targetVelocity - this.value - this.k1 * this.velocity)) / k2;
    }
    this.previousTarget = target;
    if (!Number.isFinite(this.value) || !Number.isFinite(this.velocity)) {
      this.value = target;
      this.velocity = 0;
    }
    return this.value;
  }

  /** 外から勢いを与える（跳ねる・耳をピクッと動かす） */
  kick(velocity: number) {
    this.velocity += velocity;
  }
}

function hash(index: number, seed: number): number {
  const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** なめらかな1次元のノイズ（-1〜1）。正弦波の揺れのように周期が見えない */
export function noise(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i, seed);
  const b = hash(i + 1, seed);
  return (a + (b - a) * u) * 2 - 1;
}

/** 大きなゆらぎと細かなゆらぎを重ねたノイズ（-1〜1 くらい） */
export function fractalNoise(t: number, seed: number): number {
  return noise(t, seed) * 0.7 + noise(t * 2.3 + 17.3, seed + 1) * 0.3;
}

/**
 * 身振りの強調（ビート）1つ分の動き。dt はビートの時刻からの経過秒。
 * 少し前にわずかに反対へ動いてから（予備動作）、ビートで大きく動き、ゆっくり戻る
 */
export function beatPulse(dt: number): number {
  const prepare = 0.16;
  const release = 0.45;
  if (dt < -prepare || dt > release) return 0;
  if (dt < 0) return -0.3 * Math.sin((Math.PI * (dt + prepare)) / prepare);
  return Math.sin((Math.PI * dt) / release) * (1 - (0.3 * dt) / release);
}
