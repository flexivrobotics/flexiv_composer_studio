<template>
	<div class="setup-scene-object setup-scene-object--fixed-tabs">
		<div class="setup-scene-object__sticky">
			<div class="setup-scene-object__header">
				<h3 class="setup-scene-object__title">{{ $t('setup.collisionConfig.title') }}</h3>
				<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
			</div>
			<p class="setup-tab-content__placeholder" style="margin: 0 0 0.5rem;">{{ $t('setup.collisionConfig.notice') }}</p>
		</div>

		<div class="setup-scene-object__scrollable">
			<p v-if="configsLoading" class="setup-tab-content__placeholder">{{ $t('setup.collisionConfig.feedback.loading') }}</p>
			<p v-else-if="configs.length === 0" class="setup-tab-content__placeholder">{{ $t('setup.collisionConfig.feedback.noConfigs') }}</p>
			<table v-else class="limits-table">
				<thead>
					<tr>
						<th>{{ $t('setup.collisionConfig.tableHeader.name') }}</th>
						<th>{{ $t('setup.collisionConfig.tableHeader.margin') }}</th>
						<th>{{ $t('setup.collisionConfig.tableHeader.pairs') }}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="cfg in configs" :key="cfg.name">
						<td>
							<template v-if="renamingName === cfg.name">
								<input class="setup-field__input" type="text" v-model="renameValue" style="min-width: 8rem;" />
							</template>
							<template v-else>
								{{ cfg.name }}
								<span v-if="cfg.name === DEFAULT_CONFIG_NAME" class="setup-field__label" style="margin-left: 0.35rem;">({{ $t('setup.collisionConfig.label.activeBadge') }})</span>
							</template>
						</td>
						<td>{{ cfg.collisionMargin.toFixed(3) }}</td>
						<td>{{ cfg.pairs.length }}</td>
						<td style="white-space: nowrap;">
							<template v-if="renamingName === cfg.name">
								<button class="btn" :disabled="renaming" @click="saveRename(cfg.name)">{{ $t('setup.collisionConfig.button.save') }}</button>
								<button class="btn btn--outline" :disabled="renaming" @click="cancelRename">{{ $t('setup.collisionConfig.button.cancel') }}</button>
							</template>
							<template v-else>
								<button class="btn btn--outline" @click="selectConfig(cfg.name)">{{ $t('setup.collisionConfig.button.select') }}</button>
								<button class="btn btn--outline" @click="startRename(cfg.name)">{{ $t('setup.collisionConfig.button.rename') }}</button>
								<button
									class="btn btn--danger"
									:disabled="removingName === cfg.name"
									@click="removeConfig(cfg.name)"
								>{{ $t('setup.collisionConfig.button.delete') }}</button>
							</template>
						</td>
					</tr>
				</tbody>
			</table>

			<button
				v-if="!showCreateForm"
				class="btn btn--outline"
				style="margin-top: 0.5rem;"
				@click="openCreateForm"
			>{{ $t('setup.collisionConfig.button.create') }}</button>

			<div v-else class="setup-add-form">
				<hr class="setup-divider" />
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.collisionConfig.label.name') }}</label>
					<input
						class="setup-field__input"
						type="text"
						v-model="newConfigName"
						:placeholder="$t('setup.collisionConfig.placeholder.name')"
					/>
				</div>
				<div class="setup-field-row">
					<button class="btn" :disabled="creating" @click="createConfig">
						{{ creating ? $t('setup.collisionConfig.feedback.saving') : $t('setup.collisionConfig.button.create') }}
					</button>
					<button class="btn btn--outline" :disabled="creating" @click="closeCreateForm">{{ $t('setup.collisionConfig.button.cancel') }}</button>
				</div>
			</div>

			<template v-if="selectedConfig">
				<hr class="setup-divider" />
				<h4 class="setup-scene-object__title" style="font-size: 0.95rem;">{{ selectedConfig.name }}</h4>

				<div class="setup-field-row">
					<div class="setup-field" style="flex: 1;">
						<label class="setup-field__label">{{ $t('setup.collisionConfig.label.margin') }}</label>
						<input class="setup-field__input" type="number" min="0" step="0.001" v-model.number="marginDraft" />
					</div>
					<button class="btn" :disabled="savingMargin" @click="saveMargin">
						{{ savingMargin ? $t('setup.collisionConfig.feedback.saving') : $t('setup.collisionConfig.button.save') }}
					</button>
				</div>

				<label class="setup-field__label">{{ $t('setup.collisionConfig.label.pairs') }}</label>
				<p v-if="selectedConfig.pairs.length === 0" class="setup-tab-content__placeholder">{{ $t('setup.collisionConfig.feedback.noPairs') }}</p>
				<table v-else class="limits-table">
					<thead>
						<tr>
							<th>{{ $t('setup.collisionConfig.label.pairName1') }}</th>
							<th>{{ $t('setup.collisionConfig.label.pairName2') }}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="pair in selectedConfig.pairs" :key="pair.name1 + '::' + pair.name2">
							<td>{{ pair.name1 }}</td>
							<td>{{ pair.name2 }}</td>
							<td>
								<button
									class="btn btn--danger"
									:disabled="removingPairKey === pair.name1 + '::' + pair.name2"
									@click="removePair(pair)"
								>{{ $t('setup.collisionConfig.button.removePair') }}</button>
							</td>
						</tr>
					</tbody>
				</table>

				<div class="setup-row">
					<div class="setup-field setup-row__item">
						<label class="setup-field__label">{{ $t('setup.collisionConfig.label.pairName1') }}</label>
						<select class="setup-field__input" v-model="newPairName1">
							<option value="">—</option>
							<option v-for="name in components" :key="name" :value="name">{{ name }}</option>
						</select>
					</div>
					<div class="setup-field setup-row__item">
						<label class="setup-field__label">{{ $t('setup.collisionConfig.label.pairName2') }}</label>
						<select class="setup-field__input" v-model="newPairName2">
							<option value="">—</option>
							<option v-for="name in components" :key="name" :value="name">{{ name }}</option>
						</select>
					</div>
				</div>
				<button class="btn btn--outline" :disabled="addingPair || !newPairName1 || !newPairName2" @click="addPair">
					{{ $t('setup.collisionConfig.button.addPair') }}
				</button>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiDelete, apiGet, apiPost, apiPut } from '../../services/api';
import { useToast } from '../../composables/useToast';
import { useConfirm } from '../../composables/useConfirm';
import { useI18n } from '../../composables/useI18n';

defineEmits<{
	close: [];
}>();

const { showToast } = useToast();
const { confirm } = useConfirm();
const { t } = useI18n();

const DEFAULT_CONFIG_NAME = 'default';

interface CollisionPair {
	name1: string;
	name2: string;
}

interface CollisionConfig {
	name: string;
	collisionMargin: number;
	pairs: CollisionPair[];
}

const configs = ref<CollisionConfig[]>([]);
const configsLoading = ref(false);
const components = ref<string[]>([]);

const selectedName = ref<string | null>(null);
const selectedConfig = computed(() => configs.value.find(c => c.name === selectedName.value) ?? null);
const marginDraft = ref(0);
const savingMargin = ref(false);

onMounted(() => {
	fetchConfigs();
	fetchComponents();
});

async function fetchConfigs() {
	configsLoading.value = true;
	try {
		const list = await apiGet<{ configs: string[] }>('/api/collision-configs');
		const details = await Promise.all(
			(list.configs ?? []).map(name => apiGet<CollisionConfig>(`/api/collision-configs/${encodeURIComponent(name)}`)),
		);
		configs.value = details;
		if (selectedName.value && !details.some(c => c.name === selectedName.value)) {
			selectedName.value = null;
		}
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		configsLoading.value = false;
	}
}

async function fetchComponents() {
	try {
		const data = await apiGet<{ components: string[] }>('/api/collision-components');
		components.value = data.components ?? [];
	} catch (err) {
		console.warn('Could not load collision components:', err);
	}
}

function selectConfig(name: string) {
	selectedName.value = name;
	marginDraft.value = selectedConfig.value?.collisionMargin ?? 0;
	newPairName1.value = '';
	newPairName2.value = '';
}

// ── Create ─────────────────────────────────────────────────────────

const showCreateForm = ref(false);
const newConfigName = ref('');
const creating = ref(false);

function openCreateForm() {
	newConfigName.value = '';
	showCreateForm.value = true;
}

function closeCreateForm() {
	showCreateForm.value = false;
}

async function createConfig() {
	const name = newConfigName.value.trim();
	if (!name) {
		showToast(t('setup.collisionConfig.error.missingName'), 'error');
		return;
	}
	creating.value = true;
	try {
		await apiPost('/api/collision-configs', { name, collisionMargin: 0 });
		showToast(t('setup.collisionConfig.feedback.created'), 'success');
		closeCreateForm();
		await fetchConfigs();
		selectConfig(name);
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		creating.value = false;
	}
}

// ── Rename ─────────────────────────────────────────────────────────

const renamingName = ref<string | null>(null);
const renameValue = ref('');
const renaming = ref(false);

function startRename(name: string) {
	renamingName.value = name;
	renameValue.value = name;
}

function cancelRename() {
	renamingName.value = null;
}

async function saveRename(oldName: string) {
	const newName = renameValue.value.trim();
	if (!newName || newName === oldName) {
		cancelRename();
		return;
	}
	const message = oldName === DEFAULT_CONFIG_NAME
		? t('setup.collisionConfig.confirm.renameDefault', { name: oldName })
		: t('setup.collisionConfig.confirm.rename', { name: oldName });
	const ok = await confirm(message);
	if (!ok) return;

	renaming.value = true;
	try {
		await apiPut(`/api/collision-configs/${encodeURIComponent(oldName)}/rename`, { newName });
		showToast(t('setup.collisionConfig.feedback.renamed'), 'success');
		if (selectedName.value === oldName) selectedName.value = newName;
		renamingName.value = null;
		await fetchConfigs();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		renaming.value = false;
	}
}

// ── Delete ─────────────────────────────────────────────────────────

const removingName = ref<string | null>(null);

async function removeConfig(name: string) {
	const message = name === DEFAULT_CONFIG_NAME
		? t('setup.collisionConfig.confirm.removeDefault', { name })
		: t('setup.collisionConfig.confirm.remove', { name });
	const ok = await confirm(message);
	if (!ok) return;

	removingName.value = name;
	try {
		await apiDelete(`/api/collision-configs/${encodeURIComponent(name)}`);
		showToast(t('setup.collisionConfig.feedback.removed'), 'success');
		if (selectedName.value === name) selectedName.value = null;
		await fetchConfigs();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		removingName.value = null;
	}
}

// ── Margin ─────────────────────────────────────────────────────────

async function saveMargin() {
	if (!selectedConfig.value) return;
	savingMargin.value = true;
	try {
		await apiPut(`/api/collision-configs/${encodeURIComponent(selectedConfig.value.name)}`, {
			collisionMargin: marginDraft.value,
		});
		showToast(t('setup.collisionConfig.feedback.marginSaved'), 'success');
		await fetchConfigs();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		savingMargin.value = false;
	}
}

// ── Pairs ──────────────────────────────────────────────────────────

const newPairName1 = ref('');
const newPairName2 = ref('');
const addingPair = ref(false);
const removingPairKey = ref<string | null>(null);

async function addPair() {
	if (!selectedConfig.value || !newPairName1.value || !newPairName2.value) return;
	addingPair.value = true;
	try {
		await apiPost(`/api/collision-configs/${encodeURIComponent(selectedConfig.value.name)}/pairs`, {
			name1: newPairName1.value,
			name2: newPairName2.value,
		});
		showToast(t('setup.collisionConfig.feedback.pairAdded'), 'success');
		newPairName1.value = '';
		newPairName2.value = '';
		await fetchConfigs();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		addingPair.value = false;
	}
}

async function removePair(pair: CollisionPair) {
	if (!selectedConfig.value) return;
	const key = `${pair.name1}::${pair.name2}`;
	removingPairKey.value = key;
	try {
		await apiDelete(
			`/api/collision-configs/${encodeURIComponent(selectedConfig.value.name)}/pairs`
			+ `?name1=${encodeURIComponent(pair.name1)}&name2=${encodeURIComponent(pair.name2)}`,
		);
		showToast(t('setup.collisionConfig.feedback.pairRemoved'), 'success');
		await fetchConfigs();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		removingPairKey.value = null;
	}
}
</script>
