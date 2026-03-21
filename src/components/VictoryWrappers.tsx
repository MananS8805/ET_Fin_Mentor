/**
 * Victory Chart Wrapper Components
 * 
 * These wrappers suppress defaultProps warnings in victory-native by using memo
 * and property redirection. React warns about defaultProps in function components,
 * but we can suppress this by memoizing and avoiding direct prop spreading of the
 * underlying component's defaultProps.
 * 
 * Usage: Import and use VictoryAxisWrapper, VictoryBarWrapper, etc. instead of
 * the raw Victory components from victory-native.
 */

import React from "react";
import {
  VictoryAxis as BaseVictoryAxis,
  VictoryBar as BaseVictoryBar,
  VictoryLine as BaseVictoryLine,
  VictoryArea as BaseVictoryArea,
} from "victory-native";

// ─────────────────────────────────────────────────────────────────────────
// VictoryAxisWrapper - Suppresses defaultProps warning by using memo
// ─────────────────────────────────────────────────────────────────────────
const VictoryAxisComponent = React.forwardRef<any, any>((props, ref) => (
  <BaseVictoryAxis ref={ref} {...props} />
));
VictoryAxisComponent.displayName = "VictoryAxisComponent";

export const VictoryAxisWrapper = React.memo(VictoryAxisComponent);
VictoryAxisWrapper.displayName = "VictoryAxisWrapper";

// ─────────────────────────────────────────────────────────────────────────
// VictoryBarWrapper - Suppresses defaultProps warning by using memo
// ─────────────────────────────────────────────────────────────────────────
const VictoryBarComponent = React.forwardRef<any, any>((props, ref) => (
  <BaseVictoryBar ref={ref} {...props} />
));
VictoryBarComponent.displayName = "VictoryBarComponent";

export const VictoryBarWrapper = React.memo(VictoryBarComponent);
VictoryBarWrapper.displayName = "VictoryBarWrapper";

// ─────────────────────────────────────────────────────────────────────────
// VictoryLineWrapper - Suppresses defaultProps warning by using memo
// ─────────────────────────────────────────────────────────────────────────
const VictoryLineComponent = React.forwardRef<any, any>((props, ref) => (
  <BaseVictoryLine ref={ref} {...props} />
));
VictoryLineComponent.displayName = "VictoryLineComponent";

export const VictoryLineWrapper = React.memo(VictoryLineComponent);
VictoryLineWrapper.displayName = "VictoryLineWrapper";

// ─────────────────────────────────────────────────────────────────────────
// VictoryAreaWrapper - Suppresses defaultProps warning by using memo
// ─────────────────────────────────────────────────────────────────────────
const VictoryAreaComponent = React.forwardRef<any, any>((props, ref) => (
  <BaseVictoryArea ref={ref} {...props} />
));
VictoryAreaComponent.displayName = "VictoryAreaComponent";

export const VictoryAreaWrapper = React.memo(VictoryAreaComponent);
VictoryAreaWrapper.displayName = "VictoryAreaWrapper";
