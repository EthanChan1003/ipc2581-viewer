import { Arc } from './arc';
import { Circle } from './circle';
import { Contour } from './contour';
import { Oval } from './oval';
import { Polyline } from './polyline';
import { RectCenter } from './rect-center';

export type StandardPrimitive = Contour | Polyline | Circle | RectCenter | Oval | Arc;
