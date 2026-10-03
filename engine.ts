// =====================================================================
//  PIXEL-MAZE – Labyrinth-Spiel wie Pac-Man als MakeCode-Erweiterung
//  1 bis 4 Spieler gemeinsam (auch online im Mehrspieler-Modus), vier Geister.
//  Labyrinthe sind Tilemaps aus 8x8-Kacheln (20x15 = ein Bildschirm).
//  Grafiken: assets.ts, Labyrinthe: mazes.ts, Sounds: sounds.ts (generiert).
// =====================================================================

namespace SpriteKind {
    export const MzHero = SpriteKind.create()
    export const MzGhost = SpriteKind.create()
    export const MzFx = SpriteKind.create()
}

//% color="#e1a100" weight=97 icon="" block="Pixel-Maze"
//% groups='["Start", "Labyrinthe", "Einstellungen", "Ereignisse", "Werte"]'
namespace pixelmaze {
    /** Stil eines Labyrinths */
    export enum Style {
        //% block="Neon"
        Neon = 0,
        //% block="Zuckerland"
        Candy = 1,
        //% block="Hecke"
        Hedge = 2
    }
    const STYLE_NAMES = ["Neon", "Candy", "Hedge"]
    const KEY_NAMES = ["Floor", "Wall", "Dot", "Power", "Start", "House"]
    const K_NONE = 0, K_FLOOR = 1, K_WALL = 2, K_DOT = 3, K_POWER = 4, K_START = 5, K_HOUSE = 6
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]
    const MAX_HEROES = 4
    const MAX_MAZES = 9
    const M_HOUSE = 0, M_LEAVE = 1, M_OUT = 2, M_EYES = 3

    // ---------------------------------------------------------------- Einstellungen
    let title = "PIXEL-MAZE"
    let startLives = 3
    let maxPlayers = 4
    let ghostCount = 4
    let ghostSpeedPercent = 100
    let heroSpeed = 50
    const mazeMaps: tiles.TileMapData[] = [null, null, null, null, null, null, null, null, null]
    const mazeStyles: number[] = [-1, -1, -1, -1, -1, -1, -1, -1, -1]
    let clearHandler: (maze: number) => void = null
    let ghostHandler: () => void = null

    // ---------------------------------------------------------------- Assets
    const heroImgs: Image[][][] = []     // [Spieler][Richtung][Bild]
    let ghostImgs: Image[][] = []
    let scaredImgs: Image[] = null, blinkImg: Image = null, eyesImg: Image = null
    let styleTiles: Image[][] = []

    function projImg(name: string, fallback: Image): Image {
        const a = helpers.getImageByName(name)
        return a ? a : fallback
    }
    function projAnim(name: string, fallback: Image[]): Image[] {
        const a: Image[] = helpers.getAnimationByName(name)
        return a && a.length > 0 ? a : fallback
    }
    function projTile(name: string, fallback: Image): Image {
        const a = helpers.getTileByName(name)
        return a ? a : fallback
    }
    function resolveAssets() {
        for (let i = 0; i < MAX_HEROES; i++) {
            const right = projAnim("mzHero" + (i + 1), mazeGfx.heroes[i])
            const dirs: Image[][] = [[], [], [], []]
            for (const f of right) {
                dirs[0].push(f)
                dirs[1].push(f.rotated(90))
                const l = f.clone(); l.flipX(); dirs[2].push(l)
                dirs[3].push(f.rotated(270))
            }
            heroImgs[i] = dirs
        }
        for (let i = 0; i < 4; i++) ghostImgs[i] = projAnim("mzGhost" + (i + 1), mazeGfx.ghosts[i])
        scaredImgs = projAnim("mzScared", mazeGfx.scared)
        blinkImg = projImg("mzBlink", mazeGfx.blink)
        eyesImg = projImg("mzEyes", mazeGfx.eyes)
        for (let s = 0; s < STYLE_NAMES.length; s++) {
            const t = mazeGfx.tilesets[s]
            const list: Image[] = [t[0]]
            for (let k = 0; k < KEY_NAMES.length; k++) list.push(projTile("mz" + STYLE_NAMES[s] + KEY_NAMES[k], t[k + 1]))
            styleTiles[s] = list
        }
    }
    function play(p: music.Playable) { music.play(p, music.PlaybackMode.InBackground) }
    // Paletten je Stil (palettes.ts): beim Laden wird die Palette des Stils gesetzt
    let stylePalettes = true
    function applyPalette(s: number) {
        if (stylePalettes && s >= 0 && s < mzPalettes.list.length) image.setPalette(mzPalettes.list[s])
    }

    // ---------------------------------------------------------------- Labyrinthe
    function mazeMap(i: number): tiles.TileMapData {
        if (i < 0 || i >= MAX_MAZES) return null
        if (mazeMaps[i]) return mazeMaps[i]
        const named = helpers.getTilemapByName("labyrinth" + (i + 1))
        if (named) return named
        if (i < mazeLevels.count) return mazeLevels.tilemap(i)
        return null
    }
    function mazeName(i: number): string {
        if (!mazeMaps[i] && !helpers.getTilemapByName("labyrinth" + (i + 1)) && i < mazeLevels.count) return mazeLevels.names[i]
        return "Labyrinth " + (i + 1)
    }
    function countMazes(): number {
        let n = 0
        while (n < MAX_MAZES && mazeMap(n)) n++
        return n
    }

    // ---------------------------------------------------------------- Zustand
    const ctrls = [controller.player1, controller.player2, controller.player3, controller.player4]
    const infos = [info.player1, info.player2, info.player3, info.player4]
    let kinds: number[] = []        // Art je Feld
    let W = 20, H = 15
    let floorIdx = 1
    let dotsLeft = 0
    let startCells: number[] = []
    let houseCells: number[] = []
    let exitCell = 0
    let maze = 0
    let mazeCount = 1
    let running = false
    let started = false
    let pendingMaze = -1
    let frightUntil = 0
    let combo = 0
    let modeStart = 0

    // Figuren: Position (Pixel-Mitte), Zielfeld, Richtung
    class Actor {
        sprite: Sprite
        x: number; y: number
        tc: number; tr: number          // Zielfeld
        dir: number
        moving: boolean
        constructor(img: Image, kind: number) {
            this.sprite = sprites.create(img, kind)
            this.sprite.z = 10
            this.x = 0; this.y = 0; this.tc = 0; this.tr = 0; this.dir = 2; this.moving = false
        }
        place(cell: number) {
            this.tc = cell % W; this.tr = Math.idiv(cell, W)
            this.x = this.tc * 8 + 4; this.y = this.tr * 8 + 4
            this.moving = false
        }
    }
    const heroes: Actor[] = [null, null, null, null]
    const want = [2, 2, 2, 2]
    const alive = [false, false, false, false]
    const invincibleUntil = [0, 0, 0, 0]
    const respawnAt = [0, 0, 0, 0]
    const ghosts: Actor[] = []
    const gMode: number[] = []
    const gScared: boolean[] = []
    const gLeaveAt: number[] = []

    // ---------------------------------------------------------------- Raster
    function kindAt(c: number, r: number): number {
        if (r < 0 || r >= H) return K_WALL
        return kinds[r * W + ((c % W) + W) % W]
    }
    function passable(c: number, r: number, ghost: boolean): boolean {
        const k = kindAt(c, r)
        if (k == K_WALL) return false
        if (k == K_HOUSE && !ghost) return false
        return true
    }
    function setFloor(c: number, r: number) {
        const tm = game.currentScene().tileMap
        kinds[r * W + c] = K_FLOOR
        if (floorIdx >= 0) tm.data.setTile(c, r, floorIdx)
    }

    function loadMaze(i: number) {
        maze = i
        applyPalette(mazeStyles[i] >= 0 ? mazeStyles[i] : (i < mazeLevels.count ? mazeLevels.styles[i] : 0))
        tiles.setCurrentTilemap(mazeMap(i))
        scene.setBackgroundColor(15)
        const data = game.currentScene().tileMap.data
        W = data.width; H = data.height
        const ts = data.getTileset()
        const kindOf: number[] = []
        floorIdx = -1
        for (let k = 0; k < ts.length; k++) {
            let kind = K_NONE
            for (let s = 0; s < STYLE_NAMES.length && kind == K_NONE; s++)
                for (let j = 1; j <= KEY_NAMES.length; j++)
                    if (ts[k].equals(styleTiles[s][j]) || ts[k].equals(mazeGfx.tilesets[s][j])) { kind = j; break }
            if (kind == K_NONE) kind = K_FLOOR
            kindOf.push(kind)
            if (kind == K_FLOOR && floorIdx < 0) floorIdx = k
        }
        kinds = []
        startCells = []; houseCells = []
        dotsLeft = 0
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            const kind = kindOf[data.getTile(c, r)]
            kinds.push(kind)
            if (kind == K_DOT || kind == K_POWER) dotsLeft++
            if (kind == K_START) startCells.push(r * W + c)
            if (kind == K_HOUSE) houseCells.push(r * W + c)
        }
        for (const cell of startCells) { kinds[cell] = K_FLOOR; if (floorIdx >= 0) data.setTile(cell % W, Math.idiv(cell, W), floorIdx) }
        if (startCells.length == 0) startCells.push(W + 1)
        // Ausgang des Geisterhauses: freies Feld direkt über dem Haus
        exitCell = houseCells.length ? houseCells[0] : W + 1
        for (const hc of houseCells) {
            const up = hc - W
            if (up >= 0 && kinds[up] != K_WALL && kinds[up] != K_HOUSE) { exitCell = up; break }
        }
        resetActors()
        frightUntil = 0
        modeStart = game.runtime()
    }

    function resetActors() {
        const now = game.runtime()
        for (let i = 0; i < MAX_HEROES; i++) {
            if (!heroes[i]) continue
            heroes[i].place(startCells[i % startCells.length])
            heroes[i].dir = i % 2 ? 0 : 2
            want[i] = heroes[i].dir
            invincibleUntil[i] = now + 1500
        }
        for (let g = 0; g < ghosts.length; g++) {
            ghosts[g].place(houseCells.length ? houseCells[g % houseCells.length] : exitCell)
            ghosts[g].dir = 3
            gMode[g] = g == 0 ? M_LEAVE : M_HOUSE
            gLeaveAt[g] = now + g * 2500
            gScared[g] = false
        }
    }

    // ---------------------------------------------------------------- Bewegung
    function advance(a: Actor, d: number, ghost: boolean, decide: (a: Actor) => number) {
        let guard = 0
        while (d > 0 && guard++ < 6) {
            if (!a.moving) {
                const nd = decide(a)
                if (nd < 0) return
                a.dir = nd
                a.tc = ((a.tc + DX[nd]) % W + W) % W
                a.tr += DY[nd]
                a.moving = true
            }
            const tx = a.tc * 8 + 4, ty = a.tr * 8 + 4
            let dx = tx - a.x
            if (dx > 80) { a.x += W * 8; dx = tx - a.x }      // Tunnel
            if (dx < -80) { a.x -= W * 8; dx = tx - a.x }
            const dy = ty - a.y
            const dist = Math.abs(dx) + Math.abs(dy)
            if (dist <= d) {
                a.x = tx; a.y = ty
                d -= dist
                a.moving = false
                if (!ghost) arrive(a)
            } else {
                a.x += Math.sign(dx) * d
                a.y += Math.sign(dy) * d
                d = 0
            }
        }
    }

    function heroDecide(a: Actor): number {
        const i: number = a.sprite.data["i"]
        if (passable(a.tc + DX[want[i]], a.tr + DY[want[i]], false)) return want[i]
        if (passable(a.tc + DX[a.dir], a.tr + DY[a.dir], false)) return a.dir
        return -1
    }

    function arrive(a: Actor) {
        const k = kindAt(a.tc, a.tr)
        const i: number = a.sprite.data["i"]
        if (k == K_DOT || k == K_POWER) {
            setFloor(a.tc, a.tr)
            dotsLeft--
            infos[i].changeScoreBy(k == K_POWER ? 50 : 10)
            if (k == K_POWER) {
                frightUntil = game.runtime() + Math.max(2500, 6500 - maze * 700)
                combo = 0
                play(mazeSounds.power)
                for (let g = 0; g < ghosts.length; g++) if (gMode[g] == M_OUT) { gScared[g] = true; reverse(ghosts[g]) }
            } else if (dotsLeft % 2 == 0) play(mazeSounds.dot)
            if (dotsLeft <= 0 && pendingMaze < 0) pendingMaze = maze + 1
        }
    }

    function reverse(a: Actor) {
        if (!a.moving) { a.dir = (a.dir + 2) % 4; return }
        const back = (a.dir + 2) % 4
        a.tc = ((a.tc + DX[back]) % W + W) % W
        a.tr += DY[back]
        a.dir = back
    }

    // ---------------------------------------------------------------- Geister-KI
    function nearestHero(x: number, y: number): Actor {
        let best: Actor = null, bd = 99999
        for (let i = 0; i < MAX_HEROES; i++) {
            const h = heroes[i]
            if (!h || !alive[i]) continue
            const d = Math.abs(h.x - x) + Math.abs(h.y - y)
            if (d < bd) { bd = d; best = h }
        }
        return best
    }

    function ghostTarget(g: number): number {
        const a = ghosts[g]
        if (gMode[g] == M_EYES) return houseCells.length ? houseCells[0] : exitCell
        if (gMode[g] == M_LEAVE) return exitCell
        const now = game.runtime()
        const scatter = ((now - modeStart) % 27000) < 6000
        const corners = [W - 2, 1, (H - 2) * W + 1, (H - 2) * W + W - 2]
        if (scatter) return corners[g % 4] + (g == 1 ? 0 : 0)
        const h = nearestHero(a.x, a.y)
        if (!h) return corners[g % 4]
        const hc = h.tc, hr = h.tr
        if (g % 4 == 0) return hr * W + hc
        if (g % 4 == 1) {
            const c = Math.clamp(0, W - 1, hc + DX[h.dir] * 4), r = Math.clamp(0, H - 1, hr + DY[h.dir] * 4)
            return r * W + c
        }
        if (g % 4 == 2) return ((Math.idiv(now, 4000) + g) % 2) ? hr * W + hc : corners[(Math.idiv(now, 4000)) % 4]
        const far = Math.abs(hc - a.tc) + Math.abs(hr - a.tr) > 8
        return far ? hr * W + hc : corners[3]
    }

    function ghostDecide(a: Actor): number {
        const g: number = a.sprite.data["g"]
        // Zustandswechsel an Feldmitten
        const cell = a.tr * W + a.tc
        if (gMode[g] == M_LEAVE && cell == exitCell) gMode[g] = M_OUT
        if (gMode[g] == M_EYES && kindAt(a.tc, a.tr) == K_HOUSE) { gMode[g] = M_LEAVE; gScared[g] = false }
        if (gMode[g] == M_HOUSE) {
            if (game.runtime() >= gLeaveAt[g]) gMode[g] = M_LEAVE
            else {
                // im Haus hin und her
                const nd = passable(a.tc + DX[a.dir], a.tr, true) && kindAt(a.tc + DX[a.dir], a.tr) == K_HOUSE ? a.dir : (a.dir + 2) % 4
                return DY[nd] == 0 ? nd : 0
            }
        }
        const inHouseOk = gMode[g] == M_LEAVE || gMode[g] == M_EYES
        const opts: number[] = []
        for (let d = 0; d < 4; d++) {
            if (d == (a.dir + 2) % 4) continue
            const c = a.tc + DX[d], r = a.tr + DY[d]
            if (!passable(c, r, true)) continue
            if (!inHouseOk && kindAt(c, r) == K_HOUSE) continue
            opts.push(d)
        }
        if (opts.length == 0) return (a.dir + 2) % 4
        if (gScared[g] && game.runtime() < frightUntil && gMode[g] == M_OUT) return opts[randint(0, opts.length - 1)]
        const t = ghostTarget(g), tc = t % W, tr = Math.idiv(t, W)
        let best = opts[0], bd = 999999
        for (const d of opts) {
            const c = a.tc + DX[d], r = a.tr + DY[d]
            const dd = (c - tc) * (c - tc) + (r - tr) * (r - tr)
            if (dd < bd) { bd = dd; best = d }
        }
        return best
    }

    // ---------------------------------------------------------------- Spieler
    function joinPlayer(i: number) {
        if (i >= maxPlayers || alive[i] || !running || heroes[i]) return
        const a = new Actor(heroImgs[i][2][0], SpriteKind.MzHero)
        a.sprite.data["i"] = i
        heroes[i] = a
        alive[i] = true
        a.place(startCells[i % startCells.length])
        want[i] = 2
        invincibleUntil[i] = game.runtime() + 1500
        infos[i].setLife(startLives)
        if (i > 0) infos[i].setScore(0)
        play(mazeSounds.join)
    }
    function pressA(k: number) { if (!heroes[k]) joinPlayer(k) }
    function steer(k: number, d: number) {
        want[k] = d
        const a = heroes[k]
        if (a && a.moving && d == (a.dir + 2) % 4) reverse(a)
    }
    // einzeln registriert: der Web-Compiler erlaubt hier keine Controller aus einer Liste
    controller.player1.A.onEvent(ControllerButtonEvent.Pressed, function () { pressA(0) })
    controller.player2.A.onEvent(ControllerButtonEvent.Pressed, function () { pressA(1) })
    controller.player3.A.onEvent(ControllerButtonEvent.Pressed, function () { pressA(2) })
    controller.player4.A.onEvent(ControllerButtonEvent.Pressed, function () { pressA(3) })
    controller.player1.right.onEvent(ControllerButtonEvent.Pressed, function () { steer(0, 0) })
    controller.player1.down.onEvent(ControllerButtonEvent.Pressed, function () { steer(0, 1) })
    controller.player1.left.onEvent(ControllerButtonEvent.Pressed, function () { steer(0, 2) })
    controller.player1.up.onEvent(ControllerButtonEvent.Pressed, function () { steer(0, 3) })
    controller.player2.right.onEvent(ControllerButtonEvent.Pressed, function () { steer(1, 0) })
    controller.player2.down.onEvent(ControllerButtonEvent.Pressed, function () { steer(1, 1) })
    controller.player2.left.onEvent(ControllerButtonEvent.Pressed, function () { steer(1, 2) })
    controller.player2.up.onEvent(ControllerButtonEvent.Pressed, function () { steer(1, 3) })
    controller.player3.right.onEvent(ControllerButtonEvent.Pressed, function () { steer(2, 0) })
    controller.player3.down.onEvent(ControllerButtonEvent.Pressed, function () { steer(2, 1) })
    controller.player3.left.onEvent(ControllerButtonEvent.Pressed, function () { steer(2, 2) })
    controller.player3.up.onEvent(ControllerButtonEvent.Pressed, function () { steer(2, 3) })
    controller.player4.right.onEvent(ControllerButtonEvent.Pressed, function () { steer(3, 0) })
    controller.player4.down.onEvent(ControllerButtonEvent.Pressed, function () { steer(3, 1) })
    controller.player4.left.onEvent(ControllerButtonEvent.Pressed, function () { steer(3, 2) })
    controller.player4.up.onEvent(ControllerButtonEvent.Pressed, function () { steer(3, 3) })

    function heroOut(i: number) {
        if (!heroes[i]) return
        alive[i] = false
        heroes[i].sprite.setFlag(SpriteFlag.Invisible, true)
        let anyAlive = false
        for (let k = 0; k < MAX_HEROES; k++) if (alive[k] || (heroes[k] && infos[k].life() > 0 && respawnAt[k] > 0)) anyAlive = true
        if (!anyAlive) {
            running = false
            pause(800)
            game.setGameOverMessage(false, "Game Over")
            game.over(false)
        }
    }
    info.player1.onLifeZero(function () { respawnAt[0] = 0; heroOut(0) })
    info.player2.onLifeZero(function () { respawnAt[1] = 0; heroOut(1) })
    info.player3.onLifeZero(function () { respawnAt[2] = 0; heroOut(2) })
    info.player4.onLifeZero(function () { respawnAt[3] = 0; heroOut(3) })

    function catchHero(i: number) {
        const now = game.runtime()
        if (now < invincibleUntil[i] || !alive[i]) return
        play(mazeSounds.die)
        scene.cameraShake(2, 300)
        alive[i] = false
        heroes[i].sprite.setFlag(SpriteFlag.Invisible, true)
        respawnAt[i] = now + 1200
        infos[i].changeLifeBy(-1)
    }

    // ---------------------------------------------------------------- Ablauf
    forever(function () {
        if (pendingMaze < 0) return
        const next = pendingMaze
        running = false
        pause(600)
        if (clearHandler) clearHandler(next)
        if (next >= mazeCount) {
            game.setGameOverMessage(true, "Alle Labyrinthe geschafft!")
            game.over(true)
            return
        }
        music.play(mazeSounds.levelTune, music.PlaybackMode.UntilDone)
        loadMaze(next)
        banner(mazeName(next))
        pendingMaze = -1
        running = true
    })

    function banner(text: string) {
        const img = image.create(140, 16)
        img.fill(15)
        img.drawRect(0, 0, 140, 16, 1)
        img.printCenter(text, 4, 5, image.font8)
        const b = sprites.create(img, SpriteKind.MzFx)
        b.setFlag(SpriteFlag.Ghost, true)
        b.setPosition(80, 60)
        b.z = 100
        b.lifespan = 1800
    }

    game.onUpdate(function () {
        if (!running) return
        const dt = Math.min(0.05, game.eventContext().deltaTime)
        const now = game.runtime()
        const anim = Math.idiv(now, 120) % 2
        for (let i = 0; i < MAX_HEROES; i++) {
            const h = heroes[i]
            if (!h) continue
            if (!alive[i]) {
                if (respawnAt[i] > 0 && now >= respawnAt[i] && infos[i].life() > 0) {
                    respawnAt[i] = 0
                    alive[i] = true
                    h.place(startCells[i % startCells.length])
                    invincibleUntil[i] = now + 2000
                    h.sprite.setFlag(SpriteFlag.Invisible, false)
                }
                continue
            }
            advance(h, heroSpeed * (1 + maze * 0.05) * dt, false, heroDecide)
            h.sprite.setPosition(h.x, h.y)
            h.sprite.setImage(heroImgs[i][h.dir][h.moving ? anim : 0])
            h.sprite.setFlag(SpriteFlag.Invisible, now < invincibleUntil[i] && Math.idiv(now, 80) % 2 == 0)
        }
        const frightened = now < frightUntil
        for (let g = 0; g < ghosts.length; g++) {
            const a = ghosts[g]
            let sp = 44 * ghostSpeedPercent / 100 * (1 + maze * 0.08)
            if (gMode[g] == M_EYES) sp = 95
            else if (gScared[g] && frightened) sp = sp * 0.55
            else if (gMode[g] == M_HOUSE) sp = 20
            if (!frightened) gScared[g] = false
            advance(a, sp * dt, true, ghostDecide)
            a.sprite.setPosition(a.x, a.y)
            if (gMode[g] == M_EYES) a.sprite.setImage(eyesImg)
            else if (gScared[g] && frightened) a.sprite.setImage(frightUntil - now < 1500 && anim == 1 ? blinkImg : scaredImgs[anim])
            else a.sprite.setImage(ghostImgs[g % 4][anim])
            // Begegnung mit Spielern
            for (let i = 0; i < MAX_HEROES; i++) {
                const h = heroes[i]
                if (!h || !alive[i]) continue
                if (Math.abs(h.x - a.x) < 6 && Math.abs(h.y - a.y) < 6) {
                    if (gMode[g] == M_EYES) continue
                    if (gScared[g] && frightened) {
                        gMode[g] = M_EYES
                        gScared[g] = false
                        infos[i].changeScoreBy(200 * (1 << Math.min(3, combo)))
                        combo++
                        play(mazeSounds.eatGhost)
                        if (ghostHandler) ghostHandler()
                    } else if (gMode[g] == M_OUT || gMode[g] == M_LEAVE) catchHero(i)
                }
            }
        }
    })

    // ================================================================ Blöcke

    //% blockId=mz_start block="starte Pixel-Maze"
    //% group="Start" weight=100
    export function startGame() {
        if (started) return
        started = true
        control.runInParallel(function () {
            resolveAssets()
            mazeCount = Math.max(1, countMazes())
            game.setGameOverPlayable(true, mazeSounds.winTune, false)
            game.setGameOverPlayable(false, mazeSounds.endTune, false)
            play(mazeSounds.startTune)
            game.splash(title, "Fang alle Punkte! Mitspieler: A")
            for (let g = 0; g < ghostCount; g++) {
                const a = new Actor(ghostImgs[g % 4][0], SpriteKind.MzGhost)
                a.sprite.data["g"] = g
                ghosts.push(a); gMode.push(M_HOUSE); gScared.push(false); gLeaveAt.push(0)
            }
            loadMaze(0)
            running = true
            joinPlayer(0)
            banner(mazeName(0))
        })
    }

    //% blockId=mz_title block="setze Titel auf $text"
    //% text.defl="PIXEL-MAZE"
    //% group="Start" weight=90
    export function setTitle(text: string) { title = text }

    /**
     * Legt ein Labyrinth fest (Tilemap mit 8x8-Kacheln, 20x15 Felder): Wände, Punkte,
     * Kraftpillen, Start-Kacheln für die Spieler und Geisterhaus-Kacheln.
     */
    //% blockId=mz_set_maze block="Labyrinth $n Karte $map Stil $s"
    //% n.min=1 n.max=9 n.defl=1
    //% map.shadow=tiles_tilemap_editor
    //% inlineInputMode=inline
    //% group="Labyrinthe" weight=100
    export function setMaze(n: number, map: tiles.TileMapData, s: Style) {
        const i = Math.clamp(1, MAX_MAZES, n) - 1
        mazeMaps[i] = map
        mazeStyles[i] = s
    }

    //% blockId=mz_lives block="setze Leben auf $n"
    //% n.min=1 n.max=9 n.defl=3
    //% group="Einstellungen" weight=100
    export function setLives(n: number) { startLives = n }

    //% blockId=mz_max_players block="erlaube bis zu $n Spieler"
    //% n.min=1 n.max=4 n.defl=4
    //% group="Einstellungen" weight=90
    export function setMaxPlayers(n: number) { maxPlayers = Math.clamp(1, MAX_HEROES, n) }

    //% blockId=mz_ghosts block="setze Anzahl Geister auf $n"
    //% n.min=1 n.max=8 n.defl=4
    //% group="Einstellungen" weight=80
    export function setGhostCount(n: number) { if (!started) ghostCount = Math.clamp(1, 8, n) }

    //% blockId=mz_ghost_speed block="setze Geister-Tempo auf $percent \\%"
    //% percent.min=40 percent.max=200 percent.defl=100
    //% group="Einstellungen" weight=70
    export function setGhostSpeed(percent: number) { ghostSpeedPercent = percent }

    //% blockId=mz_hero_speed block="setze Spieler-Tempo auf $v"
    //% v.min=20 v.max=120 v.defl=50
    //% group="Einstellungen" weight=60
    export function setHeroSpeed(v: number) { heroSpeed = v }

    //% blockId=mz_on_clear block="wenn Labyrinth $maze geschafft"
    //% draggableParameters="reporter"
    //% group="Ereignisse" weight=100
    export function onMazeCleared(handler: (maze: number) => void) { clearHandler = handler }

    //% blockId=mz_on_ghost block="wenn Geist gefressen"
    //% group="Ereignisse" weight=90
    export function onGhostEaten(handler: () => void) { ghostHandler = handler }

    //% blockId=mz_hero block="Figur von Spieler $n"
    //% n.min=1 n.max=4 n.defl=1
    //% group="Werte" weight=100
    export function heroOf(n: number): Sprite { const h = heroes[Math.clamp(1, MAX_HEROES, n) - 1]; return h ? h.sprite : null }

    //% blockId=mz_dots_left block="übrige Punkte"
    //% group="Werte" weight=90
    export function dotsRemaining(): number { return dotsLeft }

    //% blockId=mz_current block="aktuelles Labyrinth"
    //% group="Werte" weight=80
    export function currentMaze(): number { return maze + 1 }

    /**
     * Jeder Stil bringt seine eigene 16-Farben-Palette mit (z. B. Blautöne im Meer, Glut in der Lavahöhle).
     * Aus: das Spiel nutzt die Palette des Projekts.
     */
    //% blockId=mz_palettes block="Stil-Paletten $on"
    //% on.shadow=toggleOnOff on.defl=true
    //% group="Einstellungen" weight=10
    export function useStylePalettes(on: boolean) { stylePalettes = on }
}
