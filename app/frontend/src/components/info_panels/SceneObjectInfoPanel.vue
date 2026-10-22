<template>
	<div class="info-content">
		<MeshFilterWidget
			v-if="state.showMeshFilter"
			:disabled="disabled"
			@back="onCloseFilter"
			@filtered="onFiltered"
			@object-added="(name: string, url: string) => emit('object-added', name, url)"
			@show-bbox="(c, o, e) => emit('show-bbox', c, o, e)"
			@hide-bbox="emit('hide-bbox')"
		/>

		<template v-else>
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
					<h4 class="info-section__title">{{ $t('info.sceneObject.title') }}</h4>
					<div class="info-row">
						<span class="info-label">{{ $t('info.label.type') }}</span>
						<span class="info-value">{{ selection.item!.data.visualType === 'mesh' ? $t('info.sceneObject.mesh') : $t('info.sceneObject.primitive') }}</span>
					</div>
					<div class="info-row">
						<span class="info-label">{{ $t('info.label.parent') }}</span>
						<span class="info-value">{{ parentLabel }}</span>
					</div>
				</section>

				<!-- Pose (editable, two-way with the SDK via ConfigService.SetPose) -->
				<section class="info-section">
					<h4 class="info-section__title">{{ $t('info.pose.title') }}</h4>
					<div class="tcp-pose-row">
						<label class="tcp-pose-label tcp-pose-label--group">Pos (m)</label>
						<label class="tcp-pose-label">X</label>
						<input type="number" class="tcp-input" step="0.001" :disabled="disabled" v-model.number="form.position[0]" />
						<label class="tcp-pose-label">Y</label>
						<input type="number" class="tcp-input" step="0.001" :disabled="disabled" v-model.number="form.position[1]" />
						<label class="tcp-pose-label">Z</label>
						<input type="number" class="tcp-input" step="0.001" :disabled="disabled" v-model.number="form.position[2]" />
					</div>
					<div class="tcp-pose-row">
						<label class="tcp-pose-label tcp-pose-label--group">RPY (°)</label>
						<label class="tcp-pose-label">R</label>
						<input type="number" class="tcp-input" step="0.1" :disabled="disabled" v-model.number="form.rpy.roll" />
						<label class="tcp-pose-label">P</label>
						<input type="number" class="tcp-input" step="0.1" :disabled="disabled" v-model.number="form.rpy.pitch" />
						<label class="tcp-pose-label">Y</label>
						<input type="number" class="tcp-input" step="0.1" :disabled="disabled" v-model.number="form.rpy.yaw" />
					</div>
					<button
						class="btn btn--full"
						:disabled="disabled || applying"
						@click="applyPose"
					>{{ applying ? $t('info.pose.applying') : $t('info.pose.apply') }}</button>
				</section>
			</div>

			<!-- Tab: Operations -->
			<div v-if="state.activeTab === 'operations'" class="tab-content">
				<button
					v-if="selection.item!.data.visualType === 'mesh'"
					class="btn btn--full"
					:disabled="disabled"
					@click="state.showMeshFilter = true"
				>{{ $t('info.sceneObject.button.filterMesh') }}</button>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from '../../composables/useI18n';
import { useSelection } from '../../composables/useSelection';
import { useToast } from '../../composables/useToast';
import { apiPatch } from '../../services/api';
import { quatToRpy, rpyToQuaternion } from '../../services/kinematics';
import { radToDeg } from '../../utils/math';
import MeshFilterWidget from '../tools/MeshFilterWidget.vue';

// ── Props & Emits ──────────────────────────────────────────────────

const props = defineProps<{
	disabled?: boolean;
	getViewer?: () => any;
}>();

const emit = defineEmits<{
	'reload-mesh': [name: string, meshUrl: string];
	'object-added': [name: string, meshUrl: string];
	'show-bbox': [center: { x: number; y: number; z: number }, orientation: { x: number; y: number; z: number; w: number }, extents: { x: number; y: number; z: number }];
	'hide-bbox': [];
}>();

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();
const { showToast } = useToast();
const { t } = useI18n();

// ── Parent (attachment) ───────────────────────────────────────────
// A scene object is normally parented to the world (scene root), but one
// declared with a <parent_external> link in its URDF is instead attached to
// a robot link/flange so it inherits that link's live transform.

const parentLabel = computed(() => {
	const name = selection.item?.data?.name;
	if (!name) return '';
	const attachment = props.getViewer?.()?.getGroupAttachment(name);
	if (!attachment) return t('info.sceneObject.world');
	return `${attachment.systemName} (${attachment.linkName})`;
});

// ── State ──────────────────────────────────────────────────────────

const state = reactive({
	activeTab: 'info' as 'info' | 'operations',
	showMeshFilter: false,
});

// ── Pose (editable) ────────────────────────────────────────────────
// Mirrors ConfigHeader.pose_in_parent [required] in scene/object.proto:
// both position and orientation must be present for a SetPose write.
// The wire format is quaternion-only; RPY (degrees) is edited here and
// converted to/from quaternion at the form boundary, same as PoseControl.vue.

const applying = ref(false);
const form = reactive({
	position: [0, 0, 0] as number[],
	rpy: { roll: 0, pitch: 0, yaw: 0 },
});

function seedForm(pose: any): void {
	if (pose?.position?.length === 3 && pose?.quaternion?.length === 4) {
		form.position = [...pose.position];
		const [x, y, z, w] = pose.quaternion;
		const rpy = quatToRpy({ x, y, z, w });
		form.rpy = {
			roll: +radToDeg(rpy.roll).toFixed(1),
			pitch: +radToDeg(rpy.pitch).toFixed(1),
			yaw: +radToDeg(rpy.yaw).toFixed(1),
		};
	}
}

// Seed on selection change and refresh live when a move event updates the pose.
watch(
	() => selection.item?.data?.pose,
	(pose) => seedForm(pose),
	{ immediate: true, deep: true },
);

async function applyPose(): Promise<void> {
	const name = selection.item?.data?.name;
	if (!name) return;

	if (form.position.some((n) => !Number.isFinite(n))) {
		showToast('Invalid position.', 'error');
		return;
	}
	const { roll, pitch, yaw } = form.rpy;
	if (![roll, pitch, yaw].every((n) => Number.isFinite(n))) {
		showToast('Invalid rpy.', 'error');
		return;
	}

	const q = rpyToQuaternion(roll, pitch, yaw);
	const payload = { position: form.position, quaternion: [q.x, q.y, q.z, q.w] };

	applying.value = true;
	try {
		// The server re-emits CHANGE_UPDATED, which would move the viewer group
		// and refresh this form via the live scene-event stream — but that stream
		// is only connected while "Live Scene Events" is on (off by default, since
		// it disables UI interaction while active). So the viewer/form are updated
		// directly here instead of waiting on an event that normally never arrives.
		await apiPatch(`/api/scene-objects/${encodeURIComponent(name)}/pose`, payload);
		props.getViewer?.()?.setGroupPose(name, form.position as [number, number, number], payload.quaternion as [number, number, number, number]);
		if (selection.item) {
			selection.item.data.pose = { position: [...form.position], quaternion: [...payload.quaternion] };
		}
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		applying.value = false;
	}
}

// ── Tab Helper ─────────────────────────────────────────────────────

function onTabClick(tab: 'info' | 'operations') {
	if (props.disabled) return;
	state.activeTab = tab;
}

// ── Filter Handler ─────────────────────────────────────────────────

function onCloseFilter() {
	state.showMeshFilter = false;
	emit('hide-bbox');
}

function onFiltered(meshUrl: string) {
	state.showMeshFilter = false;
	emit('hide-bbox');
	if (meshUrl && selection.item?.data?.name) {
		emit('reload-mesh', selection.item.data.name, meshUrl);
	}
}
</script>
