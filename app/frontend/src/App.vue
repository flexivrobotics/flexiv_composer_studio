<template>
	<div class="app-shell">
		<header class="app-header surface-dark">
			<h1 class="app-title">{{ $t('app.title') }}</h1>
			<div class="workcell-root-control">
				<label class="workcell-root-label">{{ $t('app.workcellRoot') }}</label>
				<input
					class="workcell-root-input"
					:class="{ 'workcell-root-input--invalid': !rootPathValid }"
					v-model="workcellRootPath"
					:title="workcellRootPath"
					@keyup.enter="applyWorkcellRoot"
				/>
				<button class="btn btn--icon" @click="showDirBrowser = true" title="Browse">&#128193;</button>
			</div>
			<nav class="header-nav">
				<select class="locale-select" v-model="i18n.locale">
					<option value="en">English</option>
					<option value="zh">中文</option>
				</select>
				<button
					class="btn btn--icon"
					@click="toggleFullscreen"
					:title="isFullscreen ? $t('app.exitFullscreen') : $t('app.enterFullscreen')"
					:aria-label="isFullscreen ? $t('app.exitFullscreen') : $t('app.enterFullscreen')"
				>
					<svg v-if="!isFullscreen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M8 3H5a2 2 0 0 0-2 2v3" />
						<path d="M21 8V5a2 2 0 0 0-2-2h-3" />
						<path d="M3 16v3a2 2 0 0 0 2 2h3" />
						<path d="M16 21h3a2 2 0 0 0 2-2v-3" />
					</svg>
					<svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M8 3v3a2 2 0 0 1-2 2H3" />
						<path d="M21 8h-3a2 2 0 0 1-2-2V3" />
						<path d="M3 16h3a2 2 0 0 1 2 2v3" />
						<path d="M16 21v-3a2 2 0 0 1 2-2h3" />
					</svg>
				</button>
				<button
					class="btn btn--toggle"
					:class="c.ui.sceneEventsActive ? 'btn--toggle-on' : 'btn--toggle-off'"
					@click="c.handleToggleSceneEvents"
					:title="c.ui.sceneEventsActive ? $t('app.nav.liveSceneEventsOn') : $t('app.nav.liveSceneEventsOff')"
				>
					{{ c.ui.sceneEventsActive ? $t('app.nav.liveSceneEventsOn') : $t('app.nav.liveSceneEventsOff') }}
				</button>
				<button class="btn" @click="handleWorkcellSetup">{{ $t('app.nav.workcellSetup') }}</button>
			</nav>
		</header>
		<DirectoryBrowserDialog
			v-if="showDirBrowser"
			:initialPath="workcellRootPath"
			@select="onDirSelected"
			@cancel="showDirBrowser = false"
		/>
		<WorkcellDialog
			:visible="c.ui.showWorkcellDialog"
			:addGroup="c.handleAddGroup"
			:onSystemAdded="c.handleSystemAdded"
			:onSceneObjectAdded="c.handleSceneObjectAdded"
			:onAreaAdded="c.handleAreaAdded"
			:getGroupWorldPose="c.handleGetGroupWorldPose"
			:setGroupPose="c.handleSetGroupPose"
			:onClear="c.handleClearScene"
			:addPath="c.handleAddPathViewer"
			:onPathAdded="c.handlePathAddedToTree"
			:onTargetAdded="c.handleTargetAdded"
			:onPtpTrajectoryAdded="c.handlePtpTrajectoryAdded"
			:onLinearTrajectoryAdded="c.handleLinearTrajectoryAdded"
			:onCameraAdded="c.handleCameraAdded"
			@close="c.ui.showWorkcellDialog = false"
			@load="c.onLoadWorkcell"
		/>
		<main class="workspace" ref="workspaceEl">
			<Editor
				:controller="c"
				:style="{ flex: `0 0 ${leftPercent}%` }"
			/>
			<ResizeHandle
				:active="dragging"
				@start="startDrag"
			/>
			<section class="panel panel--right">
				<ThreeViewport
					ref="viewport"
					:selectedObjectName="c.freeDrawObjectName ?? c.freeSketchObjectName ?? c.selection.item?.data?.name ?? null"
					:pathOnMeshActive="c.pathOnMeshActive || c.areaDrawActive"
					@point-added="(pt) => c.areaDrawActive ? c.handleAreaPointAdded(pt) : c.handlePointAdded(pt)"
				/>
			</section>
		</main>
		<ConfirmDialog />
		<PromptDialog />
		<ToastContainer />
		<TcpModeMenu
			v-if="c.tcpMenu?.visible"
			:x="c.tcpMenu.x"
			:y="c.tcpMenu.y"
			:currentMode="c.tcpMenu.currentMode"
			@select="c.setTcpMode"
			@dismiss="c.tcpMenu.visible = false"
		/>
	</div>
</template>

<script setup lang="ts">
import { reactive, ref, provide, onMounted, onBeforeUnmount } from 'vue';
import ThreeViewport from './components/ThreeViewport.vue';
import Editor from './components/Editor.vue';
import ResizeHandle from './components/ResizeHandle.vue';
import { useResizableColumns } from './composables/useResizableColumns';
import WorkcellDialog from './components/dialogs/WorkcellDialog.vue';
import ConfirmDialog from './components/dialogs/ConfirmDialog.vue';
import PromptDialog from './components/dialogs/PromptDialog.vue';
import DirectoryBrowserDialog from './components/dialogs/DirectoryBrowserDialog.vue';
import ToastContainer from './components/dialogs/ToastContainer.vue';
import TcpModeMenu from './components/controls/TcpModeMenu.vue';
import { useSceneController } from './composables/controller/useSceneController';
import { useI18n } from './composables/useI18n';
import { useToast } from './composables/useToast';
import { apiGet, apiPost } from './services/api';
import type { ISceneTreeOps } from './types';

// --- I18n ---
const i18n = useI18n();
const { showToast } = useToast();

// --- Refs ---
const viewport = ref<InstanceType<typeof ThreeViewport> | null>(null);

// --- Resizable left panel (Editor) vs. right panel (3D viewport) ---
const workspaceEl = ref<HTMLElement | null>(null);
const { leftPercent, dragging, startDrag } = useResizableColumns(workspaceEl, 42, 20, 80);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sceneTree = ref<Record<string, any> | null>(null);

// --- Provide sceneTree ref so Editor (and its descendants) can populate it ---
provide('sceneTreeRef', sceneTree);

// --- Adapter: expose the narrow ISceneTreeOps interface to useSceneController
//     so it doesn't depend on the SceneTree component type directly. ---
const treeOps: ISceneTreeOps = {
	addItem:             (name, type)    => sceneTree.value?.addItem(name, type),
	addPath:             (parent, name)  => sceneTree.value?.addPath(parent, name),
	addArea:             (parent, name)  => sceneTree.value?.addArea(parent, name),
	addTarget:           (parent, name)  => sceneTree.value?.addTarget(parent, name),
	addPtpTrajectory:    (parent, name)  => sceneTree.value?.addPtpTrajectory(parent, name),
	addLinearTrajectory: (parent, name)  => sceneTree.value?.addLinearTrajectory(parent, name),
	clearAll:            ()              => sceneTree.value?.clearAll(),
	removeItemByName:    (name)          => sceneTree.value?.removeItemByName(name),
	removeItemByNameSilent: (name)       => sceneTree.value?.removeItemByNameSilent(name),
	hasItem:             (name)          => sceneTree.value?.hasItem(name) ?? false,
};

// --- Controller (owns all state, selection/workcell singletons, and handlers) ---
const c = reactive(useSceneController(viewport, treeOps));

// --- Workcell root ---
const workcellRootPath = ref('');
const rootApplying = ref(false);
const rootPathValid = ref(false);
const showDirBrowser = ref(false);

onMounted(async () => {
	try {
		const result = await apiGet<{ path: string; valid: boolean }>('/api/workcell-root');
		workcellRootPath.value = result.path;
		rootPathValid.value = result.valid;
		if (!result.valid) {
			showToast(i18n.t('dialog.invalidRoot.message', { path: result.path }), 'error');
		}
	} catch {
		// backend may not be reachable yet; leave blank
	}
});

async function applyWorkcellRoot() {
	if (!workcellRootPath.value.trim() || rootApplying.value) return;
	rootApplying.value = true;
	try {
		const result = await apiPost<{ path: string }>('/api/workcell-root', { path: workcellRootPath.value.trim() });
		workcellRootPath.value = result.path;
		rootPathValid.value = true;
	} catch (err: any) {
		rootPathValid.value = false;
		showToast(err.message ?? 'Failed to set workcell root', 'error');
	} finally {
		rootApplying.value = false;
	}
}

function onDirSelected(path: string) {
	showDirBrowser.value = false;
	workcellRootPath.value = path;
	applyWorkcellRoot();
}

function handleWorkcellSetup() {
	if (!rootPathValid.value) {
		showToast(i18n.t('dialog.invalidRoot.message', { path: workcellRootPath.value }), 'error');
		return;
	}
	c.ui.showWorkcellDialog = true;
}

// --- Fullscreen toggle ---
const isFullscreen = ref(!!document.fullscreenElement);

function syncFullscreenState() {
	isFullscreen.value = !!document.fullscreenElement;
}

function toggleFullscreen() {
	if (document.fullscreenElement) {
		document.exitFullscreen().catch(() => {});
	} else {
		document.documentElement.requestFullscreen().catch(() => {});
	}
}

onMounted(() => {
	document.addEventListener('fullscreenchange', syncFullscreenState);
});
onBeforeUnmount(() => {
	document.removeEventListener('fullscreenchange', syncFullscreenState);
});
</script>

<style scoped>
.workcell-root-control {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	flex: 1;
	min-width: 0;
	max-width: 42rem;
	margin: 0 1rem;
}

.workcell-root-label {
	font-size: 0.78rem;
	color: var(--dark-ink-muted);
	white-space: nowrap;
	flex-shrink: 0;
}

.workcell-root-input {
	flex: 1;
	min-width: 0;
	padding: 0.3rem 0.55rem;
	border: 1px solid var(--dark-border);
	border-radius: 5px;
	background: rgba(255, 255, 255, 0.08);
	color: var(--dark-ink);
	font-size: 0.82rem;
	font-family: monospace;
	outline: none;
	transition: border-color 120ms ease;
}

.workcell-root-input:focus {
	border-color: var(--dark-accent);
	background: rgba(255, 255, 255, 0.12);
}

.btn--icon {
	flex-shrink: 0;
	padding: 0.3rem 0.5rem;
	font-size: 0.95rem;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid var(--dark-border);
	color: var(--dark-ink);
}

.btn--icon:hover {
	background: rgba(255, 255, 255, 0.18);
}

/* Highlight the release-folder input when the path is invalid. */
.workcell-root-input--invalid {
	border-color: #e06666;
}

.btn--toggle-on {
	background: #2e9e4f;
	border-color: #2e9e4f;
	color: #fff;
}

.btn--toggle-on:hover {
	background: #35b358;
}

.btn--toggle-off {
	background: #c0392b;
	border-color: #c0392b;
	color: #fff;
}

.btn--toggle-off:hover {
	background: #d24232;
}

</style>

