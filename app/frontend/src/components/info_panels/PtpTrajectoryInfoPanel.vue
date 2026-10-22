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
				<h4 class="info-section__title">{{ $t('info.ptpTrajectory.title') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.name') }}</span>
					<span class="info-value">{{ selection.item!.data.name }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.system') }}</span>
					<span class="info-value">{{ selection.item!.data.systemName || '—' }}</span>
				</div>
			</section>
		</div>

		<!-- Tab: Operations -->
		<div v-if="state.activeTab === 'operations'" class="tab-content">
			<button
				v-if="!state.visualizing"
				class="btn-ik-solve"
				:disabled="state.loading || disabled"
				@click="startVisualization"
			>{{ state.loading ? $t('info.ptpTrajectory.button.loading') : $t('info.ptpTrajectory.button.visualize') }}</button>
			<button
				v-else
				class="btn-ik-solve"
				@click="stopVisualization"
			>{{ $t('info.ptpTrajectory.button.stop') }}</button>

			<div class="slider-row">
				<label class="slider-label">
					<span class="slider-name">{{ $t('info.ptpTrajectory.label.playback') }}</span>
					<span class="slider-value">{{ (state.progress * 100).toFixed(0) }}%</span>
				</label>
				<div class="slider-controls">
					<input
						type="range"
						class="slider-input"
						min="0"
						max="1"
						step="0.001"
						:disabled="disabled || state.loading || !state.waypoints"
						v-model.number="state.progress"
						@input="onScrub"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, watch, onUnmounted } from 'vue';
import { useSelection } from '../../composables/useSelection';
import { apiGet } from '../../services/api';
import { useToast } from '../../composables/useToast';

// ── Props ──────────────────────────────────────────────────────────

const props = defineProps<{
	disabled?: boolean;
	getViewer?: () => any;
}>();

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();
const { showToast } = useToast();

// ── State ──────────────────────────────────────────────────────────

const state = reactive({
	activeTab: 'info' as 'info' | 'operations',
	loading: false,
	visualizing: false,
	// Cached once fetched, so the slider can scrub without re-fetching and
	// playback can resume from wherever the slider was left.
	waypoints: null as number[][] | null,
	jointNames: [] as string[],
	progress: 0, // 0..1 across the whole trajectory
});

let stopFlag = false;

// Reset cached trajectory data and stop animation when a different item is selected
watch(() => selection.item?.data?.name, () => {
	stopFlag = true;
	state.visualizing = false;
	state.waypoints = null;
	state.jointNames = [];
	state.progress = 0;
});

// Pre-load waypoints as soon as the Operations tab is opened, so the slider
// is scrubbable without requiring the user to hit "Visualize" first.
watch(() => state.activeTab, (tab) => {
	if (tab === 'operations') void ensureWaypointsLoaded();
});

onUnmounted(() => {
	stopFlag = true;
});

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const VELOCITY_RAD_PER_S = 1.0; // constant joint velocity (rad/s)
const FRAME_MS = 1000 / 60;

/** Duration (ms) of each segment, driven by the joint that moves the most. */
function segmentDurations(waypoints: number[][], jointNames: string[]): number[] {
	const durations: number[] = [];
	for (let i = 0; i < waypoints.length - 1; i++) {
		const from = waypoints[i];
		const to = waypoints[i + 1];
		const maxDisp = jointNames.reduce((max, _, j) => {
			return Math.max(max, Math.abs((to[j] ?? 0) - (from[j] ?? 0)));
		}, 0);
		durations.push((maxDisp / VELOCITY_RAD_PER_S) * 1000 || 1);
	}
	return durations;
}

/** Interpolated joint angles at a normalized [0,1] position across the whole trajectory. */
function anglesAtProgress(progress: number): Record<string, number> | null {
	const waypoints = state.waypoints;
	if (!waypoints) return null;
	const jointNames = state.jointNames;
	const durations = segmentDurations(waypoints, jointNames);
	const total = durations.reduce((a, b) => a + b, 0) || 1;

	let target = Math.min(Math.max(progress, 0), 1) * total;
	let segIndex = 0;
	while (segIndex < durations.length - 1 && target > durations[segIndex]) {
		target -= durations[segIndex];
		segIndex++;
	}
	const t = Math.min(Math.max(target / (durations[segIndex] || 1), 0), 1);

	const from = waypoints[segIndex];
	const to = waypoints[segIndex + 1];
	const angles: Record<string, number> = {};
	jointNames.forEach((name, j) => {
		angles[name] = (from[j] ?? 0) + t * ((to[j] ?? 0) - (from[j] ?? 0));
	});
	return angles;
}

/** Move the viewer to a given [0,1] position and record it as the current progress.
 * Live joint-angle polling for this trajectory's system is paused (see
 * useSceneController's ptp-trajectory selection handler) while it's selected,
 * so this update isn't immediately overwritten by the real robot's pose. */
function applyProgress(progress: number) {
	state.progress = progress;
	const systemName: string = selection.item?.data?.systemName ?? '';
	const viewer = props.getViewer?.();
	const angles = anglesAtProgress(progress);
	if (viewer && angles && systemName) {
		viewer.updateJointAngles(systemName, angles);
	}
}

/** Fetch and cache the trajectory's joint waypoints + joint names, if not already loaded. */
async function ensureWaypointsLoaded(): Promise<boolean> {
	if (state.waypoints) return true;
	if (state.loading) return false;

	const data = selection.item?.data;
	const trajectoryName: string = data?.name ?? '';
	const systemName: string = data?.systemName ?? '';
	if (!trajectoryName || !systemName) return false;

	const viewer = props.getViewer?.();
	if (!viewer) {
		showToast('Viewer not available.', 'error'); return false;
	}

	const jointNames: string[] = viewer.getJointNames(systemName) ?? [];
	if (jointNames.length === 0) {
		showToast('No joint names found for system.', 'error'); return false;
	}

	state.loading = true;
	try {
		const detail = await apiGet<{ jointWaypoints: number[][] }>(
			`/api/ptp-trajectories/${encodeURIComponent(trajectoryName)}`,
		);
		const waypoints = detail.jointWaypoints ?? [];
		if (waypoints.length < 2) {
			showToast('Trajectory has fewer than 2 waypoints.', 'error');
			return false;
		}
		state.waypoints = waypoints;
		state.jointNames = jointNames;
		return true;
	} catch (err: any) {
		showToast(err?.message ?? 'Failed to fetch trajectory.', 'error');
		return false;
	} finally {
		state.loading = false;
	}
}

// ── Animation ─────────────────────────────────────────────────────

async function startVisualization() {
	const ok = await ensureWaypointsLoaded();
	if (!ok) return;

	const waypoints = state.waypoints!;
	const jointNames = state.jointNames;
	const durations = segmentDurations(waypoints, jointNames);
	const total = durations.reduce((a, b) => a + b, 0) || 1;

	state.visualizing = true;
	stopFlag = false;

	// Resume from wherever the slider currently is, rather than always restarting at 0.
	let elapsed = state.progress * total;
	if (elapsed >= total) elapsed = 0;

	while (elapsed < total) {
		if (stopFlag) break;
		applyProgress(elapsed / total);
		await sleep(FRAME_MS);
		elapsed += FRAME_MS;
	}
	if (!stopFlag) applyProgress(1);

	state.visualizing = false;
}

function stopVisualization() {
	stopFlag = true;
	state.visualizing = false;
}

/** Manual slider scrub: stop any running playback and jump the viewer to the new position. */
async function onScrub() {
	stopFlag = true;
	state.visualizing = false;
	const progress = state.progress;
	const ok = await ensureWaypointsLoaded();
	if (ok) applyProgress(progress);
}

// ── Tab helper ─────────────────────────────────────────────────────

function onTabClick(tab: 'info' | 'operations') {
	if (props.disabled) return;
	state.activeTab = tab;
}
</script>

<style scoped>

</style>
