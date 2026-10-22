import { ref, type Ref } from 'vue';
import { apiPost } from '../../services/api';
import type { IkSeedSlider } from './useIkSeedSliders';
import { degToRad, jointFromDisplay } from '../../utils/math';
import { useToast } from '../useToast';

interface PoseForm {
	pos: { x: number; y: number; z: number };
	rpy: { roll: number; pitch: number; yaw: number };
	nullspace: number;
}

// ── useIkSolver ───────────────────────────────────────────────────────
// Sends IK requests to the backend on demand and via a debounced
// schedule. Exposes suppress/unsuppress to let the caller pause
// auto-scheduling during programmatic form updates (e.g. drag sync).

export function useIkSolver(
	props: {
		systemName: string;
		frame: string;
		jointNames: string[];
		getCurrentJointAngles: ((systemName: string) => Record<string, number> | null) | null;
	},
	form: PoseForm,
	ikSeedSliders: IkSeedSlider[],
	extAxisMode: Ref<'preset' | 'preferred'>,
	emit: (event: 'update-joint-angles', payload: { systemName: string; jointAngles: Record<string, number> }) => void,
) {
	const { showToast } = useToast();
	const solving = ref(false);

	let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let _suppress = false;

	async function solveIk() {
		if (!props.frame) return;
		solving.value = true;

		const names = props.jointNames;
		const currentAngles = props.getCurrentJointAngles?.(props.systemName) ?? null;
		const seed: number[] = [];
		if (currentAngles) {
			for (const name of names) {
				const extIdx = ikSeedSliders.findIndex(s => s.name === name);
				seed.push(extIdx >= 0 ? jointFromDisplay(ikSeedSliders[extIdx].value, ikSeedSliders[extIdx].prismatic) : (currentAngles[name] ?? 0));
			}
		}

		const extAxisPosRad = ikSeedSliders.map(s => jointFromDisplay(s.value, s.prismatic));

		try {
			const data = await apiPost<any>(`/api/systems/${encodeURIComponent(props.systemName)}/ik`, {
				targetFrame: props.frame,
				position: [form.pos.x, form.pos.y, form.pos.z],
				rpy: [form.rpy.roll, form.rpy.pitch, form.rpy.yaw],
				elbowSwivelAngle: degToRad(form.nullspace),
				//jointPositionSeed: seed.length > 0 ? seed : undefined,
				jointPositionSeed: undefined,
				externalAxisPosition: extAxisPosRad.length > 0 ? extAxisPosRad : undefined,
				externalAxisPositionPreset: extAxisPosRad.length > 0 ? extAxisMode.value === 'preset' : undefined,
			});
			const solution = data.solution as number[];
			if (solution?.length) {
				const jointAngles: Record<string, number> = {};
				for (let i = 0; i < solution.length && i < names.length; i++) {
					jointAngles[names[i]] = solution[i];
				}
				emit('update-joint-angles', { systemName: props.systemName, jointAngles });
			}
		} catch (err: any) {
			console.error('IK error:', err);
			showToast('IK failed: ' + (err.message || String(err)), 'error');
		} finally {
			solving.value = false;
		}
	}

	function scheduleSolveIk() {
		if (_suppress) return;
		if (_debounceTimer !== null) clearTimeout(_debounceTimer);
		_debounceTimer = setTimeout(() => { _debounceTimer = null; solveIk(); }, 400);
	}

	function suppressSchedule() { _suppress = true; }
	function unsuppressSchedule() { _suppress = false; }

	return { solving, scheduleSolveIk, suppressSchedule, unsuppressSchedule };
}
