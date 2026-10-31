# ChordGate

**Rhythmic retrigger for held chords: a free Max for Live MIDI effect for Ableton Live.**

Feed it long chords (pads, strings, any sustained MIDI) and draw any rhythm you like. Every active step re-strikes the whole chord as a brand-new note.

Unlike an audio gate, each hit is a real note-on. Pianos, plucks and keys get a fresh attack on every beat instead of just being muted and unmuted.

🇷🇺 [Описание на русском](README_RU.md)

## Features

- Draw any rhythm: velocity per step, where 0 means rest
- Note length per step, from 0.1 to 4 steps
- Pattern length from 1 to 32 steps
- Rates: 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32
- Follows chord changes automatically
- Synced to Live's transport and song position
- Bypass switch that passes notes through untouched

## Requirements

Ableton Live with Max for Live. Max for Live is included in Live Suite and available as an add-on for Live Standard.

## Installation

1. Download `ChordGate.amxd` and `ChordGate.js` and keep them **in the same folder**, for example in your Live User Library.
2. Drag `ChordGate.amxd` onto the MIDI track that holds your chords, before the instrument.
3. Press Play.

Optional: open the device with **Edit** and press **Freeze** in Max. This embeds `ChordGate.js` inside the device, so you only need to carry one file.

## Controls

| Control | What it does |
|---|---|
| **Velocity** (orange bars) | Hit strength per step. Draw a bar to add a hit, pull it to 0 for a rest. |
| **Length** (blue bars) | How long each hit is held, in steps (0.1 to 4). |
| **Rate** | Step size: 1/4, 1/8, 1/8T, 1/16, 1/16T, 1/32. |
| **Steps** | Pattern length, 1 to 32 steps. |
| **On** | When off, chords pass through unchanged. |
| White strip | Playhead showing the current step. |

A fresh device starts with a 3-3-2 pattern so you can hear it right away.

## Tips

- **Get the result as MIDI:** create a new MIDI track, set *MIDI From* to the ChordGate track with *Post FX*, arm it and record.
- ChordGate plays while Live's transport is running.

## If the device does not load

Build it by hand from the fallback file:

1. Put an empty **Max MIDI Effect** on a track and click **Edit**.
2. In Max, select everything and delete it.
3. Open `extras/ChordGate_paste.txt` in a text editor, copy everything and paste it into Max (Ctrl+V / Cmd+V).
4. In the patcher Inspector, turn on **Open in Presentation**.
5. Save the device into the same folder as `ChordGate.js`.

## How it works

ChordGate keeps a list of the notes that are currently held. A metro synced to Live's transport ticks every 20 ticks (1/96 note). On every step boundary with a velocity above 0, all held notes get a note-off followed by a note-on with that step's velocity, and a note-off is scheduled after the step's length.

```
midiin → midiparse → js ChordGate.js → midiformat → midiout
                          ↑
metro 20 ticks → delay 2 → transport (song position)
```

The short delay makes sure new chord notes arrive before the step fires, so chord changes on a step are never missed.

## Credits

- **Idea, concept and testing in Ableton Live:** the repository owner
- **Code:** written by Claude (Anthropic)
- **Inspired by [PolyTrigga](https://midierror.gumroad.com/l/polytrigga) by midierror**

PolyTrigga is a commercial Max for Live device with many more features: ratchets, several timing modes, sequencer directions, randomization and support from its author. If you need more than ChordGate offers, please support the author and get PolyTrigga.

ChordGate is an independent implementation written from scratch. It is not affiliated with midierror.

## License

MIT, see [LICENSE](LICENSE).
