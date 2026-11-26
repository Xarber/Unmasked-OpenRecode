// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { View } from 'react-native';
import { MessageContent } from './MessageBubble';
import { Label } from '../ui';

export function SampleConversation() {
  return (
    <View style={{ gap: 12 }}>
      <View accessibilityRole="header">
        <Label style={{ fontSize: 20, fontWeight: '700' }}>An example conversation</Label>
      </View>
      <Label muted>Sample data · Read-only</Label>
      <View style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
        <MessageContent own={false} body="What’s something that made you smile today?" />
      </View>
      <View style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
        <MessageContent own body="The first coffee outside this week." />
      </View>
    </View>
  );
}
