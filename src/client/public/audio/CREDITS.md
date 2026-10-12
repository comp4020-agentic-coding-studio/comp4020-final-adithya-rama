# Jet Skirmish audio sources

These recordings are replacements, **not the original Mini Militia sounds**.

- Firearm clips: Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney,
  [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library),
  CC0. Source: [Prepared SFX Library.7z](https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z).
  Downloaded 13 October 2026. Source descriptions distinguish individual shots
  from bursts; only individual-shot recordings were selected.
- Hurt and death voices: Badre-Eddine,
  [Hurt / Death sound effect for character](https://opengameart.org/content/hurt-death-sound-effect-for-character),
  CC0. Source: [death sound effect.zip](https://opengameart.org/sites/default/files/death%20sound%20effect.zip).
  Downloaded 13 October 2026; files 1, 2, 6, 8 and 10.
- [CC0 terms](https://creativecommons.org/publicdomain/zero/1.0/).

Recordings are trimmed to a single attack/voice, mixed to mono, normalized with
headroom, faded at the tail, resampled to 44.1 kHz and encoded as Ogg Vorbis.
The game applies pitch, volume and filtering to distinguish fictional equipment.
For example, the Uzi uses a processed Carl Gustav M45 recording; this is sound
design, not an assertion that the physical weapons sound identical. Special
weapons, explosions, reload clicks and objective cues use authored synthesis.

manifest.json identifies each original filename, source/output SHA-256, trim
onset and duration. scripts/prepare-audio.py reproduces the conversion after the
archives are downloaded/extracted into .data/audio-source; use Python with
imageio-ffmpeg (and py7zr for extracting the firearm archive). Source archives
and conversion tools are excluded from the production image. Total shipped
recorded audio: 16 clips, 177,441 bytes. No remote audio requests during play.
