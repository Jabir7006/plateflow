# PlateFlow landing page redesign

Scope: the root landing page only. Dashboard, authentication and diner routes retain their existing implementation. Section order, demo-menu configuration, login and contact destinations are preserved.

## Direction

- Product: QR menus and a shared restaurant workspace for guests and staff
- Character: thoughtful, practical, a little warm
- World: table signs, printed menus and the restaurant floor
- Moments: a screenshot of the real diner menu; a quiet, dark closing invitation
- Signature: a table-number card with a QR code pointing to the configured demo menu

## Audit

- Hero: introductory pill and radial color wash compete with the message
- Hero: a small order card leaves the visual half underdeveloped
- Hero: repeating status transitions and a pulsing indicator add motion without user input
- Headings: repeated semibold serif styling and tight tracking weaken the hierarchy
- Features: six identical rounded cards with colored icon tiles read as a template
- Staff: individual bordered cards overemphasize a simple capability list
- Closing section: another centered card repeats the layout and promises an unverified setup timeframe
- Mobile navigation: desktop links disappear without a replacement menu
- Copy: hero and workflow describe live features as available while the feature list marks them as in progress
- Reveals: content starts hidden and every group uses a catch-all transition

## Nine passes

1. Spacing: consistent 4px rhythm, shared page edges and balanced section gaps. Mobile sections use 64px padding; desktop sections use 96px.
2. Color: scoped neutral light surfaces and a deep amber accent. Existing dark-theme switching remains supported. No colored glows or radial washes.
3. Icons: one Lucide family with 1.5 strokes; neutral navigation and feature icons. Colored icon tiles removed.
4. Copy: restaurant-specific language, shorter labels, no setup-time claim. Release review against current master confirmed that ordering and live kitchen features are implemented, so their descriptions reflect the available product.
5. Type: DM Sans for the landing interface with the existing Fraunces display family. Headings use weight 400; small labels keep normal tracking.
6. Layout: a substantial product preview beside the hero, asymmetric section introductions and a quieter feature grid. Mobile navigation preserves the original anchor links.
7. Details: consistent control radii, hairlines, visible keyboard focus, a skip link, semantic headings and a keyboard-accessible link to the live menu. The QR card is omitted on narrower screens so it cannot obscure menu content.
8. Visuals: captured light and dark views of the actual diner app, including the burger carousel, sizes and prices. The table QR resolves against the current origin and the configured demo path. The hero is a static capture linked to the live menu, so it adds no backend dependency to the landing page.
9. Motion: a 700ms hero entrance after fonts are ready, one-time 620ms section entrances on entering the viewport, a 180ms mobile-menu entrance, arrow movements and press feedback. One IntersectionObserver watches five groups and stops observing each after its entrance. Content remains visible before hydration and without JavaScript; the hero remains visible from its first paint. Mobile navigation overlays the page rather than moving its content. Native smooth anchor scrolling and all motion respect reduced-motion preferences. No animation library, scroll listener, repeating animation, layout animation or permanent `will-change` is added.

## Assets

Diner screenshots are stored locally as optimized WebP assets. They were captured from the configured demo route at a 390px mobile viewport, with the app’s original content and both themes. No generated image was used and no generation prompt was written.

- `public/images/diner-menu-light.webp`
- `public/images/diner-menu-dark.webp`

Captures show Table 100 and the Classic Cheeseburger at ৳180. Recapture these assets when the product design or featured menu changes.

## Verification

- Frontend ESLint and TypeScript checks
- Next.js production build
- Browser verification of the real menu preview link, theme switching and mobile navigation
- Responsive checks at 320, 390, 768, 900, 1280 and 1440 pixels

The configured demo menu still requires the existing backend and a valid table token; this redesign does not change that integration.

Design process follows **unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir))**, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Adapted for PlateFlow: https://heydamir.design/unslop
