import { reactive, ref, watch, type Ref } from 'vue';
import type ThreeViewportVue from '../../components/ThreeViewport.vue';
import type { SceneViewer } from '../../services/viewer/sceneViewer';
import { loadMeshFromUrl, buildBoxGroup } from '../../services/sceneLoader';
import { loadSelectedWorkcell, workcellLoadSignal } from '../../services/workcellDialog';
import { useSelection } from '../useSelection';
import { useToast } from '../useToast';
import { useWorkcell } from '../useWorkcell';
import { useConfirm } from '../useConfirm';
import { useI18n } from '../useI18n';
import { useSceneEvents, type SceneEventMessage } from '../useSceneEvents';
import { usePolling } from './usePolling';
import { useIkDrag } from './useIkDrag';
import { useDrawMode } from './useDrawMode';
import { apiGet, apiPost, apiDelete } from '../../services/api';
import type { ISceneTreeOps } from '../../types';

// ── Minimal exposed interface (matched to ThreeViewport's defineExpose) ──

interface ViewportExposed {
	getViewer(): SceneViewer | null;
}

// ── useSceneController ────────────────────────────────────────────────
// Thin orchestration layer: wires the viewer, tree ops, polling, draw
// mode, and IK drag composables together and exposes a flat API for
// App.vue and Editor.vue to bind to.

export function useSceneController(
	viewport: Ref<InstanceType<typeof ThreeViewportVue> | null>,
	treeOps: ISceneTreeOps,
) {
	// ── Singletons ──────────────────────────────────────────────────

	const selection = useSelection();
	const { showToast } = useToast();
	const workcell = useWorkcell();
	const { confirm } = useConfirm();
	const { t } = useI18n();

	// ── UI State ────────────────────────────────────────────────────

	const ui = reactive({
		showWorkcellDialog: false,
		setupActive: false,
		sceneEventsActive: false,
	});

	const setupLoading = ref(false);

	// ── Viewer Access Helpers ────────────────────────────────────────

	function getViewer(): SceneViewer | null {
		return (viewport.value as ViewportExposed | null)?.getViewer() ?? null;
	}

	function runViewer(fn: (v: SceneViewer) => void): void {
		const v = getViewer();
		if (v) fn(v);
	}

	// ── Sub-composables ──────────────────────────────────────────────

	const polling = usePolling(
		() => workcell.connectedSystems,
		(sysName, angles) => runViewer(v => v.updateJointAngles(sysName, angles)),
		(sysName, position, quaternion) => {
			// A reply can arrive after the system was disconnected; don't redraw its frame.
			if (!workcell.connectedSystems.includes(sysName)) return;
			runViewer(v => v.setTcpPoseFrame(sysName, position, quaternion));
		},
	);

	// Remove the live TCP frame of each system that is no longer connected.
	watch(() => workcell.connectedSystems, (now, before) => {
		for (const sysName of before ?? []) {
			if (!now.includes(sysName)) runViewer(v => v.removeTcpPoseFrame(sysName));
		}
	});

	const ikDrag = useIkDrag(getViewer, runViewer);

	const draw = useDrawMode({
		runViewer,
		getSelectedName: () => selection.item?.data?.name,
		setSelectedItem: (item) => { selection.item = item; },
		getWorkcellName: () => workcell.name,
		addPathToTree: (parent, name) => treeOps.addPath(parent, name),
		addAreaToTree: (parent, name) => {
			treeOps.addArea(parent, name);
			runViewer(v => v.setAreaParent(name, parent));
		},
	});

	// ── API Helper ───────────────────────────────────────────────────

	function fetchSystemDetails(name: string) {
		return apiGet(`/api/systems/${encodeURIComponent(name)}/info`);
	}

	// ── Event Handlers ───────────────────────────────────────────────

	function handleAddGroup(name: string, group: any, parentSystemName?: string, parentLinkName?: string) {
		runViewer(v => v.addGroup(name, group, parentSystemName, parentLinkName));
	}

	function handleRemoveGroup(name: string) {
		runViewer(v => {
			const removed = v.removeGroup(name);
			console.debug(`removeGroup("${name}") -> ${removed}`);
		});
	}

	function handleGetGroupWorldPose(name: string) {
		return getViewer()?.getGroupWorldPose(name);
	}

	function handleSetGroupPose(name: string, position: [number, number, number], quaternion: [number, number, number, number]) {
		runViewer(v => v.setGroupPose(name, position, quaternion));
	}

	function handleRemoveChild(payload: { name: string; type: string; category?: string; parentName: string }) {
		if (payload.category === 'target') {
			const wcName = workcell.name;
			if (wcName) {
				apiDelete(`/api/targets/${encodeURIComponent(wcName)}/${encodeURIComponent(payload.name)}`).catch(err =>
					console.error(`Failed to remove target '${payload.name}':`, err)
				);
			}
		} else if (payload.category === 'area') {
			const wcName = workcell.name;
			if (wcName) {
				apiDelete(`/api/${encodeURIComponent(wcName)}/areas/${encodeURIComponent(payload.name)}`).catch(err =>
					console.error(`Failed to remove area '${payload.name}':`, err)
				);
			}
		} else if (payload.category === 'ptp-trajectory') {
			apiDelete(`/api/ptp-trajectories/${encodeURIComponent(payload.name)}`).catch(err =>
				console.error(`Failed to remove PTP trajectory '${payload.name}':`, err)
			);
		} else if (payload.category === 'linear-trajectory') {
			const wcName = workcell.name;
			if (wcName) {
				apiDelete(`/api/workcells/${encodeURIComponent(wcName)}/linear-trajectories/${encodeURIComponent(payload.name)}`).catch(err =>
					console.error(`Failed to remove linear trajectory '${payload.name}':`, err)
				);
			}
		} else {
			const wcName = workcell.name;
			const pathDeleteUrl = wcName
				? `/api/path/${encodeURIComponent(payload.name)}?workcellName=${encodeURIComponent(wcName)}`
				: `/api/path/${encodeURIComponent(payload.name)}`;
			apiDelete(pathDeleteUrl).catch(err =>
				console.error(`Failed to remove toolpath '${payload.name}':`, err)
			);
		}
		runViewer(v => v.removeGroup(payload.name));
		if (draw.visiblePathName.value === payload.name) {
			draw.visiblePathName.value = null;
		}
		if (selection.item?.data?.name === payload.name) {
			selection.item = null;
			draw.selectionPoints.value = [];
			runViewer(v => v.clearAllMarkers());
		}
	}

	function handleClearSelection() {
		selection.item = null;
		selection.jointNames = null;
		selection.tcpLinkNames = null;
		draw.selectionPoints.value = [];
		polling.pauseSystem(null);
		if (draw.visiblePathName.value) {
			runViewer(v => v.setGroupVisible(draw.visiblePathName.value!, false));
			draw.visiblePathName.value = null;
		}
		runViewer(v => {
			v.clearAllMarkers();
			v.clearHighlight();
		});
	}

	function handleSetupActive(view: string | null, systemName?: string) {
		ui.setupActive = view !== null;
		// systemName is only passed by useSceneTreeSetup for views whose preview
		// (target pose, IK/trajectory solve) would otherwise be immediately
		// overwritten by live joint-angle polling.
		polling.pauseSystem(systemName ?? null);
		if (!view) runViewer(v => v.detachTransformControls());
	}

	function handleSetupLoading(loading: boolean) {
		setupLoading.value = loading;
	}

	function handleFocusItem(name: string, type?: string) {
		if (type === 'system') return;
		runViewer(v => v.focusObject(name));
	}

	function handleClearScene() {
		treeOps.clearAll();
		selection.item = null;
		draw.selectionPoints.value = [];
		draw.visiblePathName.value = null;
		workcell.connectedSystems = [];
		workcell.sceneObjectTypes.clear();
		polling.stopPolling();
		runViewer(v => {
			v.clearHighlight();
			v.resetView();
		});
	}

	async function handleSelectItem(payload: { name: string; type: string; parentName?: string }) {
		// Resume live polling that may have been paused for a previously selected target.
		polling.pauseSystem(null);

		selection.loading = true;
		selection.item = null;
		selection.jointNames = null;
		selection.tcpLinkNames = null;
		draw.selectionPoints.value = [];
		runViewer(v => {
			v.clearAllMarkers();
			v.clearHighlight();
		});

		try {
			if (payload.type === 'system') {
				const info: any = await fetchSystemDetails(payload.name);
				selection.item = { type: 'system', data: info };
				runViewer(v => {
					selection.jointNames = v.getJointNames(payload.name) ?? null;
					selection.prismaticJointNames = v.getPrismaticJointNames(payload.name);
					selection.tcpLinkNames = v.getTcpLinkNames(payload.name) ?? null;
				});
			} else if (payload.type === 'path') {
				runViewer(v => {
					if (draw.visiblePathName.value && draw.visiblePathName.value !== payload.name) {
						v.setGroupVisible(draw.visiblePathName.value, false);
					}
					v.setGroupVisible(payload.name, true);
				});
				draw.visiblePathName.value = payload.name;
				selection.item = { type: 'path', data: { name: payload.name } };
			} else if (payload.type === 'target') {
				runViewer(v => {
					if (draw.visiblePathName.value) v.setGroupVisible(draw.visiblePathName.value, false);
				});
				draw.visiblePathName.value = null;

				const wcName = workcell.name;
				const sysName = payload.parentName ?? '';
				let targetData: any = { name: payload.name, systemName: sysName };
				if (wcName) {
					try {
						targetData = await apiGet(
							`/api/targets/${encodeURIComponent(wcName)}/${encodeURIComponent(payload.name)}`,
						);
					} catch {
						// Use fallback data
					}
				}

				if (sysName) {
					try {
						const info: any = await fetchSystemDetails(sysName);
						targetData._manipulatorName = info?.manipulator?.name || undefined;
						targetData._externalAxisName = info?.externalAxis?.name || undefined;
					} catch {
						// Non-critical – panel will fall back to flat list
					}
					runViewer(v => {
						targetData._jointNames = v.getJointNames(sysName) ?? undefined;
						targetData._prismaticJointNames = v.getPrismaticJointNames(sysName);

						// Apply the target's saved joint angles to the 3-D visualizer.
						const rawAngles = targetData.jointAngles;
						const names: string[] = targetData._jointNames ?? [];
						if (rawAngles && names.length > 0) {
							let anglesDict: Record<string, number>;
							if (Array.isArray(rawAngles)) {
								anglesDict = {};
								for (let i = 0; i < Math.min(rawAngles.length, names.length); i++) {
									anglesDict[names[i]] = rawAngles[i];
								}
							} else {
								anglesDict = rawAngles as Record<string, number>;
							}
							if (Object.keys(anglesDict).length > 0) {
								v.updateJointAngles(sysName, anglesDict);
							}
						}
					});

					// Pause live polling so the visualizer holds the target pose.
					polling.pauseSystem(sysName);
				}

				selection.item = { type: 'target', data: targetData };
			} else if (payload.type === 'area') {
				runViewer(v => {
					if (draw.visiblePathName.value) v.setGroupVisible(draw.visiblePathName.value, false);
				});
				draw.visiblePathName.value = null;
				selection.item = { type: 'area', data: { name: payload.name, parentName: payload.parentName } };
				runViewer(v => {
					v.setGroupVisible(payload.name, true);
					v.highlightObject(payload.name);
				});
			} else if (payload.type === 'camera') {
				runViewer(v => {
					if (draw.visiblePathName.value) v.setGroupVisible(draw.visiblePathName.value, false);
				});
				draw.visiblePathName.value = null;
				const cfg: any = await apiGet(`/api/cameras/${encodeURIComponent(payload.name)}/config`);
				selection.item = { type: 'camera', data: cfg };
				runViewer(v => v.highlightObject(payload.name));
			} else if (payload.type === 'ptp-trajectory') {
				runViewer(v => {
					if (draw.visiblePathName.value) v.setGroupVisible(draw.visiblePathName.value, false);
				});
				draw.visiblePathName.value = null;
				selection.item = { type: payload.type as any, data: { name: payload.name, systemName: payload.parentName } };
				// Pause live polling so trajectory playback/scrubbing isn't fought by
				// the real robot's live joint angles while the system is connected.
				if (payload.parentName) polling.pauseSystem(payload.parentName);
			} else if (payload.type === 'linear-trajectory') {
				runViewer(v => {
					if (draw.visiblePathName.value) v.setGroupVisible(draw.visiblePathName.value, false);
				});
				draw.visiblePathName.value = null;
				selection.item = { type: payload.type as any, data: { name: payload.name, systemName: payload.parentName, workcellName: workcell.name } };
				if (payload.parentName) polling.pauseSystem(payload.parentName);
			} else {
				runViewer(v => {
					if (draw.visiblePathName.value) v.setGroupVisible(draw.visiblePathName.value, false);
				});
				draw.visiblePathName.value = null;
				const visualType = workcell.sceneObjectTypes.get(payload.name) || 'mesh';
				let pose: any = null;
				try {
					pose = await apiGet(`/api/scene-objects/${encodeURIComponent(payload.name)}/pose`);
				} catch {
					// Pose is optional; the editor shows values once available.
				}
				selection.item = { type: 'scene-object', data: { name: payload.name, visualType, pose } };
			}
		} catch (err: any) {
			showToast(err.message || String(err), 'error');
		} finally {
			selection.loading = false;
		}
	}

	function handleJointAnglesChange(payload: { systemName: string; jointAngles: Record<string, number> }) {
		runViewer(v => v.updateJointAngles(payload.systemName, payload.jointAngles));
	}

	function handleGetLinkPose(systemName: string, linkName: string) {
		return getViewer()?.getLinkBasePose(systemName, linkName) ?? null;
	}

	function handleGetLinkWorldPose(systemName: string, linkName: string) {
		return getViewer()?.getLinkWorldPose(systemName, linkName) ?? null;
	}

	function handleGetCurrentJointAngles(systemName: string) {
		return getViewer()?.getCurrentJointAngles(systemName) ?? null;
	}

	function handleGetJointNames(systemName: string) {
		return getViewer()?.getJointNames(systemName) ?? null;
	}

	function handleGetJointLimits(systemName: string) {
		return getViewer()?.getJointLimits(systemName) ?? undefined;
	}

	function handleSystemAdded(name: string) {
		treeOps.addItem(name, 'system');
		workcell.active = true;
	}

	function handleSceneObjectAdded(name: string, visualType?: 'primitive' | 'mesh') {
		treeOps.addItem(name, 'scene-object');
		if (visualType) workcell.sceneObjectTypes.set(name, visualType);
		workcell.active = true;
	}

	function handleCameraAdded(name: string) {
		treeOps.addItem(name, 'camera');
		workcell.active = true;
	}

	function handleAreaAdded(parentName: string, areaName: string) {
		treeOps.addArea(parentName, areaName);
		runViewer(v => v.setAreaParent(areaName, parentName));
	}

	async function handleReloadMesh(name: string, meshUrl: string) {
		try {
			const group = await loadMeshFromUrl(meshUrl, 'obj');
			runViewer(v => v.addGroup(name, group));
		} catch (err) {
			console.error(`Failed to reload mesh for "${name}":`, err);
		}
	}

	async function handleFilteredObjectAdded(name: string, meshUrl: string) {
		// The live CHANGE_ADDED scene event for this object may race with this
		// creation flow and win, already adding it to the tree + viewer.
		const alreadyAdded = treeOps.hasItem(name);
		treeOps.addItem(name, 'scene-object');
		workcell.sceneObjectTypes.set(name, 'mesh');
		if (alreadyAdded) return;
		try {
			const group = await loadMeshFromUrl(meshUrl, 'obj');
			runViewer(v => v.addGroup(name, group));
		} catch (err) {
			console.error(`Failed to load filtered object "${name}":`, err);
		}
	}

	function handleShowBboxPreview(
		center: { x: number; y: number; z: number },
		orientation: { x: number; y: number; z: number; w: number },
		extents: { x: number; y: number; z: number },
		parentSystemName?: string,
		parentLinkName?: string,
	) {
		runViewer(v => v.showBboxPreview(center, orientation, extents, parentSystemName, parentLinkName));
	}

	function handleHideBboxPreview() {
		runViewer(v => v.hideBboxPreview());
	}

	function handleAddPathViewer(
		pathName: string,
		waypoints: Array<{ pose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } }>,
		renderOnTop: boolean = true,
		showFrames: boolean = true,
	) {
		runViewer(v => v.addPath(pathName, waypoints, renderOnTop, showFrames));
	}

	function handlePathAddedToTree(parentName: string, pathName: string) {
		treeOps.addPath(parentName, pathName);
	}

	function handleTargetAdded(systemName: string, targetName: string) {
		treeOps.addTarget(systemName, targetName);
	}

	function handlePtpTrajectoryAdded(systemName: string, trajectoryName: string) {
		treeOps.addPtpTrajectory(systemName, trajectoryName);
	}

	function handleLinearTrajectoryAdded(systemName: string, trajectoryName: string) {
		treeOps.addLinearTrajectory(systemName, trajectoryName);
	}

	const _tempVisualizePaths = ref<string[]>([]);

	function _cleanupTempVisualizePaths() {
		for (const name of _tempVisualizePaths.value) {
			runViewer(v => v.removeGroup(name));
			treeOps.removeItemByName(name);
		}
		_tempVisualizePaths.value = [];
	}

	function handleCleanupVisualizePaths() {
		_cleanupTempVisualizePaths();
		runViewer(v => v.clearHighlight());
	}

	interface RasterPayload {
		name: string;
		areaName: string;
		parentName: string;
		fixedSpacing: number;
		blendingRadius: number;
		borderOffset: number;
		rasterLineSpacing: number;
		rasterJoiningThreshold: number;
		directionType: 'principal' | 'specified';
		principalRotationAngle: number;
		specifiedDirection: { x: number; y: number; z: number };
		orientationAlignmentType?: string;
		orientationAlignmentDirection?: { x: number; y: number; z: number };
	}

	async function _generateRasterPath(payload: RasterPayload, persistWorkcellName?: string) {
		return apiPost<{
			paths: Array<{
				pathName: string;
				CartesianWaypoints: Array<{
					position: { x: number; y: number; z: number };
					rotation?: { x: number; y: number; z: number; w: number };
				}>;
			}>;
			status: { code: number; message: string };
		}>('/api/path/generate-raster', {
			pathNameRef: payload.name,
			parentObjectName: payload.areaName,
			activeWorkcellName: workcell.name || '',
			fixedSpacing: payload.fixedSpacing,
			blendingRadius: payload.blendingRadius,
			borderOffset: payload.borderOffset,
			rasterLineSpacing: payload.rasterLineSpacing,
			rasterJoiningThreshold: payload.rasterJoiningThreshold,
			directionType: payload.directionType,
			principalRotationAngle: payload.principalRotationAngle,
			specifiedDirection: payload.specifiedDirection,
			workcellName: persistWorkcellName ?? '',
			orientationAlignmentType: payload.orientationAlignmentType ?? 'initial_direction',
			orientationAlignmentDirection: payload.orientationAlignmentDirection ?? { x: 1.0, y: 0.0, z: 0.0 },
		});
	}

	async function handleVisualizeToolpath(payload: RasterPayload) {
		_cleanupTempVisualizePaths();
		try {
			const result = await _generateRasterPath(payload);
			if (result.status?.code !== 0) {
				console.error('Raster toolpath generation failed:', result.status?.message);
				showToast(t('setup.path.error.createFailed', { message: result.status?.message ?? '' }), 'error');
				return;
			}
			const newPaths = result.paths ?? [];
			_tempVisualizePaths.value = newPaths.map(p => p.pathName);
			for (const p of newPaths) {
				const waypoints = p.CartesianWaypoints.map(wp => ({
					pose: {
						position: wp.position,
						rotation: wp.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
					},
				}));
				handleAddPathViewer(p.pathName, waypoints);
				runViewer(v => v.setGroupVisible(p.pathName, true));
				handlePathAddedToTree(payload.parentName, p.pathName);
			}
		} catch (err: any) {
			console.error('Failed to generate raster toolpath:', err);
			showToast(t('setup.path.error.createFailed', { message: err?.message ?? String(err) }), 'error');
		}
	}

	const _highlightedLinearPath = ref<string | null>(null);

	function handleVisualizePath(pathName: string) {
		if (_highlightedLinearPath.value) {
			runViewer(v => {
				v.clearHighlight();
				v.setGroupVisible(_highlightedLinearPath.value!, false);
			});
			_highlightedLinearPath.value = null;
		}
		if (!pathName) return;
		runViewer(v => {
			v.setGroupVisible(pathName, true);
			v.highlightObject(pathName);
		});
		_highlightedLinearPath.value = pathName;
	}

	/** Creates raster paths over an area. Returns whether they were created; on failure, shows why. */
	async function handleGenerateFromAreaPath(payload: RasterPayload): Promise<boolean> {
		try {
			const result = await _generateRasterPath(payload, workcell.name || undefined);
			if (result.status?.code !== 0) {
				console.error('Generate from area failed:', result.status?.message);
				showToast(t('setup.path.error.createFailed', { message: result.status?.message ?? '' }), 'error');
				return false;
			}
			_cleanupTempVisualizePaths();
			for (const p of result.paths ?? []) {
				const waypoints = p.CartesianWaypoints.map(wp => ({
					pose: {
						position: wp.position,
						rotation: wp.rotation ?? { x: 0, y: 0, z: 0, w: 1 },
					},
				}));
				handleAddPathViewer(p.pathName, waypoints);
				runViewer(v => v.setGroupVisible(p.pathName, true));
				handlePathAddedToTree(payload.parentName, p.pathName);
			}
			return true;
		} catch (err: any) {
			console.error('Failed to generate from area path:', err);
			showToast(t('setup.path.error.createFailed', { message: err?.message ?? String(err) }), 'error');
			return false;
		}
	}

	// ── Live scene events (SDK SceneEventService → WebSocket) ────────

	const sceneEvents = useSceneEvents(handleSceneEvent);

	function handleSceneEvent(evt: SceneEventMessage) {
		try {
			if (evt.change === 'CHANGE_REFRESHED') {
				// Ignore refreshes that are just the echo of a load we just triggered
				// ourselves (dialog load or resync below) - otherwise this loops forever.
				if (Date.now() < workcellLoadSignal.suppressRefreshUntil) return;
				resyncWorkcell();
				return;
			}
			// Only scene objects are handled here; ignore CONFIG events for
			// other config types (systems, cameras, coordinates, paths, …).
			if (evt.entity && evt.entity.type !== 'CONFIG_TYPE_OBJECT') return;

			if (evt.change === 'CHANGE_ADDED') {
				const name = evt.entity?.name || evt.frames[0];
				// Idempotent: skip objects we already show (e.g. our own creates).
				if (name && !treeOps.hasItem(name)) void _addObjectFromEvent(name);
			} else if (evt.change === 'CHANGE_REMOVED') {
				const name = evt.entity?.name || evt.frames[0];
				if (name) _removeObjectFromEvent(name);
			} else if (evt.change === 'CHANGE_RENAMED') {
				const oldName = evt.entity?.name || evt.frames[0];
				if (oldName) _removeObjectFromEvent(oldName);
				if (evt.new_name && !treeOps.hasItem(evt.new_name)) void _addObjectFromEvent(evt.new_name);
			} else if (evt.change === 'CHANGE_UPDATED') {
				// CONFIG updates name the entity; FRAME updates name the frames.
				const names = evt.entity?.name ? [evt.entity.name] : evt.frames;
				for (const name of names) {
					if (treeOps.hasItem(name)) void _updateObjectPoseFromEvent(name);
				}
			}
		} catch (err) {
			console.error('Failed to handle scene event:', err);
		}
	}

	async function _addObjectFromEvent(name: string) {
		try {
			const info: any = await apiGet(`/api/scene-objects/${encodeURIComponent(name)}`);
			if (info.visualType === 'mesh' && info.meshUrl) {
				const group = await loadMeshFromUrl(info.meshUrl, 'obj');
				runViewer(v => v.addGroup(name, group));
			} else if (info.visualType === 'primitive' && info.box?.size?.length === 3) {
				const group = buildBoxGroup(info.box.size as [number, number, number]);
				runViewer(v => v.addGroup(name, group));
			}
			const pose = info.pose;
			const visualType = info.visualType === 'primitive' ? 'primitive' : 'mesh';
			if (pose?.position && pose?.quaternion) {
				runViewer(v => v.setGroupPose(name, pose.position, pose.quaternion));
			}
			handleSceneObjectAdded(name, visualType);
			// This object may already have been selected before this (re)load —
			// e.g. a workflow node refreshing it in place — so keep the object
			// editor panel's cached pose/visualType from going stale, mirroring
			// _updateObjectPoseFromEvent's selection refresh below.
			if (selection.item?.type === 'scene-object' && selection.item.data?.name === name) {
				if (pose) selection.item.data.pose = pose;
				selection.item.data.visualType = visualType;
			}
		} catch (err) {
			console.error(`Failed to add scene object "${name}" from event:`, err);
		}
	}

	async function _updateObjectPoseFromEvent(name: string) {
		try {
			const pose: any = await apiGet(`/api/scene-objects/${encodeURIComponent(name)}/pose`);
			if (pose?.position && pose?.quaternion) {
				runViewer(v => v.setGroupPose(name, pose.position, pose.quaternion));
				// Live-refresh the object editor if this object is selected.
				if (selection.item?.type === 'scene-object' && selection.item.data?.name === name) {
					selection.item.data.pose = pose;
				}
			}
		} catch (err) {
			console.error(`Failed to update pose for "${name}" from event:`, err);
		}
	}

	function _removeObjectFromEvent(name: string) {
		treeOps.removeItemByNameSilent(name);
		runViewer(v => v.removeGroup(name));
		workcell.sceneObjectTypes.delete(name);
		if (selection.item?.data?.name === name) {
			selection.item = null;
			runViewer(v => v.clearAllMarkers());
		}
	}

	function resyncWorkcell() {
		const name = workcell.name;
		if (!name) return;
		const dialogState = { workcells: [], selectedName: name, loading: false, deleting: false, creating: false };
		void loadSelectedWorkcell(
			dialogState,
			onLoadWorkcell,          // onLoad
			() => { /* onClose: no dialog to close */ },
			handleAddGroup,
			handleSystemAdded,
			handleSceneObjectAdded,
			handleClearScene,        // onClear (clears tree + viewer first)
			handleAddPathViewer,
			handlePathAddedToTree,
			handleTargetAdded,
			handleAreaAdded,
			handleGetGroupWorldPose,
			handleSetGroupPose,
			handlePtpTrajectoryAdded,
			handleLinearTrajectoryAdded,
			handleCameraAdded,
		);
	}

	function onLoadWorkcell(name: string) {
		ui.showWorkcellDialog = false;
		workcell.name = name;
		workcell.active = true;
		if (ui.sceneEventsActive) sceneEvents.connect();   // only if the user turned live events on
		console.debug('Load workcell:', name);
	}

	// Toggled from the top menu; off by default. Connects/disconnects the
	// scene-event WebSocket directly (independent of workcell load timing).
	async function handleToggleSceneEvents() {
		if (!ui.sceneEventsActive) {
			const ok = await confirm(t('app.nav.liveSceneEventsConfirm'));
			if (!ok) return;
		}
		ui.sceneEventsActive = !ui.sceneEventsActive;
		if (ui.sceneEventsActive) {
			sceneEvents.connect();
			resyncWorkcell();   // pull latest state in case it drifted while events were off
		} else {
			sceneEvents.disconnect();
		}
	}

	// ── Public API ───────────────────────────────────────────────────

	return {
		// singletons
		selection,
		workcell,
		// ui
		ui,
		setupLoading,
		// draw mode state (spread for template access)
		pathOnMeshActive: draw.pathOnMeshActive,
		freeSketchObjectName: draw.freeSketchObjectName,
		selectionPoints: draw.selectionPoints,
		areaDrawActive: draw.areaDrawActive,
		freeDrawObjectName: draw.freeDrawObjectName,
		areaSelectionPoints: draw.areaSelectionPoints,
		visiblePathName: draw.visiblePathName,
		// viewer access
		getViewer,
		// orchestration handlers
		handleAddGroup,
		handleRemoveGroup,
		handleGetGroupWorldPose,
		handleSetGroupPose,
		handleRemoveChild,
		handleSetupActive,
		handleSetupLoading,
		handleFocusItem,
		handleClearScene,
		handleSelectItem,
		handleJointAnglesChange,
		handleGetLinkPose,
		handleGetLinkWorldPose,
		handleGetCurrentJointAngles,
		handleGetJointNames,
		handleGetJointLimits,
		handleClearSelection,
		handleSystemAdded,
		handleSceneObjectAdded,
		handleCameraAdded,
		handleAreaAdded,
		handleReloadMesh,
		handleFilteredObjectAdded,
		handleShowBboxPreview,
		handleHideBboxPreview,
		handleAddPathViewer,
		handlePathAddedToTree,
		handleTargetAdded,
		handlePtpTrajectoryAdded,
		handleLinearTrajectoryAdded,
		onLoadWorkcell,
		handleToggleSceneEvents,
		// draw mode handlers (forwarded)
		handleFreeSketchMode: draw.handleFreeSketchMode,
		handleFreeDrawMode: draw.handleFreeDrawMode,
		handleVisualizeToolpath,
		handleVisualizePath,
		handleGenerateFromAreaPath,
		handleCleanupVisualizePaths,
		handleResetView: draw.handleResetView,
		handlePointAdded: draw.handlePointAdded,
		handleClearPoints: draw.handleClearPoints,
		handleAreaPointAdded: draw.handleAreaPointAdded,
		handleClearAreaPoints: draw.handleClearAreaPoints,
		handleGeneratePathFromDialog: draw.handleGeneratePathFromDialog,
		handleGenerateAreaFromDialog: draw.handleGenerateAreaFromDialog,
		// IK drag handler (forwarded)
		handleTcpDragToggle: ikDrag.handleTcpDragToggle,
		tcpMenu: ikDrag.tcpMenu,
		setTcpMode: ikDrag.setTcpMode,
	};
}
