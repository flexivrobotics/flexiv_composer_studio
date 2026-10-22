<template>
	<div class="setup-scene-object setup-scene-object--fixed-tabs">
		<div class="setup-scene-object__sticky">
			<div class="setup-scene-object__header">
				<h3 class="setup-scene-object__title">{{ $t('setup.trajectory.titlePtp') }} - {{ parentName }}</h3>
				<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
			</div>

			<div class="setup-create-row">
				<label class="setup-field__label setup-field__label--inline">{{ $t('setup.trajectory.label.name') }}</label>
				<input
					class="setup-field__input"
					type="text"
					v-model="state.trajectoryName"
					:placeholder="$t('setup.trajectory.placeholder.name')"
				/>
				<button
					class="btn"
					:disabled="!state.trajectoryName.trim() || state.solving"
					@click="onCreateTrajectory"
				>{{ state.solving ? $t('setup.trajectory.button.solving') : $t('setup.trajectory.button.create') }}</button>
			</div>

			<hr class="setup-divider" />
		</div>

		<div class="setup-scene-object__scrollable">
			<section class="info-section trajectory-targets-section">
				<div class="target-transfer">
					<div class="target-transfer__list-wrap">
						<span class="target-transfer__list-label">{{ $t('setup.trajectory.transfer.available') }}</span>
						<ul class="target-transfer__list">
							<li v-if="fromTargets.loading" class="target-transfer__empty">
								{{ $t('setup.trajectory.transfer.loading') }}
							</li>
							<template v-else>
								<li
									v-for="item in fromTargets.available"
									:key="item"
									class="target-transfer__item"
									:class="{ 'target-transfer__item--selected': fromTargets.leftSelected === item }"
									@click="selectAvailable(item)"
								>{{ item }}</li>
								<li v-if="fromTargets.available.length === 0" class="target-transfer__empty">
									{{ $t('setup.trajectory.transfer.empty') }}
								</li>
							</template>
						</ul>
					</div>

					<div class="target-transfer__controls">
						<button
							class="btn target-transfer__btn"
							:disabled="fromTargets.leftSelected === null"
							@click="moveToSelected"
							title="Add to trajectory"
						>&#8594;</button>
						<button
							class="btn target-transfer__btn"
							:disabled="fromTargets.rightSelected === null"
							@click="moveToAvailable"
							title="Remove from trajectory"
						>&#8592;</button>
					</div>

					<div class="target-transfer__list-wrap">
						<span class="target-transfer__list-label">{{ $t('setup.trajectory.transfer.selected') }}</span>
						<ul
							class="target-transfer__list"
							@dragover.prevent
							@drop.prevent="onDrop"
						>
							<li
								v-for="(item, index) in fromTargets.selected"
								:key="item"
								class="target-transfer__item target-transfer__item--draggable"
								:class="{
									'target-transfer__item--selected': fromTargets.rightSelected === item,
									'target-transfer__item--drag-over': drag.overIndex === index,
								}"
								draggable="true"
								@click="selectTrajectory(item)"
								@dragstart="onDragStart(index)"
								@dragenter.prevent="drag.overIndex = index"
								@dragleave="onDragLeave(index)"
								@dragend="onDragEnd"
							>
								<span class="target-transfer__drag-handle">&#8942;</span>
								{{ item }}
							</li>
							<li v-if="fromTargets.selected.length === 0" class="target-transfer__empty">
								{{ $t('setup.trajectory.transfer.empty') }}
							</li>
						</ul>
					</div>
				</div>
			</section>

			<section class="info-section">
				<h4 class="info-section__title">{{ $t('setup.trajectory.motionProfile.title') }}</h4>
				<div class="motion-profile__field">
					<label class="motion-profile__label">{{ $t('setup.trajectory.motionProfile.velocity') }}</label>
					<input
						class="setup-field__input motion-profile__input"
						type="number"
						min="0"
						step="0.01"
						v-model.number="fromTargets.velocity"
					/>
					<span class="motion-profile__unit">m/s</span>
				</div>
				<div class="motion-profile__field">
					<label class="motion-profile__label">{{ $t('setup.trajectory.motionProfile.acceleration') }}</label>
					<input
						class="setup-field__input motion-profile__input"
						type="number"
						min="0"
						step="0.01"
						v-model.number="fromTargets.acceleration"
					/>
					<span class="motion-profile__unit">m/s²</span>
				</div>
			</section>

			<section class="info-section">
				<h4 class="info-section__title">{{ $t('setup.trajectory.collisionConfig.title') }}</h4>
				<div class="motion-profile__field">
					<label class="motion-profile__label">{{ $t('setup.trajectory.collisionConfig.collisionMargin') }}</label>
					<input
						class="setup-field__input motion-profile__input"
						type="number"
						min="0"
						step="0.001"
						v-model.number="fromTargets.collisionMargin"
					/>
					<span class="motion-profile__unit">m</span>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, watch, onMounted } from 'vue';
import { apiGet, apiPost } from '../../services/api';
import { useI18n } from '../../composables/useI18n';
import { useToast } from '../../composables/useToast';

const props = defineProps<{
	workcellName?: string;
	parentName: string;
	getJointNames?: ((systemName: string) => string[] | null) | null;
}>();

const emit = defineEmits<{
	close: [];
	'create-trajectory': [payload: { name: string }];
	'update-joint-angles': [payload: { systemName: string; jointAngles: Record<string, number> }];
}>();

const { t } = useI18n();
const { showToast } = useToast();

const state = reactive({
	trajectoryName: '',
	solving: false,
});

const fromTargets = reactive({
	available: [] as string[],
	selected: [] as string[],
	leftSelected: null as string | null,
	rightSelected: null as string | null,
	loading: false,
	velocity: 0.1,
	acceleration: 0.5,
	collisionMargin: 0,
});

const drag = reactive({
	fromIndex: -1,
	overIndex: -1,
});

async function fetchAvailableTargets() {
	const wc = props.workcellName;
	if (!wc) return;
	fromTargets.loading = true;
	try {
		const data = await apiGet<{ targetNames: string[] }>(
			`/api/targets/${encodeURIComponent(wc)}`,
		);
		const already = new Set(fromTargets.selected);
		fromTargets.available = (data.targetNames ?? []).filter(n => !already.has(n));
		fromTargets.leftSelected = null;
	} catch (err) {
		console.error('Failed to fetch targets:', err);
	} finally {
		fromTargets.loading = false;
	}
}

onMounted(fetchAvailableTargets);
watch(() => props.workcellName, fetchAvailableTargets);

async function visualizeTarget(name: string) {
	const wc = props.workcellName;
	if (!wc) return;
	try {
		const data = await apiGet<{ jointAngles: number[] | null }>(
			`/api/targets/${encodeURIComponent(wc)}/${encodeURIComponent(name)}`,
		);
		const anglesArr = data.jointAngles;
		if (!anglesArr || anglesArr.length === 0) return;
		const jointNames = props.getJointNames?.(props.parentName) ?? [];
		if (jointNames.length === 0) return;
		const jointAngles: Record<string, number> = {};
		jointNames.forEach((jn, i) => {
			if (i < anglesArr.length) jointAngles[jn] = anglesArr[i];
		});
		emit('update-joint-angles', { systemName: props.parentName, jointAngles });
	} catch (err) {
		console.error('Failed to fetch target for visualization:', err);
	}
}

function selectAvailable(item: string) {
	if (fromTargets.leftSelected === item) {
		fromTargets.leftSelected = null;
		return;
	}
	fromTargets.leftSelected = item;
	fromTargets.rightSelected = null;
	visualizeTarget(item);
}

function selectTrajectory(item: string) {
	if (fromTargets.rightSelected === item) {
		fromTargets.rightSelected = null;
		return;
	}
	fromTargets.rightSelected = item;
	fromTargets.leftSelected = null;
	visualizeTarget(item);
}

function onDragStart(index: number) {
	drag.fromIndex = index;
	drag.overIndex = index;
}

function onDragLeave(index: number) {
	if (drag.overIndex === index) drag.overIndex = -1;
}

function onDrop() {
	const from = drag.fromIndex;
	const to = drag.overIndex;
	if (from === -1 || to === -1 || from === to) {
		onDragEnd();
		return;
	}
	const item = fromTargets.selected.splice(from, 1)[0];
	fromTargets.selected.splice(to, 0, item);
	onDragEnd();
}

function onDragEnd() {
	drag.fromIndex = -1;
	drag.overIndex = -1;
}

function moveToSelected() {
	const item = fromTargets.leftSelected;
	if (!item) return;
	fromTargets.available.splice(fromTargets.available.indexOf(item), 1);
	fromTargets.selected.push(item);
	fromTargets.leftSelected = null;
}

function moveToAvailable() {
	const item = fromTargets.rightSelected;
	if (!item) return;
	fromTargets.selected.splice(fromTargets.selected.indexOf(item), 1);
	fromTargets.available.push(item);
	fromTargets.rightSelected = null;
}

async function onCreateTrajectory() {
	const name = state.trajectoryName.trim();
	if (!name) return;

	if (fromTargets.selected.length < 2) {
		showToast('Select at least 2 targets to create a PTP trajectory.', 'warning');
		return;
	}

	try {
		const existing = await apiGet<{ trajectoryNames: string[] }>('/api/ptp-trajectories');
		if ((existing.trajectoryNames ?? []).includes(name)) {
			showToast(`Trajectory "${name}" already exists. Choose a different name.`, 'error');
			return;
		}
	} catch {
		// proceed — server will reject duplicates if the check fails
	}

	state.solving = true;
	try {
		await apiPost('/api/ptp-trajectories', {
			name,
			systemName: props.parentName,
			workcellName: props.workcellName ?? '',
			targetNames: [...fromTargets.selected],
			velocity: fromTargets.velocity,
			acceleration: fromTargets.acceleration,
			collisionMargin: fromTargets.collisionMargin,
		});
	} catch (err: any) {
		showToast(err?.message ?? t('setup.trajectory.saveError'), 'error');
		console.error(t('setup.trajectory.saveError'), err);
		return;
	} finally {
		state.solving = false;
	}

	emit('create-trajectory', { name });
	emit('close');
}
</script>

<style scoped>
.trajectory-targets-section {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

.target-transfer {
	display: flex;
	flex-direction: row;
	align-items: stretch;
	gap: 0.5rem;
	min-height: 0;
	flex: 1;
}

.target-transfer__list-wrap {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	min-width: 0;
}

.target-transfer__list-label {
	font-size: 0.72rem;
	font-weight: 600;
	color: var(--color-accent);
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.target-transfer__list {
	flex: 1;
	list-style: none;
	margin: 0;
	padding: 0;
	border: 1px solid rgba(0, 0, 0, 0.15);
	border-radius: 4px;
	overflow-y: auto;
	min-height: 8rem;
	background: #fff;
}

.target-transfer__item {
	padding: 0.35rem 0.6rem;
	font-size: 0.85rem;
	cursor: pointer;
	user-select: none;
	border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.target-transfer__item:last-child {
	border-bottom: none;
}

.target-transfer__item:hover {
	background: rgba(0, 100, 200, 0.06);
}

.target-transfer__item--selected {
	background: rgba(0, 100, 200, 0.15);
	color: #0055bb;
}

.target-transfer__empty {
	padding: 0.5rem 0.6rem;
	font-size: 0.8rem;
	color: #aaa;
	font-style: italic;
}

.target-transfer__controls {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 0.5rem;
	flex-shrink: 0;
}

.target-transfer__btn {
	padding: 0.3rem 0.6rem;
	font-size: 1rem;
	line-height: 1;
}

.target-transfer__item--draggable {
	cursor: grab;
	display: flex;
	align-items: center;
	gap: 0.35rem;
}

.target-transfer__item--draggable:active {
	cursor: grabbing;
}

.target-transfer__item--drag-over {
	border-top: 2px solid #0064c8;
}

.target-transfer__drag-handle {
	color: #bbb;
	font-size: 1rem;
	line-height: 1;
	flex-shrink: 0;
	user-select: none;
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
	flex: 0 0 7rem;
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
</style>
