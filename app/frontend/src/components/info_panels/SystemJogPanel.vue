<template>
	<div class="tab-content">
		<p class="jog-notice">{{ $t('info.system.jog.stubNotice') }}</p>

		<div class="setup-tabs">
			<button
				class="setup-tabs__tab"
				:class="{ active: subTab === 'joint-space' }"
				@click="subTab = 'joint-space'"
			>{{ $t('info.system.jog.jointSpace') }}</button>
			<button
				class="setup-tabs__tab"
				:class="{ active: subTab === 'cartesian-space' }"
				@click="subTab = 'cartesian-space'"
			>{{ $t('info.system.jog.cartesianSpace') }}</button>
		</div>

		<JointSliders
			v-if="subTab === 'joint-space'"
			:manipulator="manipulatorSliders"
			:externalAxis="externalAxisSliders"
			:systemName="systemName"
			@change="onJointChange"
		/>

		<PoseControl
			v-else
			:systemName="systemName"
			:frame="tcpFrame"
			:jointNames="jointNames"
			:externalAxisData="externalAxisData"
			:getLinkPose="getLinkWorldPose ?? null"
			:getCurrentJointAngles="getCurrentJointAngles ?? null"
			@update-joint-angles="onJointChange"
		/>
	</div>
</template>

<script setup lang="ts">
// ── SystemJogPanel ─────────────────────────────────────────────────
// "Position" tab of SystemDetailPanel. Reuses the JointSliders and
// PoseControl controls (also used by the target-creation wizard) to show
// and preview the system's pose in the 3D viewport.
//
// STUB: this previews the pose on the viewer model only. It is not yet
// wired to read live telemetry from — or command motion on — a connected
// robot; that requires backend jog endpoints that don't exist yet.

import { reactive, computed, watch, onMounted } from 'vue';
import JointSliders, { type JointSlider } from '../controls/JointSliders.vue';
import PoseControl from '../controls/PoseControl.vue';
import { useSelection } from '../../composables/useSelection';
import { jointToDisplay, jointDecimals } from '../../utils/math';

// ── Props ──────────────────────────────────────────────────────────

const props = defineProps<{
	systemName: string;
	getCurrentJointAngles?: ((systemName: string) => Record<string, number> | null) | null;
	getJointNames?: ((systemName: string) => string[] | null) | null;
	getLinkWorldPose?: ((systemName: string, linkName: string) => { position: [number, number, number]; quaternion: [number, number, number, number] } | null) | null;
	getTcpLinkNames?: ((systemName: string) => string[] | null) | null;
	onJointAnglesChange?: ((payload: { systemName: string; jointAngles: Record<string, number> }) => void) | null;
}>();

// ── State ──────────────────────────────────────────────────────────

const selection = useSelection();

const state = reactive({
	subTab: 'joint-space' as 'joint-space' | 'cartesian-space',
	manipulatorSliders: [] as JointSlider[],
	externalAxisSliders: [] as JointSlider[],
});

const subTab = computed({
	get: () => state.subTab,
	set: (v: 'joint-space' | 'cartesian-space') => { state.subTab = v; },
});

const manipulatorSliders = computed(() => state.manipulatorSliders);
const externalAxisSliders = computed(() => state.externalAxisSliders);

const jointNames = computed<string[]>(() => props.getJointNames?.(props.systemName) ?? []);

const externalAxisData = computed(() => {
	const ea = selection.item?.data?.externalAxis;
	if (!ea) return null;
	const extNames = jointNames.value.slice(0, (ea.lowerLimit ?? []).length);
	const prismatic = extNames.map(n => selection.prismaticJointNames?.includes(n) ?? false);
	return { name: ea.name, lowerLimit: ea.lowerLimit, upperLimit: ea.upperLimit, prismatic };
});

const tcpFrame = computed<string>(() => props.getTcpLinkNames?.(props.systemName)?.[0] ?? '');

// ── Slider construction ────────────────────────────────────────────
// Limits arrive from the system config in radians (metres for a prismatic
// joint); sliders work in degrees (metres). Initial values come from the current viewer joint state when
// available, otherwise the lower limit.

function buildSliders(
	limits: { lowerLimit?: number[]; upperLimit?: number[] } | null | undefined,
	names: string[],
	current: Record<string, number> | null,
): JointSlider[] {
	const lower = limits?.lowerLimit ?? [];
	const upper = limits?.upperLimit ?? [];
	const count = Math.min(lower.length, upper.length);
	const sliders: JointSlider[] = [];
	for (let i = 0; i < count; i++) {
		const name = names[i] ?? `joint_${i + 1}`;
		const currentRad = current?.[name];
		const valueRad = (currentRad != null && !isNaN(currentRad)) ? currentRad : lower[i];
		const prismatic = selection.prismaticJointNames?.includes(name) ?? false;
		const decimals = jointDecimals(prismatic);
		sliders.push({
			name,
			value: +jointToDisplay(valueRad, prismatic).toFixed(decimals),
			min: +jointToDisplay(lower[i], prismatic).toFixed(decimals),
			max: +jointToDisplay(upper[i], prismatic).toFixed(decimals),
			prismatic,
		});
	}
	return sliders;
}

function rebuild() {
	const data = selection.item?.data;
	if (!data) {
		state.manipulatorSliders = [];
		state.externalAxisSliders = [];
		return;
	}
	const current = props.getCurrentJointAngles?.(props.systemName) ?? null;
	const names = jointNames.value;
	const manip = data.manipulator ?? null;
	// External-axis joints are ordered before manipulator joints in the
	// joint-name list, mirroring the TargetWaypoint layout used elsewhere.
	const eaCount = (data.externalAxis?.lowerLimit ?? []).length;
	state.externalAxisSliders = buildSliders(data.externalAxis, names.slice(0, eaCount), current);
	state.manipulatorSliders = buildSliders(manip, names.slice(eaCount), current);
}

// ── Events ─────────────────────────────────────────────────────────

function onJointChange(payload: { systemName: string; jointAngles: Record<string, number> }) {
	props.onJointAnglesChange?.(payload);
}

// ── Lifecycle ──────────────────────────────────────────────────────

onMounted(rebuild);
watch(() => [props.systemName, selection.item?.data], rebuild);
</script>

<style scoped>
.jog-notice {
	margin: 0 0 0.75rem;
	padding: 0.5rem 0.6rem;
	font-size: 0.78rem;
	color: var(--ink-muted);
	background: rgba(0, 0, 0, 0.03);
	border-left: 3px solid var(--accent);
	border-radius: 3px;
}
</style>
