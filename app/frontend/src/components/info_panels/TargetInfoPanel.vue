<template>
	<div class="info-content">
		<h3 class="info-title">{{ selection.item!.data.name }}</h3>

		<div class="info-tabs">
			<button
				class="info-tab"
				:class="{ active: state.activeTab === 'info' }"
				:disabled="disabled"
				@click="onTabClick('info')"
			>{{ $t('info.tab.information') }}</button>
			<button
				class="info-tab"
				:class="{ active: state.activeTab === 'operations' }"
				:disabled="disabled"
				@click="onTabClick('operations')"
			>{{ $t('info.tab.operations') }}</button>
		</div>

		<!-- Tab: Information -->
		<div v-if="state.activeTab === 'info'" class="tab-content">
			<section class="info-section">
				<h4 class="info-section__title">{{ $t('info.target.title') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.name') }}</span>
					<span class="info-value">{{ selection.item!.data.name }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.system') }}</span>
					<span class="info-value">{{ selection.item!.data.systemName || '—' }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.tcp') }}</span>
					<span class="info-value">{{ selection.item!.data.tcpName || '—' }}</span>
				</div>
			</section>

			<section v-if="manipulatorJointEntries.length > 0" class="info-section">
				<h4 class="info-section__title">{{ $t('info.target.manipulatorJointAngles') }}</h4>
				<table class="limits-table">
					<thead>
						<tr>
						<th>{{ $t('info.target.tableHeader.joint') }}</th>
						<th>{{ $t('info.target.tableHeader.angle') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(entry, i) in manipulatorJointEntries" :key="'m' + i">
							<td class="limits-joint">{{ entry.name }}</td>
							<td>{{ entry.deg }}</td>
						</tr>
					</tbody>
				</table>
			</section>

			<section v-if="externalAxisJointEntries.length > 0" class="info-section">
				<h4 class="info-section__title">{{ $t('info.target.externalAxisJointAngles') }}</h4>
				<table class="limits-table">
					<thead>
						<tr>
						<th>{{ $t('info.target.tableHeader.joint') }}</th>
						<th>{{ $t('info.target.tableHeader.position') }}</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(entry, i) in externalAxisJointEntries" :key="'e' + i">
							<td class="limits-joint">{{ entry.name }}</td>
							<td>{{ entry.withUnit }}</td>
						</tr>
					</tbody>
				</table>
			</section>

			<p v-if="manipulatorJointEntries.length === 0 && externalAxisJointEntries.length === 0" class="info-none">{{ $t('info.emptyState.noJointAngles') }}</p>

			<section v-if="cartesianPose" class="info-section">
				<h4 class="info-section__title">{{ $t('info.target.cartesianPose') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.position') }}</span>
					<span class="info-value">
						x: {{ fmt(cartesianPose.position[0]) }},
						y: {{ fmt(cartesianPose.position[1]) }},
						z: {{ fmt(cartesianPose.position[2]) }}
					</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.orientation') }}</span>
					<span class="info-value">
						R: {{ rpy.roll }}&deg;,
						P: {{ rpy.pitch }}&deg;,
						Y: {{ rpy.yaw }}&deg;
					</span>
				</div>
			</section>
			<p v-else class="info-none">{{ $t('info.emptyState.noCartesianPose') }}</p>

			<section v-if="basePose" class="info-section">
				<h4 class="info-section__title">{{ $t('info.target.cartesianPoseBase') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.position') }}</span>
					<span class="info-value">
						x: {{ fmt(basePose.position[0]) }},
						y: {{ fmt(basePose.position[1]) }},
						z: {{ fmt(basePose.position[2]) }}
					</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.orientation') }}</span>
					<span class="info-value">
						R: {{ baseRpy.roll }}&deg;,
						P: {{ baseRpy.pitch }}&deg;,
						Y: {{ baseRpy.yaw }}&deg;
					</span>
				</div>
			</section>
		</div>

		<!-- Tab: Operations -->
		<div v-if="state.activeTab === 'operations'" class="tab-content">
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import * as THREE from 'three';
import { useSelection } from '../../composables/useSelection';
import { radToDeg, formatJoint } from '../../utils/math';

// ── Props ──────────────────────────────────────────────────────────

const props = defineProps<{
	disabled?: boolean;
}>();

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();

// ── State ──────────────────────────────────────────────────────────

const state = reactive({
	activeTab: 'info' as 'info' | 'operations',
});

// ── Computed ───────────────────────────────────────────────────────

interface JointEntry {
	name: string;
	deg: string;
	/** The value with its unit: degrees, or metres for a prismatic joint. */
	withUnit: string;
}

/**
 * Build a list of { name, deg } entries from the raw joint angles and
 * a list of joint names.  Handles both the legacy dict format and the
 * Nebula flat-array format.
 */
function buildEntries(
	angles: unknown,
	jointNames: string[],
	prismaticNames: string[] = [],
): JointEntry[] {
	const entry = (name: string, value: number): JointEntry => ({
		name,
		deg: radToDeg(value).toFixed(2),
		withUnit: formatJoint(value, prismaticNames.includes(name)),
	});
	if (!angles || jointNames.length === 0) return [];

	// Nebula format: flat array [r1, r2, …]
	if (Array.isArray(angles)) {
		const arr = angles as number[];
		const count = Math.min(arr.length, jointNames.length);
		const result: JointEntry[] = [];
		for (let i = 0; i < count; i++) {
			result.push(entry(jointNames[i], arr[i]));
		}
		return result;
	}

	// Legacy dict format: { jointName: rad, … }
	if (typeof angles === 'object' && angles !== null) {
		return Object.entries(angles as Record<string, number>).map(
			([name, value]) => entry(name, value),
		);
	}

	return [];
}

/** All joint-angle entries (manipulator + external axis combined). */
const allJointEntries = computed<JointEntry[]>(() => {
	const data = selection.item?.data;
	const jointNames: string[] = data?._jointNames ?? [];
	return buildEntries(data?.jointAngles, jointNames, data?._prismaticJointNames ?? []);
});

/** Joint-angle entries belonging to the manipulator arm. */
const manipulatorJointEntries = computed<JointEntry[]>(() => {
	const data = selection.item?.data;
	const filterName: string | undefined = data?._manipulatorName;
	if (!filterName) return allJointEntries.value;
	return allJointEntries.value.filter(e => e.name.includes(filterName));
});

/** Joint-angle entries belonging to the external axis (if any). */
const externalAxisJointEntries = computed<JointEntry[]>(() => {
	const data = selection.item?.data;
	const filterName: string | undefined = data?._externalAxisName;
	if (!filterName) return [];
	return allJointEntries.value.filter(e => e.name.includes(filterName));
});

const cartesianPose = computed<{
	position: [number, number, number];
	quaternion: [number, number, number, number];
} | null>(() => {
	return selection.item?.data?.cartesianPose ?? null;
});

/** TCP pose relative to the system's own base frame (after the system mount
 * transform), captured when the target was created (SetupTarget.vue's
 * `getLinkPose`) and stored server-side in ConfigHeader.pose_in_parent. */
const basePose = computed<{
	position: [number, number, number];
	quaternion: [number, number, number, number];
} | null>(() => {
	return selection.item?.data?.poseInParent ?? null;
});

function quatToRpyDeg(q: [number, number, number, number] | undefined): { roll: string; pitch: string; yaw: string } {
	if (!q) return { roll: '—', pitch: '—', yaw: '—' };
	const euler = new THREE.Euler().setFromQuaternion(
		new THREE.Quaternion(q[0], q[1], q[2], q[3]),
		'ZYX',
	);
	return {
		roll: radToDeg(euler.x).toFixed(1),
		pitch: radToDeg(euler.y).toFixed(1),
		yaw: radToDeg(euler.z).toFixed(1),
	};
}

const rpy = computed(() => quatToRpyDeg(cartesianPose.value?.quaternion));
const baseRpy = computed(() => quatToRpyDeg(basePose.value?.quaternion));

// ── Helpers ────────────────────────────────────────────────────────

function fmt(val: number): string {
	return val.toFixed(4);
}

function onTabClick(tab: 'info' | 'operations') {
	if (props.disabled) return;
	state.activeTab = tab;
}
</script>
