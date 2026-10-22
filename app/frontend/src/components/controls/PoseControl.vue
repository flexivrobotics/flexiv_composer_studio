<template>
	<div class="tcp-pose-panel">
		<section class="info-section">
			<h4 class="info-section__title">Pose<span v-if="frame" class="info-section__title"> — {{ frame }}</span></h4>
			<div class="tcp-pose-row">
				<label class="tcp-pose-label tcp-pose-label--group">Pos (m)</label>
				<label class="tcp-pose-label">X</label>
				<input type="number" class="tcp-input" v-model.number="form.pos.x" step="0.001" />
				<label class="tcp-pose-label">Y</label>
				<input type="number" class="tcp-input" v-model.number="form.pos.y" step="0.001" />
				<label class="tcp-pose-label">Z</label>
				<input type="number" class="tcp-input" v-model.number="form.pos.z" step="0.001" />
			</div>
			<div class="tcp-pose-row">
				<label class="tcp-pose-label tcp-pose-label--group">RPY (°)</label>
				<label class="tcp-pose-label">R</label>
				<input type="number" class="tcp-input" v-model.number="form.rpy.roll" step="0.1" />
				<label class="tcp-pose-label">P</label>
				<input type="number" class="tcp-input" v-model.number="form.rpy.pitch" step="0.1" />
				<label class="tcp-pose-label">Y</label>
				<input type="number" class="tcp-input" v-model.number="form.rpy.yaw" step="0.1" />
			</div>
		</section>

		<NullspaceControl
			v-model:nullspace="form.nullspace"
			v-model:extAxisMode="extAxisMode"
			:ikSeedSliders="ikSeedSliders"
		/>

		<p v-if="solving" class="ik-status">Solving IK…</p>
	</div>
</template>

<script setup lang="ts">
// ── PoseControl ────────────────────────────────────────────────────────
// TCP pose form: owns the form state and viewer sync.
// IK seed sliders and IK solving are delegated to sub-composables.

import { reactive, ref, watch, nextTick } from 'vue';
import { quatToRpy } from '../../services/kinematics';
import { useIkSeedSliders } from '../../composables/controller/useIkSeedSliders';
import { useIkSolver } from '../../composables/controller/useIkSolver';
import { radToDeg, degToRad, jointToDisplay, jointFromDisplay, jointDecimals } from '../../utils/math';
import NullspaceControl from './NullspaceControl.vue';

// ── Props & Emits ──────────────────────────────────────────────────────

const props = defineProps<{
	systemName: string;
	frame: string;
	jointNames: string[];
	externalAxisData: { name?: string; lowerLimit?: number[]; upperLimit?: number[]; prismatic?: boolean[] } | null;
	getLinkPose: ((systemName: string, linkName: string) => { position: [number, number, number]; quaternion: [number, number, number, number] } | null) | null;
	getCurrentJointAngles: ((systemName: string) => Record<string, number> | null) | null;
}>();

const emit = defineEmits<{
	'update-joint-angles': [payload: { systemName: string; jointAngles: Record<string, number> }];
}>();

// ── Form State ─────────────────────────────────────────────────────────

const form = reactive({
	pos: { x: 0, y: 0, z: 0 },
	rpy: { roll: 0, pitch: 0, yaw: 0 },
	nullspace: 0,
});

const extAxisMode = ref<'preset' | 'preferred'>('preferred');

// ── Sub-composables ────────────────────────────────────────────────────

const { ikSeedSliders, rebuildIkSeedSliders } =
	useIkSeedSliders(props);

const { solving, scheduleSolveIk, suppressSchedule, unsuppressSchedule } =
	useIkSolver(props, form, ikSeedSliders, extAxisMode, emit);

// ── Viewer Sync ────────────────────────────────────────────────────────

function _syncFromViewer() {
	if (!props.frame || !props.getLinkPose) return;
	const pose = props.getLinkPose(props.systemName, props.frame);

	// Print the pose to the console for debugging purposes
	console.log('Syncing from viewer. Pose:', pose);

	if (!pose) return;
	form.pos.x = +pose.position[0].toFixed(3);
	form.pos.y = +pose.position[1].toFixed(3);
	form.pos.z = +pose.position[2].toFixed(3);
	const [qx, qy, qz, qw] = pose.quaternion;
	const rpy = quatToRpy({ x: qx, y: qy, z: qz, w: qw });
	form.rpy.roll = +radToDeg(rpy.roll).toFixed(1);
	form.rpy.pitch = +radToDeg(rpy.pitch).toFixed(1);
	form.rpy.yaw = +radToDeg(rpy.yaw).toFixed(1);

	console.log("RPY:", form.rpy);
}

// Called externally after a successful TCP drag IK — suppresses the
// subsequent watcher-triggered IK so the drag result isn't re-solved.
function syncFromViewer() {
	suppressSchedule();
	_syncFromViewer();
	nextTick(() => unsuppressSchedule());
}

// ── Watches ────────────────────────────────────────────────────────────

watch(() => props.frame, (newFrame) => { if (newFrame) _syncFromViewer(); });
watch(() => props.externalAxisData, rebuildIkSeedSliders, { immediate: true });
watch(form, scheduleSolveIk, { deep: true });
watch(ikSeedSliders, scheduleSolveIk, { deep: true });
watch(extAxisMode, scheduleSolveIk);

// ── Exposed API ────────────────────────────────────────────────────────

/** Called by the parent to populate the form when the panel is first opened. */
function open() {
	form.pos = { x: 0, y: 0, z: 0 };
	form.rpy = { roll: 0, pitch: 0, yaw: 0 };
	form.nullspace = 0;
	rebuildIkSeedSliders();

	const currentAngles = props.getCurrentJointAngles?.(props.systemName);
	if (currentAngles) {
		const extName = props.externalAxisData?.name as string | undefined;
		const manipJoints = extName
			? props.jointNames.filter(n => !n.includes(extName))
			: props.jointNames;
		const joint3Name = manipJoints[3];
		if (joint3Name != null && currentAngles[joint3Name] != null) {
			form.nullspace = +radToDeg(currentAngles[joint3Name]).toFixed(1);
		}
		for (const slider of ikSeedSliders) {
			const rad = currentAngles[slider.name];
			if (rad != null) slider.value = +jointToDisplay(rad, slider.prismatic).toFixed(jointDecimals(slider.prismatic));
		}
	}

	_syncFromViewer();
}

/** Current elbow-swivel / external-axis nullspace state, for use by TCP drag IK. */
function getNullspaceParams() {
	const externalAxisPosition = ikSeedSliders.map(s => jointFromDisplay(s.value, s.prismatic));
	return {
		elbowSwivelAngle: degToRad(form.nullspace),
		externalAxisPosition: externalAxisPosition.length > 0 ? externalAxisPosition : undefined,
		externalAxisPositionPreset: externalAxisPosition.length > 0 ? extAxisMode.value === 'preset' : undefined,
	};
}

defineExpose({ open, syncFromViewer, getNullspaceParams });
</script>
