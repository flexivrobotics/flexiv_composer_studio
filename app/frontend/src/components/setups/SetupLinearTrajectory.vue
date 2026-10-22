<template>
	<div class="setup-scene-object setup-scene-object--fixed-tabs">
		<div class="setup-scene-object__sticky">
			<div class="setup-scene-object__header">
				<h3 class="setup-scene-object__title">{{ $t('setup.trajectory.titleLinear') }} - {{ parentName }}</h3>
				<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
			</div>

			<div class="setup-create-row">
				<label class="setup-field__label setup-field__label--inline">{{ $t('setup.trajectory.label.name') }}</label>
				<input
					class="setup-field__input"
					type="text"
					v-model="state.trajectoryName"
					:placeholder="$t('setup.trajectory.placeholder.name')"
					:disabled="state.solving"
				/>
				<button
					class="btn"
					:disabled="!state.trajectoryName.trim() || !state.selectedPath || state.solving || state.ikState !== 'ok'"
					@click="onCreateTrajectory"
				>{{ state.solving ? $t('setup.trajectory.button.solving') : $t('setup.trajectory.button.create') }}</button>
			</div>

			<hr class="setup-divider" />

			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.trajectory.tab.fromPath') }}</label>
				<select
					class="setup-field__input"
					v-model="state.selectedPath"
				>
					<option value="">—</option>
					<option v-for="path in state.paths" :key="path" :value="path">{{ path }}</option>
				</select>
			</div>

			<template v-if="state.selectedPath">
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.trajectory.label.normalOffset') }} (m)</label>
					<input
						class="setup-field__input"
						type="number"
						min="0"
						max="0.020"
						step="0.001"
						v-model.number="state.normalOffset"
						:disabled="state.solving"
					/>
				</div>

				<p v-if="state.ikState !== 'idle'" :class="{ 'setup-warning': state.ikState === 'checking', 'setup-success': state.ikState === 'ok', 'setup-error': state.ikState === 'failed' }">
					{{ state.ikCheckMessage }}
				</p>
			</template>

			<hr class="setup-divider" />

			<div class="setup-tabs">
				<button
					class="setup-tabs__tab"
					:class="{ active: state.activeTab === 'initial-config' }"
					@click="state.activeTab = 'initial-config'"
				>Initial Configuration</button>
				<button
					class="setup-tabs__tab"
					:class="{ active: state.activeTab === 'trajectory-params' }"
					@click="state.activeTab = 'trajectory-params'"
				>Trajectory Generation Parameters</button>
			</div>
		</div>

		<div class="setup-scene-object__scrollable">
			<div v-if="state.activeTab === 'initial-config'" class="tcp-pose-panel">
				<NullspaceControl
					v-model:nullspace="state.nullspaceDeg"
					v-model:extAxisMode="state.extAxisMode"
					:ikSeedSliders="ikSeedSliders"
				/>
			</div>
			<div v-else-if="state.activeTab === 'trajectory-params'">
				<LinearTrajectoryControls
					v-model:force="state.force"
					v-model:moment="state.moment"
					v-model:velocity="state.velocity"
					v-model:acceleration="state.acceleration"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, onMounted, onUnmounted, watch } from 'vue';
import { apiPost, apiGet } from '../../services/api';
import { useI18n } from '../../composables/useI18n';
import { useToast } from '../../composables/useToast';
import { radToDeg, degToRad, jointFromDisplay } from '../../utils/math';
import { quatToRpy } from '../../services/kinematics';
import { useIkSeedSliders } from '../../composables/controller/useIkSeedSliders';
import NullspaceControl from '../controls/NullspaceControl.vue';
import LinearTrajectoryControls from '../controls/LinearTrajectoryControls.vue';

const props = defineProps<{
	workcellName?: string;
	parentName: string;
	getCurrentJointAngles?: ((systemName: string) => Record<string, number> | null) | null;
	getJointNames?: ((systemName: string) => string[] | null) | null;
	getJointLimits?: ((systemName: string) => { lower: number[]; upper: number[]; prismatic?: boolean[] } | undefined) | null;
	getTcpLinkNames?: ((systemName: string) => string[] | null) | null;
}>();

const emit = defineEmits<{
	close: [];
	'create-trajectory': [payload: { name: string }];
	'update-joint-angles': [payload: { systemName: string; jointAngles: Record<string, number> }];
	'visualize-path': [pathName: string];
}>();

const { t } = useI18n();
const { showToast } = useToast();

// ── Nullspace / ext-axis state ─────────────────────────────────────────

const nullspaceProps = reactive<{
	externalAxisData: { name?: string; lowerLimit?: number[]; upperLimit?: number[]; prismatic?: boolean[] } | null;
	jointNames: string[];
}>({
	externalAxisData: null,
	jointNames: [],
});

const { ikSeedSliders, rebuildIkSeedSliders } = useIkSeedSliders(nullspaceProps);

watch(() => nullspaceProps.externalAxisData, rebuildIkSeedSliders, { immediate: true });

// ── Form state ─────────────────────────────────────────────────────────

const state = reactive({
	trajectoryName: '',
	selectedPath: '',
	normalOffset: 0,
	nullspaceDeg: 0,
	extAxisMode: 'preferred' as 'preset' | 'preferred',
	ikState: 'idle' as 'idle' | 'checking' | 'ok' | 'failed',
	ikCheckMessage: null as string | null,
	activeTab: 'initial-config' as 'initial-config' | 'trajectory-params',
	force: { x: 0, y: 0, z: 0 },
	moment: { x: 0, y: 0, z: 0 },
	velocity: 0.1,
	acceleration: 0.5,
	paths: [] as string[],
	solving: false,
});

// ── System info ────────────────────────────────────────────────────────

// Populated once on mount so checkFirstPoseIk can access them synchronously.
let _allJointNames: string[] = [];
let _tcpFrame = '';

// Cached first pose so offset re-checks don't re-fetch the path.
let _cachedPathName = '';
let _cachedFirstPose: { position: { x: number; y: number; z: number }; rotation?: { x: number; y: number; z: number; w: number } } | null = null;

async function loadSystemInfo() {
	const name = props.parentName;
	if (!name) return;

	try {
		const info: any = await apiGet(`/api/systems/${encodeURIComponent(name)}/info`);
		const extAxis = info.externalAxis ?? null;

		const allNames = props.getJointNames?.(name) ?? [];
		const limits = props.getJointLimits?.(name);
		const extName: string = extAxis?.name ?? '';

		_allJointNames = allNames;

		const tcpNames = props.getTcpLinkNames?.(name) ?? [];
		_tcpFrame = tcpNames.length > 0 ? tcpNames[tcpNames.length - 1] : '';

		if (extAxis && extName) {
			const extJointNames = allNames.filter(n => n.includes(extName));
			const lowerLimit = extJointNames.map((n, ji) => {
				const i = allNames.indexOf(n);
				return i !== -1 && limits?.lower[i] != null
					? limits.lower[i]
					: (extAxis.lowerLimit?.[ji] ?? -3.14);
			});
			const upperLimit = extJointNames.map((n, ji) => {
				const i = allNames.indexOf(n);
				return i !== -1 && limits?.upper[i] != null
					? limits.upper[i]
					: (extAxis.upperLimit?.[ji] ?? 3.14);
			});
			const prismatic = extJointNames.map(n => limits?.prismatic?.[allNames.indexOf(n)] ?? false);
			nullspaceProps.externalAxisData = { name: extName, lowerLimit, upperLimit, prismatic };
		} else {
			nullspaceProps.externalAxisData = null;
		}
		nullspaceProps.jointNames = allNames;
	} catch {
		// Ignore — leave defaults
	}
}

// ── IK check on first path pose ────────────────────────────────────────

async function checkFirstPoseIk(pathName: string) {
	state.ikState = 'checking';
	state.ikCheckMessage = null;

	if (!_tcpFrame) {
		state.ikState = 'failed';
		state.ikCheckMessage = 'No TCP frame available for system.';
		return;
	}

	// Fetch first pose only when the path changes; reuse cache for offset re-checks.
	if (pathName !== _cachedPathName) {
		_cachedFirstPose = null;
		_cachedPathName = pathName;
		try {
			const qs = props.workcellName ? `?workcellName=${encodeURIComponent(props.workcellName)}` : '';
			const pathData = await apiGet<{ CartesianWaypoints: any[] }>(`/api/paths/${encodeURIComponent(pathName)}${qs}`);
			_cachedFirstPose = pathData.CartesianWaypoints?.[0] ?? null;
		} catch {
			state.ikState = 'failed';
			state.ikCheckMessage = `Failed to fetch path '${pathName}'.`;
			return;
		}
	}

	if (!_cachedFirstPose) {
		state.ikState = 'failed';
		state.ikCheckMessage = `Path '${pathName}' has no waypoints.`;
		return;
	}

	const rot = _cachedFirstPose.rotation ?? { x: 0, y: 0, z: 0, w: 1 };

	// Apply normal offset along the negative local z-axis (matches backend logic).
	let { x, y, z } = _cachedFirstPose.position;
	if (state.normalOffset !== 0) {
		const { x: qx, y: qy, z: qz, w: qw } = rot;
		const lz_x = 2 * (qx * qz + qw * qy);
		const lz_y = 2 * (qy * qz - qw * qx);
		const lz_z = 1 - 2 * (qx * qx + qy * qy);
		x -= state.normalOffset * lz_x;
		y -= state.normalOffset * lz_y;
		z -= state.normalOffset * lz_z;
	}
	const rpyRad = quatToRpy(rot);

	// Use current slider values as the IK seed
	const extAxisPositionRad = ikSeedSliders.length > 0
		? ikSeedSliders.map(s => jointFromDisplay(s.value, s.prismatic))
		: undefined;

	let solution: number[] = [];
	try {
		const data = await apiPost<{ solution: number[] }>(
			`/api/systems/${encodeURIComponent(props.parentName)}/ik`,
			{
				targetFrame: _tcpFrame,
				position: [x, y, z],
				rpy: [radToDeg(rpyRad.roll), radToDeg(rpyRad.pitch), radToDeg(rpyRad.yaw)],
				elbowSwivelAngle: degToRad(state.nullspaceDeg),
				externalAxisPosition: extAxisPositionRad,
				externalAxisPositionPreset: extAxisPositionRad !== undefined ? state.extAxisMode === 'preset' : undefined,
			},
		);
		solution = data.solution ?? [];
	} catch (err: any) {
		state.ikState = 'failed';
		state.ikCheckMessage = `IK failed on first pose of '${pathName}': ${err?.message ?? 'unknown error'}`;
		return;
	}

	if (!solution.length) {
		state.ikState = 'failed';
		state.ikCheckMessage = `IK found no solution for first pose of path '${pathName}'.`;
		return;
	}

	// Pre-populate ext-axis sliders from the IK solution (only on first path selection)
	// Visualize the IK result in the 3D viewer
	const jointAngles: Record<string, number> = {};
	for (let i = 0; i < solution.length && i < _allJointNames.length; i++) {
		jointAngles[_allJointNames[i]] = solution[i];
	}
	emit('update-joint-angles', { systemName: props.parentName, jointAngles });

	state.ikCheckMessage = `IK succeeded on first pose of '${pathName}'`;
	state.ikState = 'ok';
}

// ── Lifecycle ──────────────────────────────────────────────────────────

onMounted(async () => {
	try {
		const qs = props.workcellName ? `?workcellName=${encodeURIComponent(props.workcellName)}` : '';
		const data = await apiGet<{ pathNames: string[] }>(`/api/paths${qs}`);
		state.paths = data.pathNames ?? [];
	} catch (err) {
		showToast('Failed to load paths', 'error');
		console.error('Failed to load paths:', err);
	}
	await loadSystemInfo();
});

watch(() => state.selectedPath, async (pathName) => {
	emit('visualize-path', pathName);
	_cachedPathName = '';
	_cachedFirstPose = null;
	state.ikState = 'idle';
	state.ikCheckMessage = null;
	if (pathName) {
		await checkFirstPoseIk(pathName);
	}
});

let _ikDebounce: ReturnType<typeof setTimeout> | null = null;
function scheduleIkCheck() {
	if (!state.selectedPath) return;
	if (_ikDebounce !== null) clearTimeout(_ikDebounce);
	_ikDebounce = setTimeout(() => {
		_ikDebounce = null;
		checkFirstPoseIk(state.selectedPath);
	}, 400);
}

watch(() => state.normalOffset, scheduleIkCheck);
watch(() => state.nullspaceDeg, scheduleIkCheck);
watch(() => state.extAxisMode, scheduleIkCheck);
watch(ikSeedSliders, scheduleIkCheck, { deep: true });

onUnmounted(() => {
	emit('visualize-path', '');
});

// ── Submit ─────────────────────────────────────────────────────────────

async function onCreateTrajectory() {
	const name = state.trajectoryName.trim();
	if (!name || !state.selectedPath) return;

	try {
		// Toolpaths and linear trajectories share one Nebula namespace, so
		// check against every surface path — not just existing trajectories —
		// to avoid colliding with a saved toolpath's name.
		const existing = await apiGet<{ names: string[] }>('/api/surface-paths');
		if ((existing.names ?? []).includes(name)) {
			showToast(`Trajectory "${name}" already exists. Choose a different name.`, 'error');
			return;
		}
	} catch {
		// proceed — server will reject duplicates if the check fails
	}

	state.solving = true;

	const elbowSwivelAngle = degToRad(state.nullspaceDeg);
	const externalAxisPosition = ikSeedSliders.length > 0
		? ikSeedSliders.map(s => jointFromDisplay(s.value, s.prismatic))
		: undefined;

	try {
		await apiPost('/api/trajectories', {
			workcellName: props.workcellName || '',
			name,
			systemName: props.parentName,
			pathName: state.selectedPath,
			tcpName: _tcpFrame,
			normalOffset: state.normalOffset,
			elbowSwivelAngle,
			externalAxisPosition,
			externalAxisPositionPreset: externalAxisPosition !== undefined ? state.extAxisMode === 'preset' : undefined,
			force: {
				x: state.force.x,
				y: state.force.y,
				z: state.force.z,
				xEnabled: true,
				yEnabled: true,
				zEnabled: true,
			},
			moment: {
				x: state.moment.x,
				y: state.moment.y,
				z: state.moment.z,
				xEnabled: true,
				yEnabled: true,
				zEnabled: true,
			},
			velocity: state.velocity,
			acceleration: state.acceleration,
		});
		showToast(`Trajectory '${name}' saved successfully.`, 'success');
		emit('create-trajectory', { name });
		state.trajectoryName = '';
	} catch (err: any) {
		showToast(err?.message ?? t('setup.trajectory.saveError'), 'error');
		console.error(t('setup.trajectory.saveError'), err);
	} finally {
		state.solving = false;
	}
}
</script>

