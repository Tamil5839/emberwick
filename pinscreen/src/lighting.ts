// A single low, raking key light does all the work: the image lives in the
// shadows it throws across the pins. Everything else is kept dim so those
// shadows stay deep.

import {
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  Vector3,
  type WebGLRenderer,
} from 'three';
import { settings } from './settings';

const SHADOW_MAP_SIZE = 2048;
const LIGHT_DISTANCE = 40;
/** PCF filter radius in shadow-map texels: soft enough to feel photographic, tight enough to keep pins crisp. */
const SHADOW_RADIUS = 2.2;

export interface ShadowBounds {
  halfWidth: number;
  halfHeight: number;
  minZ: number;
  maxZ: number;
}

export class Lighting {
  readonly key: DirectionalLight;
  readonly fill: HemisphereLight;

  private getBounds: () => ShadowBounds = () => ({ halfWidth: 10, halfHeight: 8, minZ: -0.5, maxZ: 3 });
  private lastElevation = NaN;
  private lastAzimuth = NaN;
  private lastDepth = NaN;
  private readonly corner = new Vector3();

  constructor(
    private readonly scene: Scene,
    renderer: WebGLRenderer,
  ) {
    scene.background = new Color('#040405');

    // Studio reflections so the steel reads as metal, not grey plastic.
    const pmrem = new PMREMGenerator(renderer);
    const studio = createStudioEnvironment();
    scene.environment = pmrem.fromScene(studio, 0.02).texture;
    disposeScene(studio);
    pmrem.dispose();

    this.key = new DirectionalLight(new Color('#fff3e4'), settings.lightIntensity);
    this.key.castShadow = true;
    const shadow = this.key.shadow;
    shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    shadow.radius = SHADOW_RADIUS;
    // The board's normal is +Z, so use it as "up" for the shadow camera: the light never looks along it.
    shadow.camera.up.set(0, 0, 1);
    scene.add(this.key, this.key.target);

    this.fill = new HemisphereLight(new Color('#9aa6b8'), new Color('#1a1510'), 0.06);
    this.fill.position.set(0, 0, 1);
    scene.add(this.fill);

    this.update();
  }

  /** Where to read the board's extent from; called again whenever the board is rebuilt. */
  setBounds(getBounds: () => ShadowBounds): void {
    this.getBounds = getBounds;
    this.lastElevation = NaN;
    this.update();
  }

  /**
   * Applies the current settings and advances the auto sweep. Cheap when
   * nothing changed; returns true when the shadows need re-rendering.
   */
  update(dt = 0): boolean {
    this.key.intensity = settings.lightIntensity;
    this.scene.environmentIntensity = settings.environment;

    if (settings.autoSweep && dt > 0) {
      settings.lightAzimuth = (settings.lightAzimuth + settings.sweepSpeed * dt) % 360;
    }

    const elevation = MathUtils.clamp(settings.lightElevation, 2, 80);
    const azimuth = settings.lightAzimuth;
    const depth = settings.depth;
    if (elevation === this.lastElevation && azimuth === this.lastAzimuth && depth === this.lastDepth) return false;
    this.lastElevation = elevation;
    this.lastAzimuth = azimuth;
    this.lastDepth = depth;

    const el = MathUtils.degToRad(elevation);
    const az = MathUtils.degToRad(azimuth);
    this.key.position.set(
      Math.cos(el) * Math.cos(az) * LIGHT_DISTANCE,
      Math.cos(el) * Math.sin(az) * LIGHT_DISTANCE,
      Math.sin(el) * LIGHT_DISTANCE,
    );
    this.key.target.position.set(0, 0, 0);
    this.key.updateMatrixWorld();
    this.key.target.updateMatrixWorld();
    // The studio's key softbox sits at azimuth 0; swing it round with the light so
    // reflections and shadows always agree.
    this.scene.environmentRotation.set(0, 0, az);
    this.fitShadowCamera(el);
    return true;
  }

  /**
   * Fits the orthographic shadow frustum tightly around the board as the light
   * sees it. At a raking angle the board is foreshortened to a thin sliver, so
   * a tight fit buys a lot of shadow-map resolution where the pins are.
   */
  private fitShadowCamera(elevationRad: number): void {
    const cam = this.key.shadow.camera;
    cam.position.copy(this.key.position);
    cam.lookAt(this.key.target.position);
    cam.updateMatrixWorld();

    const { halfWidth, halfHeight, minZ, maxZ } = this.getBounds();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let near = Infinity;
    let far = -Infinity;
    for (let i = 0; i < 8; i++) {
      this.corner
        .set(i & 1 ? halfWidth : -halfWidth, i & 2 ? halfHeight : -halfHeight, i & 4 ? maxZ : minZ)
        .applyMatrix4(cam.matrixWorldInverse);
      minX = Math.min(minX, this.corner.x);
      maxX = Math.max(maxX, this.corner.x);
      minY = Math.min(minY, this.corner.y);
      maxY = Math.max(maxY, this.corner.y);
      near = Math.min(near, -this.corner.z);
      far = Math.max(far, -this.corner.z);
    }
    const pad = 0.05;
    cam.left = minX - pad;
    cam.right = maxX + pad;
    cam.bottom = minY - pad;
    cam.top = maxY + pad;
    cam.near = Math.max(0.1, near - 1);
    cam.far = far + 1;
    cam.updateProjectionMatrix();

    // Bias in world units, scaled to the texel footprint. Normal bias does the heavy
    // lifting at grazing angles; the constant term stays tiny to avoid peter-panning.
    const texel = Math.max((maxX - minX) / SHADOW_MAP_SIZE, (maxY - minY) / SHADOW_MAP_SIZE);
    const grazing = 1 / Math.max(Math.sin(elevationRad), 0.08);
    this.key.shadow.normalBias = texel * 1.6 * Math.min(grazing, 4);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.needsUpdate = true;
  }
}

/**
 * A procedural dark studio for the metal to reflect: black walls, a tall
 * softbox beside the key light (at azimuth 0; rotated with the light), a broad
 * dim panel behind the camera so exposed pin heads carry a soft sheen, and a
 * faint rim strip opposite the key.
 */
function createStudioEnvironment(): Scene {
  const env = new Scene();
  env.background = new Color(0x000000);
  const box = new BoxGeometry(1, 1, 1);

  const room = new Mesh(box, new MeshBasicMaterial({ color: new Color(0.004, 0.004, 0.005), side: BackSide }));
  room.scale.setScalar(60);
  env.add(room);

  const panel = (intensity: number, tint: string, pos: [number, number, number], size: [number, number, number]) => {
    const color = new Color(tint).multiplyScalar(intensity);
    const mesh = new Mesh(box, new MeshBasicMaterial({ color }));
    mesh.position.set(...pos);
    mesh.scale.set(...size);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };

  // Key softbox: low and to the side, like the light that throws the shadows.
  panel(5, '#fff1df', [14, 0, 5], [10, 14, 0.2]);
  // Broad, soft frontal panel above and behind the camera: exposed heads catch it,
  // buried ones don't, which is what carries the picture's tone.
  panel(2.4, '#dfe6f2', [0, 6, 18], [22, 10, 0.2]);
  // Thin cool rim strip opposite the key.
  panel(2.2, '#cfdcff', [-16, 2, 3], [0.8, 16, 0.2]);

  return env;
}

function disposeScene(scene: Scene): void {
  scene.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshBasicMaterial).dispose();
    }
  });
}
