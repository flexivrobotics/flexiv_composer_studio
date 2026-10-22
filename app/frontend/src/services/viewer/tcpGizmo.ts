import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { TcpMode } from '../../types';

type LinkWorldPoseGetter = (
	systemName: string,
	linkName: string,
) => { position: [number, number, number]; quaternion: [number, number, number, number] } | undefined;

// ── TcpGizmo ─────────────────────────────────────────────────────────
// Manages the TransformControls gizmo used for TCP drag in SceneViewer.
// Owns its own ghost Object3D, gizmo helper, context-menu callback, and
// orbit-lock logic so SceneViewer doesn't have to track any of that state.

export class TcpGizmo {
	private readonly _scene: THREE.Scene;
	private readonly _camera: THREE.Camera;
	private readonly _renderer: THREE.WebGLRenderer;
	private readonly _orbitControls: OrbitControls;
	private readonly _getLinkWorldPose: LinkWorldPoseGetter;

	private _transformControls: TransformControls | null = null;
	private _ghost: THREE.Object3D | null = null;
	private _helper: THREE.Object3D | null = null;
	private _boundContextMenu: ((e: MouseEvent) => void) | null = null;
	private _onContextMenuCb: ((x: number, y: number, mode: TcpMode) => void) | null = null;
	private _mode: TcpMode = 'translate';

	constructor(
		scene: THREE.Scene,
		camera: THREE.Camera,
		renderer: THREE.WebGLRenderer,
		orbitControls: OrbitControls,
		getLinkWorldPose: LinkWorldPoseGetter,
	) {
		this._scene = scene;
		this._camera = camera;
		this._renderer = renderer;
		this._orbitControls = orbitControls;
		this._getLinkWorldPose = getLinkWorldPose;
	}

	/**
	 * Attach a TransformControls gizmo at the current TCP world pose.
	 * Calls `onChange` on every drag step with the ghost's new pose.
	 * Calls `onContextMenu` on right-click with cursor position and current mode.
	 */
	attach(
		systemName: string,
		tcpLinkName: string,
		onChange: (
			pos: { x: number; y: number; z: number },
			quat: { x: number; y: number; z: number; w: number },
		) => void,
		onContextMenu?: (x: number, y: number, currentMode: TcpMode) => void,
	): void {
		this.detach();
		this._onContextMenuCb = onContextMenu ?? null;

		const pose = this._getLinkWorldPose(systemName, tcpLinkName);
		if (!pose || pose.position.some(v => !isFinite(v))) return;

		const ghost = new THREE.Object3D();
		ghost.position.fromArray(pose.position);
		ghost.quaternion.set(pose.quaternion[0], pose.quaternion[1], pose.quaternion[2], pose.quaternion[3]);
		this._scene.add(ghost);
		this._ghost = ghost;

		const tc = new TransformControls(this._camera, this._renderer.domElement);
		tc.attach(ghost);
		const helper = tc.getHelper();
		this._scene.add(helper);
		this._helper = helper;
		this._transformControls = tc;

		tc.addEventListener('dragging-changed', (event) => {
			this._orbitControls.enabled = !(event as any).value;
		});

		tc.addEventListener('objectChange', () => {
			const { x: px, y: py, z: pz } = ghost.position;
			if (!isFinite(px) || !isFinite(py) || !isFinite(pz)) return;
			onChange(
				{ x: px, y: py, z: pz },
				{ x: ghost.quaternion.x, y: ghost.quaternion.y, z: ghost.quaternion.z, w: ghost.quaternion.w },
			);
		});

		this._boundContextMenu = (e: MouseEvent) => {
			e.preventDefault();
			this._onContextMenuCb?.(e.clientX, e.clientY, this._mode);
		};
		this._renderer.domElement.addEventListener('contextmenu', this._boundContextMenu);
	}

	/** Switch the active TransformControls mode. Rotation-TCP uses local space. */
	setMode(mode: TcpMode): void {
		if (!this._transformControls) return;
		this._mode = mode;
		if (mode === 'translate') {
			this._transformControls.mode = 'translate';
			this._transformControls.space = 'world';
		} else if (mode === 'rotate-world') {
			this._transformControls.mode = 'rotate';
			this._transformControls.space = 'world';
		} else {
			this._transformControls.mode = 'rotate';
			this._transformControls.space = 'local';
		}
	}

	/** Remove the gizmo and ghost from the scene and reset all state. */
	detach(): void {
		if (this._boundContextMenu) {
			this._renderer.domElement.removeEventListener('contextmenu', this._boundContextMenu);
			this._boundContextMenu = null;
		}
		this._onContextMenuCb = null;
		this._mode = 'translate';

		if (this._transformControls) {
			this._transformControls.detach();
			this._transformControls.dispose();
			this._transformControls = null;
		}
		if (this._helper) {
			this._scene.remove(this._helper);
			this._helper = null;
		}
		if (this._ghost) {
			this._scene.remove(this._ghost);
			this._ghost = null;
		}
		this._orbitControls.enabled = true;
	}
}
