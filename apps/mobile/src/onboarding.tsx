// SPDX-License-Identifier: AGPL-3.0-only
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon, Label, useColors } from './ui';
import { MotionPanel } from './motion';
import { read, write } from './storage';

const steps = [
  {
    icon: 'chatbubbles-outline',
    title: 'Make room for conversation',
    body: 'Open Conversations to keep up with people you know. Use the composer to reply in your own time.',
  },
  {
    icon: 'people-outline',
    title: 'Connect on your terms',
    body: 'Open Connections to send or accept an invitation. In a conversation, you decide whether to share more of your profile.',
  },
  {
    icon: 'bookmark-outline',
    title: 'Keep what matters',
    body: 'Visit Moments for the things you’ve saved. Use Settings to manage privacy and revisit this introduction.',
  },
] as const;
const completionKey = 'introduction:v1';
const ReplayIntroduction = createContext(() => {});
export const useReplayIntroduction = () => useContext(ReplayIntroduction);

export function IntroductionProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [replay, setReplay] = useState(false);
  const [eligible, setEligible] = useState(Platform.OS !== 'web');
  useEffect(() => {
    let mounted = true;
    void read(completionKey, false)
      .then((value) => {
        if (mounted) setCompleted(value === true);
      })
      .catch(() => {
        if (mounted) setCompleted(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const html = document.documentElement;
    const update = () =>
      setEligible(location.pathname === '/' && html.dataset.unmaskedView !== 'welcome');
    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ['data-unmasked-view'] });
    update();
    return () => observer.disconnect();
  }, []);
  const finish = () => {
    setCompleted(true);
    setReplay(false);
    void write(completionKey, true).catch(() => {});
  };
  return (
    <ReplayIntroduction.Provider value={() => setReplay(true)}>
      {children}
      {(replay || (eligible && completed === false)) && <Introduction finish={finish} />}
    </ReplayIntroduction.Provider>
  );
}

function Introduction({ finish }: { finish: () => void }) {
  const [index, setIndex] = useState(0);
  const c = useColors();
  const step = steps[index] ?? steps[0];
  const { width } = useWindowDimensions();
  const last = index === steps.length - 1;
  return (
    <Modal
      visible
      onRequestClose={finish}
      presentationStyle="fullScreen"
      supportedOrientations={['portrait', 'landscape']}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>
          <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 24 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro registers static image assets through require.
                source={require('../public/icon-192.png')}
                accessibilityLabel="Unmasked"
                style={{ width: 54, height: 54, borderRadius: 16 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip introduction"
                onPress={finish}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: c.soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            <MotionPanel
              key={index}
              style={{ backgroundColor: c.panel, borderRadius: 24, padding: 24, gap: 14 }}
            >
              {index === 0 && Platform.OS === 'web' && width >= 900 && (
                <Image
                  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro registers static image assets through require.
                  source={require('../../../docs/reports/unmasked-chat-desktop.png')}
                  accessibilityLabel="Unmasked desktop conversation with sample messages"
                  resizeMode="contain"
                  style={{
                    width: '100%',
                    aspectRatio: 16 / 9,
                    height: undefined,
                    borderRadius: 12,
                  }}
                />
              )}
              <Icon name={step.icon} size={32} />
              <Label style={{ fontSize: 30, fontWeight: '700' }}>{step.title}</Label>
              <Label muted style={{ fontSize: 16, lineHeight: 24 }}>
                {step.body}
              </Label>
            </MotionPanel>
            <View accessibilityLiveRegion="polite">
              <Label muted>
                Step {index + 1} of {steps.length}
              </Label>
            </View>
            <Button
              icon={last ? 'checkmark' : 'arrow-forward'}
              title={last ? 'Get Started' : 'Next'}
              onPress={() => (last ? finish() : setIndex(index + 1))}
            />
            {index > 0 && (
              <Button
                icon="arrow-back"
                title="Back"
                secondary
                onPress={() => setIndex(index - 1)}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
