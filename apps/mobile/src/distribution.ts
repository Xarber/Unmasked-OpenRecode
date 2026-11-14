// SPDX-License-Identifier: AGPL-3.0-only
export const hosted = process.env.EXPO_PUBLIC_DISTRIBUTION === 'xcenter';
export const developerTools = !hosted;
export const hostedOrigin = 'https://unmasked.xcenter.it';
