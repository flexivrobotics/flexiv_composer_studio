import { ref, watch, type Ref } from 'vue';
import type { ObjectType } from '../../types';
import { apiGet } from '../../services/api';
import { useToast } from '../useToast';
import { loadMeshFromUrl, loadURDFFromUrl, placeCameraFrustum, buildBoxGroup, type CameraPlacement } from '../../services/sceneLoader';

/** Saved-camera fields needed to place its frustum in the viewer. */
export type CameraCreatedPayload = CameraPlacement;

// ── Option Types ───────────────────────────────────────────────────
// Structural interfaces matching the relevant parts of useSceneTree's return
// and SceneTree.vue's props, so the composable stays decoupled.

export interface SetupState {
	setupView: 'system' | 'scene-object' | 'camera' | 'path' | 'target-trajectory' | 'area' | 'ptp-trajectory' | 'linear-trajectory' | 'custom-components' | 'collision-config' | 'license' | null;
	editSystemName: string | null;
	editSystemConfig: Record<string, any> | null;
	editCameraName: string | null;
	editCameraConfig: Record<string, any> | null;
}

export interface SetupTreeOps {
	add(name: string, type: ObjectType): void;
	remove(name: string, type: ObjectType): Promise<void>;
	hasItem(name: string): boolean;
}

export interface UseSceneTreeSetupOptions {
	/** The reactive state object from useSceneTree (setupView, editSystem*, etc.). */
	state: SetupState;
	/** Tree add/remove operations from useSceneTree. */
	treeOps: SetupTreeOps;
	/** Child add for targets (from useSceneTree). */
	addTarget: (parentName: string, targetName: string) => void;
	/** Child add for PTP trajectories (from useSceneTree). */
	addPtpTrajectory: (parentName: string, trajectoryName: string) => void;
	/** Child add for linear trajectories (from useSceneTree). */
	addLinearTrajectory: (parentName: string, trajectoryName: string) => void;
	/** Child add for areas (from useSceneTree). */
	addArea: (parentName: string, areaName: string) => void;
	/** Directly invoke async path generation (bypasses the event bridge so we can await). Resolves to whether a path was created. */
	generatePath: (payload: { name: string; pointSpacing: number; blendingRadius: number; orientationAlignmentType?: string; orientationAlignmentDirection?: { x: number; y: number; z: number } }) => Promise<boolean>;
	/** Directly invoke async area generation (bypasses the event bridge so we can await). Resolves to whether an area was created. */
	generateArea: (payload: { name: string; parentName: string }) => Promise<boolean>;
	/** Emit function from the parent component. */
	emit: (event: string, ...args: any[]) => void;
	/** Accessor for the current workcell name. */
	workcellName: () => string;
	/** Confirmation dialog. */
	confirm: (message: string) => Promise<boolean>;
	/** Whether the tree is disabled (mirrors treeDisabled prop). */
	treeDisabled?: Ref<boolean | undefined>;
	/** Clear visualizer selection when opening a creation panel. */
	clearSelection?: () => void;
	/** Remove all child items (targets, trajectories) from a system without confirmation. */
	removeSystemChildren: (systemName: string) => void;
	/**
	 * Remove a top-level tree item by name without a confirm dialog or backend
	 * DELETE call. Used after a Setup* panel's own delete button has already
	 * confirmed with the user and deleted server-side (e.g. SetupCamera), so
	 * the lifecycle handler here only needs to sync local tree state.
	 */
	removeItemSilently?: (name: string) => void;
}

// ── useSceneTreeSetup ──────────────────────────────────────────────
// Encapsulates all setup-wizard orchestration — state for loading/path
// config, watchers that notify the parent, and handlers for Setup* panel
// lifecycle events.  SceneTree.vue wires these back to its template.

export function useSceneTreeSetup(opts: UseSceneTreeSetupOptions) {
	const { state, treeOps, addTarget, addPtpTrajectory, addLinearTrajectory, addArea, generatePath, generateArea, emit, workcellName, confirm, treeDisabled, clearSelection, removeSystemChildren, removeItemSilently } = opts;

	const { showToast } = useToast();

	// ── UI State ───────────────────────────────────────────────────

	const setupLoading = ref(false);
	const pathParentName = ref<string | null>(null);

	// Setup views whose robot preview (a target pose, a solved IK/trajectory
	// preview) would otherwise be immediately overwritten by live joint-angle
	// polling — see handleSetupActive's matching pauseSystem() call.
	const SETUP_VIEWS_NEEDING_POLLING_PAUSE = new Set(['target-trajectory', 'ptp-trajectory', 'linear-trajectory']);

	// Notify parent when a setup view opens or closes
	watch(() => state.setupView, (v) => {
		emit('setup-active', v,
			v && SETUP_VIEWS_NEEDING_POLLING_PAUSE.has(v) ? pathParentName.value ?? undefined : undefined);
	});
	watch(setupLoading, (v) => emit('setup-loading', v));

	// ── System Edit ────────────────────────────────────────────────

	function openEditSystem(name: string, type: ObjectType) {
		if (treeDisabled?.value) return;
		if (type !== 'system') {
			treeOps.remove(name, type);
			return;
		}
		loadAndEditSystem(name);
	}

	async function loadAndEditSystem(name: string) {
		setupLoading.value = true;
		state.editSystemName = name;
		try {
			const data = await apiGet(`/api/systems/${encodeURIComponent(name)}/config`);
			state.editSystemConfig = data as Record<string, any>;
			state.setupView = 'system';
		} catch (err: any) {
			console.error('Failed to load system config:', err);
			await confirm('Failed to load system configuration: ' + (err.message || String(err)));
			state.editSystemName = null;
		} finally {
			setupLoading.value = false;
		}
	}

	// ── Camera Edit ────────────────────────────────────────────────

	function openEditCamera(name: string) {
		if (treeDisabled?.value) return;
		loadAndEditCamera(name);
	}

	async function loadAndEditCamera(name: string) {
		setupLoading.value = true;
		state.editCameraName = name;
		try {
			const data = await apiGet(`/api/cameras/${encodeURIComponent(name)}/config`);
			state.editCameraConfig = data as Record<string, any>;
			state.setupView = 'camera';
		} catch (err: any) {
			console.error('Failed to load camera config:', err);
			await confirm('Failed to load camera configuration: ' + (err.message || String(err)));
			state.editCameraName = null;
		} finally {
			setupLoading.value = false;
		}
	}

	// ── Setup View Lifecycle ───────────────────────────────────────

	function onSetupClose() {
		state.setupView = null;
		state.editSystemName = null;
		state.editSystemConfig = null;
		state.editCameraName = null;
		state.editCameraConfig = null;
		pathParentName.value = null;
		emit('reset-view');
		emit('free-sketch-mode', { active: false });
	}

	// ── URDF Loading ───────────────────────────────────────────────

	async function loadAndAddSystemUrdf(name: string) {
		const wc = workcellName();
		if (!wc) return;
		try {
			const sysInfo = await apiGet<any>(`/api/workcells/${encodeURIComponent(wc)}/systems/${encodeURIComponent(name)}/urdf`);
			const urdfPath = sysInfo.modified_urdf_local_path;
			if (!urdfPath) {
				console.warn(`System '${name}' has no modified URDF path.`);
				return;
			}
			const baseDir = urdfPath.substring(0, urdfPath.lastIndexOf('/'));
			const url = `/api/file?path=${encodeURIComponent(urdfPath)}`;
			const group = await loadURDFFromUrl(url, baseDir);
			emit('add-group', name, group);
		} catch (err) {
			console.error(`Failed to load URDF for system "${name}":`, err);
		}
	}

	// ── Setup Panel Event Handlers ─────────────────────────────────

	async function onSystemCreated(name: string) {
		treeOps.add(name, 'system');
		onSetupClose();
		await loadAndAddSystemUrdf(name);
	}

	async function onSystemModified(name: string) {
		removeSystemChildren(name);
		onSetupClose();
		emit('remove-group', name);
		await loadAndAddSystemUrdf(name);
	}

	function onSystemDeleted(name: string) {
		treeOps.remove(name, 'system');
		onSetupClose();
		console.log(`System "${name}" deleted.`);
	}

	async function onInsertedMesh(name: string, meshUrl: string, parent: string, parentSystemName: string | null) {
		// The live CHANGE_ADDED scene event for this object may race with this
		// creation flow and win, already adding it to the tree + viewer.
		const alreadyAdded = treeOps.hasItem(name);
		treeOps.add(name, 'scene-object');
		state.setupView = null;
		if (alreadyAdded) return;
		try {
			const group = await loadMeshFromUrl(meshUrl, 'obj');
			if (parentSystemName) {
				emit('add-group', name, group, parentSystemName, parent);
			} else {
				emit('add-group', name, group);
			}
		} catch (err) {
			console.error('Failed to load mesh into viewer:', err);
		}
	}

	function onInsertedPrimitive(
		name: string,
		size: [number, number, number],
		position: [number, number, number],
		quaternion: [number, number, number, number],
		parent: string,
		parentSystemName: string | null,
	) {
		// The live CHANGE_ADDED scene event for this object may race with this
		// creation flow and win, already adding it to the tree + viewer.
		const alreadyAdded = treeOps.hasItem(name);
		treeOps.add(name, 'scene-object');
		state.setupView = null;
		if (alreadyAdded) return;
		const group = buildBoxGroup(size);
		group.position.set(...position);
		group.quaternion.set(...quaternion);
		if (parentSystemName) {
			emit('add-group', name, group, parentSystemName, parent);
		} else {
			emit('add-group', name, group);
		}
	}

	// ── Camera Setup Lifecycle ──────────────────────────────────────

	function onCameraCreated(camera: CameraCreatedPayload) {
		treeOps.add(camera.name, 'camera');
		placeCameraFrustum(camera, (name, group, parentSystemName, parentLinkName) =>
			emit('add-group', name, group, parentSystemName, parentLinkName));
		onSetupClose();
	}

	function onCameraModified(camera: CameraCreatedPayload) {
		// addGroup replaces any existing group of the same name, so no
		// explicit removal is needed before re-adding the updated frustum.
		placeCameraFrustum(camera, (name, group, parentSystemName, parentLinkName) =>
			emit('add-group', name, group, parentSystemName, parentLinkName));
		onSetupClose();
	}

	function onCameraDeleted(name: string) {
		// SetupCamera's own delete button already confirmed with the user and
		// deleted server-side; only sync local tree + viewer state here, or
		// treeOps.remove would confirm and DELETE a second time.
		if (removeItemSilently) {
			removeItemSilently(name);
			emit('remove-group', name);
		} else {
			treeOps.remove(name, 'camera');
		}
		onSetupClose();
	}

	// ── Path / Target Setup Transitions ────────────────────────────

	function openPathSetup(parentName: string) {
		pathParentName.value = parentName;
		state.setupView = 'path';
		emit('focus-group', parentName, 'system');
		emit('free-sketch-mode', { active: true, parentName });
	}

	async function onPathCreated(payload: { name: string; pointSpacing: number; blendingRadius: number; orientationAlignmentType: string; orientationAlignmentDirection: { x: number; y: number; z: number }; onComplete: () => void }) {
		const parent = pathParentName.value;
		if (!parent) return;

		// Check if the name already exists among ANY surface path — toolpaths
		// and linear trajectories share one Nebula namespace, so a name clash
		// with either kind would fail at creation time.
		try {
			const data = await apiGet<{ names: string[] }>('/api/surface-paths');
			const existing = data.names ?? [];
			if (existing.includes(payload.name)) {
				showToast(`Path "${payload.name}" already exists. Choose a different name.`, 'error');
				payload.onComplete();
				return;
			}
		} catch (err) {
			console.warn('Failed to check existing paths:', err);
		}

		const created = await generatePath(payload);
		payload.onComplete();
		if (created) onSetupClose();
	}

	function openTargetSetup(parentName: string) {
		clearSelection?.();
		pathParentName.value = parentName;
		state.setupView = 'target-trajectory';
		emit('focus-group', parentName, 'system');
	}

	function openAreaSetup(parentName: string) {
		clearSelection?.();
		pathParentName.value = parentName;
		state.setupView = 'area';
		emit('focus-group', parentName);
	}

	async function onAreaCreated(payload: { name: string; onComplete: () => void }) {
		const parent = pathParentName.value;
		if (!parent) return;
		const created = await generateArea({ name: payload.name, parentName: parent });
		payload.onComplete();
		if (created) onSetupClose();
	}

	function onTargetTrajectoryCreated(name: string) {
		const parent = pathParentName.value;
		if (parent) {
			addTarget(parent, name);
		}
		onSetupClose();
	}

	function onCreateTarget(payload: { name: string }) {
		const parent = pathParentName.value;
		if (parent) {
			addTarget(parent, payload.name);
		}
		onSetupClose();
	}

	// ── Trajectory Setup Transitions ────────────────────────────────

	function openPtpTrajectorySetup(parentName: string) {
		clearSelection?.();
		pathParentName.value = parentName;
		state.setupView = 'ptp-trajectory';
		emit('focus-group', parentName, 'system');
	}

	function openLinearTrajectorySetup(parentName: string) {
		clearSelection?.();
		pathParentName.value = parentName;
		state.setupView = 'linear-trajectory';
		emit('focus-group', parentName, 'system');
	}

	function onCreateTrajectory(payload: { name: string }) {
		const parent = pathParentName.value;
		if (parent) {
			if (state.setupView === 'ptp-trajectory') {
				addPtpTrajectory(parent, payload.name);
			} else {
				addLinearTrajectory(parent, payload.name);
			}
		}
		onSetupClose();
	}

	// ── Public API ─────────────────────────────────────────────────

	return {
		setupLoading,
		pathParentName,
		openEditSystem,
		onSetupClose,
		onSystemCreated,
		onSystemModified,
		onSystemDeleted,
		onInsertedMesh,
		onInsertedPrimitive,
		openEditCamera,
		onCameraCreated,
		onCameraModified,
		onCameraDeleted,
		openPathSetup,
		onPathCreated,
		openTargetSetup,
		onTargetTrajectoryCreated,
		onCreateTarget,
		openAreaSetup,
		onAreaCreated,
		openPtpTrajectorySetup,
		openLinearTrajectorySetup,
		onCreateTrajectory,
	};
}
