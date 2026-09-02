# Drop your assets here

Two kinds of file are picked up automatically: the sound, and the sections.

**Sections.** Each one is delivered as an approach that plays itself plus one
or more actions the hand moves, numbered in the order they happen:

| File                     | What it is                                         |
| ------------------------ | -------------------------------------------------- |
| `sections/NNa-approach.mp4` | Plays itself and ends. Ordinary GOP.            |
| `sections/NNb-action.mp4`   | The hand's. All-intra — every frame a keyframe. |
| `sections/NNc-action.mp4`   | A second action, if the movement needs two.     |

Section one is one action drawn along a line; section two is two, each turned
around a circle. Which shape a section uses is set in `src/lib/sections.js`.

**Sound.**

| File          | What it is                                                     |
| ------------- | -------------------------------------------------------------- |
| `scene.mp4`   | A shared cut, used by any section with no clips of its own.      |
| `track.mp3`   | The music, and the only music. Loops seamlessly, no stand-in.    |
| `after.mp3`   | The second audio. Played once at the end of a section, after the mark has been drawn all the way. A cue, not a loop — a few seconds is right. |

Nothing else needs to change: `src/lib/media.js` already tries these first.

Serving them from this origin also sidesteps CORS entirely, which matters —
a cross-origin video without `Access-Control-Allow-Origin` cannot be uploaded
into a WebGL texture, and a cross-origin track without it cannot be routed
through the filter graph.
