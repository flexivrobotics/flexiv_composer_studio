<template>
	<div v-if="visible" class="dialog-overlay" @click.self="close">
		<!-- Main Workcell Setup Dialog -->
		<div class="dialog">
			<div class="dialog__header">
				<h2 class="dialog__title">{{ $t('dialog.workcell.title') }}</h2>
				<button class="dialog__close" @click="close">&times;</button>
			</div>
			<div class="dialog__body">
				<div v-if="state.loading" class="dialog__loading">{{ $t('dialog.workcell.loading') }}</div>
				<div v-else-if="state.workcells.length === 0" class="dialog__empty">{{ $t('dialog.workcell.empty') }}</div>
				<div v-else class="workcell-setup">
					<div class="setup-field">
						<label class="setup-field__label">{{ $t('dialog.workcell.label.available') }}</label>
						<select class="setup-field__input" v-model="state.selectedName">
							<option value="" disabled>{{ $t('dialog.workcell.placeholder.select') }}</option>
							<option v-for="wc in state.workcells" :key="wc.name" :value="wc.name">
								{{ wc.name }}
							</option>
						</select>
					</div>

					<div v-if="selectedWorkcell" class="workcell-description">
						<h3 class="workcell-description__title">{{ $t('dialog.workcell.description') }}</h3>
						<p class="workcell-description__text">
							{{ selectedWorkcell.description || $t('dialog.workcell.noDescription') }}
						</p>
					</div>
				</div>
			</div>
			<div class="dialog__footer">
				<button class="btn btn--outline" @click="close">{{ $t('dialog.workcell.button.cancel') }}</button>
				<div class="dialog__footer__right">
					<button
						class="btn btn--outline"
						:disabled="state.creating"
						@click="openNewDialog"
				>{{ $t('dialog.workcell.button.new') }}</button>
					<button
						v-if="!state.loading"
						class="btn btn--danger"
						:disabled="!state.selectedName || state.deleting"
						@click="dialogOps.handleDelete()"
					>{{ state.deleting ? $t('dialog.workcell.button.deleting') : $t('dialog.workcell.button.delete') }}</button>
					<button
						class="btn"
						:disabled="!state.selectedName || state.loading"
						@click="dialogOps.handleLoad()"
					>{{ state.loading ? $t('dialog.workcell.button.loading') : $t('dialog.workcell.button.load') }}</button>
				</div>
			</div>
		</div>

		<!-- New Workcell Sub-dialog -->
		<div v-if="showNewForm" class="dialog-overlay" @click.self="cancelNew">
			<div class="dialog">
				<div class="dialog__header">
					<h2 class="dialog__title">{{ $t('dialog.workcell.newTitle') }}</h2>
					<button class="dialog__close" @click="cancelNew">&times;</button>
				</div>
				<div class="dialog__body">
					<div class="workcell-setup">
						<div class="setup-field">
							<label class="setup-field__label" for="new-wc-name">{{ $t('dialog.workcell.label.name') }}</label>
							<input
								id="new-wc-name"
								class="setup-field__input"
								v-model="newWorkcellName"
								:placeholder="$t('dialog.workcell.placeholder.name')"
								@keyup.enter="handleCreate"
							/>
						</div>
						<div class="setup-field">
							<label class="setup-field__label" for="new-wc-desc">{{ $t('dialog.workcell.label.description') }}</label>
							<textarea
								id="new-wc-desc"
								class="setup-field__input setup-field__textarea"
								v-model="newWorkcellDescription"
								:placeholder="$t('dialog.workcell.placeholder.description')"
								rows="3"
							></textarea>
						</div>
					</div>
				</div>
				<div class="dialog__footer">
					<button class="btn btn--outline" @click="cancelNew">{{ $t('dialog.workcell.button.cancel') }}</button>
					<div class="dialog__footer__right">
						<button
							class="btn"
							:disabled="!newWorkcellName.trim() || state.creating"
							@click="handleCreate"
						>{{ state.creating ? $t('dialog.workcell.button.creating') : $t('dialog.workcell.button.create') }}</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { fetchWorkcells, loadSelectedWorkcell, deleteWorkcell, createWorkcell, type WorkcellDialogState } from "../../services/workcellDialog";
import type { Group } from 'three';

// --- Props & Emits ---

const props = defineProps<{
	visible: boolean;
	addGroup: (name: string, group: Group, parentSystemName?: string, parentLinkName?: string) => void;
	onSystemAdded: (name: string) => void;
	onClear?: () => void;
	onSceneObjectAdded: (name: string, visualType?: 'primitive' | 'mesh') => void;
	onAreaAdded?: (parentName: string, areaName: string) => void;
	getGroupWorldPose?: (name: string) => { position: [number, number, number]; quaternion: [number, number, number, number] } | undefined;
	setGroupPose?: (name: string, position: [number, number, number], quaternion: [number, number, number, number]) => void;
	addPath?: (name: string, waypoints: Array<{ pose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } }>) => void;
	onPathAdded?: (parentName: string, pathName: string) => void;
	onTargetAdded?: (systemName: string, targetName: string) => void;
	onPtpTrajectoryAdded?: (systemName: string, trajectoryName: string) => void;
	onLinearTrajectoryAdded?: (systemName: string, trajectoryName: string) => void;
	onCameraAdded?: (name: string) => void;
}>();

const emit = defineEmits<{
	close: [];
	load: [name: string];
}>();

// --- State ---

const state: WorkcellDialogState = reactive({
	workcells: [],
	selectedName: '',
	loading: false,
	deleting: false,
	creating: false,
});

const showNewForm = ref(false);
const newWorkcellName = ref('');
const newWorkcellDescription = ref('');

// --- Computed ---

const selectedWorkcell = computed(() => 
	state.workcells.find(wc => wc.name === state.selectedName)
);

// --- Dialog Operations ---

const dialogOps = {
	handleLoad() {
		loadSelectedWorkcell(
			state,
			(name) => emit('load', name),
			() => emit('close'),
			props.addGroup,
			props.onSystemAdded,
			props.onSceneObjectAdded,
			props.onClear,
			props.addPath,
			props.onPathAdded,
			props.onTargetAdded,
			props.onAreaAdded,
			props.getGroupWorldPose,
			props.setGroupPose,
			props.onPtpTrajectoryAdded,
			props.onLinearTrajectoryAdded,
			props.onCameraAdded,
		);
	},
	handleDelete() {
		deleteWorkcell(state);
	},
};

// --- New Workcell ---

function openNewDialog() {
	newWorkcellName.value = '';
	newWorkcellDescription.value = '';
	showNewForm.value = true;
}

function cancelNew() {
	showNewForm.value = false;
}

async function handleCreate() {
	const name = newWorkcellName.value.trim();
	if (!name) return;

	state.creating = true;
	const ok = await createWorkcell(state, name, newWorkcellDescription.value.trim());
	state.creating = false;
	if (ok) {
		showNewForm.value = false;
	}
}

// --- UI Actions ---

function close() {
	emit('close');
}

// --- Lifecycle ---

onMounted(() => fetchWorkcells(state));
</script>