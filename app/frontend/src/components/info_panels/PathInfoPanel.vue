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
				<h4 class="info-section__title">{{ $t('info.path.title') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.name') }}</span>
					<span class="info-value">{{ selection.item!.data.name }}</span>
				</div>
			</section>
		</div>

		<!-- Tab: Operations -->
		<div v-if="state.activeTab === 'operations'" class="tab-content">
			<div style="display: flex; flex-direction: column; gap: 0.5rem;">
				<button class="btn-ik-solve" @click="state.showRotateSlider = !state.showRotateSlider">
					{{ $t('info.path.button.rotate') }}
				</button>
				<div v-if="state.showRotateSlider" class="rotate-slider-section">
					<div class="rotate-slider-row">
						<span class="info-label">{{ state.rotateAngle }}°</span>
						<input
							type="range"
							min="-180"
							max="180"
							step="1"
							v-model.number="state.rotateAngle"
							class="rotate-slider"
						/>
					</div>
					<div class="rotate-slider-bounds">
						<span>-180°</span>
						<span>0°</span>
						<span>180°</span>
					</div>
					<button
						class="btn-ik-solve"
						:disabled="state.applying || state.rotateAngle === 0"
						@click="onApplyRotation"
					>
						{{ state.applying ? $t('info.path.button.applying') : $t('info.path.button.applyChanges') }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useSelection } from '../../composables/useSelection';
import type { SceneViewer } from '../../services/viewer/sceneViewer';
import { apiPut } from '../../services/api';
import { useToast } from '../../composables/useToast';

// ── Props ──────────────────────────────────────────────────────────

const props = defineProps<{
	disabled?: boolean;
	getViewer?: () => SceneViewer | null;
	workcellName?: string;
}>();

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();
const { showToast } = useToast();

// ── State ──────────────────────────────────────────────────────────

const state = reactive({
	activeTab: 'info' as 'info' | 'operations',
	showRotateSlider: false,
	rotateAngle: 0,
	applying: false,
});

// ── Live rotation preview ──────────────────────────────────────────

watch(() => state.rotateAngle, (angle) => {
	const name = selection.item?.data?.name;
	if (!name) return;
	props.getViewer?.()?.previewPathRotationZ(name, angle);
});

watch(() => state.showRotateSlider, (visible) => {
	if (!visible) {
		state.rotateAngle = 0;
		const name = selection.item?.data?.name;
		if (name) props.getViewer?.()?.previewPathRotationZ(name, 0);
	}
});

watch(() => selection.item?.data?.name, (newName, oldName) => {
	if (!state.showRotateSlider || newName === oldName) return;
	if (oldName) props.getViewer?.()?.previewPathRotationZ(oldName, 0);
	state.rotateAngle = 0;
});

// ── Tab Helper ─────────────────────────────────────────────────────

function onTabClick(tab: 'info' | 'operations') {
	if (props.disabled) return;
	state.activeTab = tab;
}

async function onApplyRotation() {
	const name = selection.item?.data?.name;
	if (!name || state.rotateAngle === 0 || state.applying) return;
	state.applying = true;
	try {
		const viewer = props.getViewer?.();
		const waypoints = viewer?.getPathRotatedWaypoints(name, state.rotateAngle);
		if (!waypoints) throw new Error('Path data not found in viewer');
		await apiPut(`/api/path/${encodeURIComponent(name)}/waypoints`, { CartesianWaypoints: waypoints, workcellName: props.workcellName ?? '' });
		viewer?.commitPathRotationZ(name, state.rotateAngle);
		state.rotateAngle = 0;
	} catch (err: unknown) {
		showToast(err instanceof Error ? err.message : 'Failed to apply changes', 'error');
	} finally {
		state.applying = false;
	}
}
</script>

<style scoped>
.rotate-slider-section {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 0.5rem 0;
}

.rotate-slider-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.rotate-slider-row .info-label {
	min-width: 3.5rem;
	text-align: right;
	flex-shrink: 0;
}

.rotate-slider {
	flex: 1;
	accent-color: var(--accent);
	cursor: pointer;
}

.rotate-slider-bounds {
	display: flex;
	justify-content: space-between;
	font-size: 0.72rem;
	color: var(--text-muted, #888);
}

</style>
