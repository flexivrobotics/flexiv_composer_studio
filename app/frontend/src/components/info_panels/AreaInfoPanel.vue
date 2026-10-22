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
				<h4 class="info-section__title">{{ $t('info.area.title') }}</h4>
				<div class="info-row">
					<span class="info-label">{{ $t('info.label.name') }}</span>
					<span class="info-value">{{ selection.item!.data.name }}</span>
				</div>
				<div v-if="selection.item!.data.parentName" class="info-row">
					<span class="info-label">{{ $t('info.area.label.parentObject') }}</span>
					<span class="info-value">{{ selection.item!.data.parentName }}</span>
				</div>
			</section>
		</div>

		<!-- Tab: Operations -->
		<div v-if="state.activeTab === 'operations'" class="tab-content">
			<p class="info-empty-state">{{ $t('info.emptyState.noOperations', { type: $t('info.area.title') }) }}</p>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useSelection } from '../../composables/useSelection';

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

// ── Tab Helper ─────────────────────────────────────────────────────

function onTabClick(tab: 'info' | 'operations') {
	if (props.disabled) return;
	state.activeTab = tab;
}
</script>
