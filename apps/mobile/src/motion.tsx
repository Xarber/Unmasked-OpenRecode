// SPDX-License-Identifier: AGPL-3.0-only
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  Easing,
  cubicBezier,
} from 'react-native-reanimated';
export const motion = {
  press: 120,
  enter: 180,
  exit: 120,
  easeOut: cubicBezier(0.23, 1, 0.32, 1),
} as const;
// React to preference changes as well as the initial value; start conservatively.
const ReducedMotionContext = createContext(true);
export function useReducedMotionPreference() {
  return useContext(ReducedMotionContext);
}

export function MotionPreferences({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof matchMedia !== 'undefined') {
      const media = matchMedia('(prefers-reduced-motion: reduce)');
      const changed = () => setReduced(media.matches);
      changed();
      media.addEventListener('change', changed);
      return () => media.removeEventListener('change', changed);
    }
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return <ReducedMotionContext.Provider value={reduced}>{children}</ReducedMotionContext.Provider>;
}
export function MotionPanel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotionPreference();
  return (
    <Animated.View
      style={style}
      entering={
        reduced
          ? undefined
          : FadeIn.duration(motion.enter)
              .easing(Easing.bezier(0.23, 1, 0.32, 1))
              .reduceMotion(ReduceMotion.System)
      }
      exiting={
        reduced ? undefined : FadeOut.duration(motion.exit).reduceMotion(ReduceMotion.System)
      }
    >
      {children}
    </Animated.View>
  );
}
