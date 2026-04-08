import { Component } from './component';
import { Contour } from './contour';
import { LayerFeature } from './layer-feature';
import { Package } from './package';
import { PadStack } from './pad-stack';
import { StepRepeat } from './step-repeat';

export class Step {
  name: string = null!;
  profile: Contour | null = null;
  layerFeatures: LayerFeature[] = [];
  packages: Package[] = [];
  components: Component[] = [];
  stepRepeats: StepRepeat[] = [];
  padStacks: PadStack[] = [];
  
  // Debug: track when layerFeatures are added
  get layerFeaturesDebug(): LayerFeature[] {
    return this.layerFeatures;
  }
}
