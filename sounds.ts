// AUTOMATISCH ERZEUGT von tools/build-assets.js – Sounds in tools/config.js ändern.
namespace mazeSounds {
    export const dot = music.createSoundEffect(WaveShape.Square, 709, 709, 102, 0, 65, SoundExpressionEffect.None, InterpolationCurve.Linear)
    export const power = music.createSoundEffect(WaveShape.Square, 339, 1592, 142, 29, 448, SoundExpressionEffect.Warble, InterpolationCurve.Curve)
    export const eatGhost = music.createSoundEffect(WaveShape.Square, 1103, 2128, 149, 0, 120, SoundExpressionEffect.None, InterpolationCurve.Linear)
    export const die = music.createSoundEffect(WaveShape.Sawtooth, 612, 74, 160, 18, 687, SoundExpressionEffect.Warble, InterpolationCurve.Curve)
    export const join = music.createSoundEffect(WaveShape.Sine, 1063, 1063, 80, 0, 52, SoundExpressionEffect.None, InterpolationCurve.Linear)
    export const startTune = music.melodyPlayable(new music.Melody("c4:2-141 g4:2 c5:2 e5:2 r:2 a4:2 c5:8"))
    export const levelTune = music.melodyPlayable(new music.Melody("d#4:1-166 a#4:1 d#5:1 a#5:5"))
    export const winTune = music.melodyPlayable(new music.Melody("d4:2-169 d4:1 d4:1 a4:4 f#4:2 a4:2 c#5:6 r:1 f#5:1 d5:8"))
    export const endTune = music.melodyPlayable(new music.Melody("a#4:3-107 g#4:3 f#4:3 d#3:10"))
}
