<template>
	<div class="info-content">
		<h3 class="info-title">{{ selection.item!.data.name }}</h3>

		<div class="info-tabs">
			<button
				class="info-tab"
				:class="{ active: activeTab === 'info' }"
				:disabled="disabled"
				@click="onTabClick('info')"
			>{{ $t('info.tab.information') }}</button>
			<button
				class="info-tab"
				:class="{ active: activeTab === 'setup' }"
				:disabled="disabled"
				@click="onTabClick('setup')"
			>{{ $t('info.tab.setup') }}</button>
			<button
				class="info-tab"
				:class="{ active: activeTab === 'operations' }"
				:disabled="disabled"
				@click="onTabClick('operations')"
			>{{ $t('info.tab.operations') }}</button>
		</div>

		<!-- Tab: Information -->
		<div v-if="activeTab === 'info'" class="tab-content">
			<section class="info-section">
				<h4 class="info-section__title">{{ $t('info.camera.title') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.name') }}</span>
					<span class="info-value">{{ selection.item!.data.name }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.camera.label.parent') }}</span>
					<span class="info-value">{{ selection.item!.data.parent || 'world' }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.camera.label.cameraId') }}</span>
					<span class="info-value">{{ selection.item!.data.cameraId }}</span>
				</div>
			</section>

			<section class="info-section">
				<h4 class="info-section__title">{{ $t('info.label.position') }} / {{ $t('info.label.orientation') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.position') }}</span>
					<span class="info-value">{{ positionText }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.orientation') }}</span>
					<span class="info-value">{{ orientationText }}</span>
				</div>
			</section>

			<section class="info-section">
				<h4 class="info-section__title">{{ $t('info.camera.sectionOptics') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.camera.label.farWidth') }}</span>
					<span class="info-value">{{ selection.item!.data.farWidth }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.camera.label.farHeight') }}</span>
					<span class="info-value">{{ selection.item!.data.farHeight }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.camera.label.farDistance') }}</span>
					<span class="info-value">{{ selection.item!.data.farDistance }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.camera.label.nearDistance') }}</span>
					<span class="info-value">{{ selection.item!.data.nearDistance }}</span>
				</div>
				<div class="info-row">
					<span class="info-label">{{ $t('info.camera.label.depthScale') }}</span>
					<span class="info-value">{{ selection.item!.data.depthScale }}</span>
				</div>
			</section>
		</div>

		<!-- Tab: Setup (edit the selected camera's configuration; also hosts delete) -->
		<SetupCamera
			v-else-if="activeTab === 'setup'"
			:editCameraName="cameraName"
			:showCloseButton="false"
			@close="activeTab = 'info'"
			@camera-modified="onCameraModified"
			@camera-deleted="onCameraDeleted"
		/>

		<!-- Tab: Operations -->
		<div v-else class="tab-content">
			<p class="info-empty-state">{{ $t('info.emptyState.noOperations', { type: $t('info.camera.title') }) }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSelection } from '../../composables/useSelection';
import { quatToRpy } from '../../services/kinematics';
import { radToDeg } from '../../utils/math';
import SetupCamera from '../setups/SetupCamera.vue';
import type { CameraCreatedPayload } from '../../composables/tree/useSceneTreeSetup';

// ── Props & Emits ──────────────────────────────────────────────────

const props = defineProps<{
	disabled?: boolean;
}>();

const emit = defineEmits<{
	'camera-modified': [camera: CameraCreatedPayload];
	'camera-deleted': [name: string];
}>();

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();

// ── State ──────────────────────────────────────────────────────────

type TabKey = 'info' | 'setup' | 'operations';

const activeTab = ref<TabKey>('info');

const cameraName = computed<string>(() => selection.item?.data?.name ?? '');

// Reset to the Information tab whenever a different camera is selected.
watch(cameraName, () => {
	activeTab.value = 'info';
});

// ── Display Helpers ────────────────────────────────────────────────

const positionText = computed(() => {
	const p = selection.item?.data?.position;
	if (!Array.isArray(p) || p.length !== 3) return '—';
	return `[${p.map((v: number) => v.toFixed(3)).join(', ')}] m`;
});

const orientationText = computed(() => {
	const q = selection.item?.data?.quaternion;
	if (!Array.isArray(q) || q.length !== 4) return '—';
	const rpy = quatToRpy({ x: q[0], y: q[1], z: q[2], w: q[3] });
	const deg = [radToDeg(rpy.roll), radToDeg(rpy.pitch), radToDeg(rpy.yaw)];
	return `[${deg.map((v) => v.toFixed(1)).join(', ')}] deg (RPY)`;
});

// ── Tab Helper ─────────────────────────────────────────────────────

function onTabClick(tab: TabKey) {
	if (props.disabled) return;
	activeTab.value = tab;
}

// ── Setup lifecycle (forwarded to the scene-navigator setup machine) ─

function onCameraModified(camera: CameraCreatedPayload) {
	emit('camera-modified', camera);
	activeTab.value = 'info';
}

function onCameraDeleted(name: string) {
	emit('camera-deleted', name);
}
</script>
