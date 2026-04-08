import { Arc, LineDescRef } from 'boardui-parser';
import '../extensions/fill-desc.extensions';
import { RendererBase } from './renderer-base';
import { ReusablesProvider } from '../reusables-provider';
import { getLineDescSVGAttributes } from '../extensions/line-desc.extensions';

export class ArcRenderer extends RendererBase<Arc> {
  constructor() {
    super('path');
  }

  protected renderPart(
    part: Arc,
    partElement: SVGElement,
    reusablesProvider: ReusablesProvider
  ): void {
    const sx = part.startX;
    const sy = part.startY;
    const ex = part.endX;
    const ey = part.endY;
    const cx = part.centerX;
    const cy = part.centerY;

    const r = Math.sqrt((sx - cx) * (sx - cx) + (sy - cy) * (sy - cy));

    const isFullCircle =
      Math.abs(sx - ex) < 1e-9 && Math.abs(sy - ey) < 1e-9;

    let d: string;

    if (isFullCircle) {
      // Split into two half-arcs for a full circle
      // Compute the diametrically opposite point
      const mx = 2 * cx - sx;
      const my = 2 * cy - sy;
      // IPC-2581 Y-up → SVG Y-down: invert sweep
      const sweepFlag = part.clockwise ? 0 : 1;
      d =
        `M ${sx} ${sy} ` +
        `A ${r} ${r} 0 0 ${sweepFlag} ${mx} ${my} ` +
        `A ${r} ${r} 0 0 ${sweepFlag} ${sx} ${sy}`;
    } else {
      // Compute angles to determine largeArcFlag
      const startAngle = Math.atan2(sy - cy, sx - cx);
      const endAngle = Math.atan2(ey - cy, ex - cx);

      let angleDiff = part.clockwise
        ? startAngle - endAngle
        : endAngle - startAngle;
      if (angleDiff < 0) {
        angleDiff += 2 * Math.PI;
      }
      const largeArcFlag = angleDiff > Math.PI ? 1 : 0;
      const sweepFlag = part.clockwise ? 0 : 1;

      d = `M ${sx} ${sy} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${ex} ${ey}`;
    }

    partElement.setAttribute('d', d);
    partElement.setAttribute('fill', 'none');

    if (part.lineDesc) {
      const lineDesc =
        part.lineDesc instanceof LineDescRef
          ? reusablesProvider.getLineDescById(part.lineDesc.id)
          : part.lineDesc;
      if (lineDesc) {
        const lineDescAttributes = getLineDescSVGAttributes(lineDesc);
        for (const lineDescAttribute of lineDescAttributes) {
          partElement.setAttribute(...lineDescAttribute);
        }
      } else {
        partElement.setAttribute('stroke', 'currentColor');
        partElement.setAttribute('stroke-width', '0.1');
      }
    } else {
      partElement.setAttribute('stroke', 'currentColor');
      partElement.setAttribute('stroke-width', '0.1');
    }
  }
}
