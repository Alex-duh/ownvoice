import React from "react";
import { Composition, Still } from "remotion";
import { Demo, TOTAL } from "./Demo";
import { AppStills, AppScreen, AppScene, APP_SCENE_FRAMES } from "./app";

export const Root: React.FC = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
    <Composition id="AppScene" component={AppScene} durationInFrames={APP_SCENE_FRAMES} fps={30} width={1920} height={1080} />
    <Still id="AppStills" component={AppStills} width={1920} height={1080} />
    <Still id="AppScreen" component={AppScreen as any} width={480} height={960} defaultProps={{ which: 1 }} />
  </>
);
