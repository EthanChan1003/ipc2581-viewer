import { DrillLayer } from './layers/drill-layer';
import { RendererProvider } from './renderer-provider';
import { ConductorLayer } from './layers/conductor-layer';
import { IPC2581, Layer, Side, Step, StepRepeat, StandardPrimitiveRef } from 'boardui-parser';
import { RenderContext } from './render-context';
import { SilkscreenLayer } from './layers/silkscreen-layer';
import { ComponentLayer } from './layers/component-layer';
import { ProfileLayer } from './layers/profile-layer';
import { ElementType } from './element-type';
import { RenderProperties } from 'boardui-core';
import { ElementIdProvider } from './element-id-provider';
import { getPolygonBounds } from './extensions/polygon.extensions';
import { ReusablesProvider } from './reusables-provider';
import './extensions/xform.extensions';

export class SVGPCBRenderer {
  private _cloneableSvgElement: SVGElement;

  constructor(
    private _reusablesProvider: ReusablesProvider,
    private _renderProperties: RenderProperties
  ) {
    this._cloneableSvgElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    this._cloneableSvgElement.setAttribute(
      'xmlns',
      'http://www.w3.org/2000/svg'
    );
  }

  render(
    pcb: IPC2581,
    stepName: string,
    side: Side,
    elementIdProvider: ElementIdProvider
  ): SVGElement {
    const step = pcb.ecad.cadData.steps.find((x) => x.name === stepName);
    if (!step) {
      throw new Error('Step not found');
    }

    const renderContext = new RenderContext(
      this._reusablesProvider,
      elementIdProvider,
      this._renderProperties,
      RendererProvider.getRenderer
    );

    const svgElement: SVGElement =
      this._cloneableSvgElement.cloneNode() as SVGElement;
    svgElement.setAttribute(ElementType.STEP, step.name);
    const defsElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'defs'
    );

    if (side === 'TOP') {
      svgElement.setAttribute('transform', 'scale(-1,1) rotate(180)');
    } else {
      svgElement.setAttribute('transform', 'scale(1,1) rotate(180)');
    }

    // Use the first step that has a profile polygon for viewBox calculation
    const profileStep = pcb.ecad.cadData.steps.find((s) => s.profile?.polygon);
    if (!profileStep) {
      throw new Error('No step with a valid profile polygon found');
    }
    const bounds = getPolygonBounds(profileStep.profile!.polygon);
    svgElement.setAttribute(
      'viewBox',
      `${bounds.offsetX - this._renderProperties.padding} ${
        bounds.offsetY - this._renderProperties.padding
      } ${bounds.width + this._renderProperties.padding * 2} ${
        bounds.height + this._renderProperties.padding * 2
      }`
    );

    if (this._renderProperties.dropShadow) {
      const filterElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'filter'
      );
      filterElement.setAttribute('id', 'board-shadow');
      const dropShadowElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'feDropShadow'
      );
      dropShadowElement.setAttribute(
        'dx',
        this._renderProperties.dropShadow.dx.toString()
      );
      dropShadowElement.setAttribute(
        'dy',
        this._renderProperties.dropShadow.dy.toString()
      );
      dropShadowElement.setAttribute(
        'stdDeviation',
        this._renderProperties.dropShadow.stdDeviation.toString()
      );
      filterElement.appendChild(dropShadowElement);
      defsElement.appendChild(filterElement);
    }
    svgElement.appendChild(defsElement);

    const stepGroupElement = this.renderStep(
      pcb,
      step,
      side,
      renderContext,
      elementIdProvider,
      bounds,
      true
    );
    svgElement.appendChild(stepGroupElement);

    return svgElement;
  }

  private renderStep(
    pcb: IPC2581,
    step: Step,
    side: Side,
    renderContext: RenderContext,
    elementIdProvider: ElementIdProvider,
    bounds: ReturnType<typeof getPolygonBounds>,
    isRoot: boolean
  ): SVGElement {
    console.log(`[renderStep] Step: ${step.name}, side: ${side}, isRoot: ${isRoot}`);
    console.log(`[renderStep] layerFeatures count: ${step.layerFeatures.length}`);
    console.log(`[renderStep] stepRepeats count: ${step.stepRepeats?.length ?? 0}`);
    step.layerFeatures.forEach(lf => {
      const setCount = lf.sets?.length ?? 0;
      let totalFeatures = 0;
      let totalPads = 0;
      let totalHoles = 0;
      lf.sets?.forEach(s => {
        totalFeatures += s.features?.length ?? 0;
        totalPads += s.pads?.length ?? 0;
        totalHoles += s.holes?.length ?? 0;
      });
      console.log(`  - layerRef: "${lf.layerRef}", sets: ${setCount}, features: ${totalFeatures}, pads: ${totalPads}, holes: ${totalHoles}`);
    });
    const groupElement: SVGElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'g'
    );
    groupElement.setAttribute(ElementType.STEP, step.name);

    const profileLayer = new Layer();
    profileLayer.name = 'PROFILE';
    const profileLayerElement = new ProfileLayer(
      profileLayer,
      step,
      renderContext
    ).render();

    if (isRoot && this._renderProperties.dropShadow) {
      profileLayerElement.setAttribute('filter', 'url(#board-shadow)');
    }

    // Filter layerRefs to only include layers that exist in the layer definitions
    // Some tools (like Altium Designer) may reference layers that aren't defined
    const layers = pcb.content.layerRefs
      .map((x) => x.name)
      .map((name) => {
        try {
          return renderContext.reusablesProvider.getLayerByName(name);
        } catch {
          console.warn(`Layer '${name}' referenced but not defined, skipping.`);
          return null;
        }
      })
      .filter((layer): layer is Layer => layer !== null)
      .filter(
        (layer) => layer.side === side || layer.layerFunction === 'DRILL'
      );

    // IPC-2581 layerFunction classification based on standard
    // This ensures compatibility with different EDA tools (Altium, KiCad, etc.)
    const isConductorLayer = (layer: Layer) =>
      [
        'CONDUCTOR',
        'SIGNAL',
        'PLANE',
        'CONDFILM',
        'CONDFOIL',
        'CONDUCTIVE_ADHESIVE',
        'RESISTIVE',
        'CAPACITIVE',
        'MIXED',
      ].includes(layer.layerFunction);

    const isSilkscreenLayer = (layer: Layer) =>
      ['SILKSCREEN', 'LEGEND'].includes(layer.layerFunction);

    const isDrillLayer = (layer: Layer) =>
      layer.layerFunction === 'DRILL';

    // Only render layers that have an actual LayerFeature entry in this Step.
    // Sub-steps in a panel may not have data for every global layer reference.
    const availableLayerNames = new Set(
      step.layerFeatures.map((lf) => lf.layerRef)
    );

    const conductorLayers = layers
      .filter(isConductorLayer)
      .filter((layer) => availableLayerNames.has(layer.name));
    const componentLayers = conductorLayers.map((conductorLayer) => {
      const componentLayer = new Layer();
      componentLayer.name = `${conductorLayer.name}`;
      componentLayer.layerFunction = 'COMPONENT';
      return componentLayer;
    });
    const drillLayers = layers
      .filter(isDrillLayer)
      .filter((layer) => availableLayerNames.has(layer.name));

    // Also include layers that contain drill data (some EDA tools put drills on non-DRILL layers)
    const drillLayerNames = new Set(drillLayers.map((l) => l.name));
    const additionalDrillLayers = layers.filter((layer) => {
      if (drillLayerNames.has(layer.name)) return false;
      const layerFeature = step.layerFeatures.find(
        (lf) => lf.layerRef === layer.name
      );
      return layerFeature?.sets?.some((s) => s.holes?.length > 0);
    });
    drillLayers.push(...additionalDrillLayers);

    const silkscreenLayers = layers
      .filter(isSilkscreenLayer)
      .filter((layer) => availableLayerNames.has(layer.name));

    const conductorLayerElements = conductorLayers
      .map(
        (layer) =>
          new ConductorLayer(
            layer,
            step,
            renderContext,
            step.layerFeatures.find((x) => x.layerRef === layer.name)!
          )
      )
      .map<[Layer, SVGElement]>((x) => [x.layer, x.render()]);

    const componentLayerElements = componentLayers
      .map((layer) => new ComponentLayer(layer, step, renderContext))
      .map<[Layer, SVGElement]>((x) => [x.layer, x.render()]);

    const drillLayerElements = drillLayers
      .map(
        (layer) =>
          new DrillLayer(
            layer,
            step,
            renderContext,
            step.layerFeatures.find((x) => x.layerRef === layer.name)!,
            bounds
          )
      )
      .map<[Layer, SVGElement, DrillLayer]>((x) => [x.layer, x.render(), x]);

    const silkscreenLayerElements = silkscreenLayers
      .map(
        (layer) =>
          new SilkscreenLayer(
            layer,
            step,
            renderContext,
            step.layerFeatures.find((x) => x.layerRef === layer.name)!
          )
      )
      .map<[Layer, SVGElement]>((x) => [x.layer, x.render()]);

    console.log(`[renderStep] ${step.name}: conductorLayers=${conductorLayers.length}, drillLayers=${drillLayers.length}, silkscreenLayers=${silkscreenLayers.length}, components=${step.components?.length ?? 0}`);
    console.log(`[renderStep] ${step.name}: conductorElements=${conductorLayerElements.length}, componentElements=${componentLayerElements.length}, drillElements=${drillLayerElements.length}, silkscreenElements=${silkscreenLayerElements.length}`);

    // Render PadStack pads on conductor layers
    const stepPadStacks = step.padStacks || [];
    if (stepPadStacks.length > 0) {
      for (const [layer, layerElement] of conductorLayerElements) {
        for (const padStack of stepPadStacks) {
          for (const layerPad of padStack.layerPads || []) {
            if (layerPad.layerRef === layer.name) {
              const padGroup: SVGElement = document.createElementNS(
                'http://www.w3.org/2000/svg',
                'g'
              );
              const transformation: string[] = [];
              if (layerPad.location) {
                transformation.push(
                  `translate(${layerPad.location.x},${layerPad.location.y})`
                );
              }
              if (layerPad.xform) {
                transformation.push(layerPad.xform.getSVGTransformation());
              }
              if (transformation.length > 0) {
                padGroup.setAttribute('transform', transformation.join(' '));
              }

              try {
                const standardPrimitive =
                  layerPad.standardPrimitiveRef instanceof StandardPrimitiveRef
                    ? renderContext.reusablesProvider.getPrimitiveById(
                        layerPad.standardPrimitiveRef.id
                      )
                    : layerPad.standardPrimitiveRef;
                if (standardPrimitive) {
                  const renderer = RendererProvider.getRenderer(standardPrimitive);
                  renderer.render(standardPrimitive, padGroup, renderContext);
                }
              } catch (e) {
                console.warn(`Failed to render PadStack LayerPad: ${e}`);
              }

              layerElement.appendChild(padGroup);
            }
          }
        }
      }

      // Render PadStack layer holes into drill masks
      for (const [, maskElement] of drillLayerElements) {
        if (!maskElement) continue;
        for (const padStack of stepPadStacks) {
          for (const layerHole of padStack.layerHoles || []) {
            const circleElement: SVGElement = document.createElementNS(
              'http://www.w3.org/2000/svg',
              'circle'
            );
            circleElement.setAttribute('cx', layerHole.x.toString());
            circleElement.setAttribute('cy', layerHole.y.toString());
            circleElement.setAttribute(
              'r',
              (layerHole.diameter / 2).toString()
            );
            circleElement.setAttribute('fill', 'black');
            maskElement.appendChild(circleElement);
          }
        }
      }
    }

    for (const drillLayer of drillLayerElements.map((x) => x[2])) {
      drillLayer.apply([
        [profileLayer, profileLayerElement],
        ...conductorLayerElements,
        ...componentLayerElements,
        ...silkscreenLayerElements,
      ]);
    }

    groupElement.append(
      profileLayerElement,
      ...conductorLayerElements.map((x) => x[1]),
      ...drillLayerElements.map((x) => x[1]),
      ...silkscreenLayerElements.map((x) => x[1]),
      ...componentLayerElements.map((x) => x[1])
    );

    // Render StepRepeats (sub-boards in panel layouts)
    for (const repeat of step.stepRepeats ?? []) {
      console.log(`[StepRepeat] Processing: stepRef="${repeat.stepRef}", nx=${repeat.nx}, ny=${repeat.ny}, dx=${repeat.dx}, dy=${repeat.dy}`);
      const subStep = pcb.ecad.cadData.steps.find(
        (s) => s.name === repeat.stepRef
      );
      if (!subStep) {
        console.warn(`StepRepeat references unknown step '${repeat.stepRef}', skipping.`);
        continue;
      }
      console.log(`[StepRepeat] Found subStep: ${subStep.name}, layerFeatures: ${subStep.layerFeatures.length}`);

      const nx = Number(repeat.nx) || 1;
      const ny = Number(repeat.ny) || 1;
      const dx = Number(repeat.dx) || 0;
      const dy = Number(repeat.dy) || 0;
      const angle = Number(repeat.angle) || 0;
      const mirror = String(repeat.mirror) === 'true';
      const originX = Number(repeat.x) || 0;
      const originY = Number(repeat.y) || 0;

      for (let col = 0; col < nx; col++) {
        for (let row = 0; row < ny; row++) {
          const tx = originX + col * dx;
          const ty = originY + row * dy;

          const subGroup = this.renderStep(
            pcb,
            subStep,
            side,
            renderContext,
            elementIdProvider,
            bounds,
            false
          );

          const transform = this.buildStepRepeatTransform(tx, ty, angle, mirror);
          subGroup.setAttribute('transform', transform);
          groupElement.appendChild(subGroup);
        }
      }
    }

    return groupElement;
  }

  private buildStepRepeatTransform(
    tx: number,
    ty: number,
    angle: number,
    mirror: boolean
  ): string {
    const parts: string[] = [];
    parts.push(`translate(${tx},${ty})`);
    if (angle !== 0) {
      parts.push(`rotate(${angle})`);
    }
    if (mirror) {
      parts.push('scale(-1,1)');
    }
    return parts.join(' ');
  }
}
