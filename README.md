# Tank Wars Mobile

**FR** — Tank Wars Mobile est une recréation fidèle du jeu d'artillerie DOS Tank Wars 3.2 (1992) de Kenneth Morse, reconstruite de zéro pour les écrans tactiles. Deux joueurs visent leurs tanks chacun leur tour et se tirent dessus à travers un terrain destructible généré aléatoirement, avec 16 armes, 3 défenses, vent et murs configurables. Jouez en hot-seat sur un seul appareil ou en ligne via un code de salle. Sans pub, sans compte.

**EN** — A faithful, clean-room recreation of the classic DOS artillery game Tank Wars 3.2 (1992) by Kenneth Morse, rebuilt for touchscreens: two players take turns aiming and firing across destructible terrain, with 16 weapons, 3 defence systems, wind and wall options. Hot-seat on one device or online via room codes. No ads, no accounts. The original DOS sources are not included.

## Build

Vite + Capacitor (Android); online multiplayer is brokered through Firebase.

```
npm install
npm run build          # vite build into dist/
npx cap sync android
cd android && ./gradlew assembleRelease
npm run server         # optional relay server
```

## Install

Install the generated APK (`android/app/build/outputs/apk/release/`) on an Android device, or grab it from the author's F-Droid repository.

## Crédits / Credits

Gameplay d'après / gameplay after Tank Wars 3.2 by Kenneth Morse (1992).

© 2026 Pierre Gallaz. Développé avec [Claude Code](https://claude.com/claude-code) (Anthropic).
Licence MIT, voir `LICENSE`.

© 2026 Pierre Gallaz. Developed with [Claude Code](https://claude.com/claude-code) (Anthropic).
MIT licence, see `LICENSE`.
