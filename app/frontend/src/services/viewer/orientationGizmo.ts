import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── OrientationGizmo ─────────────────────────────────────────────────
// Renders a world-axes indicator in the bottom-left corner of the canvas,
// mirroring the main camera's orientation without moving the main scene.

export class OrientationGizmo {
	private static readonly SIZE = 100; // CSS pixels

	private readonly _renderer: THREE.WebGLRenderer;
	private readonly _mainCamera: THREE.Camera;
	private readonly _orbitControls: OrbitControls;
	private readonly _mountEl: HTMLDivElement;

	private readonly _scene: THREE.Scene;
	private readonly _camera: THREE.OrthographicCamera;

	constructor(
		renderer: THREE.WebGLRenderer,
		mainCamera: THREE.Camera,
		orbitControls: OrbitControls,
		mountEl: HTMLDivElement,
	) {
		this._renderer = renderer;
		this._mainCamera = mainCamera;
		this._orbitControls = orbitControls;
		this._mountEl = mountEl;

		this._scene = new THREE.Scene();
		this._scene.add(new THREE.AmbientLight(0xffffff, 1));
		this._scene.add(new THREE.AxesHelper(0.75));

		// Orthographic camera: the axes fill a ±1 cube, so [-1,1] bounds fit perfectly.
		this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
		this._camera.position.set(0, 0, 2);
		this._camera.up.set(0, 1, 0);
		this._camera.lookAt(0, 0, 0);
	}

	/** Render the orientation gizmo into the bottom-left corner of the canvas. */
	render(): void {
		const sz = OrientationGizmo.SIZE;
		const { clientWidth, clientHeight } = this._mountEl;

		// Mirror the main camera's angular position around the orbit target.
		const dir = new THREE.Vector3()
			.subVectors(this._mainCamera.position, this._orbitControls.target)
			.normalize()
			.multiplyScalar(2);
		this._camera.position.copy(dir);
		this._camera.up.copy(this._mainCamera.up);
		this._camera.lookAt(new THREE.Vector3(0, 0, 0));

		this._renderer.setViewport(0, 0, sz, sz);
		this._renderer.setScissor(0, 0, sz, sz);
		this._renderer.setScissorTest(true);
		// Clear only depth so the axes draw on top of the main scene without clearing it.
		this._renderer.autoClear = false;
		this._renderer.clearDepth();
		this._renderer.render(this._scene, this._camera);
		this._renderer.autoClear = true;
		this._renderer.setScissorTest(false);
		this._renderer.setViewport(0, 0, clientWidth, clientHeight);
	}
}
