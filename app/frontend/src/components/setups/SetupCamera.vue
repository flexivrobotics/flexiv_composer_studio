<template>
	<div class="setup-scene-object">
		<div class="setup-scene-object__header">
			<h3 class="setup-scene-object__title">{{ isEditMode ? $t('setup.camera.editTitle') : $t('setup.camera.createTitle') }}</h3>
			<button v-if="showCloseButton" class="setup-scene-object__close" @click="$emit('close')">&times;</button>
		</div>

		<div class="setup-field-row">
			<label class="setup-field__label setup-field__label--inline" style="width: auto;">{{ $t('setup.camera.label.name') }}</label>
			<input
				class="setup-field__input"
				:class="{ 'setup-field__input--error': missingFields.has('cameraName') }"
				type="text"
				v-model="cameraName"
				:placeholder="$t('setup.camera.placeholder.name')"
				@input="clearFieldError('cameraName')"
			/>
			<button
				class="btn"
				style="white-space: nowrap; flex-shrink: 0;"
				:disabled="creating"
				@click="cameraOps.createCamera()"
			>{{ creating ? (isEditMode ? $t('setup.camera.feedback.modifying') : $t('setup.camera.feedback.creating')) : (isEditMode ? $t('setup.camera.button.modify') : $t('setup.camera.button.create')) }}</button>
			<button
				v-if="isEditMode"
				class="btn btn--danger"
				style="white-space: nowrap; flex-shrink: 0;"
				:disabled="deleting"
				@click="cameraOps.deleteCamera()"
			>{{ deleting ? $t('setup.camera.feedback.deleting') : $t('setup.camera.button.delete') }}</button>
		</div>

		<div class="setup-tab-content">
			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.camera.label.parent') }}</label>
				<select class="setup-field__input setup-field__input--select" v-model="parent">
					<option value="world">{{ $t('setup.camera.option.world') }}</option>
					<option
						v-for="flange in systemFlanges"
						:key="flange.flangeName"
						:value="flange.flangeName"
					>{{ flange.systemName }} ({{ flange.flangeName }})</option>
				</select>
			</div>

			<section class="info-section">
				<h4 class="info-section__title">{{ $t('setup.camera.label.poseTitle') }}<span class="info-section__title info-section__title-sub"> — {{ parent }}</span></h4>
				<div class="tcp-pose-row">
					<label class="tcp-pose-label tcp-pose-label--group">Pos (m)</label>
					<label class="tcp-pose-label">X</label>
					<input type="number" class="tcp-input" v-model.number="posX" step="0.01" />
					<label class="tcp-pose-label">Y</label>
					<input type="number" class="tcp-input" v-model.number="posY" step="0.01" />
					<label class="tcp-pose-label">Z</label>
					<input type="number" class="tcp-input" v-model.number="posZ" step="0.01" />
				</div>
				<div class="tcp-pose-row">
					<label class="tcp-pose-label tcp-pose-label--group">RPY (°)</label>
					<label class="tcp-pose-label">R</label>
					<input type="number" class="tcp-input" v-model.number="rotRoll" step="0.1" />
					<label class="tcp-pose-label">P</label>
					<input type="number" class="tcp-input" v-model.number="rotPitch" step="0.1" />
					<label class="tcp-pose-label">Y</label>
					<input type="number" class="tcp-input" v-model.number="rotYaw" step="0.1" />
				</div>
			</section>

			<p class="setup-tab-content__hint">{{ $t('setup.camera.hint.optics') }}</p>
			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.camera.label.cameraId') }}</label>
				<input
					class="setup-field__input"
					:class="{ 'setup-field__input--error': missingFields.has('cameraId') }"
					type="number"
					step="1"
					v-model="cameraId"
					@input="clearFieldError('cameraId')"
				/>
			</div>
			<div class="setup-field setup-field--inline">
				<label class="setup-field__checkbox-label">
					<input type="checkbox" v-model="syncFromDevice" />
					{{ $t('setup.camera.label.syncFromDevice') }}
				</label>
				<span v-if="syncingFromDevice" class="setup-tab-content__placeholder">{{ $t('setup.camera.feedback.syncingFromDevice') }}</span>
			</div>
			<div class="setup-row">
				<div class="setup-field setup-row__item">
					<label class="setup-field__label">{{ $t('setup.camera.label.farWidth') }}</label>
					<input
						class="setup-field__input"
						:class="{ 'setup-field__input--error': missingFields.has('farWidth') }"
						type="number"
						step="0.01"
						v-model="farWidth"
						:disabled="syncFromDevice"
						@input="clearFieldError('farWidth')"
					/>
				</div>
				<div class="setup-field setup-row__item">
					<label class="setup-field__label">{{ $t('setup.camera.label.farHeight') }}</label>
					<input
						class="setup-field__input"
						:class="{ 'setup-field__input--error': missingFields.has('farHeight') }"
						type="number"
						step="0.01"
						v-model="farHeight"
						:disabled="syncFromDevice"
						@input="clearFieldError('farHeight')"
					/>
				</div>
			</div>
			<div class="setup-row">
				<div class="setup-field setup-row__item">
					<label class="setup-field__label">{{ $t('setup.camera.label.farDistance') }}</label>
					<input
						class="setup-field__input"
						:class="{ 'setup-field__input--error': missingFields.has('farDistance') }"
						type="number"
						step="0.01"
						v-model="farDistance"
						@input="clearFieldError('farDistance')"
					/>
				</div>
				<div class="setup-field setup-row__item">
					<label class="setup-field__label">{{ $t('setup.camera.label.nearDistance') }}</label>
					<input
						class="setup-field__input"
						:class="{ 'setup-field__input--error': missingFields.has('nearDistance') }"
						type="number"
						step="0.01"
						v-model="nearDistance"
						@input="clearFieldError('nearDistance')"
					/>
				</div>
			</div>
			<div class="setup-field">
				<label class="setup-field__label">{{ $t('setup.camera.label.depthScale') }}</label>
				<input
					class="setup-field__input"
					:class="{ 'setup-field__input--error': missingFields.has('depthScale') }"
					type="number"
					step="0.01"
					v-model="depthScale"
					@input="clearFieldError('depthScale')"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, type Ref } from 'vue';
import { apiGet, apiPost, apiDelete } from '../../services/api';
import { useConfirm } from '../../composables/useConfirm';
import { useToast } from '../../composables/useToast';
import { useI18n } from '../../composables/useI18n';
import { rpyToQuaternion, quatToRpy } from '../../services/kinematics';
import { radToDeg } from '../../utils/math';
import type { CameraCreatedPayload } from '../../composables/tree/useSceneTreeSetup';

const { confirm } = useConfirm();
const { showToast } = useToast();
const { t } = useI18n();

// --- Props & Emits ---

const props = withDefaults(
	defineProps<{
		editCameraName?: string | null;
		initialConfig?: Record<string, any> | null;
		showCloseButton?: boolean;
	}>(),
	{
		showCloseButton: true,
	},
);

const emit = defineEmits<{
	close: [];
	'camera-created': [camera: CameraCreatedPayload];
	'camera-modified': [camera: CameraCreatedPayload];
	'camera-deleted': [name: string];
}>();

// --- State ---

const cameraName = ref('');
const parent = ref('world');
const posX = ref(0);
const posY = ref(0);
const posZ = ref(0);
const rotRoll = ref(0);
const rotPitch = ref(0);
const rotYaw = ref(0);
const cameraId = ref('');
const farWidth = ref('1');
const farHeight = ref('1');
const farDistance = ref('2');
const nearDistance = ref('0.1');
const depthScale = ref('1000');
const creating = ref(false);
const deleting = ref(false);

// When enabled, far width/height are read from the physical camera device
// instead of being entered by hand.
const syncFromDevice = ref(false);
const syncingFromDevice = ref(false);

// Systems' flange frames, offered alongside 'world' as parent-frame options.
const systemFlanges = ref<{ systemName: string; flangeName: string }[]>([]);

// --- Computed ---

const isEditMode = computed(() => !!props.editCameraName);

// --- Required fields: single source of truth ---
//
// Mirrors the `[required]` markers in camera.proto on far_width, far_height,
// far_distance, near_distance, depth_scale, and camera_id (fields 2-7), plus
// ConfigHeader.name. Parent/position/orientation default sensibly (world
// frame, identity pose) so they are not required here.
//
// Proto source: flexiv_pdk repo, proto/flexiv/pdk/scene/camera.proto.
// The backend route (camera_routes.py CAMERA_REQUIRED_FIELDS) validates the
// same set so a bad request never silently reaches the SDK.
interface RequiredField {
	key: string;
	// Native `type="number"` inputs cast v-model's bound value to a Number on
	// input regardless of the `.number` modifier, so these refs hold a string
	// only until first edited — the type (and the check below) must tolerate
	// both.
	model: Ref<string | number>;
	labelKey: string;
}

const REQUIRED_FIELDS: RequiredField[] = [
	{ key: 'cameraName',   model: cameraName,   labelKey: 'setup.camera.label.name' },
	{ key: 'cameraId',     model: cameraId,     labelKey: 'setup.camera.label.cameraId' },
	{ key: 'farWidth',     model: farWidth,     labelKey: 'setup.camera.label.farWidth' },
	{ key: 'farHeight',    model: farHeight,    labelKey: 'setup.camera.label.farHeight' },
	{ key: 'farDistance',  model: farDistance,  labelKey: 'setup.camera.label.farDistance' },
	{ key: 'nearDistance', model: nearDistance, labelKey: 'setup.camera.label.nearDistance' },
	{ key: 'depthScale',   model: depthScale,   labelKey: 'setup.camera.label.depthScale' },
];

/** Keys of required fields currently flagged empty (drives the red outline). */
const missingFields = ref<Set<string>>(new Set());

function validateRequired(): boolean {
	const missing = REQUIRED_FIELDS.filter((f) => String(f.model.value ?? '').trim() === '');
	missingFields.value = new Set(missing.map((f) => f.key));

	if (missing.length === 0) return true;

	const names = missing.map((f) => t(f.labelKey)).join(', ');
	showToast(t('setup.camera.error.missingRequired', { fields: names }), 'error');
	return false;
}

function clearFieldError(key: string) {
	if (missingFields.value.has(key)) {
		const next = new Set(missingFields.value);
		next.delete(key);
		missingFields.value = next;
	}
}

// --- Device Sync ---

/**
 * Pull far width/height from the physical camera device and re-save the
 * camera with the updated values. Called from createCamera() *after* the
 * camera has already been saved once (so the device can identify it by
 * name), not on checkbox toggle. If the device isn't online, the camera
 * itself is left saved as-is and a warning is shown instead of an error —
 * this is a best-effort refinement, not a precondition for creation.
 */
async function syncFarPlaneFromDevice(name: string) {
	syncingFromDevice.value = true;
	try {
		const data = await apiGet<any>(`/api/cameras/${encodeURIComponent(name)}/device-resolution`);
		farWidth.value = String(data.farWidth ?? '');
		farHeight.value = String(data.farHeight ?? '');
		clearFieldError('farWidth');
		clearFieldError('farHeight');
		await apiPost('/api/cameras', buildCameraBody(name));
	} catch (err: any) {
		const message = err?.message ?? String(err);
		if (message.includes('not online')) {
			showToast(t('setup.camera.warning.deviceNotOnline', { name }), 'warning');
		} else {
			console.error('Sync far width/height from device error:', err);
			showToast(message, 'error');
		}
	} finally {
		syncingFromDevice.value = false;
	}
}

// --- Lifecycle ---

onMounted(async () => {
	await fetchSystemFlanges();

	if (isEditMode.value) {
		if (props.initialConfig) {
			applyConfig(props.initialConfig);
		} else {
			await loadCameraConfig();
		}
	}
});

async function fetchSystemFlanges() {
	try {
		const data = await apiGet<any>('/api/systems/flanges');
		systemFlanges.value = data.flanges || [];
	} catch (err) {
		console.warn('Could not load system flanges:', err);
	}
}

// --- Load existing config for editing ---

function applyConfig(cfg: Record<string, any>) {
	cameraName.value = cfg.name || '';
	parent.value = cfg.parent || 'world';

	if (cfg.position) {
		posX.value = cfg.position[0] ?? 0;
		posY.value = cfg.position[1] ?? 0;
		posZ.value = cfg.position[2] ?? 0;
	}
	if (cfg.quaternion) {
		const rpy = quatToRpy({
			x: cfg.quaternion[0], y: cfg.quaternion[1], z: cfg.quaternion[2], w: cfg.quaternion[3],
		});
		rotRoll.value = radToDeg(rpy.roll);
		rotPitch.value = radToDeg(rpy.pitch);
		rotYaw.value = radToDeg(rpy.yaw);
	}

	cameraId.value = String(cfg.cameraId ?? '');
	farWidth.value = String(cfg.farWidth ?? '');
	farHeight.value = String(cfg.farHeight ?? '');
	farDistance.value = String(cfg.farDistance ?? '');
	nearDistance.value = String(cfg.nearDistance ?? '');
	depthScale.value = String(cfg.depthScale ?? '');
}

async function loadCameraConfig() {
	try {
		const data = await apiGet<any>(`/api/cameras/${encodeURIComponent(props.editCameraName!)}/config`);
		applyConfig(data);
	} catch (err: any) {
		console.error('Failed to load camera config:', err);
		showToast('Failed to load camera configuration: ' + (err.message || String(err)), 'error');
	}
}

function buildCameraBody(name: string) {
	const quat = rpyToQuaternion(rotRoll.value, rotPitch.value, rotYaw.value);
	return {
		name,
		parent: parent.value.trim() || 'world',
		position: [posX.value, posY.value, posZ.value] as [number, number, number],
		quaternion: [quat.x, quat.y, quat.z, quat.w] as [number, number, number, number],
		cameraId: Number(cameraId.value),
		farWidth: Number(farWidth.value),
		farHeight: Number(farHeight.value),
		farDistance: Number(farDistance.value),
		nearDistance: Number(nearDistance.value),
		depthScale: Number(depthScale.value),
	};
}

/** Resolve the owning system name for a flange-parented camera, for viewer placement. */
function buildCameraCreatedPayload(name: string): CameraCreatedPayload {
	const body = buildCameraBody(name);
	const systemName = body.parent === 'world'
		? null
		: systemFlanges.value.find((f) => f.flangeName === body.parent)?.systemName ?? null;
	return {
		name: body.name,
		parent: body.parent,
		systemName,
		position: body.position,
		quaternion: body.quaternion,
		farWidth: body.farWidth,
		farHeight: body.farHeight,
		farDistance: body.farDistance,
		nearDistance: body.nearDistance,
	};
}

// --- Camera Operations ---

const cameraOps = {
	async createCamera() {
		// Highlight any empty required fields and stop, instead of silently
		// no-op'ing. Required set comes from REQUIRED_FIELDS (see above).
		if (!validateRequired()) return;

		const trimmedName = cameraName.value.trim();
		if (!isEditMode.value || trimmedName !== props.editCameraName) {
			const existingNames = await apiGet<{ cameras: string[] }>('/api/cameras')
				.then((r) => r.cameras || [])
				.catch(() => []);
			if (existingNames.includes(trimmedName)) {
				showToast(t('setup.camera.error.duplicateName', { name: trimmedName }), 'error');
				return;
			}
		}

		creating.value = true;
		try {
			// Save the camera first so it exists under this name, then — only if
			// requested — try to refine far width/height from the live device.
			await apiPost('/api/cameras', buildCameraBody(trimmedName));

			if (syncFromDevice.value) {
				await syncFarPlaneFromDevice(trimmedName);
			}

			// Built after the possible device sync so a refined far width/height
			// is reflected in the viewer's frustum.
			const payload = buildCameraCreatedPayload(trimmedName);
			if (isEditMode.value) {
				emit('camera-modified', payload);
			} else {
				emit('camera-created', payload);
			}
			emit('close');
		} catch (err: any) {
			console.error('Create camera error:', err);
			showToast(err.message || String(err), 'error');
		} finally {
			creating.value = false;
		}
	},
	async deleteCamera() {
		if (!isEditMode.value) return;
		const ok = await confirm(`Delete camera "${props.editCameraName}"?`);
		if (!ok) return;
		deleting.value = true;
		try {
			await apiDelete(`/api/cameras/${encodeURIComponent(props.editCameraName!)}`);
			emit('camera-deleted', props.editCameraName!);
			emit('close');
		} catch (err: any) {
			console.error('Delete camera error:', err);
			showToast(err.message || String(err), 'error');
		} finally {
			deleting.value = false;
		}
	},
};
</script>
