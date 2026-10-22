<template>
	<div class="setup-scene-object setup-scene-object--fixed-tabs">
		<div class="setup-scene-object__sticky">
			<div class="setup-scene-object__header">
				<h3 class="setup-scene-object__title">{{ $t('setup.target.title') }} - {{ parentName }}</h3>
				<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
			</div>

			<div class="setup-create-row">
				<label class="setup-field__label setup-field__label--inline">{{ $t('setup.target.label.name') }}</label>
				<input
					class="setup-field__input"
					type="text"
					v-model="state.targetName"
					:placeholder="$t('setup.target.placeholder.name')"
				/>
				<button
					class="btn"
					:disabled="!state.targetName.trim()"
					@click="onCreateTarget"
				>{{ $t('setup.target.button.create') }}</button>
			</div>

			<hr class="setup-divider" />

			<div class="setup-tabs">
				<button
					class="setup-tabs__tab"
					:class="{ active: state.targetSubTab === 'joint-space' }"
					@click="state.targetSubTab = 'joint-space'"
				>{{ $t('setup.target.tab.jointSpace') }}</button>
				<button
					class="setup-tabs__tab"
					:class="{ active: state.targetSubTab === 'cartesian-space' }"
					@click="state.targetSubTab = 'cartesian-space'"
				>{{ $t('setup.target.tab.cartesianSpace') }}</button>
			</div>
		</div>

		<div class="setup-scene-object__scrollable">
			<JointSliders
				v-if="state.targetSubTab === 'joint-space'"
				:manipulator="state.manipulatorSliders"
				:externalAxis="state.externalAxisSliders"
				:systemName="parentName"
				@change="onJointSlidersChange"
			/>
			<div v-if="state.targetSubTab === 'cartesian-space'" class="cartesian-actions">
				<button
					class="btn btn--full"
					:class="{ 'btn--tcp-drag-active': tcpDragActive }"
					:disabled="!state.tcpFrame"
					@click="toggleTcpDrag"
				>{{ tcpDragActive ? $t('setup.target.button.stopTcpDrag') : $t('setup.target.button.tcpDrag') }}</button>
			</div>
			<PoseControl
				v-if="state.targetSubTab === 'cartesian-space'"
				ref="poseControlRef"
				:systemName="parentName"
				:frame="state.tcpFrame"
				:jointNames="state.jointNames"
				:externalAxisData="state.externalAxisData"
				:getLinkPose="props.getLinkWorldPose ?? null"
				:getCurrentJointAngles="props.getCurrentJointAngles ?? null"
				@update-joint-angles="(p) => emit('update-joint-angles', p)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, onUnmounted } from 'vue';
import JointSliders, { type JointSlider } from '../controls/JointSliders.vue';
import PoseControl from '../controls/PoseControl.vue';
import { apiGet, apiPost } from '../../services/api';
import { useI18n } from '../../composables/useI18n';
import { useToast } from '../../composables/useToast';
import { radToDeg, jointToDisplay, jointFromDisplay, jointDecimals } from '../../utils/math';
import { quatToRpy } from '../../services/kinematics';

const props = defineProps<{
	workcellName?: string;
	parentName: string;
	getCurrentJointAngles?: ((systemName: string) => Record<string, number> | null) | null;
	getJointNames?: ((systemName: string) => string[] | null) | null;
	getJointLimits?: ((systemName: string) => { lower: number[]; upper: number[]; prismatic?: boolean[] } | undefined) | null;
	getLinkPose?: ((systemName: string, linkName: string) => { position: [number, number, number]; quaternion: [number, number, number, number] } | null) | null;
	getLinkWorldPose?: ((systemName: string, linkName: string) => { position: [number, number, number]; quaternion: [number, number, number, number] } | null) | null;
	getTcpLinkNames?: ((systemName: string) => string[] | null) | null;
}>();

const emit = defineEmits<{
	close: [];
	'update-joint-angles': [payload: { systemName: string; jointAngles: Record<string, number> }];
	'create-target': [payload: { name: string }];
	'toggle-tcp-drag': [payload: { active: boolean; systemName: string; tcpLinkName: string; onSuccess?: () => void; getNullspaceParams?: () => { elbowSwivelAngle: number; externalAxisPosition?: number[]; externalAxisPositionPreset?: boolean } | undefined }];
}>();

const { t } = useI18n();
const { showToast } = useToast();

const poseControlRef = ref<InstanceType<typeof PoseControl> | null>(null);

const state = reactive({
	targetName: '',
	targetSubTab: 'joint-space' as 'joint-space' | 'cartesian-space',
	manipulatorSliders: [] as JointSlider[],
	externalAxisSliders: [] as JointSlider[],
	tcpFrame: '',
	jointNames: [] as string[],
	externalAxisData: null as { name?: string; lowerLimit?: number[]; upperLimit?: number[]; prismatic?: boolean[] } | null,
});

// ── Build sliders from viewer URDF data (correct joint names) ──────

function buildCategory(
	jointNames: string[],
	limits: { lower: number[]; upper: number[]; prismatic?: boolean[] },
	current: Record<string, number>,
	nameFilter?: string,
): JointSlider[] {
	const { lower, upper } = limits;
	const filtered = nameFilter
		? jointNames.filter(n => n.includes(nameFilter))
		: jointNames;

	return filtered.map((jointName) => {
		const idx = jointNames.indexOf(jointName);
		const prismatic = limits.prismatic?.[idx] ?? false;
		const decimals = jointDecimals(prismatic);
		const currentValue = current[jointName];
		const value = currentValue != null ? jointToDisplay(currentValue, prismatic) : 0;
		return {
			name: jointName,
			value: +value.toFixed(decimals),
			min: idx !== -1 && lower[idx] != null ? +jointToDisplay(lower[idx], prismatic).toFixed(decimals) : -180,
			max: idx !== -1 && upper[idx] != null ? +jointToDisplay(upper[idx], prismatic).toFixed(decimals) : 180,
			prismatic,
		};
	});
}

async function buildSlidersFromSystem() {
	const name = props.parentName;
	if (!name) {
		state.manipulatorSliders = [];
		state.externalAxisSliders = [];
		return;
	}

	const allNames = props.getJointNames?.(name) ?? [];
	const limits = props.getJointLimits?.(name);
	const current = props.getCurrentJointAngles?.(name) ?? {};

	if (allNames.length === 0 || !limits) {
		state.manipulatorSliders = [];
		state.externalAxisSliders = [];
		return;
	}

	// Fetch system info to know manipulator vs external-axis names for filtering
	let manipName: string | undefined;
	let extName: string | undefined;
	let externalAxisData: { name?: string; lowerLimit?: number[]; upperLimit?: number[] } | null = null;
	try {
		const info: any = await apiGet(`/api/systems/${encodeURIComponent(name)}/info`);
		manipName = info.manipulator?.name || undefined;
		extName = info.externalAxis?.name || undefined;
		externalAxisData = info.externalAxis || null;
	} catch {
		// Fall back: put all joints into manipulator
	}

	if (extName) {
		state.manipulatorSliders = buildCategory(allNames, limits, current, manipName);
		state.externalAxisSliders = buildCategory(allNames, limits, current, extName);
	} else {
		state.manipulatorSliders = buildCategory(allNames, limits, current, manipName);
		state.externalAxisSliders = [];
	}

	// Populate Cartesian-space state
	state.jointNames = allNames;
	// Override lowerLimit/upperLimit with viewer-derived values so the
	// ext-axis slider count in PoseControl matches the joint-space tab.
	if (externalAxisData && extName) {
		const extJoints = allNames.filter(n => n.includes(extName));
		state.externalAxisData = {
			...externalAxisData,
			lowerLimit: extJoints.map(n => {
				const i = allNames.indexOf(n);
				return i !== -1 && limits.lower[i] != null ? limits.lower[i] : -3.14;
			}),
			upperLimit: extJoints.map(n => {
				const i = allNames.indexOf(n);
				return i !== -1 && limits.upper[i] != null ? limits.upper[i] : 3.14;
			}),
			prismatic: extJoints.map(n => limits.prismatic?.[allNames.indexOf(n)] ?? false),
		};
	} else {
		state.externalAxisData = externalAxisData;
	}
	const tcpNames = props.getTcpLinkNames?.(name) ?? [];
	state.tcpFrame = tcpNames.length > 0 ? tcpNames[tcpNames.length - 1] : '';
}

function onJointSlidersChange(payload: { systemName: string; jointAngles: Record<string, number> }) {
	emit('update-joint-angles', payload);
	scheduleCollisionCheck(payload.systemName, payload.jointAngles);
}

// ── Collision check (Joint Space) ───────────────────────────────────
// After FK has placed the robot at the slider-driven joint configuration,
// verify that configuration by running IK against its own resulting TCP
// pose, seeded with the same joint angles: compute_ik always solves
// against the default collision config, so a failed/empty solution here
// means the configuration is in collision (or otherwise unreachable).

let collisionCheckTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCollisionCheck(systemName: string, jointAngles: Record<string, number>) {
	if (collisionCheckTimer !== null) clearTimeout(collisionCheckTimer);
	collisionCheckTimer = setTimeout(() => {
		collisionCheckTimer = null;
		checkCollisionAfterFk(systemName, jointAngles);
	}, 400);
}

async function checkCollisionAfterFk(systemName: string, jointAngles: Record<string, number>) {
	if (!state.tcpFrame) return;
	const worldPose = props.getLinkWorldPose?.(systemName, state.tcpFrame);
	if (!worldPose) return;

	const rpyRad = quatToRpy({
		x: worldPose.quaternion[0], y: worldPose.quaternion[1],
		z: worldPose.quaternion[2], w: worldPose.quaternion[3],
	});
	const rpyDegrees = [radToDeg(rpyRad.roll), radToDeg(rpyRad.pitch), radToDeg(rpyRad.yaw)];
	const jointPositionSeed = state.jointNames.map(n => jointAngles[n] ?? 0);

	try {
		const data = await apiPost<any>(`/api/systems/${encodeURIComponent(systemName)}/ik`, {
			targetFrame: state.tcpFrame,
			position: worldPose.position,
			rpy: rpyDegrees,
			elbowSwivelAngle: 0,
			jointPositionSeed,
		});
		if (!data.solution?.length) {
			showToast(t('setup.target.collisionWarning'), 'warning');
		}
	} catch (err: any) {
		console.error('Collision check failed:', err);
		showToast(t('setup.target.collisionCheckError', { message: err?.message ?? String(err) }), 'error');
	}
}
async function onCreateTarget() {
	const name = state.targetName.trim();
	if (!name) return;

	const systemName = props.parentName;
	const workcellName = props.workcellName || '';

	// ── Duplicate check ──────────────────────────────────────────
	if (workcellName) {
		try {
			const listData = await apiGet<{ targetNames: string[] }>(
				`/api/targets/${encodeURIComponent(workcellName)}`,
			);
			if ((listData.targetNames ?? []).includes(name)) {
				showToast(t('setup.target.duplicateName', { name }), 'error');
				return;
			}
		} catch {
			// If listing fails, still allow creation — server will
			// reject duplicates anyway via gRPC status.
		}
	}

	// Collect joint angles from viewer (radians).  Fall back to the
	// slider values (which default to 0) when the viewer has no stored
	// angles yet for this system.
	let jointAngles = props.getCurrentJointAngles?.(systemName) ?? null;
	if (!jointAngles || Object.keys(jointAngles).length === 0) {
		const fromSliders: Record<string, number> = {};
		// External axis joints first, then manipulator — matches
		// the ordering expected by the Nebula TargetWaypoint.
		for (const s of [...state.externalAxisSliders, ...state.manipulatorSliders]) {
			fromSliders[s.name] = jointFromDisplay(s.value, s.prismatic);
		}
		if (Object.keys(fromSliders).length > 0) {
			jointAngles = fromSliders;
		}
	}

	// Collect Cartesian TCP pose from viewer:
	//   cartesianPose  – world-frame → stored in TargetWaypoint.cartesian
	//   poseInParent   – system-base-relative → stored in header.pose_in_parent
	let cartesianPose: {
		position: [number, number, number];
		quaternion: [number, number, number, number];
	} | null = null;
	let poseInParent: {
		position: [number, number, number];
		quaternion: [number, number, number, number];
	} | null = null;
	if (state.tcpFrame) {
		const worldPose = props.getLinkWorldPose?.(systemName, state.tcpFrame);
		if (worldPose) {
			cartesianPose = { position: worldPose.position, quaternion: worldPose.quaternion };
		}
		const basePose = props.getLinkPose?.(systemName, state.tcpFrame);
		if (basePose) {
			poseInParent = { position: basePose.position, quaternion: basePose.quaternion };
		}
	}

	try {
		await apiPost('/api/targets', {
			workcellName,
			name,
			systemName,
			jointAngles,
			cartesianPose,
			poseInParent,
			tcpName: state.tcpFrame || undefined,
		});
	} catch (err: any) {
		showToast(err?.message ?? t('setup.target.saveError'), 'error');
		console.error(t('setup.target.saveError'), err);
		return;
	}

	emit('create-target', { name });
	state.targetName = '';
}

const tcpDragActive = ref(false);

function toggleTcpDrag() {
	tcpDragActive.value = !tcpDragActive.value;
	emit('toggle-tcp-drag', {
		active: tcpDragActive.value,
		systemName: props.parentName,
		tcpLinkName: state.tcpFrame,
		onSuccess: tcpDragActive.value ? () => poseControlRef.value?.syncFromViewer() : undefined,
		getNullspaceParams: tcpDragActive.value ? () => poseControlRef.value?.getNullspaceParams() : undefined,
	});
}

function deactivateTcpDrag() {
	if (tcpDragActive.value) {
		tcpDragActive.value = false;
		emit('toggle-tcp-drag', { active: false, systemName: props.parentName, tcpLinkName: state.tcpFrame });
	}
}

onUnmounted(() => {
	deactivateTcpDrag();
	if (collisionCheckTimer !== null) clearTimeout(collisionCheckTimer);
});

// Rebuild sliders when the component mounts or parentName changes
watch(() => props.parentName, (name) => {
	buildSlidersFromSystem();
}, { immediate: true });

// Refresh inputs when switching tabs — use flush:post so the target
// component (JointSliders / PoseControl) is mounted before we update it.
watch(() => state.targetSubTab, (tab) => {
	if (tab !== 'cartesian-space') deactivateTcpDrag();
	if (tab === 'joint-space') {
		buildSlidersFromSystem();
	} else if (tab === 'cartesian-space') {
		poseControlRef.value?.open();
	}
}, { flush: 'post' });
</script>
