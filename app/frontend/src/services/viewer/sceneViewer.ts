import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { computeLinkTransforms, type UrdfJointData } from '../sceneLoader';
import { MarkerSystem } from './markerSystem';
import { TcpGizmo } from './tcpGizmo';
import { OrientationGizmo } from './orientationGizmo';
import type { ObjectClickCallback, TcpMode } from '../../types';

// ── SceneViewer Class ────────────────────────────────────────────────

export class SceneViewer {
	// ── State ──
	private _mountEl: HTMLDivElement;
	private _animationFrameId = 0;
	private _boundAnimate: (() => void) | null = null;
	private _camera: THREE.PerspectiveCamera | null = null;
	private _controls: OrbitControls | null = null;
	private _renderer: THREE.WebGLRenderer | null = null;
	private _resizeObserver: ResizeObserver | null = null;
	private _scene: THREE.Scene | null = null;
	private _raycaster = new THREE.Raycaster();

	/** Track named mesh groups added via addGroup() so they can be removed by name. */
	private _namedObjects = new Map<string, THREE.Group>();
	/** Maps area group names to their parent scene-object name. */
	private _areaParentMap = new Map<string, string>();
	/** Maps a named group to the system/link it's attached to, when parented to a robot link instead of the scene root. */
	private _groupAttachments = new Map<string, { systemName: string; linkName: string }>();
	/** Name of the object currently isolated by focusObject(), or null. */
	private _focusedObjectName: string | null = null;
	/** Names of the currently highlighted objects (possibly more than one, e.g.
	 * an area and its toolpath both highlighted during workflow execution). */
	private _highlightedObjectNames = new Set<string>();
	/** Joint data for each named group that represents a URDF kinematic chain. */
	private _kinematicData = new Map<string, UrdfJointData[]>();
	/** Last-applied joint angles per system, keyed by system name. */
	private _currentJointAngles = new Map<string, Record<string, number>>();
	/** Live TCP-pose axes frame per connected system, keyed by system name. */
	private _tcpPoseFrames = new Map<string, THREE.AxesHelper>();
	/** Optional callback for object double-clicks. */
	private _onObjectDblClick: ObjectClickCallback | null = null;
	/** Bound dblclick handler reference (for cleanup). */
	private _boundDblClick: ((e: MouseEvent) => void) | null = null;

	/** Extracted marker / preview visualisation system. */
	private _markers: MarkerSystem | null = null;

	/** TransformControls gizmo for TCP dragging. */
	private _tcpGizmo: TcpGizmo | null = null;

	/** Orientation gizmo rendered in the bottom-left corner. */
	private _orientationGizmo: OrientationGizmo | null = null;

	constructor(mountEl: HTMLDivElement) {
		this._mountEl = mountEl;
	}

	// ── Lifecycle ────────────────────────────────────────────────────

	/** Initialise the scene, camera, renderer, controls, and environment. */
	init(): void {
		const el = this._mountEl;
		const { clientWidth, clientHeight } = el;

		// Scene
		this._scene = new THREE.Scene();
		this._scene.background = new THREE.Color(0xf7fafd);

		// Camera
		this._camera = new THREE.PerspectiveCamera(45, clientWidth / clientHeight, 0.1, 100);
		this._camera.position.set(5, 5, 5);
		this._camera.up.set(0, 0, 1);
		this._camera.lookAt(0, 0, 0);

		// Renderer
		this._renderer = new THREE.WebGLRenderer({ antialias: true });
		this._renderer.setPixelRatio(window.devicePixelRatio);
		this._renderer.setSize(clientWidth, clientHeight, false);
		this._renderer.shadowMap.enabled = true;
		this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this._renderer.toneMappingExposure = 1.0;
		el.appendChild(this._renderer.domElement);

		// Controls
		this._controls = new OrbitControls(this._camera, this._renderer.domElement);
		this._controls.enableDamping = true;
		this._controls.dampingFactor = 0.08;
		this._controls.target.set(0, 0, 0);
		this._controls.minDistance = 1;
		this._controls.maxDistance = 30;

		// Setup environment
		this._addLights(this._scene);
		this._addGrid(this._scene);
		this._addGround(this._scene);
		this._addAxes(this._scene);

		// Initialise marker system
		this._markers = new MarkerSystem(this._scene, this._renderer);

		// Initialise TCP gizmo sub-system
		this._tcpGizmo = new TcpGizmo(
			this._scene,
			this._camera,
			this._renderer,
			this._controls,
			(sysName, linkName) => this.getLinkWorldPose(sysName, linkName),
		);

		this._orientationGizmo = new OrientationGizmo(this._renderer, this._camera, this._controls, el);

		// Resize observer
		this._resizeObserver = new ResizeObserver(() => this._resize());
		this._resizeObserver.observe(el);

		// Interaction
		this._boundDblClick = (e: MouseEvent) => this._onDblClick(e);
		this._renderer.domElement.addEventListener('dblclick', this._boundDblClick);

		this._boundAnimate = this._animate.bind(this);
		this._animate();
	}

	/** Dispose all GPU resources, stop loops and disconnect observers. */
	dispose(): void {
		if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
		this._boundAnimate = null;
		this._resizeObserver?.disconnect();
		this._tcpGizmo?.detach();
		this._tcpGizmo = null;

		if (this._renderer) {
			this._renderer.domElement.removeEventListener('dblclick', this._boundDblClick!);
			this._renderer.dispose();
			this._renderer.domElement.parentElement?.removeChild(this._renderer.domElement);
		}

		// Dispose and remove all named groups
		for (const name of Array.from(this._namedObjects.keys())) {
			this.removeGroup(name);
		}
		this._markers?.dispose();
		this._markers = null;

		this._scene = null;
		this._camera = null;
		this._controls = null;
		this._renderer = null;
		this._resizeObserver = null;
		this._kinematicData.clear();
		this._currentJointAngles.clear();
		this._orientationGizmo = null;
	}

	// ── Scene Management ─────────────────────────────────────────────

	/**
	 * Add a named group (e.g. robot system or scene object) to the scene.
	 *
	 * Pass `parentSystemName`/`parentLinkName` to instead add the group as a
	 * child of a link already in the scene (e.g. an in-hand camera parented
	 * to its mounting flange) so it inherits that link's transform on every
	 * subsequent `updateJointAngles()` call. Falls back to the scene root
	 * with a warning if that link isn't currently loaded.
	 */
	addGroup(name: string, group: THREE.Group, parentSystemName?: string, parentLinkName?: string): void {
		if (!this._scene) return;
		this.removeGroup(name); // Ensure no duplicate name exists
		group.name = name;

		let parent: THREE.Object3D = this._scene;
		if (parentSystemName && parentLinkName) {
			const link = this.getLinkObject3D(parentSystemName, parentLinkName);
			if (link) {
				parent = link;
				this._groupAttachments.set(name, { systemName: parentSystemName, linkName: parentLinkName });
			} else {
				console.warn(
					`addGroup("${name}"): parent link "${parentLinkName}" on system "${parentSystemName}" isn't loaded in the viewer; adding at scene root instead.`,
				);
			}
		}

		parent.add(group);
		this._namedObjects.set(name, group);

		// Scan for kinematic meta-data
		const joints = group.userData?.['joints'] as UrdfJointData[] | undefined;
		if (joints && joints.length > 0) {
			this._kinematicData.set(name, joints);
		}
	}

	/** Remove a named group and release its resources. */
	removeGroup(name: string): boolean {
		if (!this._scene) return false;
		const group = this._namedObjects.get(name);
		if (!group) return false;

		this._highlightedObjectNames.delete(name);
		group.parent?.remove(group);
		this._namedObjects.delete(name);
		this._areaParentMap.delete(name);
		this._groupAttachments.delete(name);
		this._kinematicData.delete(name);
		this._currentJointAngles.delete(name);
		this._tcpPoseFrames.delete(name);
		this._disposeGroupResources(group);
		this._markers?.clearMarkers(name);
		return true;
	}

	/**
	 * Set a named group's world pose (position + orientation). Used to apply a
	 * live "object moved" scene event to a top-level scene object group.
	 * @returns true if the group was found, false otherwise.
	 */
	setGroupPose(
		name: string,
		position: [number, number, number],
		quaternion: [number, number, number, number],
	): boolean {
		const group = this._namedObjects.get(name);
		if (!group) return false;
		group.position.fromArray(position);
		group.quaternion.fromArray(quaternion);
		return true;
	}

	/** Register an area group as a child of a parent scene object. */
	setAreaParent(areaName: string, parentName: string): void {
		this._areaParentMap.set(areaName, parentName);
	}

	/**
	 * Get a named group's current world-space pose. Used to place an area's
	 * extracted mesh at its parent's live transform, since the server no
	 * longer registers/returns a pose for it (the mesh's vertices are
	 * already in the parent's own local frame, i.e. the offset is identity).
	 */
	getGroupWorldPose(
		name: string,
	): { position: [number, number, number]; quaternion: [number, number, number, number] } | undefined {
		const group = this._namedObjects.get(name);
		if (!group) return undefined;
		const position = new THREE.Vector3();
		const quaternion = new THREE.Quaternion();
		group.getWorldPosition(position);
		group.getWorldQuaternion(quaternion);
		return {
			position: [position.x, position.y, position.z],
			quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
		};
	}

	/** Internal name used for the bounding-box preview wireframe. */
	private static readonly _BBOX_PREVIEW_NAME = '__bbox_preview__';

	/**
	 * Show or update a bounding-box wireframe preview in the scene.
	 *
	 * @param center      { x, y, z } – center of the box, relative to `parentLinkName` if given, else world-space.
	 * @param orientation { x, y, z, w } – quaternion orientation, relative to the same frame as `center`.
	 * @param extents     { x, y, z } – full side lengths along each axis.
	 * @param parentSystemName/parentLinkName – attach the preview to a robot link instead of the scene root, e.g. while previewing a flange-parented object.
	 */
	showBboxPreview(
		center: { x: number; y: number; z: number },
		orientation: { x: number; y: number; z: number; w: number },
		extents: { x: number; y: number; z: number },
		parentSystemName?: string,
		parentLinkName?: string,
	): void {
		if (!this._scene || !this._renderer) return;

		const boxGeo = new THREE.BoxGeometry(extents.x, extents.y, extents.z);
		const edges = new THREE.EdgesGeometry(boxGeo);

		const size = new THREE.Vector2();
		this._renderer.getSize(size);

		const segGeo = new LineSegmentsGeometry();
		segGeo.setPositions(Array.from(edges.getAttribute('position').array));

		const mat = new LineMaterial({
			color: 0x3399ff,
			linewidth: 3,
			resolution: size,
		});

		const line = new LineSegments2(segGeo, mat);
		line.position.set(center.x, center.y, center.z);
		line.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);

		const group = new THREE.Group();
		group.name = SceneViewer._BBOX_PREVIEW_NAME;
		group.add(line);

		this.addGroup(SceneViewer._BBOX_PREVIEW_NAME, group, parentSystemName, parentLinkName);
	}

	/** Remove the bounding-box wireframe preview from the scene. */
	hideBboxPreview(): void {
		this.removeGroup(SceneViewer._BBOX_PREVIEW_NAME);
	}

	/**
	 * Display a generated toolpath as a named group in the scene.
	 *
	 * Creates coordinate frames at each Cartesian waypoint pose and links them
	 * with a connecting line.  The whole visual is added as a named group via
	 * addGroup() so it integrates with the scene-tree lifecycle (focus, hide,
	 * remove, etc.).
	 *
	 * @param name         Unique name for the path group (will replace any existing group with the same name).
	 * @param waypoints    Array of objects each containing a `pose` with `position` and `rotation`.
	 * @param renderOnTop  When true (default), the connecting line ignores depth testing and
	 *                     draws above everything else — needed when the path sits flush on a
	 *                     surface (e.g. a raster/area toolpath preview) to avoid z-fighting.
	 *                     Pass false for paths in free space (e.g. a saved trajectory near a
	 *                     robot) so the line is properly occluded by other geometry in front of it.
	 * @param showFrames   When true (default), draws a small coordinate-frame axes helper at each
	 *                     waypoint pose alongside the connecting line. Pass false to show only the
	 *                     line (e.g. an executed toolpath, where per-pose frames are just clutter).
	 */
	addPath(
		name: string,
		waypoints: Array<{ pose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } }>,
		renderOnTop: boolean = true,
		showFrames: boolean = true,
	): void {
		if (!this._scene || waypoints.length < 2) return;
		if (!this._renderer) return;

		const group = new THREE.Group();
		group.name = name;

		// ---- Frames at each waypoint ----
		const frameSize = 0.05;
		const axesHelpers: THREE.AxesHelper[] = [];

		if (showFrames) {
			for (const wp of waypoints) {
				const { position, rotation } = wp.pose;
				const axes = new THREE.AxesHelper(frameSize);
				axes.position.set(position.x, position.y, position.z);
				axes.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
				group.add(axes);
				axesHelpers.push(axes);
			}
		}

		// Store originals so previewPathRotationZ can recompute from base pose.
		group.userData['waypoints'] = waypoints;
		group.userData['axes'] = axesHelpers;

		// ---- Connecting line ----
		const size = new THREE.Vector2();
		this._renderer.getSize(size);

		const positions: number[] = [];
		for (const wp of waypoints) {
			positions.push(wp.pose.position.x, wp.pose.position.y, wp.pose.position.z);
		}

		const geometry = new LineGeometry();
		geometry.setPositions(positions);

		const material = new LineMaterial({
			color: 0x44aaff,
			linewidth: 5,
			resolution: size,
			depthTest: !renderOnTop,
			depthWrite: !renderOnTop,
			// Pull the line slightly toward the camera so it wins depth-buffer
			// ties against a coplanar surface (e.g. the area it was rastered
			// over) without disabling depth testing outright — real occluders
			// in front of it (e.g. the robot) still cover it correctly. No-op
			// when renderOnTop already disables depth testing above.
			polygonOffset: true,
			polygonOffsetFactor: -2,
			polygonOffsetUnits: -2,
		});

		const line = new Line2(geometry, material);
		line.computeLineDistances();
		group.add(line);

		// Render path on top of mesh surfaces (e.g. highlighted area with polygon offset)
		// only when requested — otherwise let normal depth testing occlude it correctly.
		group.renderOrder = renderOnTop ? 1 : 0;

		// Register as a named group (replaces any existing group with the same name)
		this.addGroup(name, group);

		// Hide path by default — only shown when the user clicks the item
		// in the scene tree.  The hiddenByDefault flag tells resetView()
		// to keep this group hidden until it has been explicitly revealed.
		group.visible = false;
		group.userData['hiddenByDefault'] = true;
	}

	/**
	 * Preview rotating all poses of a path about each pose's own local Z-axis.
	 * Applies a delta rotation on top of the original quaternions stored at
	 * addPath() time. Does not modify the underlying data on the server.
	 */
	previewPathRotationZ(name: string, angleDeg: number): void {
		const group = this._namedObjects.get(name);
		if (!group) return;

		type WP = { pose: { rotation: { x: number; y: number; z: number; w: number } } };
		const waypoints = group.userData['waypoints'] as WP[] | undefined;
		const axes = group.userData['axes'] as THREE.AxesHelper[] | undefined;
		if (!waypoints || !axes) return;

		const halfRad = (angleDeg * Math.PI) / 360; // angleDeg/2 in radians
		const sinH = Math.sin(halfRad);
		const cosH = Math.cos(halfRad);

		for (let i = 0; i < axes.length; i++) {
			const { x: ox, y: oy, z: oz, w: ow } = waypoints[i].pose.rotation;
			// Post-multiply: q_orig * q_delta  (local-frame rotation about Z)
			// q_delta = (0, 0, sinH, cosH)
			axes[i].quaternion.set(
				ox * cosH + oy * sinH,
				-ox * sinH + oy * cosH,
				ow * sinH + oz * cosH,
				ow * cosH - oz * sinH,
			);
		}
	}

	/**
	 * Return the waypoints for a path with each rotation post-multiplied by a
	 * local-Z delta of `angleDeg` degrees, ready to send to the server.
	 * Returns null if the path group is not found.
	 */
	getPathRotatedWaypoints(
		name: string,
		angleDeg: number,
	): Array<{ position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } }> | null {
		const group = this._namedObjects.get(name);
		if (!group) return null;

		type WP = { pose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } };
		const waypoints = group.userData['waypoints'] as WP[] | undefined;
		if (!waypoints) return null;

		const halfRad = (angleDeg * Math.PI) / 360;
		const sinH = Math.sin(halfRad);
		const cosH = Math.cos(halfRad);

		return waypoints.map(wp => {
			const { x: ox, y: oy, z: oz, w: ow } = wp.pose.rotation;
			const { x: px, y: py, z: pz } = wp.pose.position;
			return {
				position: { x: px, y: py, z: pz },
				rotation: {
					x: ox * cosH + oy * sinH,
					y: -ox * sinH + oy * cosH,
					z: ow * sinH + oz * cosH,
					w: ow * cosH - oz * sinH,
				},
			};
		});
	}

	/**
	 * Permanently commit a local-Z rotation to the stored base waypoints so that
	 * future preview calls are relative to the newly applied orientation.
	 * Should be called after a successful server write.
	 */
	commitPathRotationZ(name: string, angleDeg: number): void {
		const group = this._namedObjects.get(name);
		if (!group) return;

		type WP = { pose: { rotation: { x: number; y: number; z: number; w: number } } };
		const waypoints = group.userData['waypoints'] as WP[] | undefined;
		const axes = group.userData['axes'] as THREE.AxesHelper[] | undefined;
		if (!waypoints || !axes) return;

		const halfRad = (angleDeg * Math.PI) / 360;
		const sinH = Math.sin(halfRad);
		const cosH = Math.cos(halfRad);

		for (let i = 0; i < waypoints.length; i++) {
			const { x: ox, y: oy, z: oz, w: ow } = waypoints[i].pose.rotation;
			const nx = ox * cosH + oy * sinH;
			const ny = -ox * sinH + oy * cosH;
			const nz = ow * sinH + oz * cosH;
			const nw = ow * cosH - oz * sinH;
			waypoints[i].pose.rotation.x = nx;
			waypoints[i].pose.rotation.y = ny;
			waypoints[i].pose.rotation.z = nz;
			waypoints[i].pose.rotation.w = nw;
			axes[i].quaternion.set(nx, ny, nz, nw);
		}
	}

	// ── Update & Query ───────────────────────────────────────────────

	/** Update joint angles for a kinematic chain and recompute FK locally. */
	updateJointAngles(name: string, jointAngles: Record<string, number>): boolean {
		const group = this._namedObjects.get(name);
		const joints = this._kinematicData.get(name);
		if (!group || !joints) return false;

		this._currentJointAngles.set(name, { ...jointAngles });
		const transforms = computeLinkTransforms(joints, jointAngles);

		for (const child of group.children) {
			const tf = transforms.get(child.name);
			if (tf) {
				child.position.fromArray(tf.position);
				child.quaternion.fromArray(tf.quaternion);
			}
		}
		return true;
	}

	/** Get the raw Object3D for a child link within a named system, or undefined if not loaded. */
	getLinkObject3D(systemName: string, linkName: string): THREE.Object3D | undefined {
		return this._namedObjects.get(systemName)?.getObjectByName(linkName) ?? undefined;
	}

	/** Get the system/link a named group is attached to, if it was parented via addGroup's parentSystemName/parentLinkName instead of the scene root. */
	getGroupAttachment(name: string): { systemName: string; linkName: string } | undefined {
		return this._groupAttachments.get(name);
	}

	/** Get the world pose of a child link within a named system. */
	getLinkWorldPose(systemName: string, linkName: string) {
		const group = this._namedObjects.get(systemName);
		const link = group?.getObjectByName(linkName);
		if (!link) return undefined;

		link.updateWorldMatrix(true, false);
		const pos = new THREE.Vector3();
		const quat = new THREE.Quaternion();
		link.matrixWorld.decompose(pos, quat, new THREE.Vector3());
		return {
			position: pos.toArray() as [number, number, number],
			quaternion: quat.toArray() as [number, number, number, number]
		};
	}

	/**
	 * Show/update a live TCP-pose axes frame for a connected system, driven by
	 * polled hardware feedback rather than the viewer's own FK. Position and
	 * quaternion are w.r.t. the robot's own base frame (RDK's convention),
	 * which is not the same as the system group's root — the group's root is
	 * the URDF's "world" link, and the mount joint's offset from there to the
	 * robot base is baked into the kinematic chain (see
	 * `_getMountBaseLinkName`/`getLinkBasePose`). The incoming pose is
	 * composed with that mount transform before being applied, so the frame
	 * is added as a child of the system's group but lands at the robot's
	 * actual base rather than the group's identity origin.
	 */
	setTcpPoseFrame(
		systemName: string,
		position: [number, number, number],
		quaternion: [number, number, number, number],
	): boolean {
		const group = this._namedObjects.get(systemName);
		if (!group) return false;

		let axes = this._tcpPoseFrames.get(systemName);
		if (!axes) {
			axes = new THREE.AxesHelper(0.08);
			axes.name = 'tcp-pose-live';
			group.add(axes);
			this._tcpPoseFrames.set(systemName, axes);
		}

		const joints = this._kinematicData.get(systemName);
		const baseLinkName = joints ? this._getMountBaseLinkName(joints) : undefined;
		const baseTf = baseLinkName
			? computeLinkTransforms(joints!, this._currentJointAngles.get(systemName)).get(baseLinkName)
			: undefined;

		if (baseTf) {
			const baseMatrix = new THREE.Matrix4().compose(
				new THREE.Vector3(...baseTf.position),
				new THREE.Quaternion(...baseTf.quaternion),
				new THREE.Vector3(1, 1, 1),
			);
			const poseMatrix = new THREE.Matrix4().compose(
				new THREE.Vector3(...position),
				new THREE.Quaternion(...quaternion),
				new THREE.Vector3(1, 1, 1),
			);
			const composed = baseMatrix.multiply(poseMatrix);
			composed.decompose(axes.position, axes.quaternion, new THREE.Vector3());
		} else {
			axes.position.fromArray(position);
			axes.quaternion.fromArray(quaternion);
		}
		return true;
	}

	/** Remove the live TCP-pose axes frame for a system, if present. */
	removeTcpPoseFrame(systemName: string): void {
		const axes = this._tcpPoseFrames.get(systemName);
		if (!axes) return;
		axes.parent?.remove(axes);
		this._tcpPoseFrames.delete(systemName);
	}

	/**
	 * Resolve the name of the link immediately after the system's mount
	 * joint — the system's true base frame (as opposed to the system
	 * group's own root, which is always identity: the mount offset is
	 * applied by this joint inside the URDF, not by the group's own
	 * transform). The mount joint is identified generically as whichever
	 * joint is attached directly to the URDF's "world" link — its literal
	 * name varies across generator versions (`arm_mount.joint`,
	 * `system_mount.joint`, …), but it's always the one fixed joint whose
	 * parent is "world".
	 */
	private _getMountBaseLinkName(joints: UrdfJointData[]): string | undefined {
		return joints.find(j => j.parent === 'world')?.child;
	}

	/**
	 * Get a link's pose relative to the system's base frame — i.e. the
	 * inverse of the system mount transform composed with the link's pose:
	 * `inv(system_mount_transform) * link_pose`, where the mount transform
	 * is the pose of the link right after the system's world-mount joint
	 * (see `_getMountBaseLinkName`).
	 *
	 * Computed from the URDF's joint graph directly (`computeLinkTransforms`)
	 * rather than via the THREE scene graph: the mount joint's child link
	 * commonly has no visual/collision geometry, so it may not exist as a
	 * named object in the scene (links without geometry are pruned when the
	 * URDF is loaded — see `loadURDFFromUrl`). Falls back to the kinematic
	 * root ("world") if no mount joint is found.
	 */
	getLinkBasePose(systemName: string, linkName: string) {
		const joints = this._kinematicData.get(systemName);
		if (!joints) return undefined;

		const jointAngles = this._currentJointAngles.get(systemName);
		const transforms = computeLinkTransforms(joints, jointAngles);

		const targetTf = transforms.get(linkName);
		if (!targetTf) return undefined;

		const baseLinkName = this._getMountBaseLinkName(joints);
		const baseTf = (baseLinkName ? transforms.get(baseLinkName) : undefined) ?? {
			position: [0, 0, 0] as [number, number, number],
			quaternion: [0, 0, 0, 1] as [number, number, number, number],
		};

		const baseMatrix = new THREE.Matrix4().compose(
			new THREE.Vector3(...baseTf.position),
			new THREE.Quaternion(...baseTf.quaternion),
			new THREE.Vector3(1, 1, 1),
		);
		const targetMatrix = new THREE.Matrix4().compose(
			new THREE.Vector3(...targetTf.position),
			new THREE.Quaternion(...targetTf.quaternion),
			new THREE.Vector3(1, 1, 1),
		);

		const relative = baseMatrix.clone().invert().multiply(targetMatrix);
		const pos = new THREE.Vector3();
		const quat = new THREE.Quaternion();
		relative.decompose(pos, quat, new THREE.Vector3());
		return {
			position: pos.toArray() as [number, number, number],
			quaternion: quat.toArray() as [number, number, number, number]
		};
	}

	/** Return the names of active joints for a named system. */
	getJointNames(name: string): string[] | undefined {
		return this._kinematicData.get(name)?.filter(j => j.type !== 'fixed').map(j => j.name);
	}

	/**
	 * Return joint limits for a named system, in radians or (prismatic) metres.
	 * `prismatic[i]` is true for a linear joint, such as a rail.
	 */
	getJointLimits(name: string): { lower: number[]; upper: number[]; prismatic: boolean[] } | undefined {
		const joints = this._kinematicData.get(name)?.filter(j => j.type !== 'fixed');
		if (!joints || joints.length === 0) return undefined;
		const lower: number[] = [];
		const upper: number[] = [];
		const prismatic: boolean[] = [];
		for (const j of joints) {
			lower.push(j.lower ?? -3.14);
			upper.push(j.upper ?? 3.14);
			prismatic.push(j.type === 'prismatic');
		}
		return { lower, upper, prismatic };
	}

	/** Return the names of a system's prismatic (linear) joints. */
	getPrismaticJointNames(name: string): string[] {
		return this._kinematicData.get(name)?.filter(j => j.type === 'prismatic').map(j => j.name) ?? [];
	}

	/** Return names of frames designated as TCP or flanges. */
	getTcpLinkNames(name: string): string[] | undefined {
		const group = this._namedObjects.get(name);
		if (!group) return undefined;
		const links = group.children.filter(c => /\.(tcp|flange)\b/i.test(c.name)).map(c => c.name);
		return links.length ? links : undefined;
	}

	/** Get the current set of joint angles for a named system. */
	getCurrentJointAngles(name: string): Record<string, number> | undefined {
		return this._currentJointAngles.get(name);
	}

	/**
	 * Isolate a single named object — hide all other named groups so that
	 * only the target object is visible.  The camera is not moved.
	 */
	focusObject(name: string): boolean {
		const target = this._namedObjects.get(name);
		if (!target) return false;

		this._focusedObjectName = name;
		for (const [n, group] of this._namedObjects) {
			const isChildArea = this._areaParentMap.get(n) === name;
			group.visible = n === name || isChildArea;
		}
		return true;
	}

	/**
	 * Show or hide a named group.
	 * @returns true if the group was found, false otherwise.
	 */
	setGroupVisible(name: string, visible: boolean): boolean {
		const group = this._namedObjects.get(name);
		if (!group) return false;
		group.visible = visible;
		return true;
	}

	/** Restore visibility of all named objects (except paths not yet clicked). */
	resetView(): void {
		this._focusedObjectName = null;
		for (const group of this._namedObjects.values()) {
			if (!group.userData['hiddenByDefault']) {
				group.visible = true;
			}
		}
	}

	/** Apply an emissive highlight to a named object, replacing any previously
	 * highlighted object(s). Use highlightObjects() to highlight several at once. */
	highlightObject(name: string): void {
		this.highlightObjects([name]);
	}

	/** Apply an emissive highlight to exactly this set of named objects,
	 * un-highlighting any previously highlighted object not in the list. */
	highlightObjects(names: string[]): void {
		const next = new Set(names);
		for (const name of this._highlightedObjectNames) {
			if (!next.has(name)) this._unhighlightObject(name);
		}
		for (const name of next) {
			if (!this._highlightedObjectNames.has(name)) this._applyHighlight(name);
		}
		this._highlightedObjectNames = next;
	}

	/** Remove the emissive highlight from all currently highlighted object(s). */
	clearHighlight(): void {
		for (const name of this._highlightedObjectNames) this._unhighlightObject(name);
		this._highlightedObjectNames.clear();
	}

	private _applyHighlight(name: string): void {
		const group = this._namedObjects.get(name);
		if (!group) return;
		group.traverse(obj => {
			if (obj instanceof THREE.Mesh) {
				const mat = obj.material as THREE.MeshStandardMaterial;
				if (!mat) return;
				if (mat.emissive) {
					// Save original state before overwriting so _unhighlightObject can restore it
					obj.userData['_savedEmissive'] = mat.emissive.getHex();
					obj.userData['_savedEmissiveIntensity'] = mat.emissiveIntensity;
					mat.emissive.setHex(0x4488ff);
					mat.emissiveIntensity = 0.35;
				}
				// Pull the area surface in front of its coplanar parent mesh
				obj.userData['_savedPolygonOffset'] = mat.polygonOffset;
				obj.userData['_savedPolygonOffsetFactor'] = mat.polygonOffsetFactor;
				obj.userData['_savedPolygonOffsetUnits'] = mat.polygonOffsetUnits;
				mat.polygonOffset = true;
				mat.polygonOffsetFactor = -2;
				mat.polygonOffsetUnits = -2;
				mat.needsUpdate = true;
			}
		});
	}

	private _unhighlightObject(name: string): void {
		const group = this._namedObjects.get(name);
		if (!group) return;
		group.traverse(obj => {
			if (obj instanceof THREE.Mesh) {
				const mat = obj.material as THREE.MeshStandardMaterial;
				if (!mat) return;
				if (mat.emissive) {
					mat.emissive.setHex(obj.userData['_savedEmissive'] ?? 0x000000);
					mat.emissiveIntensity = obj.userData['_savedEmissiveIntensity'] ?? 0;
					delete obj.userData['_savedEmissive'];
					delete obj.userData['_savedEmissiveIntensity'];
				}
				mat.polygonOffset = obj.userData['_savedPolygonOffset'] ?? false;
				mat.polygonOffsetFactor = obj.userData['_savedPolygonOffsetFactor'] ?? 0;
				mat.polygonOffsetUnits = obj.userData['_savedPolygonOffsetUnits'] ?? 0;
				delete obj.userData['_savedPolygonOffset'];
				delete obj.userData['_savedPolygonOffsetFactor'];
				delete obj.userData['_savedPolygonOffsetUnits'];
				mat.needsUpdate = true;
			}
		});
	}

	// ── Markers (delegated to MarkerSystem) ──────────────────────────

	/** Add a sphere marker at the given world-space point for a named object. */
	addMarker(name: string, point: { x: number; y: number; z: number }): void {
		this._markers?.addMarker(name, point);
	}

	/** Add a path-segment line through intermediate toolpath points. */
	addIntermediateMarkers(name: string, points: { x: number; y: number; z: number }[]): void {
		this._markers?.addIntermediateMarkers(name, points);
	}

	/** Remove all markers for a named object. */
	clearMarkers(name: string): void {
		this._markers?.clearMarkers(name);
	}

	/** Remove all markers for all objects. */
	clearAllMarkers(): void {
		this._markers?.clearAllMarkers();
	}

	// ── TCP TransformControls ────────────────────────────────────────────

	/**
	 * Attach a TransformControls gizmo to a ghost object placed at the TCP
	 * world pose. On every drag step, `onChange` receives the ghost's new
	 * world position and quaternion so the caller can solve IK.
	 */
	attachTransformControls(
		systemName: string,
		tcpLinkName: string,
		onChange: (
			pos: { x: number; y: number; z: number },
			quat: { x: number; y: number; z: number; w: number },
		) => void,
		onContextMenu?: (x: number, y: number, currentMode: TcpMode) => void,
	): void {
		this._tcpGizmo?.attach(systemName, tcpLinkName, onChange, onContextMenu);
	}

	/** Switch the active TransformControls mode. Rotation-TCP uses local space (TCP frame axes). */
	setTransformMode(mode: TcpMode): void {
		this._tcpGizmo?.setMode(mode);
	}

	/** Remove the TransformControls gizmo and ghost object from the scene. */
	detachTransformControls(): void {
		this._tcpGizmo?.detach();
	}

	// ── Interaction ──────────────────────────────────────────────────

	/** Register a double-click callback. */
	set onDblClick(cb: ObjectClickCallback | null) {
		this._onObjectDblClick = cb;
	}

	private _onDblClick(event: MouseEvent): void {
		if (!this._onObjectDblClick) return;
		this._performRaycast(event);
	}

	private _performRaycast(event: { clientX: number; clientY: number }): void {
		if (!this._camera || !this._renderer || !this._onObjectDblClick) return;

		const rect = this._renderer.domElement.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		this._raycaster.setFromCamera(new THREE.Vector2(x, y), this._camera);

		const meshes: THREE.Mesh[] = [];
		for (const group of this._namedObjects.values()) {
			group.traverse(obj => { if ((obj as THREE.Mesh).isMesh) meshes.push(obj as THREE.Mesh); });
		}
		if (!meshes.length) return;

		const hits = this._raycaster.intersectObjects(meshes, false);
		if (!hits.length) return;

		const hit = hits[0];
		const name = this._resolveObjectName(hit.object);
		if (!name) return;

		// Resolve world normal
		const normal = new THREE.Vector3(0, 0, 1);
		if (hit.face) {
			const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
			normal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();
		}

		this._onObjectDblClick({
			name,
			point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
			normal: { x: normal.x, y: normal.y, z: normal.z },
		});
	}

	private _resolveObjectName(obj: THREE.Object3D): string | null {
		let curr: THREE.Object3D | null = obj;
		while (curr) {
			if (curr.name && this._namedObjects.has(curr.name)) {
				// In focus mode, clicks on child areas of the focused parent
				// should be treated as clicks on the parent itself, since the
				// area geometry is part of that parent's surface.
				if (this._focusedObjectName) {
					const parentName = this._areaParentMap.get(curr.name);
					if (parentName === this._focusedObjectName) return this._focusedObjectName;
				}
				return curr.name;
			}
			curr = curr.parent;
		}
		return null;
	}

	// ── Private Event/Render Loop ───────────────────────────────────

	private _animate(): void {
		if (!this._renderer || !this._scene || !this._camera) return;
		this._animationFrameId = requestAnimationFrame(this._boundAnimate!);
		this._controls?.update();
		this._renderer.render(this._scene, this._camera);
		this._orientationGizmo?.render();
	}

	private _resize(): void {
		if (!this._mountEl || !this._renderer || !this._camera) return;
		const { clientWidth, clientHeight } = this._mountEl;
		if (!clientWidth || !clientHeight) return;
		this._renderer.setSize(clientWidth, clientHeight, false);
		this._camera.aspect = clientWidth / clientHeight;
		this._camera.updateProjectionMatrix();

		const pixelRatio = this._renderer.getPixelRatio?.() ?? 1;

		// Update LineMaterial resolutions on marker lines
		this._markers?.updateResolutions(clientWidth, clientHeight, pixelRatio);

		// Update LineMaterial resolutions on path and bbox preview groups
		for (const group of this._namedObjects.values()) {
			group.traverse(obj => {
				const mat = (obj as any).material;
				if (mat instanceof LineMaterial) {
					mat.resolution.set(clientWidth, clientHeight);
				}
			});
		}
	}

	// ── GPU Resource Cleanup ──────────────────────────────────────

	private _disposeGroupResources(group: THREE.Group): void {
		group.traverse(obj => {
			if (obj instanceof THREE.Mesh || obj instanceof Line2 || obj instanceof LineSegments2) {
				(obj as any).geometry?.dispose();
				const mat = (obj as any).material;
				if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose());
				else mat?.dispose();
			}
		});
	}

	// ── Scene Decorators ─────────────────────────────────────────

	private _addLights(scene: THREE.Scene): void {
		scene.add(new THREE.AmbientLight(0xffffff, 0.5));
		const dir = new THREE.DirectionalLight(0xffffff, 1.2);
		dir.position.set(0, 0, 10);
		scene.add(dir);
	}

	private _addGrid(scene: THREE.Scene): void {
		const grid = new THREE.GridHelper(10, 20, 0x183431, 0x183431);
		grid.rotation.x = Math.PI / 2;
		scene.add(grid);
	}

	private _addGround(scene: THREE.Scene): void {
		const ground = new THREE.Mesh(
			new THREE.PlaneGeometry(10, 10),
			new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.25 })
		);
		ground.rotation.x = Math.PI / 2;
		ground.position.z = -0.01;
		ground.receiveShadow = true;
		scene.add(ground);
	}

	private _addAxes(scene: THREE.Scene): void {
		scene.add(new THREE.AxesHelper(1.5));
	}
}
