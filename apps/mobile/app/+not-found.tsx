// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { router } from 'expo-router';
import { Shell, Empty, Button } from '../src/ui';
export default function NotFound() {
  return (
    <Shell title="This page has wandered off" back>
      <Empty
        title="Let’s head back to your people."
        description="This link may be incomplete or no longer available."
      />
      <Button title="Open conversations" onPress={() => router.replace('/')} />
    </Shell>
  );
}
