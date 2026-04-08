import { Location } from './location';
import { StandardPrimitiveRef } from './standard-primitive-ref';
import { XForm } from './x-form';

export class LayerPad {
  layerRef: string = null!;
  location: Location = null!;
  standardPrimitiveRef: StandardPrimitiveRef = null!;
  xform: XForm | null = null;
}
