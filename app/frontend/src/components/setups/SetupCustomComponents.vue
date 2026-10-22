<template>
	<div class="setup-scene-object setup-scene-object--fixed-tabs">
		<div class="setup-scene-object__sticky">
			<div class="setup-scene-object__header">
				<h3 class="setup-scene-object__title">{{ $t('setup.customComponents.title') }}</h3>
				<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
			</div>

			<div class="setup-subtabs">
				<button
					class="setup-subtabs__tab"
					:class="{ active: activeTab === 'tool-adapter' }"
					@click="activeTab = 'tool-adapter'"
				>{{ $t('setup.customComponents.tab.toolAdapter') }}</button>
				<button
					class="setup-subtabs__tab"
					:class="{ active: activeTab === 'tool' }"
					@click="activeTab = 'tool'"
				>{{ $t('setup.customComponents.tab.tool') }}</button>
			</div>
		</div>

		<div class="setup-scene-object__scrollable">
		<div v-if="activeTab === 'tool-adapter'" class="setup-subtab-content">
			<p v-if="customToolAdaptersLoading" class="setup-tab-content__placeholder">{{ $t('setup.customComponents.feedback.loadingCustomToolAdapters') }}</p>
			<p v-else-if="customToolAdapters.length === 0" class="setup-tab-content__placeholder">{{ $t('setup.customComponents.feedback.noCustomToolAdapters') }}</p>
			<table v-else class="limits-table">
				<thead>
					<tr>
						<th>{{ $t('setup.customComponents.tableHeader.manufacturer') }}</th>
						<th>{{ $t('setup.customComponents.tableHeader.model') }}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(item, i) in customToolAdapters" :key="i">
						<td>{{ item.manufacturer }}</td>
						<td>{{ item.model }}</td>
						<td>
							<button
								class="btn btn--danger"
								style="white-space: nowrap;"
								:disabled="removingToolAdapterKey === item.manufacturer + '/' + item.model"
								@click="removeCustomToolAdapter(item)"
							>{{ $t('setup.customComponents.button.remove') }}</button>
						</td>
					</tr>
				</tbody>
			</table>

			<button
				v-if="!showAddForm"
				class="btn btn--outline"
				style="margin-top: 0.5rem;"
				@click="openAddForm"
			>{{ $t('setup.customComponents.button.addToolAdapter') }}</button>

			<div v-else class="setup-add-form">
				<hr class="setup-divider" />

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.manufacturer') }}</label>
					<input
						class="setup-field__input"
						type="text"
						v-model="newManufacturer"
						:placeholder="$t('setup.customComponents.placeholder.manufacturer')"
					/>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.model') }}</label>
					<input
						class="setup-field__input"
						type="text"
						v-model="newModel"
						:placeholder="$t('setup.customComponents.placeholder.model')"
					/>
				</div>

				<label class="setup-field__label">{{ $t('setup.customComponents.label.flangePoses') }}</label>

				<template v-for="(pose, i) in newFlangePoses" :key="i">
					<hr v-if="i > 0" class="setup-divider" />
					<div class="setup-row">
						<div class="setup-field setup-row__item">
							<label class="setup-field__label">{{ $t('setup.system.label.x') }}</label>
							<input class="setup-field__input" type="number" step="0.01" v-model.number="pose.x" />
						</div>
						<div class="setup-field setup-row__item">
							<label class="setup-field__label">{{ $t('setup.system.label.y') }}</label>
							<input class="setup-field__input" type="number" step="0.01" v-model.number="pose.y" />
						</div>
						<div class="setup-field setup-row__item">
							<label class="setup-field__label">{{ $t('setup.system.label.z') }}</label>
							<input class="setup-field__input" type="number" step="0.01" v-model.number="pose.z" />
						</div>
					</div>
					<div class="setup-row">
						<div class="setup-field setup-row__item">
							<label class="setup-field__label">{{ $t('setup.system.label.roll') }}</label>
							<input class="setup-field__input" type="number" step="0.1" v-model.number="pose.roll" />
						</div>
						<div class="setup-field setup-row__item">
							<label class="setup-field__label">{{ $t('setup.system.label.pitch') }}</label>
							<input class="setup-field__input" type="number" step="0.1" v-model.number="pose.pitch" />
						</div>
						<div class="setup-field setup-row__item">
							<label class="setup-field__label">{{ $t('setup.system.label.yaw') }}</label>
							<input class="setup-field__input" type="number" step="0.1" v-model.number="pose.yaw" />
						</div>
					</div>
					<button
						v-if="newFlangePoses.length > 1"
						class="btn btn--danger"
						style="white-space: nowrap;"
						@click="removeFlangePose(i)"
					>{{ $t('setup.customComponents.button.removeFlange') }}</button>
				</template>

				<button class="btn btn--outline" @click="addFlangePose">{{ $t('setup.customComponents.button.addFlange') }}</button>

				<hr class="setup-divider" />

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.visualMesh') }}</label>
					<input ref="adapterVisualFileInput" type="file" hidden @change="onAdapterVisualFileSelected" />
					<div class="setup-file-row">
						<button class="btn btn--outline" @click="adapterVisualFileInput?.click()">{{ $t('setup.customComponents.button.selectFile') }}</button>
						<div v-if="adapterVisualFileName" class="setup-file-path setup-file-path--fill">{{ adapterVisualFileName }}</div>
						<div v-else class="setup-file-path setup-file-path--empty setup-file-path--fill">{{ $t('setup.customComponents.status.noFile') }}</div>
					</div>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.collisionMesh') }}</label>
					<input ref="adapterCollisionFileInput" type="file" hidden @change="onAdapterCollisionFileSelected" />
					<div class="setup-file-row">
						<button class="btn btn--outline" @click="adapterCollisionFileInput?.click()">{{ $t('setup.customComponents.button.selectFile') }}</button>
						<div v-if="adapterCollisionFileName" class="setup-file-path setup-file-path--fill">{{ adapterCollisionFileName }}</div>
						<div v-else class="setup-file-path setup-file-path--empty setup-file-path--fill">{{ $t('setup.customComponents.status.noFile') }}</div>
					</div>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.preview') }}</label>
					<MeshPosePreview
						:visualFile="adapterVisualFile"
						:collisionFile="adapterCollisionFile"
						:poses="newFlangePosesWithLabels"
					/>
				</div>

				<div class="setup-field-row" style="margin-top: 0.75rem;">
					<button class="btn" :disabled="savingToolAdapter" @click="saveCustomToolAdapter">
						{{ savingToolAdapter ? $t('setup.customComponents.feedback.saving') : $t('setup.customComponents.button.save') }}
					</button>
					<button class="btn btn--outline" :disabled="savingToolAdapter" @click="closeAddForm">
						{{ $t('setup.customComponents.button.cancel') }}
					</button>
				</div>
			</div>
		</div>

		<div v-else-if="activeTab === 'tool'" class="setup-subtab-content">
			<p v-if="customToolsLoading" class="setup-tab-content__placeholder">{{ $t('setup.customComponents.feedback.loadingCustomTools') }}</p>
			<p v-else-if="customTools.length === 0" class="setup-tab-content__placeholder">{{ $t('setup.customComponents.feedback.noCustomTools') }}</p>
			<table v-else class="limits-table">
				<thead>
					<tr>
						<th>{{ $t('setup.customComponents.tableHeader.manufacturer') }}</th>
						<th>{{ $t('setup.customComponents.tableHeader.model') }}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(item, i) in customTools" :key="i">
						<td>{{ item.manufacturer }}</td>
						<td>{{ item.model }}</td>
						<td>
							<button
								class="btn btn--danger"
								style="white-space: nowrap;"
								:disabled="removingToolKey === item.manufacturer + '/' + item.model"
								@click="removeCustomTool(item)"
							>{{ $t('setup.customComponents.button.remove') }}</button>
						</td>
					</tr>
				</tbody>
			</table>

			<button
				v-if="!showAddToolForm"
				class="btn btn--outline"
				style="margin-top: 0.5rem;"
				@click="openAddToolForm"
			>{{ $t('setup.customComponents.button.addTool') }}</button>

			<div v-else class="setup-add-form">
				<hr class="setup-divider" />

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.manufacturer') }}</label>
					<input
						class="setup-field__input"
						type="text"
						v-model="newToolManufacturer"
						:placeholder="$t('setup.customComponents.placeholder.manufacturer')"
					/>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.model') }}</label>
					<input
						class="setup-field__input"
						type="text"
						v-model="newToolModel"
						:placeholder="$t('setup.customComponents.placeholder.model')"
					/>
				</div>

				<label class="setup-field__label">{{ $t('setup.customComponents.label.tcpPose') }}</label>

				<div class="setup-row">
					<div class="setup-field setup-row__item">
						<label class="setup-field__label">{{ $t('setup.system.label.x') }}</label>
						<input class="setup-field__input" type="number" step="0.01" v-model.number="newToolTcpPose.x" />
					</div>
					<div class="setup-field setup-row__item">
						<label class="setup-field__label">{{ $t('setup.system.label.y') }}</label>
						<input class="setup-field__input" type="number" step="0.01" v-model.number="newToolTcpPose.y" />
					</div>
					<div class="setup-field setup-row__item">
						<label class="setup-field__label">{{ $t('setup.system.label.z') }}</label>
						<input class="setup-field__input" type="number" step="0.01" v-model.number="newToolTcpPose.z" />
					</div>
				</div>
				<div class="setup-row">
					<div class="setup-field setup-row__item">
						<label class="setup-field__label">{{ $t('setup.system.label.roll') }}</label>
						<input class="setup-field__input" type="number" step="0.1" v-model.number="newToolTcpPose.roll" />
					</div>
					<div class="setup-field setup-row__item">
						<label class="setup-field__label">{{ $t('setup.system.label.pitch') }}</label>
						<input class="setup-field__input" type="number" step="0.1" v-model.number="newToolTcpPose.pitch" />
					</div>
					<div class="setup-field setup-row__item">
						<label class="setup-field__label">{{ $t('setup.system.label.yaw') }}</label>
						<input class="setup-field__input" type="number" step="0.1" v-model.number="newToolTcpPose.yaw" />
					</div>
				</div>

				<hr class="setup-divider" />

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.visualMesh') }}</label>
					<input ref="toolVisualFileInput" type="file" hidden @change="onToolVisualFileSelected" />
					<div class="setup-file-row">
						<button class="btn btn--outline" @click="toolVisualFileInput?.click()">{{ $t('setup.customComponents.button.selectFile') }}</button>
						<div v-if="toolVisualFileName" class="setup-file-path setup-file-path--fill">{{ toolVisualFileName }}</div>
						<div v-else class="setup-file-path setup-file-path--empty setup-file-path--fill">{{ $t('setup.customComponents.status.noFile') }}</div>
					</div>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.collisionMesh') }}</label>
					<input ref="toolCollisionFileInput" type="file" hidden @change="onToolCollisionFileSelected" />
					<div class="setup-file-row">
						<button class="btn btn--outline" @click="toolCollisionFileInput?.click()">{{ $t('setup.customComponents.button.selectFile') }}</button>
						<div v-if="toolCollisionFileName" class="setup-file-path setup-file-path--fill">{{ toolCollisionFileName }}</div>
						<div v-else class="setup-file-path setup-file-path--empty setup-file-path--fill">{{ $t('setup.customComponents.status.noFile') }}</div>
					</div>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.customComponents.label.preview') }}</label>
					<MeshPosePreview
						:visualFile="toolVisualFile"
						:collisionFile="toolCollisionFile"
						:poses="newToolTcpPoses"
					/>
				</div>

				<div class="setup-field-row" style="margin-top: 0.75rem;">
					<button class="btn" :disabled="savingTool" @click="saveCustomTool">
						{{ savingTool ? $t('setup.customComponents.feedback.saving') : $t('setup.customComponents.button.save') }}
					</button>
					<button class="btn btn--outline" :disabled="savingTool" @click="closeAddToolForm">
						{{ $t('setup.customComponents.button.cancel') }}
					</button>
				</div>
			</div>
		</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { apiDelete, apiGet, apiPost, apiPostForm } from '../../services/api';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import { useI18n } from '../../composables/useI18n';
import { rpyToQuaternion } from '../../services/kinematics';
import MeshPosePreview from '../controls/MeshPosePreview.vue';

defineEmits<{
	close: [];
}>();

const { showToast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();

interface ComponentOption {
	manufacturer: string;
	model: string;
}

interface Pose {
	x: number;
	y: number;
	z: number;
	roll: number;
	pitch: number;
	yaw: number;
}

function newPose(): Pose {
	return { x: 0, y: 0, z: 0, roll: 0, pitch: 0, yaw: 0 };
}

const activeTab = ref<'tool-adapter' | 'tool'>('tool-adapter');

const customToolAdapters = ref<ComponentOption[]>([]);
const customToolAdaptersLoading = ref(false);

const customTools = ref<ComponentOption[]>([]);
const customToolsLoading = ref(false);

onMounted(() => {
	fetchCustomToolAdapters();
	fetchCustomTools();
});

async function fetchCustomToolAdapters() {
	customToolAdaptersLoading.value = true;
	try {
		const data = await apiGet<any>('/api/custom-tool-adapters');
		customToolAdapters.value = data.customToolAdapters || [];
	} catch (err) {
		console.warn('Could not load custom tool adapters:', err);
	} finally {
		customToolAdaptersLoading.value = false;
	}
}

async function fetchCustomTools() {
	customToolsLoading.value = true;
	try {
		const data = await apiGet<any>('/api/custom-tools');
		customTools.value = data.customTools || [];
	} catch (err) {
		console.warn('Could not load custom tools:', err);
	} finally {
		customToolsLoading.value = false;
	}
}

// ── Remove ─────────────────────────────────────────────────────────

const removingToolAdapterKey = ref<string | null>(null);
const removingToolKey = ref<string | null>(null);

async function removeCustomToolAdapter(item: ComponentOption) {
	const key = `${item.manufacturer}/${item.model}`;
	removingToolAdapterKey.value = key;
	try {
		let usedBy: string[] = [];
		try {
			const usage = await apiGet<{ systems: string[] }>(
				`/api/custom-tool-adapters/${encodeURIComponent(item.manufacturer)}/${encodeURIComponent(item.model)}/usage`,
			);
			usedBy = usage.systems || [];
		} catch (err) {
			console.warn('Could not check tool adapter usage:', err);
		}

		const message = usedBy.length > 0
			? t('setup.customComponents.warning.toolAdapterInUse', { model: item.model, systems: usedBy.join(', ') })
			: t('setup.customComponents.confirm.removeToolAdapter', { model: item.model });
		const ok = await confirm(message);
		if (!ok) return;

		await apiDelete(`/api/custom-tool-adapters/${encodeURIComponent(item.manufacturer)}/${encodeURIComponent(item.model)}`);
		showToast(t('setup.customComponents.feedback.removedToolAdapter'), 'success');
		await fetchCustomToolAdapters();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		removingToolAdapterKey.value = null;
	}
}

async function removeCustomTool(item: ComponentOption) {
	const key = `${item.manufacturer}/${item.model}`;
	removingToolKey.value = key;
	try {
		let usedBy: string[] = [];
		try {
			const usage = await apiGet<{ systems: string[] }>(
				`/api/custom-tools/${encodeURIComponent(item.manufacturer)}/${encodeURIComponent(item.model)}/usage`,
			);
			usedBy = usage.systems || [];
		} catch (err) {
			console.warn('Could not check tool usage:', err);
		}

		const message = usedBy.length > 0
			? t('setup.customComponents.warning.toolInUse', { model: item.model, systems: usedBy.join(', ') })
			: t('setup.customComponents.confirm.removeTool', { model: item.model });
		const ok = await confirm(message);
		if (!ok) return;

		await apiDelete(`/api/custom-tools/${encodeURIComponent(item.manufacturer)}/${encodeURIComponent(item.model)}`);
		showToast(t('setup.customComponents.feedback.removedTool'), 'success');
		await fetchCustomTools();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		removingToolKey.value = null;
	}
}

// ── Add Tool Adapter Form ───────────────────────────────────────────
// Saving overwrites any existing entry with the same manufacturer + model,
// so this form doubles as "modify": re-enter an existing manufacturer/model
// with new flange poses and save to update it.

const showAddForm = ref(false);
const newManufacturer = ref('');
const newModel = ref('');
const newFlangePoses = reactive<Pose[]>([newPose()]);
const newFlangePosesWithLabels = computed(() =>
	newFlangePoses.map((pose, i) => ({ ...pose, label: `Flange ${i + 1}` })),
);
const savingToolAdapter = ref(false);

const adapterVisualFileInput = ref<HTMLInputElement | null>(null);
const adapterCollisionFileInput = ref<HTMLInputElement | null>(null);
const adapterVisualFile = ref<File | null>(null);
const adapterCollisionFile = ref<File | null>(null);
const adapterVisualFileName = ref('');
const adapterCollisionFileName = ref('');

function openAddForm() {
	newManufacturer.value = '';
	newModel.value = '';
	newFlangePoses.splice(0, newFlangePoses.length, newPose());
	adapterVisualFile.value = null;
	adapterCollisionFile.value = null;
	adapterVisualFileName.value = '';
	adapterCollisionFileName.value = '';
	showAddForm.value = true;
}

function closeAddForm() {
	showAddForm.value = false;
}

function addFlangePose() {
	newFlangePoses.push(newPose());
}

function removeFlangePose(index: number) {
	newFlangePoses.splice(index, 1);
}

function onAdapterVisualFileSelected(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (!file) return;
	adapterVisualFile.value = file;
	adapterVisualFileName.value = file.name;
}

function onAdapterCollisionFileSelected(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (!file) return;
	adapterCollisionFile.value = file;
	adapterCollisionFileName.value = file.name;
}

async function saveCustomToolAdapter() {
	const manufacturer = newManufacturer.value.trim();
	const model = newModel.value.trim();
	if (!manufacturer || !model) {
		showToast(t('setup.customComponents.error.missingRequired'), 'error');
		return;
	}

	savingToolAdapter.value = true;
	try {
		const flanges = newFlangePoses.map((pose) => {
			const quat = rpyToQuaternion(pose.roll, pose.pitch, pose.yaw);
			return {
				position: [pose.x, pose.y, pose.z],
				quaternion: [quat.x, quat.y, quat.z, quat.w],
			};
		});

		let visualMeshPath: string | null = null;
		let collisionMeshPath: string | null = null;
		if (adapterVisualFile.value || adapterCollisionFile.value) {
			const formData = new FormData();
			if (adapterVisualFile.value) formData.append('visual_file', adapterVisualFile.value);
			if (adapterCollisionFile.value) formData.append('collision_file', adapterCollisionFile.value);
			const uploadResult = await apiPostForm<any>(
				`/api/custom-tool-adapters/assets/${encodeURIComponent(manufacturer)}/${encodeURIComponent(model)}`,
				formData,
			);
			visualMeshPath = uploadResult.visualServerPath || null;
			collisionMeshPath = uploadResult.collisionServerPath || null;
		}

		await apiPost('/api/custom-tool-adapters', {
			manufacturer,
			model,
			flanges,
			visualMeshPath,
			collisionMeshPath,
		});
		showToast(t('setup.customComponents.feedback.saved'), 'success');
		closeAddForm();
		await fetchCustomToolAdapters();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		savingToolAdapter.value = false;
	}
}

// ── Add Tool Form ────────────────────────────────────────────────────
// Saving overwrites any existing entry with the same manufacturer + model,
// so this form doubles as "modify": re-enter an existing manufacturer/model
// with a new TCP pose and save to update it.

const showAddToolForm = ref(false);
const newToolManufacturer = ref('');
const newToolModel = ref('');
const newToolTcpPose = reactive<Pose>(newPose());
const newToolTcpPoses = computed(() => [{ ...newToolTcpPose, label: 'TCP' }]);
const savingTool = ref(false);

const toolVisualFileInput = ref<HTMLInputElement | null>(null);
const toolCollisionFileInput = ref<HTMLInputElement | null>(null);
const toolVisualFile = ref<File | null>(null);
const toolCollisionFile = ref<File | null>(null);
const toolVisualFileName = ref('');
const toolCollisionFileName = ref('');

function openAddToolForm() {
	newToolManufacturer.value = '';
	newToolModel.value = '';
	Object.assign(newToolTcpPose, newPose());
	toolVisualFile.value = null;
	toolCollisionFile.value = null;
	toolVisualFileName.value = '';
	toolCollisionFileName.value = '';
	showAddToolForm.value = true;
}

function closeAddToolForm() {
	showAddToolForm.value = false;
}

function onToolVisualFileSelected(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (!file) return;
	toolVisualFile.value = file;
	toolVisualFileName.value = file.name;
}

function onToolCollisionFileSelected(event: Event) {
	const file = (event.target as HTMLInputElement).files?.[0];
	if (!file) return;
	toolCollisionFile.value = file;
	toolCollisionFileName.value = file.name;
}

async function saveCustomTool() {
	const manufacturer = newToolManufacturer.value.trim();
	const model = newToolModel.value.trim();
	if (!manufacturer || !model) {
		showToast(t('setup.customComponents.error.missingRequired'), 'error');
		return;
	}

	savingTool.value = true;
	try {
		const quat = rpyToQuaternion(newToolTcpPose.roll, newToolTcpPose.pitch, newToolTcpPose.yaw);
		const tcp = {
			position: [newToolTcpPose.x, newToolTcpPose.y, newToolTcpPose.z],
			quaternion: [quat.x, quat.y, quat.z, quat.w],
		};

		let visualMeshPath: string | null = null;
		let collisionMeshPath: string | null = null;
		if (toolVisualFile.value || toolCollisionFile.value) {
			const formData = new FormData();
			if (toolVisualFile.value) formData.append('visual_file', toolVisualFile.value);
			if (toolCollisionFile.value) formData.append('collision_file', toolCollisionFile.value);
			const uploadResult = await apiPostForm<any>(
				`/api/custom-tools/assets/${encodeURIComponent(manufacturer)}/${encodeURIComponent(model)}`,
				formData,
			);
			visualMeshPath = uploadResult.visualServerPath || null;
			collisionMeshPath = uploadResult.collisionServerPath || null;
		}

		await apiPost('/api/custom-tools', {
			manufacturer,
			model,
			tcp,
			visualMeshPath,
			collisionMeshPath,
		});
		showToast(t('setup.customComponents.feedback.savedTool'), 'success');
		closeAddToolForm();
		await fetchCustomTools();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		savingTool.value = false;
	}
}
</script>
