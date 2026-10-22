<template>
	<section class="info-section">
		<h4 class="info-section__title">Nullspace — elbow swivel angle (deg)</h4>
		<div class="slider-row">
			<label class="slider-label">
				<span class="slider-name">Elbow Swivel</span>
				<span class="slider-value">{{ nullspace.toFixed(1) }}°</span>
			</label>
			<input
				type="range"
				class="slider-input"
				min="-180"
				max="180"
				step="1"
				:value="nullspace"
				@input="$emit('update:nullspace', +($event.target as HTMLInputElement).value)"
			/>
		</div>
	</section>

	<section v-if="ikSeedSliders.length > 0" class="info-section">
		<div class="info-section__title-row">
			<h4 class="info-section__title">External Axis Joint Values</h4>
			<div class="ext-axis-mode">
				<label class="ext-axis-mode__option">
					<input type="radio" value="preferred" :checked="extAxisMode === 'preferred'" @change="$emit('update:extAxisMode', 'preferred')" />
					Preferred
				</label>
				<label class="ext-axis-mode__option">
					<input type="radio" value="preset" :checked="extAxisMode === 'preset'" @change="$emit('update:extAxisMode', 'preset')" />
					Preset
				</label>
			</div>
		</div>
		<div v-for="(slider, i) in ikSeedSliders" :key="'ns-ext' + i" class="slider-row">
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
					:step="10 ** -jointDecimals(slider.prismatic)"
					v-model.number="slider.value"
					@input="onSeedRangeInput(slider)"
				/>
				<input
					type="number"
					class="slider-spinbox"
					:min="slider.min"
					:max="slider.max"
					:step="10 ** -jointDecimals(slider.prismatic)"
					v-model.number="slider.value"
					@input="onSeedSpinboxInput(slider, $event)"
				/>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
import type { IkSeedSlider } from '../../composables/controller/useIkSeedSliders';
import { jointDecimals, jointUnit } from '../../utils/math';

const props = defineProps<{
	nullspace: number;
	extAxisMode: 'preset' | 'preferred';
	ikSeedSliders: IkSeedSlider[];
}>();

defineEmits<{
	'update:nullspace': [value: number];
	'update:extAxisMode': [value: 'preset' | 'preferred'];
}>();

function onSeedRangeInput(slider: IkSeedSlider) {
	slider.value = +slider.value.toFixed(2);
}

function onSeedSpinboxInput(slider: IkSeedSlider, event: Event) {
	const raw = (event.target as HTMLInputElement).valueAsNumber;
	if (!isNaN(raw)) slider.value = +raw.toFixed(2);
}
</script>
