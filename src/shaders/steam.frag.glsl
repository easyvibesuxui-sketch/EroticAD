precision highp float;

/*  STEAMED GLASS
 *  -------------
 *  The video never reaches the eye directly. It is pushed through a sheet of
 *  condensation: the frame is warped by drifting fog, smeared by a wide
 *  poisson blur, crushed down to a warm luminance ramp (skin glow and
 *  silhouette survive, detail does not), then veiled, beaded and streaked.
 *
 *  uSteam == 1.0 -> nothing legible, only heat and movement.
 *  uSteam == 0.0 -> the pane is dry and the video is untouched.
 */

uniform sampler2D uTex;
uniform vec2  uCoverScale;   // uv scale that makes the video "cover" the plane
uniform float uPlaneAspect;  // width / height of the plane, in screen units
uniform float uTime;
uniform float uSteam;        // 0 clear .. 1 fogged  (breathing already folded in)
uniform float uReveal;       // raw hold progress, 0..1
uniform float uPulse;        // heartbeat transient, shared with the audio engine
uniform float uBreath;       // slow respiration, 0..1
uniform vec2  uPointer;      // where the hand rests, in plane uv
uniform float uWipe;         // how much of the hand's warmth has soaked in

varying vec2 vUv;

const float GOLDEN = 2.39996323;
const int   TAPS   = 28;

/* ------------------------------------------------------------------ noise */

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

/* Per-pixel randomness for dithering and tap jitter. Fed from gl_FragCoord
 * rather than uv: hash21 over a 0..1 domain correlates along rows and leaves
 * faint horizontal banding across the fog. */
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

float fbm5(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v;
}

/* ------------------------------------------------------- condensation body
 * Two layers of fog moving at different speeds and in different directions.
 * The slow one is the body of the steam; the fast one is the shimmer that
 * makes it read as warm air rather than a static blur.
 */
float condensation(vec2 p, float t) {
  float slow = fbm5(p * 2.6 + vec2(t * 0.014, -t * 0.022));
  float fast = fbm3(p * 6.1 + vec2(-t * 0.055, t * 0.041));
  float body = mix(slow, fast, 0.32);
  // Breathing thickens and thins the sheet from the bottom up, like warm air
  // rising off skin.
  body += (1.0 - p.y) * 0.10 * uBreath;
  return clamp(body, 0.0, 1.0);
}

/* --------------------------------------------------------------- droplets
 * Beads clinging to the glass. x = coverage, yz = a cheap surface normal so
 * each bead can act as a tiny lens over whatever is behind it.
 */
vec3 beads(vec2 p, float t) {
  vec2 q = p * vec2(uPlaneAspect, 1.0) * 26.0;
  q.y += t * 0.05;
  float n  = fbm3(q);
  float e  = 0.06;
  float gx = fbm3(q + vec2(e, 0.0)) - fbm3(q - vec2(e, 0.0));
  float gy = fbm3(q + vec2(0.0, e)) - fbm3(q - vec2(0.0, e));
  float m  = smoothstep(0.60, 0.76, n);
  return vec3(m, gx, gy);
}

/* --------------------------------------------------------------- rivulets
 * Every so often a bead gets heavy and runs, cutting a narrow, wobbling
 * channel of near-clear glass behind it. This is the only place detail is
 * allowed to leak while the pane is fogged — and only a sliver of it.
 */
float rivulets(vec2 p, float t) {
  float acc = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float lanes = 7.0 + fi * 6.0;

    vec2 q = p;
    q.x += 0.010 * sin(p.y * (8.0 + fi * 5.0) + t * 0.45 + fi * 2.1);

    float lane = floor(q.x * lanes);
    float seed = hash21(vec2(lane, 11.0 + fi * 17.0));
    float alive = step(0.72, seed);

    float cx = (lane + 0.5 + (seed - 0.5) * 0.45) / lanes;
    float w = 0.0045 + seed * 0.0070;
    float band = smoothstep(w, 0.0, abs(q.x - cx));

    // The head falls; the trail is what it has already wiped clean above it.
    float head = 1.0 - fract(seed * 5.31 + t * (0.030 + seed * 0.045));
    float above = p.y - head;
    float tail = smoothstep(0.0, 0.05, above) * smoothstep(0.55, 0.10, above);

    acc = max(acc, band * tail * alive);
  }
  return clamp(acc, 0.0, 1.0);
}

/* ------------------------------------------------------------------- blur
 * Golden-angle poisson disc. The jitter is per-pixel and time-varying, so any
 * structure the finite tap count would otherwise leave behind dissolves into
 * moving grain instead of resolving into a recognisable shape.
 */
vec3 mistBlur(vec2 uv, float radius, float jitter) {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i);
    float a = fi * GOLDEN + jitter;
    float r = sqrt((fi + 0.5) / float(TAPS));
    vec2 dir = vec2(cos(a) / uPlaneAspect, sin(a));
    vec2 off = dir * r * radius * uCoverScale;
    float w = exp(-1.7 * r * r);
    acc += texture2D(uTex, clamp(uv + off, vec2(0.0015), vec2(0.9985))).rgb * w;
    wsum += w;
  }
  return acc / wsum;
}

void main() {
  vec2 screenUv = vUv;                                   // 0..1 across the pane
  vec2 aspectUv = vec2(screenUv.x * uPlaneAspect, screenUv.y);

  float t = uTime;

  /* --- how fogged is this particular pixel ------------------------------ */

  float fog = condensation(screenUv, t);

  // The palm smears a soft, irregular hole in the sheet — never a clean circle.
  vec2 pAspect = vec2(uPointer.x * uPlaneAspect, uPointer.y);
  float d = distance(aspectUv, pAspect);
  float edge = fbm3(screenUv * 5.0 + t * 0.12) * 0.10;
  float palm = 1.0 - smoothstep(0.10, 0.46 + edge, d);

  float runs = rivulets(screenUv, t);

  float steam = uSteam;
  steam *= mix(1.0, 0.35, palm * uWipe);        // warmth of the hand
  steam *= 1.0 - runs * 0.30;                   // a bead ran through here
  steam *= 0.86 + 0.28 * fog;                   // the sheet is not uniform
  steam = clamp(steam, 0.0, 1.0);

  /* --- warp, then destroy detail ---------------------------------------- */

  vec3 bead = beads(screenUv, t);

  vec2 warp = vec2(
    fbm3(screenUv * 3.4 + vec2(t * 0.030, 0.0)) - 0.5,
    fbm3(screenUv * 3.4 + vec2(0.0, t * 0.026) + 41.7) - 0.5
  );

  vec2 uv = (screenUv - 0.5) * uCoverScale + 0.5;
  uv += warp * 0.085 * steam * uCoverScale;
  uv += bead.yz * 0.85 * bead.x * steam * uCoverScale;
  uv += vec2(0.0, runs * 0.010 * steam) * uCoverScale;

  float jitter = rand(gl_FragCoord.xy + fract(t) * vec2(37.0, 91.0)) * 6.2831;
  float radius = 0.088 * steam * steam + 0.026 * steam;

  vec3 wide = mistBlur(uv, radius, jitter);
  vec3 tight = mistBlur(uv, radius * 0.34, jitter + 1.7);
  vec3 sharp = texture2D(uTex, clamp(uv, vec2(0.0015), vec2(0.9985))).rgb;

  // Below ~0.02 steam the pane is dry and the frame is left completely alone.
  vec3 col = mix(sharp, mix(tight, wide, 0.62), smoothstep(0.0, 0.06, steam));

  /* --- skin bleed -------------------------------------------------------
   * At full steam the image collapses onto a warm luminance ramp. What is
   * left is heat, silhouette and motion: you can tell there is a body, and
   * nothing else.
   */
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

  vec3 shadowTint = vec3(0.115, 0.055, 0.075);
  vec3 midTint    = vec3(0.62, 0.33, 0.32);
  vec3 skinTint   = vec3(1.02, 0.80, 0.72);

  vec3 ramp = mix(shadowTint, midTint, smoothstep(0.02, 0.42, luma));
  ramp = mix(ramp, skinTint, smoothstep(0.38, 0.86, luma));
  ramp *= 0.72 + luma * 0.80;

  col = mix(col, ramp, steam * 0.82);

  // Highlights bloom through the fog before anything else does.
  float hot = max(luma - 0.52, 0.0);
  col += skinTint * pow(hot, 1.4) * steam * 0.9;

  /* --- the veil itself --------------------------------------------------- */

  vec3 haze = mix(vec3(0.135, 0.075, 0.088), vec3(0.40, 0.245, 0.245), fog);
  haze = mix(haze, vec3(0.52, 0.30, 0.29), uPulse * 0.35);
  col = mix(col, haze, steam * (0.26 + 0.30 * fog));

  // Warm air holds light. Without this lift the fogged frame reads as a dark
  // smudge rather than a lit room seen through a bathroom mirror.
  col += vec3(0.085, 0.048, 0.052) * steam * (0.55 + 0.45 * fog);

  // Beads catch the room light and sit on top of everything.
  float glint = smoothstep(0.55, 1.0, bead.x) * steam;
  col += vec3(0.50, 0.38, 0.38) * glint * (0.05 + 0.07 * fog);
  col += vec3(0.46, 0.32, 0.32) * runs * steam * 0.04;

  /* --- lens, once the glass is clear ------------------------------------- */

  float clearNess = 1.0 - steam;
  float lens = smoothstep(0.55, 1.0, clearNess);

  // Sampled unconditionally: a texture fetch inside non-uniform control flow
  // has undefined derivatives, and this pays for itself in stability.
  float ca = 0.0018 * lens;
  vec2 caDir = normalize(screenUv - vec2(0.5) + 1e-5) * ca * uCoverScale;
  vec3 fringe = vec3(
    texture2D(uTex, clamp(uv + caDir, vec2(0.0015), vec2(0.9985))).r,
    col.g,
    texture2D(uTex, clamp(uv - caDir, vec2(0.0015), vec2(0.9985))).b
  );
  col = mix(col, fringe, lens);
  // A whisper of warmth stays in the grade even at full reveal.
  col = mix(col, col * vec3(1.03, 0.99, 0.98), 0.6 * lens);

  /* --- finish ------------------------------------------------------------ */

  float vig = 1.0 - smoothstep(0.50, 1.10, distance(screenUv, vec2(0.5)) * 1.35);
  col *= mix(0.46, 1.0, vig);
  col *= 0.94 + 0.06 * uPulse;

  float grain = rand(gl_FragCoord.xy * 1.7 + fract(t) * vec2(113.0, 57.0)) - 0.5;
  col += grain * (0.020 + 0.045 * steam);

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
