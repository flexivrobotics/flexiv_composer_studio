<template>
	<div class="setup-scene-object">
		<div class="setup-scene-object__header">
			<h3 class="setup-scene-object__title">{{ $t('setup.sceneObject.title') }}</h3>
			<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
		</div>

		<div class="setup-field-row">
			<label class="setup-field__label setup-field__label--inline" style="width: auto;">{{ $t('setup.sceneObject.label.name') }}</label>
			<input
				class="setup-field__input"
				type="text"
				v-model="state.objectName"
				:placeholder="$t('setup.sceneObject.placeholder.name')"
			/>
			<button
				v-if="state.activeTab === 'mesh'"
				class="btn"
				style="white-space: nowrap; flex-shrink: 0;"
				:disabled="!state.selectedFilePath || !state.objectName.trim() || state.inserting"
				@click="meshOps.insertMesh()"
			>{{ state.inserting ? $t('setup.sceneObject.status.uploading') : $t('setup.sceneObject.button.insertMesh') }}</button>
			<button
				v-else
				class="btn"
				style="white-space: nowrap; flex-shrink: 0;"
				:disabled="!state.objectName.trim() || state.inserting"
				@click="primitiveOps.insertBox()"
			>{{ state.inserting ? $t('setup.sceneObject.status.inserting') : $t('setup.sceneObject.button.insertBox') }}</button>
		</div>

		<div class="setup-field">
			<label class="setup-field__label">{{ $t('setup.sceneObject.label.parent') }}</label>
			<select class="setup-field__input setup-field__input--select" v-model="state.parent">
				<option value="world">{{ $t('setup.sceneObject.option.world') }}</option>
				<option
					v-for="flange in systemFlanges"
					:key="flange.flangeName"
					:value="flange.flangeName"
				>{{ flange.systemName }} ({{ flange.flangeName }})</option>
			</select>
		</div>

		<div class="setup-tabs">
			<button
				class="setup-tabs__tab"
				:class="{ active: state.activeTab === 'mesh' }"
				@click="state.activeTab = 'mesh'"
			>{{ $t('setup.sceneObject.tab.mesh') }}</button>
			<button
				class="setup-tabs__tab"
				:class="{ active: state.activeTab === 'primitive' }"
				@click="state.activeTab = 'primitive'"
			>{{ $t('setup.sceneObject.tab.primitives') }}</button>
		</div>

		<div v-if="state.activeTab === 'mesh'" class="setup-tab-content">
			<input ref="meshFileInput" type="file" accept=".obj" hidden @change="onFileSelected" />
			<div class="setup-file-row">
				<button class="btn btn--outline" @click="openFileDialog">{{ $t('setup.sceneObject.button.selectObj') }}</button>
				<div v-if="state.selectedFilePath" class="setup-file-path setup-file-path--fill">{{ state.selectedFilePath }}</div>
				<div v-else class="setup-file-path setup-file-path--empty setup-file-path--fill">{{ $t('setup.sceneObject.status.noFile') }}</div>
			</div>

			<div v-if="state.mtlRequired" class="setup-field">
				<label class="setup-field__label">{{ $t('setup.sceneObject.label.requiredMtl') }}</label>
				<div class="setup-file-path setup-file-path--required">{{ $t('setup.sceneObject.status.required', { filename: state.mtlRequired }) }}</div>
				<input
					ref="mtlFileInput"
					type="file"
					:accept="mtlAccept"
					hidden
					@change="onMtlFileSelected"
				/>
				<div class="setup-file-row">
					<button class="btn btn--outline" @click="openMtlDialog">{{ $t('setup.sceneObject.button.selectMtl') }}</button>
					<div v-if="state.mtlFilePath" class="setup-file-path setup-file-path--fill">{{ state.mtlFilePath }}</div>
					<div v-else class="setup-file-path setup-file-path--empty setup-file-path--fill">{{ $t('setup.sceneObject.status.noFile') }}</div>
				</div>
			</div>

		</div>
		<div v-else class="setup-tab-content">
			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.sceneObject.label.shape') }}</label>
				<select class="setup-field__input" v-model="state.shape">
					<option value="box">{{ $t('setup.sceneObject.shape.box') }}</option>
				</select>
			</div>

			<div v-if="state.shape === 'box'" class="setup-field-row">
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.sceneObject.label.sizeX') }}</label>
					<input class="setup-field__input" type="number" min="0" step="0.01" v-model.number="state.sizeX" />
				</div>
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.sceneObject.label.sizeY') }}</label>
					<input class="setup-field__input" type="number" min="0" step="0.01" v-model.number="state.sizeY" />
				</div>
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.sceneObject.label.sizeZ') }}</label>
					<input class="setup-field__input" type="number" min="0" step="0.01" v-model.number="state.sizeZ" />
				</div>
			</div>

			<section class="info-section">
				<h4 class="info-section__title">{{ $t('setup.sceneObject.label.pose') }}<span class="info-section__title info-section__title-sub"> — {{ state.parent }}</span></h4>
				<div class="tcp-pose-row">
					<label class="tcp-pose-label tcp-pose-label--group">Pos (m)</label>
					<label class="tcp-pose-label">X</label>
					<input type="number" class="tcp-input" step="0.001" v-model.number="state.position.x" />
					<label class="tcp-pose-label">Y</label>
					<input type="number" class="tcp-input" step="0.001" v-model.number="state.position.y" />
					<label class="tcp-pose-label">Z</label>
					<input type="number" class="tcp-input" step="0.001" v-model.number="state.position.z" />
				</div>
				<div class="tcp-pose-row">
					<label class="tcp-pose-label tcp-pose-label--group">RPY (°)</label>
					<label class="tcp-pose-label">R</label>
					<input type="number" class="tcp-input" step="0.1" v-model.number="state.rpy.roll" />
					<label class="tcp-pose-label">P</label>
					<input type="number" class="tcp-input" step="0.1" v-model.number="state.rpy.pitch" />
					<label class="tcp-pose-label">Y</label>
					<input type="number" class="tcp-input" step="0.1" v-model.number="state.rpy.yaw" />
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue';
import { apiGet, apiPost, apiPostForm } from '../../services/api';
import { useConfirm } from '../../composables/useConfirm';
import { rpyToQuaternion } from '../../services/kinematics';

// --- Props & Emits ---

const props = defineProps<{
	workcellName?: string;
}>();

const emit = defineEmits<{
	close: [];
	'inserted-mesh': [name: string, path: string, parent: string, parentSystemName: string | null];
	'inserted-primitive': [name: string, size: [number, number, number], position: [number, number, number], quaternion: [number, number, number, number], parent: string, parentSystemName: string | null];
	'show-bbox': [center: { x: number; y: number; z: number }, orientation: { x: number; y: number; z: number; w: number }, extents: { x: number; y: number; z: number }, parentSystemName?: string, parentLinkName?: string];
	'hide-bbox': [];
}>();

// --- State ---

const state = reactive({
	objectName: '',
	parent: 'world',
	activeTab: 'mesh' as 'mesh' | 'primitive',
	selectedFile: null as File | null,
	selectedFilePath: '',
	mtlRequired: '',
	selectedMtlFile: null as File | null,
	mtlFilePath: '',
	inserting: false,
	shape: 'box' as 'box',
	sizeX: 0.1,
	sizeY: 0.1,
	sizeZ: 0.1,
	position: { x: 0, y: 0, z: 0 },
	rpy: { roll: 0, pitch: 0, yaw: 0 },
});

const meshFileInput = ref<HTMLInputElement | null>(null);
const mtlFileInput = ref<HTMLInputElement | null>(null);

// Systems' flange frames, offered alongside 'world' as parent options.
const systemFlanges = ref<{ systemName: string; flangeName: string }[]>([]);

// --- Computed ---

const mtlAccept = computed(() => {
	const ext = state.mtlRequired.split('.').pop();
	return ext ? `.${ext}` : '.mtl';
});

/** Resolve the owning system name for a flange-parented object, for viewer placement. */
function resolveParentSystemName(): string | null {
	if (state.parent === 'world') return null;
	return systemFlanges.value.find((f) => f.flangeName === state.parent)?.systemName ?? null;
}

// --- Lifecycle ---

onMounted(async () => {
	try {
		const data = await apiGet<any>('/api/systems/flanges');
		systemFlanges.value = data.flanges || [];
	} catch (err) {
		console.warn('Could not load system flanges:', err);
	}
});

// --- Primitive Preview ---
// Shows a live wireframe preview of the box in the viewer as the user edits
// its size/pose, using the same bbox-preview mechanism as MeshFilterWidget.

watch(
	() => state.activeTab === 'primitive' && state.shape === 'box'
		? { size: { x: state.sizeX, y: state.sizeY, z: state.sizeZ }, position: { ...state.position }, rpy: { ...state.rpy }, parent: state.parent }
		: null,
	(params) => {
		if (params) {
			const quat = rpyToQuaternion(params.rpy.roll, params.rpy.pitch, params.rpy.yaw);
			const parentSystemName = resolveParentSystemName();
			if (parentSystemName) {
				emit('show-bbox', params.position, quat, params.size, parentSystemName, params.parent);
			} else {
				emit('show-bbox', params.position, quat, params.size);
			}
		} else {
			emit('hide-bbox');
		}
	},
	{ deep: true, immediate: true },
);

onUnmounted(() => emit('hide-bbox'));

// --- Mesh Operations ---

const meshOps = {
	async insertMesh() {
		const file = state.selectedFile;
		const name = state.objectName.trim();
		if (!file || !name || !props.workcellName) return;

		state.inserting = true;
		try {
			const formData = new FormData();
			formData.append('obj_file', file);
			if (state.selectedMtlFile) {
				formData.append('mtl_file', state.selectedMtlFile);
			}

			const uploadResult = await apiPostForm<any>(
				`/api/workcells/${encodeURIComponent(props.workcellName)}/scene/assets/${encodeURIComponent(name)}`,
				formData,
			);

			try {
				await apiPost('/api/scene-objects/mesh', { name, meshFilePath: uploadResult.objServerPath, parent: state.parent });
			} catch (warn) {
				console.warn('Nebula add warning:', (warn as any)?.message);
			}

			const meshUrl = `/api/file?path=${encodeURIComponent(uploadResult.objPath)}`;
			emit('inserted-mesh', name, meshUrl, state.parent, resolveParentSystemName());
			emit('close');
		} catch (err) {
			console.error(err);
			const { confirm } = useConfirm();
			await confirm('Failed to save mesh files: ' + err);
		} finally {
			state.inserting = false;
		}
	},
};

// --- Primitive Shape Operations ---

const primitiveOps = {
	async insertBox() {
		const name = state.objectName.trim();
		if (!name) return;

		state.inserting = true;
		try {
			const q = rpyToQuaternion(state.rpy.roll, state.rpy.pitch, state.rpy.yaw);
			await apiPost('/api/scene-objects/box', {
				name,
				sizeX: state.sizeX,
				sizeY: state.sizeY,
				sizeZ: state.sizeZ,
				position: [state.position.x, state.position.y, state.position.z],
				quaternion: [q.x, q.y, q.z, q.w],
				parent: state.parent,
			});
			emit(
				'inserted-primitive', name, [state.sizeX, state.sizeY, state.sizeZ],
				[state.position.x, state.position.y, state.position.z], [q.x, q.y, q.z, q.w],
				state.parent, resolveParentSystemName(),
			);
			emit('close');
		} catch (err) {
			console.error(err);
			const { confirm } = useConfirm();
			await confirm('Failed to add box: ' + err);
		} finally {
			state.inserting = false;
		}
	},
};

// --- UI Actions ---

function openFileDialog() {
	meshFileInput.value?.click();
}

function openMtlDialog() {
	mtlFileInput.value?.click();
}

// --- Event Handlers ---

function onFileSelected(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	state.selectedFile = file;
	state.selectedFilePath = file.name;
	if (!state.objectName) {
		state.objectName = file.name.replace(/\.obj$/i, '') || file.name;
	}
	input.value = '';

	const reader = new FileReader();
	reader.onload = () => {
		const text = reader.result as string;
		const match = text.match(/^mtllib\s+(.+)$/m);
		state.mtlRequired = match ? match[1].trim() : '';
		state.mtlFilePath = '';
		state.selectedMtlFile = null;
	};
	reader.readAsText(file);
}

function onMtlFileSelected(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	state.selectedMtlFile = file;
	state.mtlFilePath = file.name;
	input.value = '';
}
</script>