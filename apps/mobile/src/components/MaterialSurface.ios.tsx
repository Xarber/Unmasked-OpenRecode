// SPDX-License-Identifier: AGPL-3.0-only
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View, type ViewProps } from 'react-native';
import { useApp } from '../provider';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
export function MaterialSurface({ style, ...props }: ViewProps) {
  const [opaque, setOpaque] = useState(true),
    { dark } = useApp();
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((v) => {
      if (active) setOpaque(v);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOpaque);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  if (opaque || !isLiquidGlassAvailable() || !isGlassEffectAPIAvailable())
    return <View {...props} style={style} />;
  return (
    <GlassView
      {...props}
      style={[style, { backgroundColor: 'transparent' }]}
      glassEffectStyle="regular"
      colorScheme={dark ? 'dark' : 'light'}
      tintColor={dark ? '#1D1E29E6' : '#FFFFFFE6'}
    />
  );
}
