// SPDX-License-Identifier: AGPL-3.0-only
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useApp } from '../provider';
import { Button, Card, Field, Label, SectionHeading } from '../ui';
import { startXCenterLogin, xcenterWebAvailable } from '../xcenterLogin';

type Appearance = { theme: string | null; revision: number };
const appearancePath = '/xcenter/settings/appearance';

export function XCenterSettings() {
  const app = useApp();
  const [password, setPassword] = useState('');
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Appearance>();
  const account = useQuery({
    queryKey: ['xcenter-account', app.user?.id],
    queryFn: () => api<{ linked: boolean; signedInWithXCenter: boolean }>('/xcenter/account'),
    enabled: xcenterWebAvailable,
    retry: false,
  });
  if (!account.data) return null;
  const { linked, signedInWithXCenter } = account.data;
  async function action(run: () => Promise<void>) {
    setBusy(true);
    try {
      await run();
    } catch (error) {
      app.setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <SectionHeading title="X-Center ID" icon="key-outline" />
      {!linked &&
        (linking ? (
          <>
            <Field
              label="Current Unmasked password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Button
              title="Continue to X-Center ID"
              icon="arrow-forward"
              disabled={busy || !password}
              onPress={() =>
                void action(async () => {
                  await startXCenterLogin({ mode: 'link', password });
                  setPassword('');
                })
              }
            />
            <Button
              title="Cancel"
              secondary
              onPress={() => {
                setPassword('');
                setLinking(false);
              }}
            />
          </>
        ) : (
          <Button title="Link X-Center ID" icon="link-outline" onPress={() => setLinking(true)} />
        ))}
      {linked && !signedInWithXCenter && (
        <Button
          title="Sign in with X-Center ID"
          icon="key-outline"
          disabled={busy}
          onPress={() => void action(() => startXCenterLogin({ mode: 'signin' }))}
        />
      )}
      {signedInWithXCenter && (
        <>
          <Label muted>
            Save your appearance setting privately, then load it on another device.
          </Label>
          <Button
            title="Load saved appearance"
            icon="cloud-download-outline"
            disabled={busy}
            onPress={() => void action(async () => setSaved(await api<Appearance>(appearancePath)))}
          />
          {saved && (
            <>
              <Label muted>
                {saved.theme ? `Saved appearance: ${saved.theme}` : 'No appearance saved yet.'}
              </Label>
              {saved.theme && (
                <Button
                  title="Use saved appearance"
                  secondary
                  onPress={() => app.setTheme(saved.theme!)}
                />
              )}
              <Button
                title="Save this device’s appearance"
                icon="cloud-upload-outline"
                disabled={busy}
                onPress={() =>
                  void action(async () => {
                    setSaved(
                      await api<Appearance>(appearancePath, 'PUT', {
                        theme: app.theme,
                        revision: saved.revision,
                      }),
                    );
                    app.setNotice('Appearance saved to X-Center ID.');
                  })
                }
              />
              {saved.revision > 0 && (
                <Button
                  title="Remove saved appearance"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    void action(async () => {
                      await api(appearancePath, 'DELETE', { revision: saved.revision });
                      setSaved(undefined);
                      app.setNotice('Saved appearance removed from X-Center ID.');
                    })
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}
