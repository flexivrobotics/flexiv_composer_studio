import * as THREE from 'three';
import { loadURDFFromUrl, loadSceneObjectURDFFromUrl, loadMeshFromUrl, placeCameraFrustum } from './sceneLoader';
import { apiGet, apiPost, apiDelete } from './api';
import { useConfirm } from '../composables/useConfirm';
import { useI18n } from '../composables/useI18n';
import { useToast } from '../composables/useToast';

// ── Types & Interfaces ───────────────────────────────────────────────

interface Workcell {
	name: string;
	description?: string;
}

export interface WorkcellDialogState {
	workcells: Workcell[];
	selectedName: string;
	loading: boolean;
	deleting: boolean;
	creating: boolean;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Loading a workcell causes the server to broadcast a CHANGE_REFRESHED scene
 * event back to us over the live scene-events socket. Consumers that react to
 * that event (e.g. to resync an externally-changed workcell) must ignore it
 * while it's just an echo of a load we just triggered ourselves - otherwise
 * load -> CHANGE_REFRESHED -> resync -> load loops forever.
 */
export const workcellLoadSignal = { suppressRefreshUntil: 0 };
const SELF_LOAD_ECHO_WINDOW_MS = 3000;

/**
 * Fetch the list of available workcells from the server.
 */
export async function fetchWorkcells(state: WorkcellDialogState): Promise<void> {
	const { t } = useI18n();
	const { showToast } = useToast();
	state.loading = true;
	try {
		const data = await apiGet<{ workcells: Workcell[] }>('/api/workcells');
		state.workcells = (data.workcells || []).sort((a: Workcell, b: Workcell) =>
			a.name.localeCompare(b.name)
		);
	} catch (err: any) {
		showToast(err.message || t('error.fetchWorkcells'), 'error');
	} finally {
		state.loading = false;
	}
}

/**
 * Load a selected workcell: POST the selection to the server, then load
 * all system URDFs and scene-object URDFs into the viewer.
 */
export async function loadSelectedWorkcell(
	state: WorkcellDialogState,
	onLoad: (name: string) => void,
	onClose: () => void,
	addGroup: (name: string, group: THREE.Group, parentSystemName?: string, parentLinkName?: string) => void,
	onSystemAdded: (name: string) => void,
	onSceneObjectAdded: (name: string, visualType?: 'primitive' | 'mesh') => void,
	onClear?: () => void,
	addPath?: (name: string, waypoints: Array<{ pose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } }>) => void,
	onPathAdded?: (parentName: string, pathName: string) => void,
	onTargetAdded?: (systemName: string, targetName: string) => void,
	onAreaAdded?: (parentName: string, areaName: string) => void,
	getGroupWorldPose?: (name: string) => { position: [number, number, number]; quaternion: [number, number, number, number] } | undefined,
	setGroupPose?: (name: string, position: [number, number, number], quaternion: [number, number, number, number]) => void,
	onPtpTrajectoryAdded?: (systemName: string, trajectoryName: string) => void,
	onLinearTrajectoryAdded?: (systemName: string, trajectoryName: string) => void,
	onCameraAdded?: (name: string) => void,
): Promise<void> {
	if (!state.selectedName) return;
	const { t } = useI18n();
	const { showToast } = useToast();
	onClear?.();
	state.loading = true;
	try {
		workcellLoadSignal.suppressRefreshUntil = Date.now() + SELF_LOAD_ECHO_WINDOW_MS;
		const data = await apiPost<any>('/api/workcells/load', { name: state.selectedName });

		const loadedSystemGroups = new Map<string, THREE.Group>();
		const trackingAddGroup = (name: string, group: THREE.Group) => {
			addGroup(name, group);
			loadedSystemGroups.set(name, group);
		};

		await loadSystemsFromWorkcell(data, trackingAddGroup, onSystemAdded, state);
		await loadSceneObjectsFromWorkcell(data, addGroup, onSceneObjectAdded, state, loadedSystemGroups);

		// Load saved areas after scene objects, since each area is placed at
		// its parent's current world pose.
		if (onAreaAdded && getGroupWorldPose && setGroupPose) {
			await loadAreasFromWorkcell(state.selectedName, addGroup, onAreaAdded, getGroupWorldPose, setGroupPose);
		}

		// Cameras may be parented to a system's flange, so load them after
		// systems so addGroup can parent them to that flange's link.
		if (onCameraAdded) {
			await loadCamerasFromWorkcell(addGroup, onCameraAdded);
		}

		// Load existing paths after systems and scene objects are ready
		if (addPath && onPathAdded) {
			await loadPathsFromWorkcell(state.selectedName, addPath, onPathAdded);
		}

		// Load saved targets
		if (onTargetAdded) {
			await loadTargetsFromWorkcell(state.selectedName, onTargetAdded);
		}

		// Load saved PTP trajectories
		if (onPtpTrajectoryAdded) {
			await loadPtpTrajectoriesFromWorkcell(onPtpTrajectoryAdded);
		}

		// Load saved linear path trajectories
		if (onLinearTrajectoryAdded) {
			await loadLinearTrajectoriesFromWorkcell(state.selectedName, onLinearTrajectoryAdded);
		}

		onLoad(state.selectedName);
		onClose();
	} catch (err: any) {
		showToast(err.message || t('error.loadWorkcell'), 'error');
	} finally {
		state.loading = false;
	}
}

/**
 * Create a new workcell on the server.
 */
export async function createWorkcell(
	state: WorkcellDialogState,
	name: string,
	description: string,
): Promise<boolean> {
	const { t } = useI18n();
	const { showToast } = useToast();
	state.loading = true;
	try {
		await apiPost('/api/workcells', { name, description });
		// Refresh the workcell list and select the newly created one
		await fetchWorkcells(state);
		state.selectedName = name;
		return true;
	} catch (err: any) {
		showToast(err.message || t('error.createWorkcell'), 'error');
		return false;
	} finally {
		state.loading = false;
	}
}

/**
 * Delete a workcell by name (with a confirmation prompt).
 */
export async function deleteWorkcell(
	state: WorkcellDialogState,
	onSuccess?: () => void,
): Promise<void> {
	if (!state.selectedName) return;
	const { t } = useI18n();
	const { showToast } = useToast();
	const { confirm } = useConfirm();
		const ok = await confirm(t('dialog.workcell.confirmDelete', { name: state.selectedName }));
	if (!ok) return;

	state.deleting = true;
	try {
		await apiDelete(`/api/workcells/${encodeURIComponent(state.selectedName)}`);
		state.workcells = state.workcells.filter(wc => wc.name !== state.selectedName);
		state.selectedName = '';
		onSuccess?.();
	} catch (err: any) {
		showToast(err.message || t('error.deleteWorkcell'), 'error');
	} finally {
		state.deleting = false;
	}
}

// ── Workcell Loading Helpers ─────────────────────────────────────────

async function loadSystemsFromWorkcell(
	data: any,
	addGroup: (name: string, group: THREE.Group) => void,
	onSystemAdded: (name: string) => void,
	state: WorkcellDialogState,
): Promise<number> {
	const { t } = useI18n();
	const { showToast } = useToast();
	let loadedCount = 0;
	if (!Array.isArray(data.systems)) return loadedCount;

	for (const system of data.systems) {
		const urdfPath = system.modified_urdf_local_path;
		if (!urdfPath) {
			console.warn(`System '${system.name}' has no modified URDF path.`);
			continue;
		}
		try {
			const sysName = system.name.replace(/^\//, '') || system.name;
			const baseDir = urdfPath.substring(0, urdfPath.lastIndexOf('/'));
			const url = buildFileUrl(urdfPath);
			const group = await loadURDFFromUrl(url, baseDir);
			addGroup(sysName, group);
			onSystemAdded(sysName);
			loadedCount++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`Failed to load system "${system.name}":`, err);
			showToast(t('error.loadSystem', { name: system.name, msg }), 'error');
		}
	}
	return loadedCount;
}

async function loadSceneObjectsFromWorkcell(
	data: any,
	addGroup: (name: string, group: THREE.Group, parentSystemName?: string, parentLinkName?: string) => void,
	onSceneObjectAdded: (name: string, visualType?: 'primitive' | 'mesh') => void,
	state: WorkcellDialogState,
	loadedSystemGroups?: Map<string, THREE.Group>,
): Promise<number> {
	const { t } = useI18n();
	const { showToast } = useToast();
	let loadedCount = 0;
	const sceneObj = data.sceneObjects as { modified_urdf_local_path?: string } | null;
	if (!sceneObj?.modified_urdf_local_path) return loadedCount;

	try {
		const urdfPath = sceneObj.modified_urdf_local_path;
		const baseDir = urdfPath.substring(0, urdfPath.lastIndexOf('/'));
		const url = buildFileUrl(urdfPath);
		const items = await loadSceneObjectURDFFromUrl(url, baseDir);

		// Pass 1: add every mesh to the 3D viewer, attaching to a system link group when declared
		for (const item of items) {
			let parentSystemName: string | undefined;
			if (item.parentLinkName && loadedSystemGroups) {
				for (const [sysName, sysGroup] of loadedSystemGroups.entries()) {
					const child = sysGroup.children.find(c => c.name === item.parentLinkName);
					if (child instanceof THREE.Group) { parentSystemName = sysName; break; }
				}
			}
			addGroup(item.name, item.group, parentSystemName, parentSystemName ? item.parentLinkName : undefined);
			loadedCount++;
		}

		// Pass 2: register scene objects in the tree (areas are no longer part
		// of this combined URDF - they're restored separately, see
		// loadAreasFromWorkcell, since they're no longer nebula scene objects).
		for (const item of items) {
			onSceneObjectAdded(item.name, item.visualType);
		}

		loadedCount = items.length;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error('Failed to load scene objects:', err);
		showToast(t('error.loadSceneObjects', { msg }), 'error');
	}
	return loadedCount;
}

/**
 * Fetch all saved areas for a workcell and restore them in the viewer/tree.
 * Areas are no longer nebula scene objects (see extract-area workflow), so
 * they aren't part of the combined scene-objects URDF loaded above - each is
 * loaded from its own mesh file and placed at its parent's current live
 * world pose (its vertices are already in the parent's own local frame).
 */
export async function loadAreasFromWorkcell(
	workcellName: string,
	addGroup: (name: string, group: THREE.Group) => void,
	onAreaAdded: (parentName: string, areaName: string) => void,
	getGroupWorldPose: (name: string) => { position: [number, number, number]; quaternion: [number, number, number, number] } | undefined,
	setGroupPose: (name: string, position: [number, number, number], quaternion: [number, number, number, number]) => void,
): Promise<number> {
	let loadedCount = 0;
	try {
		const data = await apiGet<{ areas: Array<{ name: string; parentName: string; meshUrl: string | null }> }>(
			`/api/${encodeURIComponent(workcellName)}/areas`,
		);
		for (const area of data.areas ?? []) {
			if (!area.meshUrl) continue;
			try {
				const group = await loadMeshFromUrl(area.meshUrl, 'obj');
				addGroup(area.name, group);
				const parentPose = getGroupWorldPose(area.parentName);
				if (parentPose) setGroupPose(area.name, parentPose.position, parentPose.quaternion);
				onAreaAdded(area.parentName, area.name);
				loadedCount++;
			} catch (err) {
				console.warn(`Failed to load area '${area.name}':`, err);
			}
		}
	} catch (err) {
		console.error('Failed to load areas:', err);
	}
	return loadedCount;
}

/**
 * Fetch saved targets for the workcell and restore them in the scene tree.
 */
export async function loadTargetsFromWorkcell(
	workcellName: string,
	onTargetAdded: (systemName: string, targetName: string) => void,
): Promise<number> {
	let loadedCount = 0;
	try {
		const listData = await apiGet<{ targetNames: string[] }>(
			`/api/targets/${encodeURIComponent(workcellName)}`,
		);
		for (const targetName of listData.targetNames ?? []) {
			let detail: any;
			try {
				detail = await apiGet(
					`/api/targets/${encodeURIComponent(workcellName)}/${encodeURIComponent(targetName)}`,
				);
			} catch {
				console.warn(`Failed to fetch target '${targetName}'.`);
				continue;
			}
			const systemName: string = detail.systemName ?? '';
			if (systemName) {
				onTargetAdded(systemName, targetName);
				loadedCount++;
			}
		}
	} catch (err) {
		console.error('Failed to load targets:', err);
	}
	return loadedCount;
}

/**
 * Fetch all saved paths for a workcell from JSON storage and restore them
 * into the viewer and scene tree.
 */
export async function loadPathsFromWorkcell(
	workcellName: string,
	addPath: (name: string, waypoints: Array<{ pose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } }>) => void,
	onPathAdded: (parentName: string, pathName: string) => void,
): Promise<number> {
	let loadedCount = 0;
	try {
		const qs = workcellName ? `?workcellName=${encodeURIComponent(workcellName)}` : '';
		const listData = await apiGet<{ pathNames: string[] }>(`/api/paths${qs}`);
		const pathNames: string[] = listData.pathNames ?? [];
		for (const pn of pathNames) {
			let detail: any;
			try {
				detail = await apiGet(`/api/paths/${encodeURIComponent(pn)}${qs}`);
			} catch {
				console.warn(`Failed to fetch path '${pn}'.`);
				continue;
			}
			const waypoints: any[] = detail.CartesianWaypoints ?? [];
			if (waypoints.length < 2) continue;
			const mapped = waypoints.map((wp: any) => ({ pose: wp }));
			addPath(pn, mapped);
			onPathAdded(detail.parentName, pn);
			loadedCount++;
		}
	} catch (err) {
		console.error('Failed to load paths:', err);
	}
	return loadedCount;
}

/**
 * Read saved linear path trajectory JSON files from the workcell folder and
 * restore them in the scene tree.
 */
export async function loadLinearTrajectoriesFromWorkcell(
	workcellName: string,
	onLinearTrajectoryAdded: (systemName: string, trajectoryName: string) => void,
): Promise<number> {
	let loadedCount = 0;
	try {
		const data = await apiGet<{ trajectories: Array<{ name: string; systemName: string; tcpName: string }> }>(
			`/api/workcells/${encodeURIComponent(workcellName)}/linear-trajectories`,
		);
		for (const t of data.trajectories ?? []) {
			if (t.name && t.systemName) {
				onLinearTrajectoryAdded(t.systemName, t.name);
				loadedCount++;
			}
		}
	} catch (err) {
		console.error('Failed to load linear trajectories:', err);
	}
	return loadedCount;
}

/**
 * Fetch all saved PTP trajectories and restore them in the scene tree.
 */
export async function loadPtpTrajectoriesFromWorkcell(
	onPtpTrajectoryAdded: (systemName: string, trajectoryName: string) => void,
): Promise<number> {
	let loadedCount = 0;
	try {
		const listData = await apiGet<{ trajectoryNames: string[] }>('/api/ptp-trajectories');
		for (const trajectoryName of listData.trajectoryNames ?? []) {
			let detail: any;
			try {
				detail = await apiGet(`/api/ptp-trajectories/${encodeURIComponent(trajectoryName)}`);
			} catch {
				console.warn(`Failed to fetch PTP trajectory '${trajectoryName}'.`);
				continue;
			}
			const systemName: string = detail.systemName ?? '';
			if (systemName) {
				onPtpTrajectoryAdded(systemName, trajectoryName);
				loadedCount++;
			}
		}
	} catch (err) {
		console.error('Failed to load PTP trajectories:', err);
	}
	return loadedCount;
}

/**
 * Fetch all saved cameras and restore their frustums in the viewer + scene
 * tree. Must run after systems are loaded so a flange-parented camera can be
 * attached to that flange's link via `addGroup`.
 */
export async function loadCamerasFromWorkcell(
	addGroup: (name: string, group: THREE.Group, parentSystemName?: string, parentLinkName?: string) => void,
	onCameraAdded: (name: string) => void,
): Promise<number> {
	let loadedCount = 0;
	try {
		const [listData, flangeData] = await Promise.all([
			apiGet<{ cameras: string[] }>('/api/cameras'),
			apiGet<{ flanges: { systemName: string; flangeName: string }[] }>('/api/systems/flanges').catch(() => ({ flanges: [] })),
		]);
		const systemNameByFlange = new Map((flangeData.flanges ?? []).map((f) => [f.flangeName, f.systemName]));

		for (const name of listData.cameras ?? []) {
			let cfg: any;
			try {
				cfg = await apiGet(`/api/cameras/${encodeURIComponent(name)}/config`);
			} catch {
				console.warn(`Failed to fetch camera '${name}'.`);
				continue;
			}
			const parent: string = cfg.parent || 'world';
			placeCameraFrustum(
				{
					name,
					parent,
					systemName: parent === 'world' ? null : systemNameByFlange.get(parent) ?? null,
					position: cfg.position,
					quaternion: cfg.quaternion,
					farWidth: cfg.farWidth,
					farHeight: cfg.farHeight,
					farDistance: cfg.farDistance,
					nearDistance: cfg.nearDistance,
				},
				addGroup,
			);
			onCameraAdded(name);
			loadedCount++;
		}
	} catch (err) {
		console.error('Failed to load cameras:', err);
	}
	return loadedCount;
}

function buildFileUrl(path: string): string {
	return `/api/file?path=${encodeURIComponent(path)}`;
}


