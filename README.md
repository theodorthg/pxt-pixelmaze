# Pixel-Maze

Labyrinth-Spiel wie Pac-Man für MakeCode Arcade, als Erweiterung mit eigenen Blöcken. Grafiken, Labyrinthe
und Sounds stammen aus dem [Arcade Asset Generator](https://theodorthg.github.io/arcade-asset-generator/).

- 1 bis 4 Spieler gemeinsam: weitere Spieler steigen mit **A** ein, am selben Gerät oder online im
  Mehrspieler-Modus von arcade.makecode.com. Jeder hat eigene Leben und Punkte.
- Steuerung mit dem Steuerkreuz; die Figur biegt an der nächsten Kreuzung ab.
- Vier Geister mit eigenem Verhalten: Jäger, Abfänger, Streuner und einer, der Abstand hält.
  Kraftpillen machen sie für kurze Zeit essbar (200, 400, 800, 1600 Punkte).
- Tunnel links und rechts. Sind alle Punkte gefressen, geht es ins nächste Labyrinth.

```blocks
pixelmaze.setMaxPlayers(4)
pixelmaze.startGame()
```

## Eigene Labyrinthe
Tilemap mit **8×8-Kacheln**, 20×15 Felder, Block `Labyrinth … Karte … Stil …` oder Tilemap `labyrinth1`, `labyrinth2` …
Kacheln je Stil (`Neon`, `Candy`, `Hedge`): `mzNeonFloor`, `mzNeonWall`, `mzNeonDot`, `mzNeonPower`, `mzNeonStart`
(Spielerstarts), `mzNeonHouse` (Geisterhaus, Ausgang nach oben). Figuren: `mzHero1` … `mzHero4` (schaut nach rechts),
Geister `mzGhost1` … `mzGhost4`, `mzScared`, `mzBlink`, `mzEyes`.

Einbinden: Erweiterungen → `github:theodorthg/pxt-pixelmaze`. Lizenz: MIT.
