// Renderer, lens and orbit controls: the "photo studio" around the board.

import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  HalfFloatType,
  type IUniform,
  Mesh,
  type MeshDepthMaterial,
  MathUtils,
  OneFactor,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SrcColorFactor,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  ZeroFactor,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { pinHighlightLimit, trimShaftsIn } from './pinfield';
import { settings } from './settings';

/** A longish lens flattens perspective the way a product photographer would shoot. */
const FOV = 28;
/** Default view: a touch right of centre and a touch below, looking slightly across the pins. */
const VIEW_AZIMUTH = 8;
const VIEW_ELEVATION = -5;
/** Breathing room around the board when framed. */
const FRAME_MARGIN = 1.06;
/**
 * Views much narrower than the board (portrait, square) fill their height and
 * crop the sides, which frames the face; wider ones show the whole board.
 */
const COVER_BELOW_ASPECT = 1.2;
const MAX_PIXEL_RATIO = 2;
/** How much the frame darkens toward its corners, like a lens in a dark studio. */
const VIGNETTE = 0.5;
/** Largest bokeh blur, as a fraction of the frame, however far out of focus. */
const MAX_BLUR = 0.012;
/** Highlight ceiling (linear radiance) while depth of field is on; see pinHighlightLimit. */
const DOF_HIGHLIGHT_LIMIT = 3;
/** Bokeh aperture at full blur: fraction of the frame blurred per world unit off the focus plane. */
const APERTURE_AT_FULL_BLUR = 0.008;

export class Stage {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;

  private boardWidth = 16;
  private boardHeight = 12;
  private readonly target = new Vector3(0, 0, 0.25);
  private readonly vignette = createVignette();
  private readonly screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private dof: { composer: EffectComposer; bokeh: Record<string, IUniform> } | null = null;
  /** Output frame the view is letterboxed to (null fills the window). */
  private frame: { width: number; height: number } | null = null;
  /** Render at the frame's exact pixel size, for recording. */
  private exact = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    // three r182+ folded PCFSoftShadowMap into PCFShadowMap, which now does soft,
    // noise-rotated hardware PCF on its own (softness comes from shadow.radius).
    this.renderer.shadowMap.type = PCFShadowMap;
    // Shadows are re-rendered only when render() is told something moved, and never
    // twice a frame (the depth-of-field pass renders the scene a second time).
    this.renderer.shadowMap.autoUpdate = false;

    this.camera = new PerspectiveCamera(FOV, 1, 0.1, 400);
    this.camera.up.set(0, 1, 0);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.6;
    this.controls.screenSpacePanning = true;
    // Keep the camera in front of the board.
    this.controls.minAzimuthAngle = MathUtils.degToRad(-78);
    this.controls.maxAzimuthAngle = MathUtils.degToRad(78);
    this.controls.minPolarAngle = MathUtils.degToRad(14);
    this.controls.maxPolarAngle = MathUtils.degToRad(166);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Tell the stage what it's framing (called when the board is rebuilt). */
  setBoardSize(width: number, height: number): void {
    this.boardWidth = width;
    this.boardHeight = height;
    this.controls.minDistance = this.fitDistance() * 0.25;
    this.controls.maxDistance = this.fitDistance() * 3;
  }

  /**
   * Letterboxes the view to an output frame (null fills the window). With
   * `exact`, the drawing buffer is exactly frame.width × frame.height pixels,
   * whatever the window or screen density, which is what recording needs.
   */
  setFrame(frame: { width: number; height: number } | null, exact = false): void {
    this.frame = frame;
    this.exact = exact && frame !== null;
    this.canvas.classList.toggle('framed', frame !== null);
    this.resize();
  }

  resize(): void {
    const { frame } = this;
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    const aspect = frame ? frame.width / frame.height : viewWidth / viewHeight;
    const cssWidth = frame ? Math.min(viewWidth, viewHeight * aspect) : viewWidth;
    const cssHeight = frame ? cssWidth / aspect : viewHeight;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;

    const [bufferWidth, bufferHeight] = this.exact && frame ? [frame.width, frame.height] : [cssWidth, cssHeight];
    this.renderer.setPixelRatio(this.exact ? 1 : Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.setSize(bufferWidth, bufferHeight, false);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.vignette.material.uniforms.aspect.value = aspect;
    if (this.dof) {
      this.dof.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.dof.composer.setSize(bufferWidth, bufferHeight);
    }
  }

  /** Distance at which the board fills the current view (see COVER_BELOW_ASPECT). */
  private fitDistance(): number {
    const tanHalf = Math.tan(MathUtils.degToRad(FOV / 2));
    const fitHeight = (this.boardHeight / 2) / tanHalf;
    if (this.camera.aspect < COVER_BELOW_ASPECT) return fitHeight * FRAME_MARGIN;
    const fitWidth = (this.boardWidth / 2) / (tanHalf * this.camera.aspect);
    return Math.max(fitHeight, fitWidth) * FRAME_MARGIN;
  }

  resetView(): void {
    // One undamped update flushes any leftover orbit momentum before we jump.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;

    const distance = this.fitDistance();
    const az = MathUtils.degToRad(VIEW_AZIMUTH);
    const el = MathUtils.degToRad(VIEW_ELEVATION);
    this.controls.target.copy(this.target);
    this.camera.position.set(
      this.target.x + Math.sin(az) * Math.cos(el) * distance,
      this.target.y + Math.sin(el) * distance,
      this.target.z + Math.cos(az) * Math.cos(el) * distance,
    );
    this.camera.lookAt(this.target);
    this.controls.update();
  }

  /** Draws a frame; pass true when pins or the light moved so the shadows follow. */
  render(shadowsChanged: boolean): void {
    this.renderer.toneMappingExposure = settings.exposure;
    this.renderer.shadowMap.needsUpdate = shadowsChanged;
    this.controls.update();

    pinHighlightLimit.value = settings.depthOfField ? DOF_HIGHLIGHT_LIMIT : 1e4;
    if (settings.depthOfField) {
      const { composer, bokeh } = this.depthOfField();
      // Auto-focus on the orbit target, so the board stays sharp wherever you swing.
      bokeh.focus.value = this.camera.position.distanceTo(this.controls.target);
      bokeh.aperture.value = settings.blur * APERTURE_AT_FULL_BLUR;
      composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // Multiply a soft vignette over the frame without clearing it.
    this.renderer.autoClear = false;
    this.renderer.render(this.vignette, this.screenCamera);
    this.renderer.autoClear = true;
  }

  /** Built on first use: scene → bokeh → tone mapping and sRGB, multisampled like the direct path. */
  private depthOfField(): { composer: EffectComposer; bokeh: Record<string, IUniform> } {
    if (this.dof) return this.dof;
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(this.renderer, target);
    const bokeh = new BokehPass(this.scene, this.camera, { focus: 40, aperture: 0, maxblur: MAX_BLUR });
    // Its depth prepass uses an override material, so teach it to trim pin shafts too.
    trimShaftsIn((bokeh as unknown as { _materialDepth: MeshDepthMaterial })._materialDepth);
    composer.addPass(new RenderPass(this.scene, this.camera));
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    this.dof = { composer, bokeh: bokeh.uniforms as Record<string, IUniform> };
    const size = this.renderer.getSize(new Vector2());
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.setSize(size.x, size.y);
    return this.dof;
  }
}

/** One full-screen triangle that multiplies the frame by a soft radial falloff. */
function createVignette(): Mesh<BufferGeometry, ShaderMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const material = new ShaderMaterial({
    uniforms: { aspect: { value: 1 }, strength: { value: VIGNETTE } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4( position.xy, 0.0, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform float aspect;
      uniform float strength;
      varying vec2 vUv;
      void main() {
        vec2 p = ( vUv - 0.5 ) * vec2( aspect, 1.0 ) / sqrt( aspect * aspect + 1.0 ) * 2.0;
        float falloff = smoothstep( 0.35, 1.05, length( p ) );
        gl_FragColor = vec4( vec3( 1.0 - strength * falloff ), 1.0 );
      }`,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: CustomBlending,
    blendSrc: ZeroFactor,
    blendDst: SrcColorFactor,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}
