import { reactive } from 'vue';
import type { SceneViewer } from '../../services/viewer/sceneViewer';
import { quatToRpy } from '../../services/kinematics';
import { apiPost } from '../../services/api';
import type { TcpMode } from '../../types';
import { radToDeg } from '../../utils/math';

// ── useIkDrag ─────────────────────────────────────────────────────────
// Manages TCP drag via TransformControls + online IK solving.
// Attach/detach is driven by handleTcpDragToggle; IK calls are
// fire-and-forget with a solving guard to avoid overlapping requests.
// The context menu state (tcpMenu) is reactive so App.vue can render
// a Vue component instead of the former inline DOM menu in SceneViewer.

export function useIkDrag(
	getViewer: () => SceneViewer | null,
	runViewer: (fn: (v: SceneViewer) => void) => void,
) {
	let _solving = false;

	const tcpMenu = reactive({
		visible: false,
		x: 0,
		y: 0,
		currentMode: 'translate' as TcpMode,
	});

	async function _onDragChange(
		pos: { x: number; y: number; z: number },
		quat: { x: number; y: number; z: number; w: number },
		systemName: string,
		tcpLinkName: string,
		onSuccess?: () => void,
		getNullspaceParams?: () => { elbowSwivelAngle: number; externalAxisPosition?: number[]; externalAxisPositionPreset?: boolean } | undefined,
	): Promise<void> {
		if (_solving) return;
		_solving = true;
		try {
			const rpy = quatToRpy(quat);
			console.log(pos, quat);
			const jointNames = getViewer()?.getJointNames(systemName) ?? [];
			const currentAngles = getViewer()?.getCurrentJointAngles(systemName) ?? {};
			const seed = jointNames.map(n => currentAngles[n] ?? 0);
			const nullspace = getNullspaceParams?.();
			const data = await apiPost<any>(
				`/api/systems/${encodeURIComponent(systemName)}/ik`,
				{
					targetFrame: tcpLinkName,
					position: [pos.x, pos.y, pos.z],
					rpy: [radToDeg(rpy.roll), radToDeg(rpy.pitch), radToDeg(rpy.yaw)],
					elbowSwivelAngle: nullspace?.elbowSwivelAngle ?? 0,
					jointPositionSeed: seed.length > 0 ? seed : undefined,
					externalAxisPosition: nullspace?.externalAxisPosition,
					externalAxisPositionPreset: nullspace?.externalAxisPositionPreset,
				},
			);
			const solution = data.solution as number[] | undefined;
			if (solution?.length) {
				const jointAngles: Record<string, number> = {};
				for (let i = 0; i < solution.length && i < jointNames.length; i++) {
					jointAngles[jointNames[i]] = solution[i];
				}
				runViewer(v => v.updateJointAngles(systemName, jointAngles));
				onSuccess?.();
			}
		} catch {
			// IK failed — robot holds last valid pose
		} finally {
			_solving = false;
		}
	}

	function setTcpMode(mode: TcpMode): void {
		runViewer(v => v.setTransformMode(mode));
		tcpMenu.currentMode = mode;
		tcpMenu.visible = false;
	}

	function handleTcpDragToggle(payload: {
		active: boolean;
		systemName: string;
		tcpLinkName: string;
		onSuccess?: () => void;
		getNullspaceParams?: () => { elbowSwivelAngle: number; externalAxisPosition?: number[]; externalAxisPositionPreset?: boolean } | undefined;
	}): void {
		if (payload.active) {
			const { systemName, tcpLinkName, onSuccess, getNullspaceParams } = payload;
			runViewer(v => v.attachTransformControls(
				systemName,
				tcpLinkName,
				(pos, quat) => _onDragChange(pos, quat, systemName, tcpLinkName, onSuccess, getNullspaceParams),
				(x, y, mode) => {
					tcpMenu.x = x;
					tcpMenu.y = y;
					tcpMenu.currentMode = mode;
					tcpMenu.visible = true;
				},
			));
		} else {
			runViewer(v => v.detachTransformControls());
			tcpMenu.visible = false;
		}
	}

	return { handleTcpDragToggle, tcpMenu, setTcpMode };
}
