import { LayerHole } from './layer-hole';
import { LayerPad } from './layer-pad';

export class PadStack {
  net: string = null!;
  layerHoles: LayerHole[] = [];
  layerPads: LayerPad[] = [];
}
