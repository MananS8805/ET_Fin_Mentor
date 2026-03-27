/**
 * Victory Chart Wrapper Components
 * 
 * Thin pass-through wrappers that suppress defaultProps warnings
 * without using React.memo (which breaks Victory's internal prop detection).
 */

import React from "react";
import {
  VictoryAxis as BaseVictoryAxis,
  VictoryBar as BaseVictoryBar,
  VictoryLine as BaseVictoryLine,
} from "victory-native";

export function VictoryAxisWrapper(props: React.ComponentProps<typeof BaseVictoryAxis>) {
  return <BaseVictoryAxis {...props} />;
}

export function VictoryBarWrapper(props: React.ComponentProps<typeof BaseVictoryBar>) {
  return <BaseVictoryBar {...props} />;
}

export function VictoryLineWrapper(props: React.ComponentProps<typeof BaseVictoryLine>) {
  return <BaseVictoryLine {...props} />;
}
