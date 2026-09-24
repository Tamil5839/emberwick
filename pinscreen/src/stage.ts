// Renderer, lens and orbit controls: the "photo studio" around the board.

import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  Mesh,
  MathUtils,
  OneFactor,
  OrthographicCamera,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SrcColorFactor,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  ZeroFactor,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { settings } from './settings';

/** A longish lens flattens perspective the way a product photographer would shoot. */
const FOV = 28;
/** Default view: a touch right of centre and a touch below, looking slightly across the pins. */
const VIEW_AZIMUTH = 8;
const VIEW_ELEVATION = -5;
/** Breathing room around the board when framed. */
const FRAME_MARGIN = 1.06;
const MAX_PIXEL_RATIO = 2;
/** How much the frame darkens toward its corners, like a lens in a dark studio. */
const VIGNETTE = 0.5;

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

  resize(width = window.innerWidth, height = window.innerHeight): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.vignette.material.uniforms.aspect.value = width / height;
  }

  /** Distance at which the whole board fits the current viewport. */
  private fitDistance(): number {
    const tanHalf = Math.tan(MathUtils.degToRad(FOV / 2));
    const fitHeight = (this.boardHeight / 2) / tanHalf;
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

  render(): void {
    this.renderer.toneMappingExposure = settings.exposure;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    // Multiply a soft vignette over the frame without clearing it.
    this.renderer.autoClear = false;
    this.renderer.render(this.vignette, this.screenCamera);
    this.renderer.autoClear = true;
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
