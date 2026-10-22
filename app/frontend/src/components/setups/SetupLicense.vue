<template>
	<div class="setup-scene-object setup-scene-object--fixed-tabs">
		<div class="setup-scene-object__sticky">
			<div class="setup-scene-object__header">
				<h3 class="setup-scene-object__title">{{ $t('setup.license.title') }}</h3>
				<button class="setup-scene-object__close" @click="$emit('close')">&times;</button>
			</div>

			<div class="setup-tabs">
				<button
					class="setup-tabs__tab"
					:class="{ active: activeTab === 'status' }"
					@click="activeTab = 'status'"
				>{{ $t('setup.license.tabs.status') }}</button>
				<button
					class="setup-tabs__tab"
					:class="{ active: activeTab === 'install' }"
					@click="activeTab = 'install'"
				>{{ $t('setup.license.tabs.install') }}</button>
			</div>
		</div>

		<div class="setup-scene-object__scrollable">
			<!-- Tab: Status -->
			<div v-if="activeTab === 'status'" class="setup-tab-content">
				<p v-if="statusLoading" class="setup-tab-content__placeholder">{{ $t('setup.license.feedback.loading') }}</p>
				<template v-else>
					<div class="setup-field-row">
						<div class="setup-field" style="flex: 1;">
							<label class="setup-field__label">{{ $t('setup.license.label.deviceIdentifier') }}</label>
							<input class="setup-field__input" type="text" :value="deviceIdentifier" readonly />
						</div>
						<button class="btn btn--outline" style="white-space: nowrap; align-self: flex-end;" @click="exportIdentifier">
							{{ $t('setup.license.button.export') }}
						</button>
					</div>
					<p class="setup-tab-content__placeholder">
						{{ $t('setup.license.label.hardwareVerifiable') }}: {{ hardwareVerifiable ? $t('setup.license.value.yes') : $t('setup.license.value.no') }}
						&nbsp;·&nbsp;
						{{ $t('setup.license.label.tpmAvailable') }}: {{ tpmAvailable ? $t('setup.license.value.yes') : $t('setup.license.value.no') }}
						<template v-if="tpmDetail">({{ tpmDetail }})</template>
					</p>

					<hr class="setup-divider" />

					<template v-if="warnings.length > 0">
						<label class="setup-field__label">{{ $t('setup.license.label.warnings') }}</label>
						<ul>
							<li v-for="(warning, i) in warnings" :key="i" class="setup-tab-content__placeholder">{{ warning }}</li>
						</ul>

						<hr class="setup-divider" />
					</template>

					<p v-if="licenses.length === 0" class="setup-tab-content__placeholder">{{ $t('setup.license.feedback.noLicenses') }}</p>
					<section v-for="lic in licenses" :key="lic.licenseId" class="info-section license-details">
						<div class="info-row">
							<span class="info-label">{{ $t('setup.license.tableHeader.licenseId') }}</span>
							<span class="info-value">{{ lic.licenseId }}</span>
						</div>
						<div class="info-row">
							<span class="info-label">{{ $t('setup.license.tableHeader.customer') }}</span>
							<span class="info-value">{{ lic.customer }}</span>
						</div>
						<div class="info-row">
							<span class="info-label">{{ $t('setup.license.tableHeader.issued') }}</span>
							<span class="info-value">{{ formatDate(lic.issued) }}</span>
						</div>
						<div class="info-row">
							<span class="info-label">{{ $t('setup.license.tableHeader.expires') }}</span>
							<span class="info-value">{{ formatDate(lic.expires) }}</span>
						</div>
						<div class="info-row">
							<span class="info-label">{{ $t('setup.license.tableHeader.services') }}</span>
							<div class="info-value">
								<div v-for="svc in lic.services" :key="svc">{{ formatServiceName(svc) }}</div>
							</div>
						</div>
						<div class="info-row">
							<span class="info-label">{{ $t('setup.license.tableHeader.hardwareVerified') }}</span>
							<span class="info-value">{{ lic.hardwareVerified ? $t('setup.license.value.yes') : $t('setup.license.value.no') }}</span>
						</div>
						<div class="info-row">
							<span class="info-label">{{ $t('setup.license.tableHeader.notes') }}</span>
							<span class="info-value">{{ lic.notes }}</span>
						</div>
					</section>

					<button class="btn btn--outline" style="margin-top: 0.5rem;" :disabled="statusLoading" @click="loadStatus">
						{{ $t('setup.license.button.refresh') }}
					</button>
				</template>
			</div>

			<!-- Tab: Install -->
			<div v-else class="setup-tab-content">
				<div class="setup-field">
					<label class="setup-field__label">{{ $t('setup.license.label.licenseFile') }}</label>
					<input ref="licenseFileInput" type="file" accept=".lic,.txt,text/plain" hidden @change="onFileSelected" />
					<div class="setup-field-row">
						<input
							class="setup-field__input"
							:class="{ 'setup-field__input--error': missingFields.has('licenseFileContent') }"
							type="text"
							readonly
							:placeholder="$t('setup.license.placeholder.noFileSelected')"
							:value="selectedFileName"
						/>
						<button class="btn btn--outline" style="white-space: nowrap;" @click="openFileDialog">
							{{ $t('setup.license.button.chooseFile') }}
						</button>
					</div>
				</div>

				<div class="setup-field-row">
					<button class="btn" :disabled="installing" @click="submitInstall">
						{{ installing ? $t('setup.license.feedback.saving') : $t('setup.license.button.install') }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, type Ref } from 'vue';
import { apiGet, apiPost } from '../../services/api';
import { useToast } from '../../composables/useToast';
import { useI18n } from '../../composables/useI18n';

defineEmits<{
	close: [];
}>();

const { showToast } = useToast();
const { t } = useI18n();

const activeTab = ref<'status' | 'install'>('status');

// ── Status tab ───────────────────────────────────────────────────────

interface InstalledLicense {
	licenseId: string;
	customer: string;
	issued: string | null;
	expires: string | null;
	services: string[];
	hardwareVerified: boolean;
	notes: string;
}

const statusLoading = ref(false);
const deviceIdentifier = ref('');
const hardwareVerifiable = ref(false);
const tpmAvailable = ref(false);
const tpmDetail = ref('');
const warnings = ref<string[]>([]);
const licenses = ref<InstalledLicense[]>([]);

function formatDate(iso: string | null): string {
	if (!iso) return t('setup.license.value.never');
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleString();
}

function formatServiceName(service: string): string {
	const name = service.replace('LICENSED_SERVICE_', '').toLowerCase();
	return name.charAt(0).toUpperCase() + name.slice(1);
}

// Matches the CLI's `pdk-scene license identifier -o <file>`: writes the
// raw identifier text to a file the user picks, to attach to an email to Flexiv.
const DEVICE_IDENTIFIER_FILE_NAME = 'license_identifier.txt';

async function exportIdentifier() {
	try {
		const showSaveFilePicker = (window as any).showSaveFilePicker;
		if (showSaveFilePicker) {
			const handle = await showSaveFilePicker({
				suggestedName: DEVICE_IDENTIFIER_FILE_NAME,
				types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }],
			});
			const writable = await handle.createWritable();
			await writable.write(deviceIdentifier.value);
			await writable.close();
		} else {
			// Browsers without the File System Access API get a plain download
			// instead of a save dialog.
			const blob = new Blob([deviceIdentifier.value], { type: 'text/plain' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = DEVICE_IDENTIFIER_FILE_NAME;
			link.click();
			URL.revokeObjectURL(url);
		}
		showToast(t('setup.license.feedback.exported'), 'success');
	} catch (err: any) {
		if (err?.name === 'AbortError') return;
		showToast(err.message || String(err), 'error');
	}
}

async function loadStatus() {
	statusLoading.value = true;
	try {
		const [listData, identifierData] = await Promise.all([
			apiGet<{
				licenses: InstalledLicense[];
				tpmAvailable: boolean;
				tpmDetail: string;
				warnings: string[];
			}>('/api/license'),
			apiGet<{ identifier: string; hardwareVerifiable: boolean }>('/api/license/device-identifier'),
		]);
		licenses.value = listData.licenses ?? [];
		tpmAvailable.value = listData.tpmAvailable;
		tpmDetail.value = listData.tpmDetail;
		warnings.value = listData.warnings ?? [];
		deviceIdentifier.value = identifierData.identifier;
		hardwareVerifiable.value = identifierData.hardwareVerifiable;
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		statusLoading.value = false;
	}
}

onMounted(loadStatus);

// ── Install tab ──────────────────────────────────────────────────────

// Base64 of the chosen file's raw bytes - never decoded to text, so a binary
// `.lic` bundle survives intact. The backend derives the final
// SaveRequest.license value from these bytes the same way the CLI does.
const licenseFileContent = ref('');
const selectedFileName = ref('');
const installing = ref(false);
const licenseFileInput = ref<HTMLInputElement | null>(null);

function openFileDialog() {
	licenseFileInput.value?.click();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

function onFileSelected(event: Event) {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) return;
	input.value = '';

	selectedFileName.value = file.name;

	const reader = new FileReader();
	reader.onload = () => {
		licenseFileContent.value = arrayBufferToBase64(reader.result as ArrayBuffer);
		clearFieldError('licenseFileContent');
	};
	reader.readAsArrayBuffer(file);
}

// Single required field (SaveRequest.license [required] in license_service.proto).
interface RequiredField {
	key: string;
	model: Ref<string>;
	labelKey: string;
}

const REQUIRED_FIELDS: RequiredField[] = [
	{ key: 'licenseFileContent', model: licenseFileContent, labelKey: 'setup.license.label.licenseFile' },
];

const missingFields = ref<Set<string>>(new Set());

function validateRequired(): boolean {
	const missing = REQUIRED_FIELDS.filter((f) => f.model.value.trim() === '');
	missingFields.value = new Set(missing.map((f) => f.key));
	if (missing.length === 0) return true;
	showToast(t('setup.license.error.missingRequired'), 'error');
	return false;
}

function clearFieldError(key: string) {
	if (missingFields.value.has(key)) {
		const next = new Set(missingFields.value);
		next.delete(key);
		missingFields.value = next;
	}
}

async function submitInstall() {
	if (!validateRequired()) return;

	installing.value = true;
	try {
		const result = await apiPost<{ newlyLicensed: string[] }>('/api/license', {
			license: licenseFileContent.value,
			fileName: selectedFileName.value,
		});
		const newlyLicensed = result.newlyLicensed ?? [];
		showToast(
			newlyLicensed.length > 0
				? t('setup.license.feedback.installSuccess', { services: newlyLicensed.join(', ') })
				: t('setup.license.feedback.installSuccessNone'),
			'success',
		);
		licenseFileContent.value = '';
		selectedFileName.value = '';
		activeTab.value = 'status';
		await loadStatus();
	} catch (err: any) {
		showToast(err.message || String(err), 'error');
	} finally {
		installing.value = false;
	}
}
</script>

<style scoped>
/* .info-row/.info-label/.info-value have no font-size of their own — every
   other place they're used sits inside .selection-info-panel, which sets
   0.85rem. This section instead sits directly in .setup-tab-content, so
   without this it falls back to the 16px default and looks oversized next
   to the rest of the interface. */
.license-details {
	font-size: 0.85rem;
}

/* .info-row's default flex/space-between squashes a wrapped multi-line
   value (e.g. the Services list) against its label. A fixed-width label
   column keeps every row's value aligned and left-wrapping instead. */
.license-details .info-row {
	display: grid;
	grid-template-columns: 8rem 1fr;
	column-gap: 0.75rem;
	align-items: start;
}

.license-details .info-value {
	text-align: left;
	word-break: break-word;
}
</style>
