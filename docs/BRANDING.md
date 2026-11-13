# Unmasked identity

Name and tagline supplied by the owner: **Unmasked — Be real. No covers.** Part of OpenRecode. No naming clearance or global trademark availability is claimed. The original starter history is preserved at Xarber/Unmasked. Active development uses the private Unmasked-OpenRecode repository.

Accent #6269F5. Light background #F7F7FC, white surfaces, ink #222337, secondary #727487. Dark background #14151D, surface #1D1E29, text #F3F3FC, secondary #ABAEBF. Use the platform system sans-serif so dynamic text and native rendering remain familiar. Hierarchy uses restrained weights and generous spacing; no bundled proprietary fonts.

assets/branding/icon-master.svg is the editable 1024×1024 source: background, symbol (open-u and conversation-tail paths), highlight groups with stable identifiers. The open U and conversation tail suggest an open, personal exchange. Dark, monochrome and tinted SVG variants retain layer structure. No copyrighted third-party artwork is used.

`scripts/branding.mjs` reproduces PWA 192/512 and 1024 native raster icons, Apple touch icon, Android foreground/monochrome files and SVG variants/banner using Sharp. Run `npm run branding`. Exports are tracked; sources remain editable. Android uses an independent foreground over the configured accent background. Native asset catalogs and Apple layered icon workflows require actual prebuild and icon validation; these are not completed by having an SVG master.

Keep essential symbol strokes in the maskable safe zone; validate real launcher masks before release. The source banner is brand artwork, not a screenshot. Any screenshots under docs/reports are real development-application views and must be labeled with fixture data.
