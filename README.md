![Tank Wars Mobile](docs/banner.png)

# Tank Wars Mobile

**FR** — Le jeu d'artillerie DOS Tank Wars 3.2 (1992) de Kenneth Morse, refait pour l'écran tactile : angle, puissance, vent, aucun aperçu de trajectoire. 16 armes, 3 défenses, terrain destructible. À deux sur un téléphone, ou en ligne. Sans pub, sans achat.

**EN** — The DOS artillery game Tank Wars 3.2 (1992) by Kenneth Morse, rebuilt for touchscreens: angle, power, wind, no trajectory preview. 16 weapons, 3 defences, destructible terrain. Hot-seat on one phone, or online. No ads, no purchases. The original DOS sources are not included.

## Key points

- Aim by dragging on the battlefield: sideways for the angle, up and down for power.
  Tap the weapon name to cycle weapons, then **FIRE**.
- Players take turns; kills earn money, spent in the weapons shop between rounds.
- Defences: shields, inertia dampeners, repulsers. Options: 6 wall types, 5 wind
  levels, terrain crumbling.
- Online: **Create Room** gives a 4-character code, the other player enters it under
  **Join Room**. Game state goes through a Firebase Realtime Database.
- Local play needs no network. No account, no tracking.
- Sound effects are synthesised; there are no audio files.

## Install


[<img src="docs/badge_obtainium.png" alt="Get it on Obtainium" height="48">](https://gallaz.ch/eink/#obtainium)

- **F-Droid** (recommended, updates arrive by themselves): add the repository from [gallaz.ch/eink](https://gallaz.ch/eink/#fdroid), or the address `https://funkypitt.github.io/fdroid-repo/repo` in F-Droid.
- **Obtainium**: tap the badge on the phone, or add `https://github.com/funkypitt/tankwars-mobile` in Obtainium.
- **APK**: attached to the [latest release](../../releases/latest). No automatic updates.

All three deliver the same file, with the same signature.

## Build

Vite + Capacitor (Android); online play goes through Firebase.

```
npm install
npm run build          # vite build into dist/
npx cap sync android
cd android && ./gradlew assembleRelease
npm run server         # optional relay server
```

## Crédits / Credits

Gameplay d'après / gameplay after Tank Wars 3.2 by Kenneth Morse (1992).

© 2026 Pierre Gallaz. Développé avec [Claude Code](https://claude.com/claude-code) (Anthropic).
Licence MIT, voir `LICENSE`.

© 2026 Pierre Gallaz. Developed with [Claude Code](https://claude.com/claude-code) (Anthropic).
MIT licence, see `LICENSE`.

## Captures d'écran

<img src="docs/screenshot-1.png" width="30%"> <img src="docs/screenshot-2.png" width="30%">
