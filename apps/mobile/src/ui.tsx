// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import Animated from 'react-native-reanimated';
import { motion, useReducedMotionPreference, MotionPanel } from './motion';
import { MaterialSurface } from './components/MaterialSurface';
import {
  Text,
  View,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  type ViewStyle,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from './provider';
import { openWelcome } from './webWelcome';
export const accent = '#6269F5';
export function useColors() {
  return useApp().dark
    ? {
        bg: '#14151D',
        panel: '#1D1E29',
        text: '#F3F3FC',
        muted: '#ABAEBF',
        line: '#303140',
        soft: '#282A41',
        accent,
        action: '#535BD6',
      }
    : {
        bg: '#F7F7FC',
        panel: '#FFFFFF',
        text: '#222337',
        muted: '#65677A',
        line: '#E9E9F2',
        soft: '#EEEEFE',
        accent,
        action: '#535BD6',
      };
}
export function Label({
  children,
  muted = false,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: object;
}) {
  const c = useColors();
  return (
    <Text style={[{ color: muted ? c.muted : c.text, fontSize: 15, lineHeight: 23 }, style]}>
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 21,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
}) {
  const c = useColors();
  return <Ionicons name={name} size={size} color={color ?? c.muted} />;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  danger?: boolean;
}) {
  const c = useColors(),
    reduced = useReducedMotionPreference(),
    [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={16}
      style={{ minHeight: 48, borderRadius: 14 }}
    >
      <Animated.View
        style={{
          backgroundColor: disabled ? c.bg : secondary ? c.soft : danger ? '#B82B45' : c.action,
          minHeight: 48,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: disabled ? 1 : 0,
          borderColor: c.line,
          transform: [{ scale: pressed && !reduced ? 0.97 : 1 }],
          transitionProperty: reduced ? 'none' : 'transform',
          transitionDuration: motion.press,
          transitionTimingFunction: motion.easeOut,
        }}
      >
        {icon && <Icon name={icon} size={18} color={secondary ? accent : '#FFF'} />}
        <Text
          style={{
            color: disabled ? c.muted : secondary ? c.text : '#FFF',
            fontWeight: '600',
            fontSize: 14,
          }}
        >
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      {label && <Label style={{ fontSize: 13, fontWeight: '600' }}>{label}</Label>}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label ?? props.placeholder}
        {...props}
        style={[
          {
            backgroundColor: c.bg,
            borderColor: c.line,
            borderWidth: 1,
            borderRadius: 13,
            paddingHorizontal: 15,
            paddingVertical: 13,
            fontSize: 16,
            color: c.text,
            minHeight: 48,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.panel,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.line,
          padding: 22,
          gap: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function SectionHeading({
  title,
  icon,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Icon name={icon} color={accent} />
      <Label style={{ fontSize: 19, fontWeight: '600', flexShrink: 1 }}>{title}</Label>
    </View>
  );
}
export function InfoDisclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false),
    c = useColors();
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ minHeight: 48, flexDirection: 'row', gap: 10, alignItems: 'center' }}
      >
        <Icon name="information-circle-outline" />
        <Label muted style={{ flex: 1, fontSize: 13 }}>
          {title}
        </Label>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} />
      </Pressable>
      {open && (
        <MotionPanel style={{ padding: 16, borderRadius: 14, backgroundColor: c.bg, gap: 10 }}>
          {children}
        </MotionPanel>
      )}
    </View>
  );
}
export function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  const colors = ['#E8E5FF', '#DFEFED', '#F5E8E0', '#E3ECF8'];
  const i = name.charCodeAt(0) % colors.length;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.37,
        backgroundColor: colors[i],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.36,
          fontWeight: '600',
          color: ['#5E478F', '#25675F', '#82513B', '#3D5B83'][i],
        }}
      >
        {name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </Text>
    </View>
  );
}
export function Empty({
  icon = 'chatbubbles-outline',
  title,
  description,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
}) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, flex: 1 }}>
      <View style={{ padding: 22, borderRadius: 24, backgroundColor: '#6269F512' }}>
        <Icon name={icon} size={34} color={accent} />
      </View>
      <Label style={{ fontSize: 21, fontWeight: '600', textAlign: 'center' }}>{title}</Label>
      <Label muted style={{ maxWidth: 340, textAlign: 'center' }}>
        {description}
      </Label>
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
      <ActivityIndicator color={accent} />
    </View>
  );
}
const nav = [
  { path: '/', label: 'Conversations', icon: 'chatbubbles-outline' },
  { path: '/connections', label: 'Connections', icon: 'people-outline' },
  { path: '/moments', label: 'Saved moments', icon: 'bookmark-outline' },
  { path: '/settings', label: 'Settings', icon: 'settings-outline' },
] as const;
export function Shell({
  children,
  title,
  subtitle,
  back = false,
  scroll = false,
  action,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  back?: boolean;
  scroll?: boolean;
  action?: React.ReactNode;
}) {
  const c = useColors(),
    app = useApp(),
    path = usePathname(),
    { width } = useWindowDimensions(),
    wide = width >= 900;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View onTouchStart={app.touch} style={{ flex: 1, flexDirection: 'row' }}>
        {wide && (
          <View
            style={{
              width: 240,
              borderRightWidth: 1,
              borderColor: c.line,
              padding: 24,
              gap: 30,
              backgroundColor: c.panel,
            }}
          >
            <Brand />
            <View style={{ gap: 8 }}>
              {nav.map((n) => (
                <Pressable
                  accessibilityRole="link"
                  key={n.path}
                  onPress={() => {
                    if (n.path !== path) app.lock();
                    router.navigate(n.path);
                  }}
                  style={{
                    padding: 14,
                    borderRadius: 13,
                    backgroundColor: path === n.path ? c.soft : 'transparent',
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <Icon name={n.icon} color={path === n.path ? accent : c.muted} />
                  <Label style={{ fontSize: 14, fontWeight: path === n.path ? '600' : '400' }}>
                    {n.label}
                  </Label>
                </Pressable>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ gap: 12, borderTopWidth: 1, borderColor: c.line, paddingTop: 22 }}>
              <Label muted style={{ fontSize: 12 }}>
                A little less noise.{'\n'}A little more you.
              </Label>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Avatar name={app.user?.displayName ?? 'You'} size={36} />
                <View>
                  <Label style={{ fontWeight: '600', fontSize: 13 }}>{app.user?.displayName}</Label>
                  <Label muted style={{ fontSize: 11 }}>
                    @{app.user?.username}
                  </Label>
                </View>
              </View>
            </View>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <MaterialSurface
            style={{
              paddingHorizontal: wide ? 36 : 20,
              paddingVertical: 24,
              borderBottomWidth: 1,
              borderColor: c.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              backgroundColor: c.panel,
            }}
          >
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to conversations"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                style={{ padding: 12, minWidth: 48, minHeight: 48 }}
              >
                <Icon name="arrow-back" />
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Label style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.7 }}>
                {title}
              </Label>
              {subtitle && (
                <Label muted style={{ fontSize: 13, marginTop: 2 }}>
                  {subtitle}
                </Label>
              )}
            </View>
            {action}
            {!wide && openWelcome && <Brand compact />}
          </MaterialSurface>
          {!app.online && (
            <View style={{ padding: 10, backgroundColor: c.soft }}>
              <Label style={{ textAlign: 'center', fontSize: 12 }}>
                Connection interrupted · Your drafts and queued messages stay on this device
              </Label>
            </View>
          )}
          {app.notice !== '' && (
            <MotionPanel>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
                onPress={() => app.setNotice('')}
                style={{ padding: 14, backgroundColor: c.soft }}
              >
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Icon name="information-circle-outline" color={accent} />
                  <Label style={{ fontSize: 13, flex: 1 }}>{app.notice}</Label>
                  <Icon name="close" size={18} />
                </View>
              </Pressable>
            </MotionPanel>
          )}
          {scroll ? (
            <ScrollView
              contentContainerStyle={{
                padding: wide ? 36 : 20,
                gap: 20,
                maxWidth: 1050,
                width: '100%',
                alignSelf: 'center',
              }}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
          {!wide && !back && (
            <MaterialSurface
              style={{
                flexDirection: 'row',
                borderTopWidth: 1,
                borderColor: c.line,
                backgroundColor: c.panel,
                paddingVertical: 10,
              }}
            >
              {nav.map((n) => (
                <Pressable
                  accessibilityRole="link"
                  key={n.path}
                  onPress={() => {
                    app.lock();
                    router.navigate(n.path);
                  }}
                  style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: 44 }}
                >
                  <Icon name={n.icon} color={path === n.path ? accent : c.muted} />
                  <Label muted style={{ fontSize: 10 }}>
                    {n.label === 'Conversations'
                      ? 'Chats'
                      : n.label === 'Saved moments'
                        ? 'Moments'
                        : n.label}
                  </Label>
                </Pressable>
              ))}
            </MaterialSurface>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  const c = useColors();
  const mark = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          backgroundColor: c.action,
          width: 36,
          height: 36,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 25, fontWeight: '700' }}>u</Text>
      </View>
      {!compact && (
        <Text style={{ color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -1 }}>
          unmasked<Text style={{ color: accent }}>.</Text>
        </Text>
      )}
    </View>
  );
  if (!openWelcome) return mark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="About Unmasked"
      onPress={openWelcome}
      style={{ alignSelf: 'flex-start', minWidth: 48, minHeight: 48, justifyContent: 'center' }}
    >
      {mark}
    </Pressable>
  );
}
