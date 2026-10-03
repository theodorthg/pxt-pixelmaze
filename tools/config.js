module.exports = {
    styles: ['neon', 'candy', 'hedge'],           // Reihenfolge = pixelmaze.Style
    mazes: [{ seed: '1', style: 'neon', name: 'Neonlabyrinth' }, { seed: '2', style: 'candy', name: 'Zuckerland' }, { seed: '7', style: 'hedge', name: 'Heckengarten' }],
    heroColors: [5, 7, 3, 9],                     // Spieler 1–4
    ghostColors: [2, 3, 9, 4],                    // Jäger, Abfänger, Streuner, Scheuer
    sfx: { dot: ['blip', '3'], power: ['powerup', '6'], eatGhost: ['coin', '5'], die: ['death', '3'], join: ['blip', '1'] },
    melodies: { startTune: ['start', '5'], levelTune: ['level', '4'], winTune: ['win', '4'], endTune: ['gameover', '4'] },
};
