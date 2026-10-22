<template>
	<div class="motion-profile">
		<section class="info-section">
			<h4 class="info-section__title">Path Force / Moment</h4>
			<div class="fm-grid">
				<div class="fm-col">
					<span class="fm-col__header">Force (N)</span>
					<div class="fm-row">
						<label class="fm-label">X</label>
						<input class="setup-field__input fm-input" type="number" step="0.1" :value="force.x" @input="emitForce('x', +($event.target as HTMLInputElement).value)" />
					</div>
					<div class="fm-row">
						<label class="fm-label">Y</label>
						<input class="setup-field__input fm-input" type="number" step="0.1" :value="force.y" @input="emitForce('y', +($event.target as HTMLInputElement).value)" />
					</div>
					<div class="fm-row">
						<label class="fm-label">Z</label>
						<input class="setup-field__input fm-input" type="number" step="0.1" :value="force.z" @input="emitForce('z', +($event.target as HTMLInputElement).value)" />
					</div>
				</div>
				<div class="fm-col">
					<span class="fm-col__header">Moment (Nm)</span>
					<div class="fm-row">
						<label class="fm-label">X</label>
						<input class="setup-field__input fm-input" type="number" step="0.01" :value="moment.x" @input="emitMoment('x', +($event.target as HTMLInputElement).value)" />
					</div>
					<div class="fm-row">
						<label class="fm-label">Y</label>
						<input class="setup-field__input fm-input" type="number" step="0.01" :value="moment.y" @input="emitMoment('y', +($event.target as HTMLInputElement).value)" />
					</div>
					<div class="fm-row">
						<label class="fm-label">Z</label>
						<input class="setup-field__input fm-input" type="number" step="0.01" :value="moment.z" @input="emitMoment('z', +($event.target as HTMLInputElement).value)" />
					</div>
				</div>
			</div>
		</section>
		<section class="info-section">
			<h4 class="info-section__title">Path Motion</h4>
			<div class="motion-profile__field">
				<label class="motion-profile__label">Velocity</label>
				<input class="setup-field__input motion-profile__input" type="number" min="0" step="0.01" :value="velocity" @input="$emit('update:velocity', +($event.target as HTMLInputElement).value)" />
				<span class="motion-profile__unit">m/s</span>
			</div>
			<div class="motion-profile__field">
				<label class="motion-profile__label">Acceleration</label>
				<input class="setup-field__input motion-profile__input" type="number" min="0" step="0.01" :value="acceleration" @input="$emit('update:acceleration', +($event.target as HTMLInputElement).value)" />
				<span class="motion-profile__unit">m/s²</span>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
export interface ForceMomentAxes {
	x: number;
	y: number;
	z: number;
}

const props = defineProps<{
	force: ForceMomentAxes;
	moment: ForceMomentAxes;
	velocity: number;
	acceleration: number;
}>();

const emit = defineEmits<{
	'update:force': [value: ForceMomentAxes];
	'update:moment': [value: ForceMomentAxes];
	'update:velocity': [value: number];
	'update:acceleration': [value: number];
}>();

function emitForce<K extends keyof ForceMomentAxes>(key: K, value: ForceMomentAxes[K]) {
	emit('update:force', { ...props.force, [key]: value });
}

function emitMoment<K extends keyof ForceMomentAxes>(key: K, value: ForceMomentAxes[K]) {
	emit('update:moment', { ...props.moment, [key]: value });
}
</script>

<style scoped>
.motion-profile {
	padding: 0.5rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	box-sizing: border-box;
	width: 100%;
	min-width: 0;
}

.motion-profile__field {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.motion-profile__field + .motion-profile__field {
	margin-top: 0.5rem;
}

.motion-profile__label {
	flex: 0 0 5.5rem;
	font-size: 0.85rem;
	color: var(--color-text);
}

.motion-profile__input {
	flex: 1;
	min-width: 0;
}

.motion-profile__unit {
	font-size: 0.8rem;
	color: var(--color-text-muted);
	white-space: nowrap;
}

.fm-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
	gap: 0.5rem 0.75rem;
	margin-top: 0.5rem;
}

.fm-col {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	min-width: 0;
}

.fm-col__header {
	font-size: 0.72rem;
	font-weight: 600;
	color: var(--color-accent);
	text-transform: uppercase;
	letter-spacing: 0.04em;
	margin-bottom: 0.1rem;
}

.fm-row {
	display: flex;
	align-items: center;
	gap: 0.35rem;
}

.fm-label {
	font-size: 0.85rem;
	color: var(--color-text);
	width: 0.75rem;
	flex-shrink: 0;
}

.fm-input {
	flex: 1;
	min-width: 0;
}
</style>
