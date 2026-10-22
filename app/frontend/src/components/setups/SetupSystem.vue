<template>
	<div class="setup-scene-object">
		<div class="setup-scene-object__header">
			<h3 class="setup-scene-object__title">{{ isEditMode ? $t('setup.system.editTitle') : $t('setup.system.createTitle') }}</h3>
			<button v-if="showCloseButton" class="setup-scene-object__close" @click="$emit('close')">&times;</button>
		</div>

		<div class="setup-field-row">
			<label class="setup-field__label setup-field__label--inline" style="width: auto;">{{ $t('setup.system.label.name') }}</label>
			<input
				class="setup-field__input"
				:class="{ 'setup-field__input--error': missingFields.has('systemName') }"
				type="text"
				v-model="systemName"
				:placeholder="$t('setup.system.placeholder.name')"
				@input="clearFieldError('systemName')"
			/>
			<button
				class="btn"
				style="white-space: nowrap; flex-shrink: 0;"
				:disabled="creating"
				@click="systemOps.createSystem()"
			>{{ creating ? (isEditMode ? $t('setup.system.feedback.modifying') : $t('setup.system.feedback.creating')) : (isEditMode ? $t('setup.system.button.modify') : $t('setup.system.button.create')) }}</button>
			<button
				v-if="isEditMode"
				class="btn btn--danger"
				style="white-space: nowrap; flex-shrink: 0;"
				:disabled="deleting"
				@click="systemOps.deleteSystem()"
			>{{ deleting ? $t('setup.system.feedback.deleting') : $t('setup.system.button.delete') }}</button>
		</div>

		<div class="setup-field-row">
			<button
				class="btn"
				style="white-space: nowrap; flex: 1; width: 100%;"
				:disabled="syncing"
				@click="systemOps.syncFromController()"
			>{{ syncing ? $t('setup.system.feedback.syncing') : $t('setup.system.button.sync') }}</button>
		</div>

		<!-- Configuration tabs -->
		<div class="setup-tabs">
			<button
				class="setup-tabs__tab"
				:class="{ active: activeConfigTab === 'manipulator' }"
				@click="activeConfigTab = 'manipulator'"
			>{{ $t('setup.system.tab.manipulator') }}</button>
			<button
				class="setup-tabs__tab"
				:class="{ active: activeConfigTab === 'external-axis' }"
				@click="activeConfigTab = 'external-axis'"
			>{{ $t('setup.system.tab.externalAxis') }}</button>
			<button
				class="setup-tabs__tab"
				:class="{ active: activeConfigTab === 'tool' }"
				@click="activeConfigTab = 'tool'"
			>{{ $t('setup.system.tab.tool') }}</button>
			<button
				class="setup-tabs__tab"
				:class="{ active: activeConfigTab === 'mounting' }"
				@click="activeConfigTab = 'mounting'"
			>{{ $t('setup.system.tab.mounting') }}</button>
		</div>

		<!-- Tab: Manipulator -->
		<div v-if="activeConfigTab === 'manipulator'" class="setup-tab-content">
			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.system.label.name') }}</label>
				<input
					class="setup-field__input"
					:class="{ 'setup-field__input--error': missingFields.has('manipulatorName') }"
					type="text"
					v-model="manipulatorName"
					:placeholder="$t('setup.system.placeholder.manipulator')"
					@input="clearFieldError('manipulatorName')"
				/>
			</div>

			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.system.label.armSerial') }}</label>
				<input
					class="setup-field__input"
					:class="{ 'setup-field__input--error': missingFields.has('armSerialNumber') }"
					type="text"
					v-model="armSerialNumber"
					:placeholder="$t('setup.system.placeholder.armSerial')"
					@input="clearFieldError('armSerialNumber')"
				/>
			</div>

			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.system.label.controlBoxSerial') }}</label>
				<input
					class="setup-field__input"
					:class="{ 'setup-field__input--error': missingFields.has('controlBoxSerialNumber') }"
					type="text"
					v-model="controlBoxSerialNumber"
					:placeholder="$t('setup.system.placeholder.controlBoxSerial')"
					@input="clearFieldError('controlBoxSerialNumber')"
				/>
			</div>
		</div>

		<!-- Tab: External Axis -->
		<div v-else-if="activeConfigTab === 'external-axis'" class="setup-tab-content">
			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.system.label.name') }}</label>
				<input
					class="setup-field__input"
					type="text"
					v-model="externalAxisName"
					:placeholder="$t('setup.system.placeholder.extAxisName')"
				/>
			</div>

			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.system.label.manufacturer') }}</label>
				<select
					class="setup-field__input setup-field__input--select"
					v-model="externalAxisManufacturer"
					@change="onManufacturerChange"
				>
					<option value="">{{ $t('setup.system.placeholder.selectManufacturer') }}</option>
					<option
						v-for="mfr in axesByManufacturer.keys()"
						:key="mfr"
						:value="mfr"
					>{{ mfr }}</option>
				</select>
			</div>

			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.system.label.model') }}</label>
				<select
					class="setup-field__input setup-field__input--select"
					v-model="externalAxisModel"
					:disabled="!externalAxisManufacturer"
				>
					<option value="">{{ $t('setup.system.placeholder.selectModel') }}</option>
					<option
						v-for="model in modelsForSelectedManufacturer"
						:key="model"
						:value="model"
					>{{ model }}</option>
				</select>
			</div>

			<p v-if="axesLoading" class="setup-tab-content__placeholder">{{ $t('setup.system.feedback.loadingAxes') }}</p>
			<p v-else-if="availableAxes.length === 0" class="setup-tab-content__placeholder">{{ $t('setup.system.feedback.noAxes') }}</p>
		</div>

		<!-- Tab: Tool & Tool Adapter -->
		<div v-else-if="activeConfigTab === 'tool'" class="setup-tab-content">

			<!-- Inner sub-tabs -->
			<div class="setup-subtabs">
				<button
					class="setup-subtabs__tab"
					:class="{ active: activeToolSubTab === 'tool-adapter' }"
					@click="activeToolSubTab = 'tool-adapter'"
				>{{ $t('setup.system.subTab.toolAdapter') }}</button>
				<button
					class="setup-subtabs__tab"
					:class="{ active: activeToolSubTab === 'tool' }"
					@click="activeToolSubTab = 'tool'"
				>{{ $t('setup.system.subTab.tool') }}</button>
			</div>

			<!-- Sub-tab: Tool Adapter -->
			<div v-if="activeToolSubTab === 'tool-adapter'" class="setup-subtab-content">
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.system.label.name') }}</label>
					<input
						class="setup-field__input"
						type="text"
						v-model="toolAdapterName"
						:placeholder="$t('setup.system.placeholder.toolAdapter')"
					/>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.system.label.manufacturer') }}</label>
					<select
						class="setup-field__input setup-field__input--select"
						v-model="toolAdapterManufacturer"
						@change="onToolAdapterManufacturerChange"
					>
						<option value="">{{ $t('setup.system.placeholder.selectManufacturer') }}</option>
						<option
							v-for="mfr in toolAdaptersByManufacturer.keys()"
							:key="mfr"
							:value="mfr"
						>{{ mfr }}</option>
					</select>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.system.label.model') }}</label>
					<select
						class="setup-field__input setup-field__input--select"
						v-model="toolAdapterModel"
						:disabled="!toolAdapterManufacturer"
					>
						<option value="">{{ $t('setup.system.placeholder.selectModel') }}</option>
						<option
							v-for="model in toolAdapterModelsForSelectedManufacturer"
							:key="model"
							:value="model"
						>{{ model }}</option>
					</select>
				</div>

				<p v-if="toolAdaptersLoading" class="setup-tab-content__placeholder">{{ $t('setup.system.feedback.loadingAdapters') }}</p>
				<p v-else-if="availableToolAdapters.length === 0" class="setup-tab-content__placeholder">{{ $t('setup.system.feedback.noAdapters') }}</p>
			</div>

			<!-- Sub-tab: Tool -->
			<div v-if="activeToolSubTab === 'tool'" class="setup-subtab-content">
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.system.label.name') }}</label>
					<input
						class="setup-field__input"
						type="text"
						v-model="toolName"
						:placeholder="$t('setup.system.placeholder.tool')"
					/>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.system.label.manufacturer') }}</label>
					<select
						class="setup-field__input setup-field__input--select"
						v-model="toolManufacturer"
						@change="onToolManufacturerChange"
					>
						<option value="">{{ $t('setup.system.placeholder.selectManufacturer') }}</option>
						<option
							v-for="mfr in toolsByManufacturer.keys()"
							:key="mfr"
							:value="mfr"
						>{{ mfr }}</option>
					</select>
				</div>

				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.system.label.model') }}</label>
					<select
						class="setup-field__input setup-field__input--select"
						v-model="toolModel"
						:disabled="!toolManufacturer"
					>
						<option value="">{{ $t('setup.system.placeholder.selectModel') }}</option>
						<option
							v-for="model in toolModelsForSelectedManufacturer"
							:key="model"
							:value="model"
						>{{ model }}</option>
					</select>
				</div>

				<p v-if="toolsLoading" class="setup-tab-content__placeholder">{{ $t('setup.system.feedback.loadingTools') }}</p>
				<p v-else-if="availableTools.length === 0" class="setup-tab-content__placeholder">{{ $t('setup.system.feedback.noTools') }}</p>
			</div>
		</div>

		<!-- Tab: Mounting -->
		<div v-else-if="activeConfigTab === 'mounting'" class="setup-tab-content">

			<!-- Inner sub-tabs -->
			<div class="setup-subtabs">
				<button
					class="setup-subtabs__tab"
					:class="{ active: activeMountSubTab === 'system-mount' }"
					@click="activeMountSubTab = 'system-mount'"
				>{{ $t('setup.system.subTab.systemMount') }}</button>
				<button
					class="setup-subtabs__tab"
					:class="{ active: activeMountSubTab === 'manipulator-mount' }"
					@click="activeMountSubTab = 'manipulator-mount'"
				>{{ $t('setup.system.subTab.manipulatorMount') }}</button>
			</div>

			<!-- Sub-tab: System Mount -->
			<div v-if="activeMountSubTab === 'system-mount'" class="setup-subtab-content">
				<p class="setup-tab-content__hint">{{ $t('setup.system.hint.systemMount') }}</p>

				<section class="info-section">
					<h4 class="info-section__title">{{ $t('setup.system.label.poseTitle') }}</h4>
					<div class="tcp-pose-row">
						<label class="tcp-pose-label tcp-pose-label--group">Pos (m)</label>
						<label class="tcp-pose-label">X</label>
						<input type="number" class="tcp-input" v-model.number="mountX" step="0.01" />
						<label class="tcp-pose-label">Y</label>
						<input type="number" class="tcp-input" v-model.number="mountY" step="0.01" />
						<label class="tcp-pose-label">Z</label>
						<input type="number" class="tcp-input" v-model.number="mountZ" step="0.01" />
					</div>
					<div class="tcp-pose-row">
						<label class="tcp-pose-label tcp-pose-label--group">RPY (°)</label>
						<label class="tcp-pose-label">R</label>
						<input type="number" class="tcp-input" v-model.number="mountRoll" step="0.1" />
						<label class="tcp-pose-label">P</label>
						<input type="number" class="tcp-input" v-model.number="mountPitch" step="0.1" />
						<label class="tcp-pose-label">Y</label>
						<input type="number" class="tcp-input" v-model.number="mountYaw" step="0.1" />
					</div>
				</section>
			</div>

			<!-- Sub-tab: Manipulator Mount -->
			<div v-if="activeMountSubTab === 'manipulator-mount'" class="setup-subtab-content">
				<p class="setup-tab-content__hint">{{ $t('setup.system.hint.manipulatorMount') }}</p>

				<section class="info-section">
					<h4 class="info-section__title">{{ $t('setup.system.label.poseTitle') }}</h4>
					<div class="tcp-pose-row">
						<label class="tcp-pose-label tcp-pose-label--group">Pos (m)</label>
						<label class="tcp-pose-label">X</label>
						<input type="number" class="tcp-input" v-model.number="manipulatorMountX" step="0.01" />
						<label class="tcp-pose-label">Y</label>
						<input type="number" class="tcp-input" v-model.number="manipulatorMountY" step="0.01" />
						<label class="tcp-pose-label">Z</label>
						<input type="number" class="tcp-input" v-model.number="manipulatorMountZ" step="0.01" />
					</div>
					<div class="tcp-pose-row">
						<label class="tcp-pose-label tcp-pose-label--group">RPY (°)</label>
						<label class="tcp-pose-label">R</label>
						<input type="number" class="tcp-input" v-model.number="manipulatorMountRoll" step="0.1" />
						<label class="tcp-pose-label">P</label>
						<input type="number" class="tcp-input" v-model.number="manipulatorMountPitch" step="0.1" />
						<label class="tcp-pose-label">Y</label>
						<input type="number" class="tcp-input" v-model.number="manipulatorMountYaw" step="0.1" />
					</div>
				</section>
			</div>
		</div>

	</div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, type Ref } from 'vue';
import { apiGet, apiPost, apiDelete } from '../../services/api';
import { useConfirm } from '../../composables/useConfirm';
import { usePrompt } from '../../composables/usePrompt';
import { useToast } from '../../composables/useToast';
import { useI18n } from '../../composables/useI18n';
import { radToDeg, degToRad } from '../../utils/math';

const { confirm } = useConfirm();
const { prompt } = usePrompt();
const { showToast } = useToast();
const { t } = useI18n();

// --- Props & Emits ---

const props = withDefaults(
	defineProps<{
		editSystemName?: string | null;
		initialConfig?: Record<string, any> | null;
		initialConfigTab?: 'manipulator' | 'external-axis' | 'tool' | 'mounting';
		showCloseButton?: boolean;
	}>(),
	{
		showCloseButton: true,
	},
);

const emit = defineEmits<{
	close: [];
	'system-created': [name: string];
	'system-modified': [name: string];
	'system-deleted': [name: string];
}>();

// --- Types ---

interface ComponentOption {
	manufacturer: string;
	model: string;
}

// --- State ---

const activeConfigTab = ref(props.initialConfigTab ?? 'manipulator');
const activeToolSubTab = ref('tool-adapter');
const activeMountSubTab = ref('system-mount');
const systemName = ref('');
const manipulatorName = ref('');
const armSerialNumber = ref('');
const controlBoxSerialNumber = ref('');
const externalAxisName = ref('');
const externalAxisManufacturer = ref('');
const externalAxisModel = ref('');
const toolName = ref('');
const toolManufacturer = ref('');
const toolModel = ref('');
const toolAdapterName = ref('');
const toolAdapterManufacturer = ref('');
const toolAdapterModel = ref('');
const mountX = ref(0);
const mountY = ref(0);
const mountZ = ref(0);
const mountRoll = ref(0);
const mountPitch = ref(0);
const mountYaw = ref(0);
const manipulatorMountX = ref(0);
const manipulatorMountY = ref(0);
const manipulatorMountZ = ref(0);
const manipulatorMountRoll = ref(0);
const manipulatorMountPitch = ref(0);
const manipulatorMountYaw = ref(0);
const creating = ref(false);
const deleting = ref(false);
const syncing = ref(false);

// Available external axes fetched from server
const availableAxes = ref<ComponentOption[]>([]);
const axesLoading = ref(false);

// Available tools fetched from server
const availableTools = ref<ComponentOption[]>([]);
const toolsLoading = ref(false);

// Available tool adapters fetched from server
const availableToolAdapters = ref<ComponentOption[]>([]);
const toolAdaptersLoading = ref(false);

// --- Computed ---

const isEditMode = computed(() => !!props.editSystemName);

// --- Required fields: single source of truth ---
//
// Which System fields are mandatory is defined ONCE here, mirroring the
// `[required]` markers in the SDK protos. Do not scatter `if (!x) ...` checks
// elsewhere — derive from this list (validation highlighting and tab-switching
// all read it). If a proto's [required] set changes, update this list and
// nothing else.
//
// Proto sources (flexiv_pdk repo, proto/flexiv/pdk/):
//   system/system.proto            -> header [required], control_box_serial_number [required], manipulator [required]
//   config_header.proto            -> name [required]   (System.header.name = the system name)
//   system/components/manipulator.proto -> name [required], arm_serial_number [required]
//
// The optional sub-components (external axis, tool, tool adapter) are only
// required *conditionally* — their proto fields are marked [required] but the
// component itself is optional on System — so they are validated at submit time
// by the backend only when the user starts filling them in, not listed here.
interface RequiredField {
	/** Stable key: matches the highlight class binding and request-body key. */
	key: string;
	/** The reactive model backing the input. */
	model: Ref<string>;
	/** i18n key for the field label (used in the "missing fields" message). */
	labelKey: string;
	/** Config tab the input lives on, so we can reveal it on a failed submit. */
	tab?: 'manipulator' | 'external-axis' | 'tool' | 'mounting';
}

const REQUIRED_FIELDS: RequiredField[] = [
	{ key: 'systemName',             model: systemName,             labelKey: 'setup.system.label.systemName' },
	{ key: 'manipulatorName',        model: manipulatorName,        labelKey: 'setup.system.label.name',             tab: 'manipulator' },
	{ key: 'armSerialNumber',        model: armSerialNumber,        labelKey: 'setup.system.label.armSerial',        tab: 'manipulator' },
	{ key: 'controlBoxSerialNumber', model: controlBoxSerialNumber, labelKey: 'setup.system.label.controlBoxSerial', tab: 'manipulator' },
];

/** Keys of required fields currently flagged empty (drives the red outline). */
const missingFields = ref<Set<string>>(new Set());

/**
 * Flag every empty required field, reveal the first offending tab, and toast
 * the field names. Returns true when all required fields are filled.
 */
function validateRequired(): boolean {
	const missing = REQUIRED_FIELDS.filter((f) => f.model.value.trim() === '');
	missingFields.value = new Set(missing.map((f) => f.key));

	if (missing.length === 0) return true;

	// Reveal the first missing field that lives on a (possibly hidden) tab.
	const onTab = missing.find((f) => f.tab);
	if (onTab && onTab.tab) activeConfigTab.value = onTab.tab;

	const names = missing.map((f) => t(f.labelKey)).join(', ');
	showToast(t('setup.system.error.missingRequired', { fields: names }), 'error');
	return false;
}

/** Clear the red outline for a field once the user edits it. */
function clearFieldError(key: string) {
	if (missingFields.value.has(key)) {
		const next = new Set(missingFields.value);
		next.delete(key);
		missingFields.value = next;
	}
}

// Helper: group component options by manufacturer
function groupByManufacturer(items: ComponentOption[]) {
	const map = new Map<string, string[]>();
	for (const item of items) {
		const mfr = item.manufacturer || 'Unknown';
		if (!map.has(mfr)) map.set(mfr, []);
		map.get(mfr)!.push(item.model);
	}
	return map;
}

// Group available axes by manufacturer for the select dropdown
const axesByManufacturer = computed(() => groupByManufacturer(availableAxes.value));

// Models for the currently selected manufacturer
const modelsForSelectedManufacturer = computed(() => {
	return axesByManufacturer.value.get(externalAxisManufacturer.value) || [];
});

// Group available tools by manufacturer
const toolsByManufacturer = computed(() => groupByManufacturer(availableTools.value));

// Models for the currently selected tool manufacturer
const toolModelsForSelectedManufacturer = computed(() => {
	return toolsByManufacturer.value.get(toolManufacturer.value) || [];
});

// Group available tool adapters by manufacturer
const toolAdaptersByManufacturer = computed(() => groupByManufacturer(availableToolAdapters.value));

// Models for the currently selected tool adapter manufacturer
const toolAdapterModelsForSelectedManufacturer = computed(() => {
	return toolAdaptersByManufacturer.value.get(toolAdapterManufacturer.value) || [];
});

// --- Lifecycle ---

onMounted(async () => {
	await Promise.all([
		fetchAvailableAxes(),
		fetchAvailableTools(),
		fetchAvailableToolAdapters(),
	]);

	if (isEditMode.value) {
		if (props.initialConfig) {
			applyConfig(props.initialConfig);
		} else {
			await loadSystemConfig();
		}
	}
});

// --- Methods ---

async function fetchAvailableAxes() {
	axesLoading.value = true;
	try {
		const data = await apiGet<any>('/api/external-robot-axes');
		availableAxes.value = data.axes || [];
	} catch (err) {
		console.warn('Could not load external axes:', err);
	} finally {
		axesLoading.value = false;
	}
}

async function fetchAvailableTools() {
	toolsLoading.value = true;
	try {
		const [tools, customTools] = await Promise.all([
			apiGet<any>('/api/tools').then((data) => data.tools || []).catch((err) => {
				console.warn('Could not load tools:', err);
				return [];
			}),
			apiGet<any>('/api/custom-tools').then((data) => data.customTools || []).catch((err) => {
				console.warn('Could not load custom tools:', err);
				return [];
			}),
		]);
		availableTools.value = [...tools, ...customTools];
	} finally {
		toolsLoading.value = false;
	}
}

async function fetchAvailableToolAdapters() {
	toolAdaptersLoading.value = true;
	try {
		const [toolAdapters, customToolAdapters] = await Promise.all([
			apiGet<any>('/api/tool-adapters').then((data) => data.toolAdapters || []).catch((err) => {
				console.warn('Could not load tool adapters:', err);
				return [];
			}),
			apiGet<any>('/api/custom-tool-adapters').then((data) => data.customToolAdapters || []).catch((err) => {
				console.warn('Could not load custom tool adapters:', err);
				return [];
			}),
		]);
		availableToolAdapters.value = [...toolAdapters, ...customToolAdapters];
	} finally {
		toolAdaptersLoading.value = false;
	}
}

function onManufacturerChange() {
	// Reset model when manufacturer changes
	externalAxisModel.value = '';
}

function onToolManufacturerChange() {
	// Reset model when manufacturer changes
	toolModel.value = '';
}

function onToolAdapterManufacturerChange() {
	// Reset model when manufacturer changes
	toolAdapterModel.value = '';
}

// --- Load existing config for editing ---

function applyConfig(cfg: Record<string, any>) {
	systemName.value = cfg.name || '';
	manipulatorName.value = cfg.manipulatorName || '';
	armSerialNumber.value = cfg.armSerialNumber || '';
	controlBoxSerialNumber.value = cfg.controlBoxSerialNumber || '';
	externalAxisName.value = cfg.externalAxisName || '';
	externalAxisManufacturer.value = cfg.externalAxisManufacturer || '';
	externalAxisModel.value = cfg.externalAxisModel || '';
	toolAdapterName.value = cfg.toolAdapterName || '';
	toolAdapterManufacturer.value = cfg.toolAdapterManufacturer || '';
	toolAdapterModel.value = cfg.toolAdapterModel || '';
	toolName.value = cfg.toolName || '';
	toolManufacturer.value = cfg.toolManufacturer || '';
	toolModel.value = cfg.toolModel || '';

	if (cfg.mountXyz) {
		mountX.value = cfg.mountXyz[0] ?? 0;
		mountY.value = cfg.mountXyz[1] ?? 0;
		mountZ.value = cfg.mountXyz[2] ?? 0;
	}
	if (cfg.mountRpy) {
		mountRoll.value = radToDeg(cfg.mountRpy[0] ?? 0);
		mountPitch.value = radToDeg(cfg.mountRpy[1] ?? 0);
		mountYaw.value = radToDeg(cfg.mountRpy[2] ?? 0);
	}
	if (cfg.manipulatorMountXyz) {
		manipulatorMountX.value = cfg.manipulatorMountXyz[0] ?? 0;
		manipulatorMountY.value = cfg.manipulatorMountXyz[1] ?? 0;
		manipulatorMountZ.value = cfg.manipulatorMountXyz[2] ?? 0;
	}
	if (cfg.manipulatorMountRpy) {
		manipulatorMountRoll.value = radToDeg(cfg.manipulatorMountRpy[0] ?? 0);
		manipulatorMountPitch.value = radToDeg(cfg.manipulatorMountRpy[1] ?? 0);
		manipulatorMountYaw.value = radToDeg(cfg.manipulatorMountRpy[2] ?? 0);
	}
}

async function loadSystemConfig() {
	try {
		const data = await apiGet<any>(`/api/systems/${encodeURIComponent(props.editSystemName!)}/config`);
		applyConfig(data);
	} catch (err: any) {
		console.error('Failed to load system config:', err);
		showToast('Failed to load system configuration: ' + (err.message || String(err)), 'error');
	}
}

// --- System Operations ---

const systemOps = {
	async createSystem() {
		// Highlight any empty required fields and stop, instead of silently
		// no-op'ing. Required set comes from REQUIRED_FIELDS (see above).
		if (!validateRequired()) return;

		const trimmedName = systemName.value.trim();
		if (!isEditMode.value || trimmedName !== props.editSystemName) {
			const existingNames = await apiGet<{ systems: string[] }>('/api/systems')
				.then((r) => r.systems || [])
				.catch((): string[] => []);
			if (existingNames.includes(trimmedName)) {
				showToast(t('setup.system.error.duplicateName', { name: trimmedName }), 'error');
				return;
			}
		}

		if (isEditMode.value) {
			const ok = await confirm(
				`Modifying the system will remove all its targets and trajectories. Continue?`
			);
			if (!ok) return;
		}
		creating.value = true;
		try {
			const body: Record<string, any> = {
				name: systemName.value.trim(),
				manipulatorName: manipulatorName.value.trim(),
				armSerialNumber: armSerialNumber.value.trim(),
				controlBoxSerialNumber: controlBoxSerialNumber.value.trim(),
			};

			// Include external axis data if a name was provided
			if (externalAxisName.value.trim()) {
				body.externalAxisName = externalAxisName.value.trim();
				body.externalAxisManufacturer = externalAxisManufacturer.value.trim() || null;
				body.externalAxisModel = externalAxisModel.value.trim() || null;
			}

			// Include tool adapter data if a name was provided
			if (toolAdapterName.value.trim()) {
				body.toolAdapterName = toolAdapterName.value.trim();
				body.toolAdapterManufacturer = toolAdapterManufacturer.value.trim() || null;
				body.toolAdapterModel = toolAdapterModel.value.trim() || null;
			}

			// Include tool data if a name was provided
			if (toolName.value.trim()) {
				body.toolName = toolName.value.trim();
				body.toolManufacturer = toolManufacturer.value.trim() || null;
				body.toolModel = toolModel.value.trim() || null;
			}

			// Include system mounting pose (convert RPY from degrees to radians)
			body.mountXyz = [mountX.value, mountY.value, mountZ.value];
			body.mountRpy = [
				degToRad(mountRoll.value),
				degToRad(mountPitch.value),
				degToRad(mountYaw.value),
			];

			// Include manipulator mounting pose
			body.manipulatorMountXyz = [manipulatorMountX.value, manipulatorMountY.value, manipulatorMountZ.value];
			body.manipulatorMountRpy = [
				degToRad(manipulatorMountRoll.value),
				degToRad(manipulatorMountPitch.value),
				degToRad(manipulatorMountYaw.value),
			];

			await apiPost('/api/systems', body);
			if (isEditMode.value) {
				emit('system-modified', systemName.value.trim());
			} else {
				emit('system-created', systemName.value.trim());
			}
			emit('close');
		} catch (err: any) {
			console.error('Create system error:', err);
			showToast(err.message || String(err), 'error');
		} finally {
			creating.value = false;
		}
	},
	async deleteSystem() {
		if (!isEditMode.value) return;
		const ok = await confirm(`Delete system "${props.editSystemName}"?`);
		if (!ok) return;
		deleting.value = true;
		try {
			await apiDelete(`/api/systems/${encodeURIComponent(props.editSystemName!)}`);
			emit('system-deleted', props.editSystemName!);
			emit('close');
		} catch (err: any) {
			console.error('Delete system error:', err);
			showToast(err.message || String(err), 'error');
		} finally {
			deleting.value = false;
		}
	},
	async syncFromController() {
		const targetName = isEditMode.value ? props.editSystemName!.trim() : systemName.value.trim();
		if (!targetName) {
			showToast(t('setup.system.error.nameRequired'), 'error');
			return;
		}

		if (!isEditMode.value || targetName !== props.editSystemName) {
			const existingNames = await apiGet<{ systems: string[] }>('/api/systems')
				.then((r) => r.systems || [])
				.catch((): string[] => []);
			if (existingNames.includes(targetName)) {
				showToast(t('setup.system.error.duplicateName', { name: targetName }), 'error');
				return;
			}
		}

		const serialNumber = await prompt(t('setup.system.prompt.serialNumber'), {
			placeholder: t('setup.system.prompt.serialNumberPlaceholder'),
		});
		if (!serialNumber || !serialNumber.trim()) return;

		syncing.value = true;
		try {
			const data = await apiPost<any>('/api/systems/sync-from-controller', {
				name: targetName,
				serialNumber: serialNumber.trim(),
			});
			applyConfig(data);
			showToast('Synced system configuration from controller.', 'success');
		} catch (err: any) {
			console.error('Sync from controller error:', err);
			showToast(err.message || String(err), 'error');
		} finally {
			syncing.value = false;
		}
	},
};
</script>