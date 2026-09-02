# Drop your assets here

Three filenames are picked up automatically, ahead of every remote fallback:

| File          | What it is                                                     |
| ------------- | -------------------------------------------------------------- |
| `scene.mp4`   | The film. H.264, muted track, loopable. 1080p is plenty.        |
| `track.mp3`   | The bed — deep, slow, bass-forward. Loops seamlessly.           |
| `after.mp3`   | The second audio. Played once at the end of a section, after the mark has been drawn all the way. A cue, not a loop — a few seconds is right. |

Nothing else needs to change: `src/lib/media.js` already tries these first.

Serving them from this origin also sidesteps CORS entirely, which matters —
a cross-origin video without `Access-Control-Allow-Origin` cannot be uploaded
into a WebGL texture, and a cross-origin track without it cannot be routed
through the filter graph.
