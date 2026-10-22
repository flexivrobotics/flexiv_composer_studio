<template>
	<div class="info-content">
		<h3 class="info-title">{{ systemName || '—' }}</h3>

		<div class="info-tabs">
			<button
				v-for="tab in tabs"
				:key="tab.key"
				class="info-tab"
				:class="{ active: activeTab === tab.key }"
				:disabled="disabled || (tab.key === 'position' && !isConnected)"
				:title="tab.key === 'position' && !isConnected ? $t('info.system.jog.connectHint') : ''"
				@click="onTabClick(tab.key)"
			>{{ $t(tab.label) }}</button>
		</div>

		<!-- Tab: Information -->
		<SystemInfoPanel v-if="activeTab === 'info'" />

		<!-- Tab: Setup (edit the selected system's configuration) -->
		<SetupSystem
			v-else-if="activeTab === 'setup'"
			:editSystemName="systemName"
			:initialConfigTab="setupSystemInitialTab"
			:showCloseButton="false"
			@close="activeTab = 'info'"
			@system-modified="onSystemModified"
			@system-deleted="onSystemDeleted"
		/>

		<!-- Tab: Position / Jog -->
		<SystemJogPanel
			v-else-if="activeTab === 'position'"
			:systemName="systemName"
			:getCurrentJointAngles="getCurrentJointAngles"
			:getJointNames="getJointNames"
			:getLinkWorldPose="getLinkWorldPose"
			:getTcpLinkNames="getTcpLinkNames"
			:onJointAnglesChange="onJointAnglesChange"
		/>

		<!-- Tab: Operations -->
		<div v-else class="tab-content">
			<div style="display: flex; flex-direction: column; gap: 0.5rem;">
				<button
					v-if="!isConnected"
					class="btn-ik-solve"
					:disabled="disabled || connecting"
					@click="onConnectSystem"
				>{{ connecting ? $t('info.system.button.connecting') : $t('info.system.button.connect') }}</button>
				<button
					v-else
					class="btn-ik-solve"
					:disabled="disabled || connecting"
					@click="onDisconnectSystem"
				>{{ connecting ? $t('info.system.button.disconnecting') : $t('info.system.button.disconnect') }}</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
// ── SystemDetailPanel ──────────────────────────────────────────────
// Single tabbed workspace for everything associated with a selected
// system, so the scene navigator has one entry point (select the system)
// rather than scattered affordances. Tabs:
//   Info       → SystemInfoPanel (read-only specs / limits)
//   Setup      → SetupSystem (edit config; also hosts delete)
//   Position   → SystemJogPanel (preview / jog; requires a connection)
//   Operations → connect (+ future run/stop/home)

import { reactive, computed, ref, watch } from 'vue';
import SystemInfoPanel from './SystemInfoPanel.vue';
import SystemJogPanel from './SystemJogPanel.vue';
import SetupSystem from '../setups/SetupSystem.vue';
import { useSelection } from '../../composables/useSelection';
import { useWorkcell, notifyConnectionChanged } from '../../composables/useWorkcell';
import { useToast } from '../../composables/useToast';
import { useI18n } from '../../composables/useI18n';
import { apiPost } from '../../services/api';

// ── Props & Emits ──────────────────────────────────────────────────

const props = defineProps<{
	disabled?: boolean;
	getCurrentJointAngles?: ((systemName: string) => Record<string, number> | null) | null;
	getJointNames?: ((systemName: string) => string[] | null) | null;
	getLinkWorldPose?: ((systemName: string, linkName: string) => { position: [number, number, number]; quaternion: [number, number, number, number] } | null) | null;
	getTcpLinkNames?: ((systemName: string) => string[] | null) | null;
	onJointAnglesChange?: ((payload: { systemName: string; jointAngles: Record<string, number> }) => void) | null;
	/** Tab to land on when this panel (re-)mounts. Defaults to 'info'. */
	initialTab?: 'info' | 'setup' | 'position' | 'operations';
	/** SetupSystem sub-tab to land on when the 'setup' tab (re-)mounts. */
	initialSetupTab?: 'manipulator' | 'external-axis' | 'tool' | 'mounting';
}>();

const emit = defineEmits<{
	'system-modified': [name: string];
	'system-deleted': [name: string];
}>();

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();
const workcell = useWorkcell();
const { showToast } = useToast();
const i18n = useI18n();

// ── State ──────────────────────────────────────────────────────────

const tabs = [
	{ key: 'info' as const, label: 'info.tab.information' },
	{ key: 'setup' as const, label: 'info.tab.setup' },
	{ key: 'position' as const, label: 'info.tab.position' },
	{ key: 'operations' as const, label: 'info.tab.operations' },
];

type TabKey = (typeof tabs)[number]['key'];

const activeTab = ref<TabKey>(props.initialTab ?? 'info');
const connecting = ref(false);
// Which SetupSystem tab to land on when (re-)mounting it for the 'setup' tab.
// Defaults to 'manipulator', or whatever the parent requested for this
// mount (e.g. 'tool' when returning from the custom-components wizard).
const setupSystemInitialTab = ref<'manipulator' | 'external-axis' | 'tool' | 'mounting'>(
	props.initialSetupTab ?? 'manipulator',
);

const systemName = computed<string>(() => selection.item?.data?.name ?? '');

const isConnected = computed(() =>
	systemName.value ? workcell.connectedSystems.includes(systemName.value) : false,
);

// Reset to the Information tab whenever a different system is selected.
watch(systemName, () => {
	activeTab.value = 'info';
	setupSystemInitialTab.value = 'manipulator';
});

// ── Tab handling ───────────────────────────────────────────────────

function onTabClick(tab: TabKey) {
	if (props.disabled) return;
	if (tab === 'position' && !isConnected.value) return;
	activeTab.value = tab;
	setupSystemInitialTab.value = 'manipulator';
}

// ── Setup lifecycle (forwarded to the scene-navigator setup machine) ─

function onSystemModified(name: string) {
	emit('system-modified', name);
	activeTab.value = 'info';
}

function onSystemDeleted(name: string) {
	emit('system-deleted', name);
}

// ── Operations ─────────────────────────────────────────────────────

async function onConnectSystem() {
	const name = systemName.value;
	if (!name) return;
	connecting.value = true;
	try {
		const result: any = await apiPost(`/api/systems/${encodeURIComponent(name)}/connect`, {});
		if (result?.connected) {
			if (!workcell.connectedSystems.includes(name)) {
				workcell.connectedSystems = [...workcell.connectedSystems, name];
			}
			notifyConnectionChanged();
		} else {
			showToast(i18n.t('info.system.error.connectFailed', { message: result?.message ?? 'unknown error' }), 'error');
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		showToast(i18n.t('info.system.error.connectFailed', { message }), 'error');
	} finally {
		connecting.value = false;
	}
}

async function onDisconnectSystem() {
	const name = systemName.value;
	if (!name) return;
	connecting.value = true;
	try {
		await apiPost(`/api/systems/${encodeURIComponent(name)}/disconnect`, {});
		workcell.connectedSystems = workcell.connectedSystems.filter((s) => s !== name);
		notifyConnectionChanged();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		showToast(i18n.t('info.system.error.disconnectFailed', { message }), 'error');
	} finally {
		connecting.value = false;
	}
}
</script>
