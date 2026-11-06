// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#6269F5" />
        <meta
          name="description"
          content="Unmasked — a quieter space for genuine conversations. Be real. No covers."
        />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style>{`html,body,#root{height:100%;height:100dvh;overscroll-behavior:none}html{-webkit-tap-highlight-color:transparent}button,a,[role=button]{touch-action:manipulation}*:focus-visible{outline:2px solid #6269F5;outline-offset:3px}input,textarea{font-size:16px}body{margin:0} @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
