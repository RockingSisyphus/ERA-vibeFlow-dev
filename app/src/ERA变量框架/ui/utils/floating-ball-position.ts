export interface FloatingBallPlacementInput {
  viewportTop: number;
  viewportHeight: number;
  ballHeight: number;
  safeTop: number;
  safeBottom: number;
  sendFormTop: number | null;
  gap?: number;
  fallbackBottomReserve?: number;
}

export interface FloatingBallPlacementBounds {
  minTop: number;
  maxTop: number;
  defaultTop: number;
}

const finiteOr = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);

export function clampFloatingBallTop(top: number, bounds: FloatingBallPlacementBounds): number {
  return Math.min(bounds.maxTop, Math.max(bounds.minTop, finiteOr(top, bounds.defaultTop)));
}

/**
 * 只计算视口几何，不读取 DOM。宿主输入栏存在时以其顶部作为硬边界；否则保留一段
 * 保守的底部空间，避免 ERA 小球回落到常见的移动端发送控件区域。
 */
export function calculateFloatingBallPlacement(input: FloatingBallPlacementInput): FloatingBallPlacementBounds {
  const viewportTop = finiteOr(input.viewportTop, 0);
  const viewportHeight = Math.max(0, finiteOr(input.viewportHeight, 0));
  const ballHeight = Math.max(1, finiteOr(input.ballHeight, 50));
  const safeTop = Math.max(0, finiteOr(input.safeTop, 0));
  const safeBottom = Math.max(0, finiteOr(input.safeBottom, 0));
  const gap = Math.max(0, finiteOr(input.gap ?? 12, 12));
  const fallbackBottomReserve = Math.max(0, finiteOr(input.fallbackBottomReserve ?? 96, 96));
  const viewportBottom = viewportTop + viewportHeight;
  const minTop = viewportTop + safeTop + gap;
  const fallbackBoundary = viewportBottom - Math.max(fallbackBottomReserve, safeBottom + gap);
  const sendFormBoundary =
    input.sendFormTop !== null && Number.isFinite(input.sendFormTop) && input.sendFormTop > viewportTop
      ? input.sendFormTop
      : fallbackBoundary;
  const lowerBoundary = Math.min(viewportBottom - safeBottom, sendFormBoundary);
  const maxTop = Math.max(minTop, lowerBoundary - gap - ballHeight);
  const visualCenterTop = viewportTop + viewportHeight * 0.52 - ballHeight / 2;
  const defaultTop = Math.min(maxTop, Math.max(minTop, visualCenterTop));
  return { minTop, maxTop, defaultTop };
}
