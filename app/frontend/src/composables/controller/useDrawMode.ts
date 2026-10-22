import { ref, type Ref } from 'vue';
import type { SceneViewer } from '../../services/viewer/sceneViewer';
import type { ObjectType } from '../../types';
import { loadMeshFromUrl } from '../../services/sceneLoader';
import { apiPost, apiDelete } from '../../services/api';
import { useToast } from '../useToast';
import { useI18n } from '../useI18n';

type Point3 = { x: number; y: number; z: number };

// ── useDrawMode ───────────────────────────────────────────────────────
// Owns all reactive state and event handlers for path-on-mesh sketching
// and area free-draw.

export interface DrawModeOptions {
	runViewer: (fn: (v: SceneViewer) => void) => void;
	/** Returns the name of the currently selected scene object, if any. */
	getSelectedName: () => string | undefined;
	/** Allows the draw mode to update the global selection (e.g. on free-sketch activation). */
	setSelectedItem: (item: { type: ObjectType; data: any } | null) => void;
	/** Returns the active workcell name (used in area extract API call). */
	getWorkcellName: () => string;
	addPathToTree: (parentName: string, pathName: string) => void;
	addAreaToTree: (parentName: string, areaName: string) => void;
}

export function useDrawMode(opts: DrawModeOptions) {
	const { runViewer, getSelectedName, setSelectedItem, getWorkcellName, addPathToTree, addAreaToTree } = opts;
	const { showToast } = useToast();
	const { t } = useI18n();

	// ── State ────────────────────────────────────────────────────────

	const pathOnMeshActive = ref(false);
	const freeSketchObjectName = ref<string | null>(null);
	const selectionPoints = ref<Point3[]>([]);
	const visiblePathName = ref<string | null>(null);

	const areaDrawActive = ref(false);
	const freeDrawObjectName = ref<string | null>(null);
	const areaSelectionPoints = ref<Point3[]>([]);

	// ── Path Sketch ──────────────────────────────────────────────────

	function handleFreeSketchMode(payload: { active: boolean; parentName?: string }): void {
		const parentName = payload.parentName;
		if (payload.active && parentName) {
			freeSketchObjectName.value = parentName;
			pathOnMeshActive.value = true;
			selectionPoints.value = [];
			visiblePathName.value = null;
			setSelectedItem({ type: 'scene-object', data: { name: parentName, visualType: 'mesh' } });
			runViewer(v => v.focusObject(parentName));
		} else {
			freeSketchObjectName.value = null;
			pathOnMeshActive.value = false;
			selectionPoints.value = [];
			visiblePathName.value = null;
			runViewer(v => {
				v.clearAllMarkers();
				v.resetView();
			});
		}
	}

	function handleResetView(): void {
		pathOnMeshActive.value = false;
		selectionPoints.value = [];
		visiblePathName.value = null;
		runViewer(v => {
			v.clearAllMarkers();
			v.resetView();
		});
	}

	async function handlePointAdded(point: Point3): Promise<void> {
		const name = getSelectedName();
		if (!name) return;

		selectionPoints.value = [...selectionPoints.value, point];
		const idx = selectionPoints.value.length - 1;

		if (idx > 0) {
			const prev = selectionPoints.value[idx - 1];
			try {
				const data = await apiPost<any>('/api/path/generate-between-points', {
					parentObjectName: name,
					from: prev,
					to: point,
					fixedSpacing: 0.01,
				});
				const intermediates = data.intermediatePoints ?? [];
				runViewer(v => v.addIntermediateMarkers(name, intermediates));
			} catch (err) {
				console.error('Failed to generate intermediate points:', err);
			}
		}

		runViewer(v => v.addMarker(name, point));
	}

	function handleClearPoints(): void {
		const name = getSelectedName();
		selectionPoints.value = [];
		if (name) runViewer(v => v.clearMarkers(name));
	}

	/** Creates the sketched path. Returns whether a path was created; on failure, shows why and keeps the waypoints. */
	async function handleGeneratePathFromDialog(payload: { name: string; pointSpacing: number; blendingRadius: number; orientationAlignmentType?: string; orientationAlignmentDirection?: { x: number; y: number; z: number } }): Promise<boolean> {
		const parentName = getSelectedName();
		if (!parentName) return false;
		const points = [...selectionPoints.value];
		if (points.length < 2) {
			showToast(t('setup.path.error.notEnoughWaypoints'), 'warning');
			return false;
		}

		try {
			const data = await apiPost<any>('/api/path/generate-from-points', {
				parentObjectName: parentName,
				pathNameRef: payload.name,
				points,
				blendingRadius: payload.blendingRadius,
				fixedSpacing: payload.pointSpacing,
				workcellName: getWorkcellName(),
				flagAutoName: false,
				orientationAlignmentType: payload.orientationAlignmentType ?? 'initial_direction',
				orientationAlignmentDirection: payload.orientationAlignmentDirection ?? { x: 1.0, y: 0.0, z: 0.0 },
			});
			const pathName = data.pathName as string | undefined;
			if (!pathName) throw new Error('No path was returned.');
			runViewer(v => v.clearMarkers(parentName));
			selectionPoints.value = [];
			addPathToTree(parentName, pathName);
			const waypoints = (data.CartesianWaypoints ?? []).map((wp: any) => ({ pose: wp }));
			runViewer(v => v.addPath(pathName, waypoints));
			return true;
		} catch (err: any) {
			console.error('Failed to generate path from dialog:', err);
			showToast(t('setup.path.error.createFailed', { message: err?.message ?? String(err) }), 'error');
			return false;
		}
	}

	// ── Area Free Draw ───────────────────────────────────────────────

	function handleFreeDrawMode(payload: { active: boolean; parentName?: string }): void {
		const parentName = payload.parentName ?? null;
		if (payload.active && parentName) {
			freeDrawObjectName.value = parentName;
			areaDrawActive.value = true;
			areaSelectionPoints.value = [];
			runViewer(v => v.focusObject(parentName));
		} else {
			const nameToClean = freeDrawObjectName.value;
			freeDrawObjectName.value = null;
			areaDrawActive.value = false;
			areaSelectionPoints.value = [];
			if (nameToClean) runViewer(v => {
				v.clearMarkers(nameToClean);
				v.clearMarkers(nameToClean + '__close');
			});
		}
	}

	function handleClearAreaPoints(): void {
		const name = freeDrawObjectName.value;
		areaSelectionPoints.value = [];
		if (name) runViewer(v => {
			v.clearMarkers(name);
			v.clearMarkers(name + '__close');
		});
	}

	async function handleAreaPointAdded(point: Point3): Promise<void> {
		const name = freeDrawObjectName.value;
		if (!name) return;

		areaSelectionPoints.value = [...areaSelectionPoints.value, point];
		const points = areaSelectionPoints.value;
		const idx = points.length - 1;
		const closeKey = name + '__close';

		runViewer(v => v.addMarker(name, point));

		const generateSegment = async (segKey: string, from: Point3, to: Point3): Promise<void> => {
			try {
				const data = await apiPost<any>('/api/path/generate-between-points', {
					parentObjectName: name,
					from,
					to,
					fixedSpacing: 0.01,
				});
				const pn = data.pathName as string | undefined;
				const intermediates = data.intermediatePoints ?? [];
				runViewer(v => v.addIntermediateMarkers(segKey, intermediates));
				if (pn) {
					apiDelete(`/api/path/${encodeURIComponent(pn)}`).catch(err =>
						console.error(`Failed to remove temp area path '${pn}':`, err)
					);
				}
			} catch (err) {
				console.error('Failed to generate intermediate area points:', err);
			}
		};

		const tasks: Promise<void>[] = [];
		if (idx > 0) tasks.push(generateSegment(name, points[idx - 1], point));
		if (points.length >= 3) {
			runViewer(v => v.clearMarkers(closeKey));
			tasks.push(generateSegment(closeKey, point, points[0]));
		}
		await Promise.all(tasks);
	}

	/** Extracts the drawn area. Returns whether an area was created; on failure, shows why and keeps the points. */
	async function handleGenerateAreaFromDialog(payload: { name: string; parentName: string }): Promise<boolean> {
		const { name: areaName, parentName } = payload;
		const boundary = [...areaSelectionPoints.value];
		if (boundary.length < 3) {
			showToast(t('setup.area.error.notEnoughPoints'), 'warning');
			return false;
		}

		try {
			const data = await apiPost<any>(
				`/api/scene-objects/${encodeURIComponent(parentName)}/extract-area`,
				{ areaName, boundary, workcellName: getWorkcellName() },
			);
			const extractedName = data.extracted_object as string | undefined;
			const meshUrl = data.meshUrl as string | undefined;
			if (!extractedName) throw new Error('No area was returned.');
			runViewer(v => {
				v.clearMarkers(parentName);
				v.clearMarkers(parentName + '__close');
			});
			areaSelectionPoints.value = [];
			addAreaToTree(parentName, extractedName);
			if (meshUrl) await showAreaMesh(extractedName, parentName, meshUrl);
			return true;
		} catch (err: any) {
			console.error('Failed to extract area:', err);
			showToast(t('setup.area.error.createFailed', { message: err?.message ?? String(err) }), 'error');
			return false;
		}
	}

	/** Draws a created area's mesh. The area already exists, so a failure here is only logged. */
	async function showAreaMesh(areaName: string, parentName: string, meshUrl: string): Promise<void> {
		try {
			const group = await loadMeshFromUrl(meshUrl, 'obj');
			runViewer(v => v.addGroup(areaName, group));
			// The extracted mesh's vertices are already in the parent's own
			// local frame (an identity offset), so place it at the parent's
			// current world pose rather than one returned by the server.
			let parentPose: ReturnType<SceneViewer['getGroupWorldPose']>;
			runViewer(v => { parentPose = v.getGroupWorldPose(parentName); });
			if (parentPose) {
				runViewer(v => v.setGroupPose(areaName, parentPose!.position, parentPose!.quaternion));
			}
		} catch (err) {
			console.error(`Failed to load mesh of area '${areaName}':`, err);
		}
	}

	// ── Public API ───────────────────────────────────────────────────

	return {
		// state
		pathOnMeshActive,
		freeSketchObjectName,
		selectionPoints,
		visiblePathName,
		areaDrawActive,
		freeDrawObjectName,
		areaSelectionPoints,
		// handlers
		handleFreeSketchMode,
		handleFreeDrawMode,
		handleResetView,
		handlePointAdded,
		handleClearPoints,
		handleAreaPointAdded,
		handleClearAreaPoints,
		handleGeneratePathFromDialog,
		handleGenerateAreaFromDialog,
	};
}

export type DrawMode = ReturnType<typeof useDrawMode>;
