<template>
	<div class="setup-scene-object">
		<div class="setup-scene-object__header">
			<h3 class="setup-scene-object__title">
				{{ $t('setup.area.title') }}
				<span v-if="parentName" style="font-weight: 400; opacity: 0.6;"> - {{ parentName }}</span>
			</h3>
			<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
		</div>

		<div class="setup-field-row">
			<label class="setup-field__label setup-field__label--inline" style="width: auto;">{{ $t('setup.area.label.name') }}</label>
			<input
				class="setup-field__input"
				type="text"
				v-model="state.areaName"
				:placeholder="$t('setup.area.placeholder.name')"
			/>
			<button
				class="btn"
				style="white-space: nowrap; flex-shrink: 0;"
				:disabled="!state.areaName.trim() || state.creating"
				@click="onCreate"
			>{{ state.creating ? $t('setup.area.button.extracting') : $t('setup.area.button.create') }}</button>
		</div>

		<hr class="setup-divider" />

		<div class="setup-tabs">
			<button
				class="setup-tabs__tab"
				:class="{ active: state.activeTab === 'free-draw' }"
				@click="state.activeTab = 'free-draw'"
			>{{ $t('setup.area.tab.freeDraw') }}</button>
			<button
				class="setup-tabs__tab"
				:class="{ active: state.activeTab === 'generate-from-mesh' }"
				@click="state.activeTab = 'generate-from-mesh'"
			>{{ $t('setup.area.tab.generateFromMesh') }}</button>
		</div>

		<div v-if="state.activeTab === 'free-draw'" class="cartesian-actions">
			<p class="setup-tab-content__hint">{{ $t('setup.area.hint.clickObject') }}</p>
			<button class="btn btn--full" @click="emit('clear-area-points')">{{ $t('setup.area.button.clearPoints') }}</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, watch, onUnmounted } from 'vue';
import { useToast } from '../../composables/useToast';

// ── Props & Emits ──────────────────────────────────────────────────

const props = defineProps<{
	workcellName?: string;
	parentName: string;
	existingAreaNames?: string[];
}>();

const emit = defineEmits<{
	close: [];
	'area-created': [payload: { name: string; onComplete: () => void }];
	'free-draw-mode': [payload: { active: boolean; parentName?: string }];
	'clear-area-points': [];
}>();

const { showToast } = useToast();

// ── State ──────────────────────────────────────────────────────────

const state = reactive({
	areaName: '',
	activeTab: 'free-draw' as 'free-draw' | 'generate-from-mesh',
	creating: false,
});

// ── Tab switching ──────────────────────────────────────────────────

watch(() => state.activeTab, (tab) => {
	if (tab === 'free-draw') {
		emit('free-draw-mode', { active: true, parentName: props.parentName });
	} else {
		emit('free-draw-mode', { active: false });
	}
}, { immediate: true });

onUnmounted(() => {
	emit('free-draw-mode', { active: false });
});

// ── Actions ────────────────────────────────────────────────────────

async function onCreate() {
	const name = state.areaName.trim();
	if (!name) return;
	if (props.existingAreaNames?.includes(name)) {
		showToast(`An area named '${name}' already exists.`, 'error');
		return;
	}
	state.creating = true;
	await new Promise<void>((resolve) => {
		emit('area-created', { name, onComplete: resolve });
	});
	state.creating = false;
}
</script>
