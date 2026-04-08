import { UserSpecial } from 'boardui-parser';
import { RendererBase } from './renderer-base';
import { ReusablesProvider } from '../reusables-provider';
import { ElementIdProvider } from '../element-id-provider';
import { RenderProperties } from 'boardui-core';

export class UserSpecialRenderer extends RendererBase<UserSpecial> {
  constructor() {
    super('g');
  }

  protected renderPart(
    part: UserSpecial,
    partElement: SVGElement,
    reusablesProvider: ReusablesProvider,
    elementIdProvider: ElementIdProvider,
    renderProperties: RenderProperties,
    renderSubpart: (part: any, partElement: SVGElement) => void
  ): void {
    for (const feature of part.features ?? []) {
      renderSubpart(feature, partElement);
    }
  }
}
