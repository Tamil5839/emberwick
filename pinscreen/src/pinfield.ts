// The pin board: one InstancedMesh of domed steel pins, hex-packed on a dark
// perforated backplate inside a low frame.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  type Material,
  Mesh,
  MeshDepthMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD_WIDTH, FINISHES, type FinishName, MAX_DEPTH, ROW_SPACING, settings } from './settings';

/** Pin radius as a fraction of the pitch; the rest is the gap between neighbours. */
const PIN_RADIUS = 0.43;
/** Dome height as a fraction of the pin radius. */
const HEAD_HEIGHT = 0.62;
const RADIAL_SEGMENTS = 8;
/** Where the shaft top rests when a pin is fully in, as a fraction of the dome height (negative = sunk). */
const REST_OFFSET = -0.35;
const PLATE_MARGIN = 0.32;
const PLATE_THICKNESS = 0.3;
const FRAME_WIDTH = 0.5;
const FRAME_HEIGHT = 0.16;
/** World z where every shaft ends: just under the plate surface, so hidden shaft is never drawn. */
const SHAFT_END_Z = -0.04;
/** How quickly ambient/environment light dies off the deeper a surface sits among its neighbours. */
const AO_STRENGTH = 6;
/** Neighbourhood radius used to estimate how buried each pin is, as a fraction of the pin depth (in pitches). */
const AO_REACH = 0.6;
const AO_MIN_RADIUS = 2;
const AO_MAX_RADIUS = 12;

/**
 * Ceiling on pin radiance before tone mapping. Unlimited normally; the
 * depth-of-field path resolves MSAA in HDR, where a sub-pixel glint would
 * otherwise survive as a white firefly, so it lowers this while active.
 */
export const pinHighlightLimit = { value: 1e4 };

export interface PinLayout {
  cols: number;
  rows: number;
  count: number;
  pitch: number;
  radius: number;
  fieldWidth: number;
  fieldHeight: number;
  plateWidth: number;
  plateHeight: number;
}

function layoutFor(cols: number, rows: number): PinLayout {
  const pitch = BOARD_WIDTH / (cols + 0.5);
  const radius = pitch * PIN_RADIUS;
  const fieldWidth = (cols + 0.5) * pitch;
  const fieldHeight = ((rows - 1) * ROW_SPACING + 1) * pitch;
  return {
    cols,
    rows,
    count: cols * rows,
    pitch,
    radius,
    fieldWidth,
    fieldHeight,
    plateWidth: fieldWidth + PLATE_MARGIN * 2,
    plateHeight: fieldHeight + PLATE_MARGIN * 2,
  };
}

/** World-space centre of pin (col, row); row 0 is the top of the board. */
function pinPosition(layout: PinLayout, col: number, row: number, out: { x: number; y: number }): void {
  const { pitch, cols, rows } = layout;
  out.x = (col + 0.5 + (row & 1) * 0.5 - (cols + 0.5) / 2) * pitch;
  out.y = ((rows - 1) / 2 - row) * ROW_SPACING * pitch;
}

export class PinField {
  readonly group = new Group();
  layout!: PinLayout;

  /** Current (smoothed) height of each pin above its rest position. */
  heights = new Float32Array(0);
  /** What's on screen: heights plus any ripple offset. */
  private shown = new Float32Array(0);
  /** World-space x/y of each pin, for effects and click hits. */
  posX = new Float32Array(0);
  posY = new Float32Array(0);
  private blurTmp = new Float32Array(0);
  private neighbourZ = new Float32Array(0);

  private pins: InstancedMesh | null = null;
  private board: Group | null = null;
  private restZ = 0;
  private headHeight = 0;

  private readonly pinMaterial: MeshStandardMaterial;
  private readonly pinDepthMaterial: MeshDepthMaterial;
  private readonly plateMaterial: MeshStandardMaterial;
  private readonly frameMaterial: MeshStandardMaterial;
  private readonly aoUniform = { value: AO_STRENGTH };

  constructor() {
    this.pinMaterial = new MeshStandardMaterial();
    this.pinMaterial.onBeforeCompile = (shader) => this.injectOcclusion(shader);
    this.pinMaterial.customProgramCacheKey = () => 'pin-occlusion';
    this.setFinish(settings.finish);
    // The shadow pass must trim the shafts exactly like the colour pass does.
    this.pinDepthMaterial = new MeshDepthMaterial();
    trimShaftsIn(this.pinDepthMaterial);

    this.plateMaterial = new MeshStandardMaterial({ color: '#ffffff', metalness: 0.05, roughness: 0.82 });
    this.frameMaterial = new MeshStandardMaterial({ color: '#121214', metalness: 0.3, roughness: 0.8 });
  }

  build(cols: number, rows: number): void {
    this.dispose();
    const layout = layoutFor(cols, rows);
    this.layout = layout;
    this.headHeight = layout.radius * HEAD_HEIGHT;
    this.restZ = this.headHeight * REST_OFFSET;

    const { count } = layout;
    this.heights = new Float32Array(count);
    this.shown = new Float32Array(count);
    this.posX = new Float32Array(count);
    this.posY = new Float32Array(count);
    this.blurTmp = new Float32Array(count);
    this.neighbourZ = new Float32Array(count);

    const geometry = createPinGeometry(layout.radius, this.headHeight);
    const neighbourAttr = new InstancedBufferAttribute(this.neighbourZ, 1);
    neighbourAttr.setUsage(DynamicDrawUsage);
    geometry.setAttribute('pinNeighbourZ', neighbourAttr);

    const pins = new InstancedMesh(geometry, this.pinMaterial, count);
    pins.customDepthMaterial = this.pinDepthMaterial;
    pins.instanceMatrix.setUsage(DynamicDrawUsage);
    pins.castShadow = true;
    pins.receiveShadow = true;
    // Pins move every frame; the board is always in view, so skip bounds bookkeeping.
    pins.frustumCulled = false;

    const m = pins.instanceMatrix.array as Float32Array;
    const pos = { x: 0, y: 0 };
    for (let row = 0, i = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++, i++) {
        pinPosition(layout, col, row, pos);
        const o = i * 16;
        m.fill(0, o, o + 16);
        m[o] = m[o + 5] = m[o + 10] = m[o + 15] = 1;
        m[o + 12] = pos.x;
        m[o + 13] = pos.y;
        m[o + 14] = this.restZ;
        this.posX[i] = pos.x;
        this.posY[i] = pos.y;
        this.neighbourZ[i] = this.restZ + this.headHeight;
      }
    }
    this.pins = pins;
    this.board = this.createBoard(layout);
    this.group.add(this.board, pins);
  }

  setFinish(name: FinishName): void {
    const finish = FINISHES[name];
    this.pinMaterial.color.set(finish.color);
    this.pinMaterial.metalness = finish.metalness;
    this.pinMaterial.roughness = finish.roughness;
  }

  /**
   * Eases every pin toward its target (value * depth) and writes the result
   * straight into the instance matrix buffer. `values` null holds the current
   * shape (freeze); `snap` jumps straight to the targets; `offsets` (ripples)
   * are added on top without disturbing the eased heights. Allocation-free.
   */
  update(values: Float32Array | null, dt: number, snap = false, offsets: Float32Array | null = null): void {
    const pins = this.pins;
    if (!pins) return;
    const { heights, shown } = this;
    const m = pins.instanceMatrix.array as Float32Array;
    const count = heights.length;
    const depth = Math.min(settings.depth, MAX_DEPTH);
    // Frame-rate independent version of "cover `smoothing` of the gap every 60 Hz frame".
    const k = snap ? 1 : 1 - Math.pow(1 - Math.min(Math.max(settings.smoothing, 0.001), 1), Math.min(dt, 0.1) * 60);
    const restZ = this.restZ;
    // Ripples may dip below rest, but never so far that a head sinks out of sight.
    const floor = -this.headHeight;

    for (let i = 0, o = 14; i < count; i++, o += 16) {
      let h = heights[i];
      if (values) {
        h += (values[i] * depth - h) * k;
        heights[i] = h;
      }
      if (offsets) {
        h += offsets[i];
        if (h < floor) h = floor;
      }
      shown[i] = h;
      m[o] = restZ + h;
    }
    pins.instanceMatrix.needsUpdate = true;

    this.updateNeighbourhood();
  }

  /**
   * Box-blurs the heights so the shader knows how far each surface sits below
   * its neighbours' heads: buried shafts and pits then see less of the studio
   * environment, the way a real pin forest occludes itself. The neighbourhood
   * grows with pin depth, since deeper pits hide more of the sky.
   */
  private updateNeighbourhood(): void {
    const { cols, rows, pitch } = this.layout;
    const { shown: heights, blurTmp: tmp, neighbourZ: out } = this;
    const R = Math.max(AO_MIN_RADIUS, Math.min(AO_MAX_RADIUS, Math.round((settings.depth / pitch) * AO_REACH)));
    const lastCol = cols - 1;
    const lastRow = rows - 1;

    // Running-sum box blur, edges clamped: O(pins) whatever the radius.
    for (let r = 0; r < rows; r++) {
      const row = r * cols;
      let sum = 0;
      for (let k = -R; k <= R; k++) sum += heights[row + (k < 0 ? 0 : k > lastCol ? lastCol : k)];
      tmp[row] = sum;
      for (let c = 1; c < cols; c++) {
        const add = c + R > lastCol ? lastCol : c + R;
        const sub = c - R - 1 < 0 ? 0 : c - R - 1;
        sum += heights[row + add] - heights[row + sub];
        tmp[row + c] = sum;
      }
    }

    const norm = 1 / ((2 * R + 1) * (2 * R + 1));
    const lift = this.restZ + this.headHeight * 0.6;
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let k = -R; k <= R; k++) sum += tmp[(k < 0 ? 0 : k > lastRow ? lastRow : k) * cols + c];
      out[c] = lift + sum * norm;
      for (let r = 1; r < rows; r++) {
        const add = r + R > lastRow ? lastRow : r + R;
        const sub = r - R - 1 < 0 ? 0 : r - R - 1;
        sum += tmp[add * cols + c] - tmp[sub * cols + c];
        out[r * cols + c] = lift + sum * norm;
      }
    }

    const attr = this.pins!.geometry.getAttribute('pinNeighbourZ') as InstancedBufferAttribute;
    attr.needsUpdate = true;
  }

  private injectOcclusion(shader: WebGLProgramParametersWithUniforms): void {
    shader.uniforms.pinAOStrength = this.aoUniform;
    shader.uniforms.pinHighlightLimit = pinHighlightLimit;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float pinNeighbourZ;\nvarying float vPinBuried;',
      )
      .replace(
        '#include <begin_vertex>',
        `${TRIM_SHAFT}\nvPinBuried = max( 0.0, pinNeighbourZ - ( transformed.z + instanceMatrix[ 3 ].z ) );`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vPinBuried;\nuniform float pinAOStrength;\nuniform float pinHighlightLimit;',
      )
      .replace(
        '#include <aomap_fragment>',
        [
          '#include <aomap_fragment>',
          'float pinAO = exp( -vPinBuried * pinAOStrength );',
          'reflectedLight.indirectDiffuse *= pinAO;',
          'reflectedLight.indirectSpecular *= pinAO;',
        ].join('\n'),
      )
      .replace(
        '#include <opaque_fragment>',
        [
          '#include <opaque_fragment>',
          'float pinPeak = max( max( gl_FragColor.r, gl_FragColor.g ), gl_FragColor.b );',
          'if ( pinPeak > pinHighlightLimit ) gl_FragColor.rgb *= pinHighlightLimit / pinPeak;',
        ].join('\n'),
      );
  }

  private createBoard(layout: PinLayout): Group {
    const board = new Group();

    this.plateMaterial.map?.dispose();
    this.plateMaterial.map = createPlateTexture(layout);
    this.plateMaterial.needsUpdate = true;

    const plate = new Mesh(new BoxGeometry(layout.plateWidth, layout.plateHeight, PLATE_THICKNESS), this.plateMaterial);
    plate.position.z = -PLATE_THICKNESS / 2;
    // The plate only receives: nothing sits below it, and not casting avoids acne at grazing angles.
    plate.receiveShadow = true;
    board.add(plate);

    const w = layout.plateWidth;
    const h = layout.plateHeight;
    const fw = FRAME_WIDTH;
    const depth = PLATE_THICKNESS + FRAME_HEIGHT;
    const radius = 0.06;
    const horizontal = new RoundedBoxGeometry(w + fw * 2, fw, depth, 3, radius);
    const vertical = new RoundedBoxGeometry(fw, h + 0.02, depth, 3, radius);
    const z = FRAME_HEIGHT - depth / 2;
    const bars: [BufferGeometry, number, number][] = [
      [horizontal, 0, (h + fw) / 2],
      [horizontal, 0, -(h + fw) / 2],
      [vertical, -(w + fw) / 2, 0],
      [vertical, (w + fw) / 2, 0],
    ];
    for (const [geometry, x, y] of bars) {
      const bar = new Mesh(geometry, this.frameMaterial);
      bar.position.set(x, y, z);
      bar.castShadow = true;
      bar.receiveShadow = true;
      board.add(bar);
    }
    return board;
  }

  /** Height of the middle of the relief above the plate, for click hit-testing. */
  get midZ(): number {
    return this.restZ + this.headHeight + Math.min(settings.depth, MAX_DEPTH) * 0.4;
  }

  /** True if world (x, y) lands on the pin field. */
  contains(x: number, y: number): boolean {
    return Math.abs(x) <= this.layout.fieldWidth / 2 && Math.abs(y) <= this.layout.fieldHeight / 2;
  }

  /** Half-extents of everything that can cast a shadow, for fitting the shadow camera. */
  get bounds(): { halfWidth: number; halfHeight: number; minZ: number; maxZ: number } {
    return {
      halfWidth: this.layout.plateWidth / 2 + FRAME_WIDTH,
      halfHeight: this.layout.plateHeight / 2 + FRAME_WIDTH,
      minZ: -PLATE_THICKNESS,
      maxZ: this.restZ + this.headHeight + Math.min(settings.depth, MAX_DEPTH),
    };
  }

  private dispose(): void {
    if (this.pins) {
      this.pins.geometry.dispose();
      this.pins.dispose();
      this.group.remove(this.pins);
      this.pins = null;
    }
    if (this.board) {
      const geometries = new Set<BufferGeometry>();
      this.board.traverse((o) => {
        if (o instanceof Mesh) geometries.add(o.geometry);
      });
      for (const g of geometries) g.dispose();
      this.group.remove(this.board);
      this.board = null;
    }
  }
}

/**
 * Vertex-shader snippet: pins only translate, so the shaft's bottom ring (the
 * vertices at the z = -1 marker) is pinned to just under the plate surface. Each
 * shaft is then exactly as long as its pin sticks out, which keeps fill and
 * shadow-map cost proportional to what's visible.
 */
const TRIM_SHAFT = /* glsl */ `#include <begin_vertex>
#ifdef USE_INSTANCING
if ( position.z < -0.5 ) transformed.z = min( ${SHAFT_END_Z.toFixed(3)} - instanceMatrix[ 3 ].z, -0.001 );
#endif`;

/**
 * Makes a depth material trim pin shafts too. Only instanced meshes are
 * affected, so it's safe on override materials that also draw the board.
 */
export function trimShaftsIn(material: Material): void {
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', TRIM_SHAFT);
  };
  material.customProgramCacheKey = () => 'pin-trimmed-depth';
}

/**
 * A pin: an open cylinder shaft (its bottom end is trimmed in the vertex
 * shader, see TRIM_SHAFT) capped by a spherical dome, 8 sides, 40 triangles.
 * The shaft top sits at z = 0 and the dome apex at z = headHeight.
 */
function createPinGeometry(radius: number, headHeight: number): BufferGeometry {
  const N = RADIAL_SEGMENTS;
  // Sphere through the rim (r, 0) and the apex (0, headHeight).
  const R = (radius * radius + headHeight * headHeight) / (2 * headHeight);
  const centreZ = headHeight - R;
  const thetaMax = Math.asin(Math.min(1, radius / R));
  const domeRings = [thetaMax, thetaMax * 0.5];

  const ringCount = 2 + domeRings.length;
  const vertexCount = ringCount * N + 1;
  const position = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);

  let v = 0;
  const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    position[v * 3] = x;
    position[v * 3 + 1] = y;
    position[v * 3 + 2] = z;
    normal[v * 3] = nx;
    normal[v * 3 + 1] = ny;
    normal[v * 3 + 2] = nz;
    v++;
  };

  // Rings 0 and 1: shaft bottom and top, with horizontal normals. The bottom's
  // z = -1 is only a marker; TRIM_SHAFT moves it to just under the plate.
  for (const z of [-1, 0]) {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      put(Math.cos(a) * radius, Math.sin(a) * radius, z, Math.cos(a), Math.sin(a), 0);
    }
  }
  // Dome rings: the rim duplicates the shaft top with dome normals, leaving a crisp machined edge.
  for (const theta of domeRings) {
    const rho = theta === thetaMax ? radius : R * Math.sin(theta);
    const z = theta === thetaMax ? 0 : centreZ + R * Math.cos(theta);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const s = Math.sin(theta);
      put(Math.cos(a) * rho, Math.sin(a) * rho, z, Math.cos(a) * s, Math.sin(a) * s, Math.cos(theta));
    }
  }
  const apex = v;
  put(0, 0, headHeight, 0, 0, 1);

  const index: number[] = [];
  const quadBand = (lower: number, upper: number) => {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      index.push(lower + i, lower + j, upper + j, lower + i, upper + j, upper + i);
    }
  };
  quadBand(0, N); // shaft
  quadBand(2 * N, 3 * N); // dome rim → mid ring
  for (let i = 0; i < N; i++) index.push(3 * N + i, 3 * N + ((i + 1) % N), apex); // dome cap fan

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.setIndex(index);
  return geometry;
}

/** Dark charcoal plate with a drilled hole under every pin, drawn once per layout. */
function createPlateTexture(layout: PinLayout): CanvasTexture {
  const pxPerUnit = Math.min(2048 / layout.plateWidth, 9 / layout.pitch);
  const width = Math.round(layout.plateWidth * pxPerUnit);
  const height = Math.round(layout.plateHeight * pxPerUnit);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1d1d20';
  ctx.fillRect(0, 0, width, height);

  // Faint mottling so the plate reads as a real surface in the raking light.
  const grain = ctx.createImageData(width, height);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = Math.random() * 14;
    grain.data[i] = grain.data[i + 1] = grain.data[i + 2] = 255;
    grain.data[i + 3] = n;
  }
  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = width;
  grainCanvas.height = height;
  grainCanvas.getContext('2d')!.putImageData(grain, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(grainCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  const holeRadius = layout.radius * 1.12 * pxPerUnit;
  const cx = width / 2;
  const cy = height / 2;
  const pos = { x: 0, y: 0 };
  ctx.fillStyle = '#050506';
  ctx.beginPath();
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      pinPosition(layout, col, row, pos);
      const x = cx + pos.x * pxPerUnit;
      const y = cy - pos.y * pxPerUnit;
      ctx.moveTo(x + holeRadius, y);
      ctx.arc(x, y, holeRadius, 0, Math.PI * 2);
    }
  }
  ctx.fill();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
