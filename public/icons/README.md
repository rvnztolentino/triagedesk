# TriageDesk Icon Placeholders

These files use `.codex/triagedesk.png` as the source app icon: green rounded background with the white TriageDesk mark. The generated PNG/app icon files use a stronger rounded-corner alpha mask.

Replace the files with production artwork at the same paths and dimensions:

- `public/favicon.ico` - browser favicon bundle, currently backed by a 32x32 placeholder.
- `public/icons/triagedesk.png` - 720x720 source copy used for generated app icon assets. The in-app sidebar/auth brand mark is drawn in `components/brand-icon.tsx` so it can match the selected accent color exactly.
- `public/icons/favicon-16x16.png` - 16x16 browser favicon.
- `public/icons/favicon-32x32.png` - 32x32 browser favicon.
- `public/icons/apple-touch-icon.png` - 180x180 iOS home-screen icon.
- `public/icons/icon-192x192.png` - 192x192 PWA icon.
- `public/icons/icon-512x512.png` - 512x512 PWA icon.
- `app/icon.png` - 512x512 Next.js app icon fallback.
- `app/apple-icon.png` - 180x180 Next.js Apple icon fallback.

Keep replacement artwork square and readable at 16x16. Transparent rounded corners are acceptable for PNG/app icon outputs.
