<template>
	<div class="mesh-filter-widget">
		<div class="mesh-filter-widget__header">
			<h3 class="mesh-filter-widget__title">{{ $t('workflow.meshFilter.title') }}</h3>
			<button
				class="mesh-filter-widget__close"
				:disabled="disabled"
				@click="$emit('back')"
			>&times;</button>
		</div>

		<div class="mesh-filter-widget__body">
			<button
				class="btn btn--full"
				:disabled="disabled || state.loading || !state.filterType"
				@click="onFilterMesh"
			>{{ state.loading ? '…' : $t('workflow.meshFilter.button.filter') }}</button>

			<div class="setup-field setup-field--inline">
				<label class="setup-field__checkbox-label">
					<input
						type="checkbox"
						v-model="state.replaceObject"
						:disabled="disabled"
					/>
					{{ $t('workflow.meshFilter.label.replaceObject') }}
				</label>
			</div>

			<hr class="mesh-filter-widget__divider" />

			<div class="setup-field">
				<label class="setup-field__label">{{ $t('workflow.meshFilter.label.filterType') }}</label>
				<select
					class="setup-field__input"
					v-model="state.filterType"
					:disabled="disabled"
				>
					<option value="">{{ $t('workflow.meshFilter.placeholder') }}</option>
					<option value="smoothMesh">{{ $t('workflow.meshFilter.filter.smoothMesh') }}</option>
					<option value="largestRegion">{{ $t('workflow.meshFilter.filter.largestRegion') }}</option>
					<option value="boundingBox">{{ $t('workflow.meshFilter.filter.boundingBox') }}</option>
				</select>
			</div>

			<hr v-if="state.filterType" class="mesh-filter-widget__divider" />

			<!-- SmoothMesh params -->
			<template v-if="state.filterType === 'smoothMesh'">
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('workflow.meshFilter.param.passBand') }}</label>
					<input
						class="setup-field__input"
						type="number"
						v-model.number="state.smoothMeshParams.passBand"
						step="0.01"
						:disabled="disabled"
					/>
				</div>
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('workflow.meshFilter.param.numIterations') }}</label>
					<input
						class="setup-field__input"
						type="number"
						v-model.number="state.smoothMeshParams.numIterations"
						step="1"
						min="1"
						:disabled="disabled"
					/>
				</div>
			</template>

			<!-- LargestRegion: no params -->
			<template v-if="state.filterType === 'largestRegion'">
				<p class="mesh-filter-widget__empty-params">{{ $t('workflow.meshFilter.emptyParams') }}</p>
			</template>

			<!-- BoundingBox params -->
			<template v-if="state.filterType === 'boundingBox'">
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('workflow.meshFilter.param.bboxCenter') }}</label>
					<div class="setup-field__row">
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.center.x" step="0.001" :disabled="disabled" placeholder="X" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.center.y" step="0.001" :disabled="disabled" placeholder="Y" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.center.z" step="0.001" :disabled="disabled" placeholder="Z" />
					</div>
				</div>
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('workflow.meshFilter.param.bboxRPY') }}</label>
					<div class="setup-field__row">
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.rpy.roll" step="0.1" :disabled="disabled" :placeholder="$t('workflow.meshFilter.param.roll')" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.rpy.pitch" step="0.1" :disabled="disabled" :placeholder="$t('workflow.meshFilter.param.pitch')" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.rpy.yaw" step="0.1" :disabled="disabled" :placeholder="$t('workflow.meshFilter.param.yaw')" />
					</div>
				</div>
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('workflow.meshFilter.param.bboxExtents') }}</label>
					<div class="setup-field__row">
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.extents.x" step="0.001" :disabled="disabled" placeholder="X" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.extents.y" step="0.001" :disabled="disabled" placeholder="Y" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.boundingBoxParams.extents.z" step="0.001" :disabled="disabled" placeholder="Z" />
					</div>
				</div>
				<div class="setup-field setup-field--inline">
					<label class="setup-field__checkbox-label">
						<input
							type="checkbox"
							v-model="state.boundingBoxParams.enableZBound"
							:disabled="disabled"
						/>
						{{ $t('workflow.meshFilter.param.enableZBound') }}
					</label>
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue';
import { apiPost } from '../../services/api';
import { useSelection } from '../../composables/useSelection';
import { useWorkcell } from '../../composables/useWorkcell';
import { rpyToQuaternion } from '../../services/kinematics';
import { useToast } from '../../composables/useToast';

type FilterType = '' | 'smoothMesh' | 'largestRegion' | 'boundingBox';

interface SmoothMeshParams {
	passBand: number;
	numIterations: number;
}

interface BoundingBoxParams {
	center: { x: number; y: number; z: number };
	rpy: { roll: number; pitch: number; yaw: number };
	extents: { x: number; y: number; z: number };
	enableZBound: boolean;
}

// ── Props & Emits ──────────────────────────────────────────────────

defineProps<{
	disabled?: boolean;
}>();

const emit = defineEmits<{
	back: [];
	filtered: [meshUrl: string];
	'object-added': [name: string, meshUrl: string];
	'show-bbox': [center: { x: number; y: number; z: number }, orientation: { x: number; y: number; z: number; w: number }, extents: { x: number; y: number; z: number }];
	'hide-bbox': [];
}>();

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();
const workcell = useWorkcell();
const { showToast } = useToast();

// ── State ──────────────────────────────────────────────────────────

const state = reactive<{
	filterType: FilterType;
	replaceObject: boolean;
	smoothMeshParams: SmoothMeshParams;
	boundingBoxParams: BoundingBoxParams;
	loading: boolean;
}>({
	filterType: '',
	replaceObject: true,
	smoothMeshParams: {
		passBand: 0.1,
		numIterations: 10,
	},
	boundingBoxParams: {
		center: { x: 0.0, y: 0.0, z: 0.0 },
		rpy: { roll: 0.0, pitch: 0.0, yaw: 0.0 },
		extents: { x: 1.0, y: 1.0, z: 1.0 },
		enableZBound: true,
	},
	loading: false,
});

// ── Bounding Box Preview Watcher ────────────────────────────────────

watch(
	() => state.filterType === 'boundingBox' ? { ...state.boundingBoxParams } : null,
	(params) => {
		if (params) {
			const quat = rpyToQuaternion(params.rpy.roll, params.rpy.pitch, params.rpy.yaw);
			emit('show-bbox', params.center, quat, params.extents);
		} else {
			emit('hide-bbox');
		}
	},
	{ deep: true, immediate: true },
);

// ── Actions ────────────────────────────────────────────────────────

async function onFilterMesh() {
	if (!state.filterType || !selection.item) return;

	state.loading = true;

	try {
		const objectName = selection.item.data.name;
		const body: Record<string, unknown> = {
			filterType: state.filterType,
			replaceObject: state.replaceObject,
			workcellName: workcell.name,
		};

		if (state.filterType === 'smoothMesh') {
			body.passBand = state.smoothMeshParams.passBand;
			body.numIterations = state.smoothMeshParams.numIterations;
		} else if (state.filterType === 'boundingBox') {
			body.bboxCenter = { ...state.boundingBoxParams.center };
			body.bboxOrientation = rpyToQuaternion(
				state.boundingBoxParams.rpy.roll,
				state.boundingBoxParams.rpy.pitch,
				state.boundingBoxParams.rpy.yaw,
			);
			body.bboxExtents = { ...state.boundingBoxParams.extents };
			body.enableZBound = state.boundingBoxParams.enableZBound;
		}

		const data = await apiPost<{ meshUrl?: string; filteredMeshUrl?: string; filtered_object?: string }>(`/api/scene-objects/${encodeURIComponent(objectName)}/filter-mesh`, body);
		emit('filtered', data.meshUrl ?? '');
		if (!state.replaceObject && data.filteredMeshUrl && data.filtered_object) {
			emit('object-added', data.filtered_object, data.filteredMeshUrl);
		}
		emit('back');
	} catch (err: any) {
		showToast(err?.message ?? String(err), 'error');
	} finally {
		state.loading = false;
	}
}
</script>

<style scoped>
.mesh-filter-widget__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.5rem;
}

.mesh-filter-widget__title {
	margin: 0;
	font-size: 1.1rem;
	font-weight: 600;
	color: var(--accent-strong);
}

.mesh-filter-widget__close {
	border: none;
	background: transparent;
	color: #999;
	font-size: 1.5rem;
	line-height: 1;
	cursor: pointer;
	padding: 0.2rem;
	transition: color 0.15s;
}

.mesh-filter-widget__close:hover {
	color: #666;
}

.mesh-filter-widget__body .setup-field__input {
	color: var(--ink);
	background: #fff;
	border-color: var(--line);
}

.mesh-filter-widget__body .setup-field__input:focus {
	border-color: var(--accent);
	box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.15);
}

.mesh-filter-widget__body select.setup-field__input {
	cursor: pointer;
}

.mesh-filter-widget__body select.setup-field__input option {
	color: var(--ink);
	background: #fff;
}

.mesh-filter-widget__body .setup-field__label {
	color: var(--accent);
}

.mesh-filter-widget__divider {
	border: none;
	border-top: 1px solid var(--line);
	margin: 0.25rem 0 0.75rem;
}

.mesh-filter-widget__empty-params {
	color: var(--ink-muted);
	font-size: 0.85rem;
	font-style: italic;
	padding: 0.5rem 0;
}

.setup-field__row {
	display: flex;
	gap: 0.35rem;
}

.setup-field__input--third {
	flex: 1;
	min-width: 0;
}

.setup-field__input--quarter {
	flex: 1;
	min-width: 0;
}
</style>
