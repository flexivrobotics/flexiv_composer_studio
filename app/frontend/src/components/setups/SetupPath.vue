<template>
	<div class="setup-scene-object setup-scene-object--fixed-tabs">
		<div class="setup-scene-object__sticky">
			<div class="setup-scene-object__header">
				<h3 class="setup-scene-object__title">
					{{ $t('setup.path.title') }}
					<span v-if="parentName" style="font-weight: 400; opacity: 0.6;"> - {{ parentName }}</span>
				</h3>
				<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
			</div>

			<div class="setup-field-row">
				<label class="setup-field__label setup-field__label--inline" style="width: auto;">{{ $t('setup.path.label.name') }}</label>
				<input
					class="setup-field__input"
					type="text"
					v-model="state.pathName"
					:placeholder="$t('setup.path.placeholder.name')"
				/>
				<button
					class="btn"
					style="white-space: nowrap; flex-shrink: 0;"
					:disabled="!canSubmit || state.creating"
					@click="onSubmit"
				>{{ state.creating ? $t('setup.path.button.creating') : $t('setup.path.button.create') }}</button>
			</div>

			<hr class="setup-divider" />

			<div class="setup-tabs">
				<button
					class="setup-tabs__tab"
					:class="{ active: state.activeTab === 'free-sketch' }"
					@click="state.activeTab = 'free-sketch'"
				>{{ $t('setup.path.tab.freeSketch') }}</button>
				<button
					class="setup-tabs__tab"
					:class="{ active: state.activeTab === 'generate-from-area' }"
					@click="state.activeTab = 'generate-from-area'"
				>{{ $t('setup.path.tab.generateFromArea') }}</button>
			</div>
		</div>

		<div class="setup-scene-object__scrollable">

		<!-- Free Sketch tab -->
		<div v-if="state.activeTab === 'free-sketch'" class="setup-tab-content">
			<p class="setup-tab-content__hint">{{ $t('setup.path.hint.clickObject') }}</p>
			<div class="setup-tabs setup-tabs--compact">
				<button
					class="setup-tabs__tab"
					:class="{ active: state.freeSketchSubTab === 'parameters' }"
					@click="state.freeSketchSubTab = 'parameters'"
				>{{ $t('setup.path.subTab.parameters') }}</button>
				<button
					class="setup-tabs__tab"
					:class="{ active: state.freeSketchSubTab === 'orientation' }"
					@click="state.freeSketchSubTab = 'orientation'"
				>{{ $t('setup.path.subTab.orientationAlignment') }}</button>
			</div>

			<div v-if="state.freeSketchSubTab === 'parameters'" class="setup-tab-content">
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.pointSpacing') }}</label>
					<input
						class="setup-field__input"
						type="number"
						v-model.number="state.pointSpacing"
						step="0.001"
						min="0.001"
					/>
				</div>
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.blendingRadius') }}</label>
					<input
						class="setup-field__input"
						type="number"
						v-model.number="state.blendingRadius"
						step="0.001"
						min="0"
					/>
				</div>
				<div style="margin-top: 0.5rem;">
					<button class="btn-ik-solve" style="width: 100%;" @click="$emit('clear-waypoints')">{{ $t('setup.path.button.clearWaypoints') }}</button>
				</div>
			</div>

			<div v-else class="setup-tab-content">
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.orientationAlignment') }}</label>
					<select class="setup-field__input" v-model="state.orientationAlignment.type">
						<option value="initial_direction">{{ $t('setup.path.label.alignWithInitialDirection') }}</option>
						<option value="previous">{{ $t('setup.path.label.alignWithPrevious') }}</option>
						<option value="direction">{{ $t('setup.path.label.alignWithDirection') }}</option>
					</select>
				</div>
				<div v-if="state.orientationAlignment.type === 'direction'" style="margin-top: 0.5rem;">
					<div class="setup-field__row">
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.orientationAlignment.direction.x" step="0.01" placeholder="X" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.orientationAlignment.direction.y" step="0.01" placeholder="Y" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.orientationAlignment.direction.z" step="0.01" placeholder="Z" />
					</div>
				</div>
			</div>
		</div>

		<!-- Generate from Area tab -->
		<div v-else class="setup-tab-content">
			<!-- Area selector -->
			<div class="setup-field-row">
				<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.area') }}</label>
				<select class="setup-field__input" v-model="state.selectedArea" :disabled="!areas || areas.length === 0" @change="onAreaSelect">
					<option value="" disabled>{{ areas && areas.length > 0 ? $t('setup.path.placeholder.selectArea') : $t('setup.path.placeholder.noAreas') }}</option>
					<option v-for="area in areas" :key="area" :value="area">{{ area }}</option>
				</select>
			</div>

			<hr class="setup-divider" />

			<div class="setup-tabs setup-tabs--compact">
				<button
					class="setup-tabs__tab"
					:class="{ active: state.rasterSubTab === 'parameters' }"
					@click="state.rasterSubTab = 'parameters'"
				>{{ $t('setup.path.subTab.parameters') }}</button>
				<button
					class="setup-tabs__tab"
					:class="{ active: state.rasterSubTab === 'orientation' }"
					@click="state.rasterSubTab = 'orientation'"
				>{{ $t('setup.path.subTab.orientationAlignment') }}</button>
			</div>

			<div v-if="state.rasterSubTab === 'parameters'" class="setup-tab-content">
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.fixedSpacing') }}</label>
					<input class="setup-field__input" type="number" v-model.number="state.raster.fixedSpacing" step="0.001" min="0.001" />
				</div>
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.blendingRadius') }}</label>
					<input class="setup-field__input" type="number" v-model.number="state.raster.blendingRadius" step="0.001" min="0" />
				</div>
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.borderOffset') }}</label>
					<input class="setup-field__input" type="number" v-model.number="state.raster.borderOffset" step="0.001" />
				</div>
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.rasterLineSpacing') }}</label>
					<input class="setup-field__input" type="number" v-model.number="state.raster.rasterLineSpacing" step="0.001" min="0.001" />
				</div>
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.rasterJoiningThreshold') }}</label>
					<input
						class="setup-field__input"
						type="number"
						v-model.number="state.raster.rasterJoiningThreshold"
						step="0.001"
						:min="+(state.raster.rasterLineSpacing * 2).toFixed(6)"
						@blur="state.raster.rasterJoiningThreshold = Math.max(state.raster.rasterJoiningThreshold, +(state.raster.rasterLineSpacing * 2).toFixed(6))"
					/>
				</div>

				<hr class="setup-divider" />

				<!-- Raster direction -->
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.path.label.rasterDirection') }}</label>
					<div class="setup-tabs setup-tabs--compact">
						<button
							class="setup-tabs__tab"
							:class="{ active: state.raster.directionType === 'principal' }"
							@click="state.raster.directionType = 'principal'"
						>{{ $t('setup.path.label.principalAngle') }}</button>
						<button
							class="setup-tabs__tab"
							:class="{ active: state.raster.directionType === 'specified' }"
							@click="state.raster.directionType = 'specified'"
						>{{ $t('setup.path.label.specifiedDirection') }}</button>
					</div>
					<div v-if="state.raster.directionType === 'principal'" class="setup-field-row" style="margin-top: 0.5rem;">
						<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.principalRotationAngle') }}</label>
						<input class="setup-field__input" type="number" v-model.number="state.raster.principalRotationAngle" step="1" min="-90" max="90" @change="state.raster.principalRotationAngle = Math.min(90, Math.max(-90, state.raster.principalRotationAngle))" />
					</div>
					<div v-else style="margin-top: 0.5rem;">
						<div class="setup-field__row">
							<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.raster.specifiedDirection.x" step="0.01" placeholder="X" />
							<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.raster.specifiedDirection.y" step="0.01" placeholder="Y" />
							<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.raster.specifiedDirection.z" step="0.01" placeholder="Z" />
						</div>
					</div>
				</div>
			</div>

			<div v-else class="setup-tab-content">
				<div class="setup-field-row">
					<label class="setup-field__label setup-field__label--inline">{{ $t('setup.path.label.orientationAlignment') }}</label>
					<select class="setup-field__input" v-model="state.raster.orientationAlignment.type">
						<option value="initial_direction">{{ $t('setup.path.label.alignWithInitialDirection') }}</option>
						<option value="previous">{{ $t('setup.path.label.alignWithPrevious') }}</option>
						<option value="direction">{{ $t('setup.path.label.alignWithDirection') }}</option>
					</select>
				</div>
				<div v-if="state.raster.orientationAlignment.type === 'direction'" style="margin-top: 0.5rem;">
					<div class="setup-field__row">
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.raster.orientationAlignment.direction.x" step="0.01" placeholder="X" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.raster.orientationAlignment.direction.y" step="0.01" placeholder="Y" />
						<input class="setup-field__input setup-field__input--third" type="number" v-model.number="state.raster.orientationAlignment.direction.z" step="0.01" placeholder="Z" />
					</div>
				</div>
			</div>

			<hr class="setup-divider" />

			<button
				class="btn-ik-solve"
				style="width: 100%;"
				:disabled="!state.selectedArea"
				@click="onVisualizeToolpath"
			>{{ $t('setup.path.button.visualizeToolpath') }}</button>

		</div>

		</div><!-- end scrollable -->
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { degToRad } from '../../utils/math';

// ── Props & Emits ──────────────────────────────────────────────────

const props = defineProps<{
	workcellName?: string;
	parentName: string;
	areas?: string[];
}>();

type OrientationAlignmentType = 'initial_direction' | 'previous' | 'direction';

interface OrientationAlignmentPayload {
	orientationAlignmentType: OrientationAlignmentType;
	orientationAlignmentDirection: { x: number; y: number; z: number };
}

interface RasterPayload extends OrientationAlignmentPayload {
	name: string;
	areaName: string;
	parentName: string;
	fixedSpacing: number;
	blendingRadius: number;
	borderOffset: number;
	rasterLineSpacing: number;
	rasterJoiningThreshold: number;
	directionType: 'principal' | 'specified';
	principalRotationAngle: number;
	specifiedDirection: { x: number; y: number; z: number };
}

const emit = defineEmits<{
	close: [];
	'path-created': [payload: { name: string; pointSpacing: number; blendingRadius: number; onComplete: () => void } & OrientationAlignmentPayload];
	'clear-waypoints': [];
	'select-area': [payload: { name: string; parentName: string }];
	'generate-from-area-path': [payload: RasterPayload & { onComplete: () => void }];
	'visualize-toolpath': [payload: RasterPayload];
}>();

// ── State ──────────────────────────────────────────────────────────

const state = reactive({
	pathName: '',
	activeTab: 'free-sketch' as 'free-sketch' | 'generate-from-area',
	creating: false,
	freeSketchSubTab: 'parameters' as 'parameters' | 'orientation',
	rasterSubTab: 'parameters' as 'parameters' | 'orientation',
	// Free sketch params
	pointSpacing: 0.01,
	blendingRadius: 0.002,
	orientationAlignment: {
		type: 'initial_direction' as OrientationAlignmentType,
		direction: { x: 1.0, y: 0.0, z: 0.0 },
	},
	// Generate from area
	selectedArea: '',
	raster: {
		fixedSpacing: 0.01,
		blendingRadius: 0.002,
		borderOffset: 0.0,
		rasterLineSpacing: 0.05,
		rasterJoiningThreshold: 0.1,
		directionType: 'principal' as 'principal' | 'specified',
		principalRotationAngle: 0.0,
		specifiedDirection: { x: 1.0, y: 0.0, z: 0.0 },
		rasterFlip: false,
		orientationAlignment: {
			type: 'initial_direction' as OrientationAlignmentType,
			direction: { x: 1.0, y: 0.0, z: 0.0 },
		},
	},
});

// Joining threshold must be at least 2× raster line spacing; auto-bump if spacing grows past it
watch(() => state.raster.rasterLineSpacing, (v) => {
	const min = +(v * 2).toFixed(6);
	if (state.raster.rasterJoiningThreshold < min) {
		state.raster.rasterJoiningThreshold = min;
	}
});

// ── Computed ───────────────────────────────────────────────────────

const canSubmit = computed(() =>
	state.activeTab === 'free-sketch'
		? !!state.pathName.trim()
		: !!state.pathName.trim() && !!state.selectedArea,
);

// ── Actions ────────────────────────────────────────────────────────

function onAreaSelect() {
	if (state.selectedArea) {
		emit('select-area', { name: state.selectedArea, parentName: props.parentName });
	}
}

function onVisualizeToolpath() {
	if (!state.selectedArea) return;
	emit('visualize-toolpath', {
		name: state.pathName.trim() || `temp_raster`,
		areaName: state.selectedArea,
		parentName: props.parentName,
		fixedSpacing: state.raster.fixedSpacing,
		blendingRadius: state.raster.blendingRadius,
		borderOffset: state.raster.borderOffset,
		rasterLineSpacing: state.raster.rasterLineSpacing,
		rasterJoiningThreshold: state.raster.rasterJoiningThreshold,
		directionType: state.raster.directionType,
		principalRotationAngle: degToRad(state.raster.principalRotationAngle),
		specifiedDirection: { ...state.raster.specifiedDirection },
		orientationAlignmentType: state.raster.orientationAlignment.type,
		orientationAlignmentDirection: { ...state.raster.orientationAlignment.direction },
	});
}

async function onSubmit() {
	if (state.creating) return;
	state.creating = true;
	await new Promise<void>((resolve) => {
		if (state.activeTab === 'free-sketch') {
			const name = state.pathName.trim();
			if (!name) { resolve(); return; }
			emit('path-created', {
				name: `${props.parentName}_${name}`,
				pointSpacing: state.pointSpacing,
				blendingRadius: state.blendingRadius,
				orientationAlignmentType: state.orientationAlignment.type,
				orientationAlignmentDirection: { ...state.orientationAlignment.direction },
				onComplete: resolve,
			});
		} else {
			const name = state.pathName.trim();
			if (!name || !state.selectedArea) { resolve(); return; }
			emit('generate-from-area-path', {
				name: `${props.parentName}_${name}`,
				areaName: state.selectedArea,
				parentName: props.parentName,
				fixedSpacing: state.raster.fixedSpacing,
				blendingRadius: state.raster.blendingRadius,
				borderOffset: state.raster.borderOffset,
				rasterLineSpacing: state.raster.rasterLineSpacing,
				rasterJoiningThreshold: state.raster.rasterJoiningThreshold,
				directionType: state.raster.directionType,
				principalRotationAngle: degToRad(state.raster.principalRotationAngle),
				specifiedDirection: { ...state.raster.specifiedDirection },
				orientationAlignmentType: state.raster.orientationAlignment.type,
				orientationAlignmentDirection: { ...state.raster.orientationAlignment.direction },
				onComplete: resolve,
			});
		}
	});
	state.creating = false;
}
</script>
