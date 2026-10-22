<template>
	<div class="joint-sliders">
		<section v-if="manipulator.length > 0" class="info-section">
			<h4 class="info-section__title">{{ $t('controls.jointSliders.manipulatorJoints') }}</h4>
			<div v-for="(slider, i) in manipulator" :key="'ms' + i" class="slider-row">
				<label class="slider-label">
					<span class="slider-name">{{ slider.name }}</span>
					<span class="slider-value">{{ slider.value.toFixed(jointDecimals(slider.prismatic)) }}{{ jointUnit(slider.prismatic) }}</span>
				</label>
				<div class="slider-controls">
					<input
						type="range"
						class="slider-input"
						:min="slider.min"
						:max="slider.max"
						:step="stepOf(slider)"
						v-model.number="slider.value"
						@input="onRangeInput(slider)"
					/>
					<input
						type="number"
						class="slider-spinbox"
						:min="slider.min"
						:max="slider.max"
						:step="stepOf(slider)"
						v-model.number="slider.value"
						@input="onSpinboxInput(slider, $event)"
					/>
				</div>
			</div>
		</section>

		<section v-if="externalAxis.length > 0" class="info-section">
			<h4 class="info-section__title">{{ $t('controls.jointSliders.externalAxisJoints') }}</h4>
			<div v-for="(slider, i) in externalAxis" :key="'es' + i" class="slider-row">
				<label class="slider-label">
					<span class="slider-name">{{ slider.name }}</span>
					<span class="slider-value">{{ slider.value.toFixed(jointDecimals(slider.prismatic)) }}{{ jointUnit(slider.prismatic) }}</span>
				</label>
				<div class="slider-controls">
					<input
						type="range"
						class="slider-input"
						:min="slider.min"
						:max="slider.max"
						:step="stepOf(slider)"
						v-model.number="slider.value"
						@input="onRangeInput(slider)"
					/>
					<input
						type="number"
						class="slider-spinbox"
						:min="slider.min"
						:max="slider.max"
						:step="stepOf(slider)"
						v-model.number="slider.value"
						@input="onSpinboxInput(slider, $event)"
					/>
				</div>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
// ── JointSliders ───────────────────────────────────────────────────────
// Renders manipulator and external-axis joint sliders.
// Emits `change` with all current angles (in radians) whenever any slider
// is moved, so the parent can update the viewer and call the Nebula API.

export interface JointSlider {
	name: string;
	value: number;  // degrees, or metres if prismatic
	min: number;    // degrees, or metres if prismatic
	max: number;    // degrees, or metres if prismatic
	/** True for a linear joint, such as a rail. */
	prismatic?: boolean;
}

import { jointFromDisplay, jointDecimals, jointUnit } from '../../utils/math';

const props = defineProps<{
	manipulator: JointSlider[];
	externalAxis: JointSlider[];
	systemName: string;
}>();

const emit = defineEmits<{
	change: [payload: { systemName: string; jointAngles: Record<string, number> }];
}>();

function emitChanges() {
	const jointAngles: Record<string, number> = {};
	// External axis joints first, then manipulator — matches the
	// ordering expected by the Nebula TargetWaypoint protobuf.
	for (const s of [...props.externalAxis, ...props.manipulator]) {
		jointAngles[s.name] = jointFromDisplay(round(s), s.prismatic);
	}
	emit('change', { systemName: props.systemName, jointAngles });
}

/** Slider and spinbox step: 0.01° or 1 mm. */
function stepOf(slider: JointSlider): number {
	return 10 ** -jointDecimals(slider.prismatic);
}

function round(slider: JointSlider, value = slider.value): number {
	return +value.toFixed(jointDecimals(slider.prismatic));
}

function onRangeInput(slider: JointSlider) {
	slider.value = round(slider);
	emitChanges();
}

function onSpinboxInput(slider: JointSlider, event: Event) {
	const raw = (event.target as HTMLInputElement).valueAsNumber;
	if (!isNaN(raw)) {
		slider.value = round(slider, raw);
	}
	emitChanges();
}
</script>
