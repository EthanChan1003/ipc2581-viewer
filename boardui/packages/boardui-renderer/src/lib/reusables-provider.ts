import {
  LineDesc,
  FillDesc,
  Color,
  StandardPrimitive,
  Package,
  Layer,
} from 'boardui-parser';

export interface ReusablesProvider {
  /** Provides layer element.
   * @param name Layer name.
   */
  getLayerByName(name: string): Layer;

  /** Provides color element.
   * @param colorId Color identifier.
   */
  getColorById(colorId: string): Color;

  /** Provides line desctiptor element.
   * @param lineDescId line descriptor identifier.
   * @returns LineDesc or null if not found (dictionary is optional in IPC-2581)
   */
  getLineDescById(lineDescId: string): LineDesc | null;

  /** Provides fill desctiptor element.
   * @param fillDescId fill descriptor identifier.
   * @returns FillDesc or null if not found (dictionary is optional in IPC-2581)
   */
  getFillDescById(fillDescId: string): FillDesc | null;

  /** Provides predefined primitive.
   * @param primitiveId Primitive identifier.
   */
  getPrimitiveById(primitiveId: string): StandardPrimitive;

  /** Provides package element.
   * @param name Package name.
   */
  getPackageByName(name: string): Package;
}
