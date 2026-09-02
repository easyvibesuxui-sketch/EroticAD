# Drop your assets here

Two filenames are picked up automatically:

| File          | What it is                                                     |
| ------------- | -------------------------------------------------------------- |
| `scene.mp4`   | The film. H.264, muted track, loopable. 1080p is plenty.        |
| `track.mp3`   | The only sound on the site. Loops under everything, start to end. |

Nothing else needs to change: `src/lib/media.js` already tries these first.

Serving them from this origin also sidesteps CORS entirely, which matters —
a cross-origin video without `Access-Control-Allow-Origin` cannot be uploaded
into a WebGL texture, and a cross-origin track without it cannot be routed
through the filter graph.
