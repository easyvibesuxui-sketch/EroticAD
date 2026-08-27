// The plane is a pane of glass, not a screen. It breathes very slightly with
// the heartbeat so the whole frame feels alive even before anything moves.
uniform float uPulse;
uniform float uBreath;

varying vec2 vUv;

void main() {
  vUv = uv;

  vec3 pos = position;
  float swell = 1.0 + uPulse * 0.0055 + uBreath * 0.0022;
  pos.xy *= swell;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
