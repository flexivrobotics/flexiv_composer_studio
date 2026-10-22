<template>
	<div class="panel-left__split">
		<!-- Navigator tree — shown until an item is selected or a setup wizard is
		     opened, at which point the detail panel replaces it in this column. -->
		<div v-show="!showDetail" class="panel-left__split__tree">
			<div class="scene-tree">
				<div v-for="cat in categories" :key="cat.label" class="tree-category">
					<div class="tree-category__header" @click="cat.toggle">
						<span class="tree-category__arrow" :class="{ expanded: cat.isOpen }">&#9654;</span>
						<span class="tree-category__label">{{ cat.label }}</span>
						<span class="tree-category__count">{{ cat.items.length }}</span>
						<button
							class="tree-category__add"
							:disabled="treeDisabled || !workcell.active"
							@click.stop="setupState.setupView = (cat.type as 'system' | 'scene-object'  | 'camera')"
							:title="'Add ' + cat.label"
						>+</button>
					</div>
					<div v-if="cat.isOpen" class="tree-category__children">
						<template v-for="item in cat.items" :key="item.name">
							<div
								class="tree-item"
								:class="{ 'tree-item--selected': selectedItemName === item.name }"
								@click="selectItem(item)"
								@dblclick="focusItem(item)"
							>
								<div class="tree-item__info">
									<span
										class="tree-item__status"
										:class="{
											'status--connected': workcell.connectedSystems.includes(item.name),
											'status--disconnected': !workcell.connectedSystems.includes(item.name),
										}"
										v-if="item.type === 'system'"
									></span>
									<span class="tree-item__name">{{ item.name }}</span>
								</div>
								<button
									v-if="cat.type !== 'system' && cat.type !== 'camera'"
									class="tree-item__remove"
									:disabled="treeDisabled"
									@click.stop="treeOps.remove(item.name, cat.type)"
									:title="$t('tree.action.remove')"
								>×</button>
							</div>
							<TreeSubCategory
								v-for="sc in subCategoryMap.get(item.name) ?? []"
								:key="sc.category"
								:label="sc.label"
								:open="isSubCategoryOpen(item.name, sc.category)"
								:items="childrenByCategory(item, sc.category)"
								:selectedChildName="selectedChildName"
								:disabled="treeDisabled"
								:canAdd="sc.canAdd"
								:addDisabled="treeDisabled || !workcell.active"
								:addTitle="sc.addTitle"
								:emptyText="sc.emptyText"
								@toggle="toggleSubCategory(item.name, sc.category)"
								@add="sc.onAdd?.()"
								@select="selectChildItem"
								@remove="removeChildItem"
							/>
						</template>
						<div v-if="cat.items.length === 0" class="tree-empty">
							{{ cat.type === 'system' ? $t('tree.empty.systems') : cat.type === 'camera' ? $t('tree.empty.cameras') : $t('tree.empty.sceneObjects') }}
						</div>
					</div>
				</div>
			</div>
		</div>
		<!-- Detail panel — takes over this column in place of the navigator tree
		     when an item is selected or a setup wizard is open, so the left pane
		     is a single panel (tree OR detail), not a side-by-side split. The
		     back bar returns to the tree. -->
		<div v-show="showDetail" class="panel-left__split__info surface-light">
			<div class="panel-left__detail-bar">
				<button class="panel-left__back" @click="backToNavigator">
					&#8592; {{ $t('app.panel.backToNavigator') }}
				</button>
			</div>
			<div class="panel-left__detail-body">
			<div v-if="isSystemDetail" class="selection-info-panel">
				<SystemDetailPanel
					:disabled="controller.pathOnMeshActive"
					:getCurrentJointAngles="controller.handleGetCurrentJointAngles ?? null"
					:getJointNames="controller.handleGetJointNames ?? null"
					:getLinkWorldPose="controller.handleGetLinkWorldPose ?? null"
					:getTcpLinkNames="(name: string) => controller.getViewer()?.getTcpLinkNames(name) ?? null"
					:onJointAnglesChange="(p: any) => controller.handleJointAnglesChange(p)"
					:initialTab="systemDetailInitialTab"
					:initialSetupTab="systemDetailInitialSetupTab"
					@system-modified="(n: string) => setup.onSystemModified(n)"
					@system-deleted="(n: string) => { setup.onSystemDeleted(n); backToNavigator(); }"
				/>
			</div>
			<SetupCustomComponents
				v-else-if="activeSetupView === 'custom-components'"
				class="panel-left__setup"
				@close="setup.onSetupClose()"
			/>
			<SetupSystem
				v-else-if="activeSetupView === 'system'"
				class="panel-left__setup"
				:editSystemName="setupState.editSystemName"
				:initialConfig="setupState.editSystemConfig"
				:initialConfigTab="setupSystemInitialTab"
				@close="setup.onSetupClose()"
				@system-created="(n: string) => setup.onSystemCreated(n)"
				@system-modified="(n: string) => setup.onSystemModified(n)"
				@system-deleted="(n: string) => setup.onSystemDeleted(n)"
			/>
			<SetupSceneObject
				v-else-if="activeSetupView === 'scene-object'"
				class="panel-left__setup"
				:workcellName="workcell.name"
				@close="setup.onSetupClose()"
				@inserted-mesh="(n: string, u: string, parent: string, parentSystemName: string | null) => setup.onInsertedMesh(n, u, parent, parentSystemName)"
				@inserted-primitive="(n: string, s: [number, number, number], p: [number, number, number], q: [number, number, number, number], parent: string, parentSystemName: string | null) => setup.onInsertedPrimitive(n, s, p, q, parent, parentSystemName)"
				@show-bbox="(c: any, o: any, e: any, sys?: string, link?: string) => controller.handleShowBboxPreview(c, o, e, sys, link)"
				@hide-bbox="controller.handleHideBboxPreview()"
			/>
			<SetupCamera
				v-else-if="activeSetupView === 'camera'"
				class="panel-left__setup"
				:editCameraName="setupState.editCameraName"
				:initialConfig="setupState.editCameraConfig"
				@close="setup.onSetupClose()"
				@camera-created="(c: any) => setup.onCameraCreated(c)"
				@camera-modified="(c: any) => setup.onCameraModified(c)"
				@camera-deleted="(n: string) => setup.onCameraDeleted(n)"
			/>
			<SetupPath
				v-else-if="activeSetupView === 'path'"
				class="panel-left__setup"
				:workcellName="workcell.name"
				:parentName="setup.pathParentName ?? ''"
				:areas="pathParentAreas"
				@close="() => { controller.handleCleanupVisualizePaths?.(); setup.onSetupClose(); }"
				@path-created="(p: any) => setup.onPathCreated(p)"
				@clear-waypoints="controller.handleClearPoints()"
				@select-area="(p: any) => controller.handleSelectItem?.({ name: p.name, type: 'area', parentName: p.parentName })"
				@generate-from-area-path="async (p: any) => { const ok = await props.controller.handleGenerateFromAreaPath?.(p); p.onComplete?.(); if (ok) setup.onSetupClose(); }"
				@visualize-toolpath="(p: any) => emitBridge('visualize-toolpath', p)"
				/>
			<SetupArea
				v-else-if="activeSetupView === 'area'"
				class="panel-left__setup"
				:workcellName="workcell.name"
				:parentName="setup.pathParentName ?? ''"
				:existingAreaNames="pathParentAreas"
				@close="setup.onSetupClose()"
				@area-created="(p: any) => setup.onAreaCreated(p)"
				@free-draw-mode="(p: any) => controller.handleFreeDrawMode(p)"
				@clear-area-points="controller.handleClearAreaPoints()"
			/>
			<SetupTarget
				v-else-if="activeSetupView === 'target-trajectory'"
				class="panel-left__setup"
				:workcellName="workcell.name"
				:parentName="setup.pathParentName ?? ''"
				:getCurrentJointAngles="controller.handleGetCurrentJointAngles ?? null"
				:getJointNames="controller.handleGetJointNames ?? null"
				:getJointLimits="controller.handleGetJointLimits ?? null"
				:getLinkPose="controller.handleGetLinkPose ?? null"
				:getLinkWorldPose="controller.handleGetLinkWorldPose ?? null"
				:getTcpLinkNames="(name: string) => controller.getViewer()?.getTcpLinkNames(name) ?? null"
				@close="setup.onSetupClose()"
				@create-target="(p: any) => setup.onCreateTarget(p)"
				@update-joint-angles="(p: any) => controller.handleJointAnglesChange(p)"
				@toggle-tcp-drag="(p: any) => controller.handleTcpDragToggle(p)"
			/>
			<SetupPTPTrajectory
				v-else-if="activeSetupView === 'ptp-trajectory'"
				class="panel-left__setup"
				:workcellName="workcell.name"
				:parentName="setup.pathParentName ?? ''"
				:getJointNames="controller.handleGetJointNames ?? null"
				@close="setup.onSetupClose()"
				@create-trajectory="(p: any) => setup.onCreateTrajectory(p)"
				@update-joint-angles="(p: any) => controller.handleJointAnglesChange(p)"
			/>
			<SetupLinearTrajectory
				v-else-if="activeSetupView === 'linear-trajectory'"
				class="panel-left__setup"
				:workcellName="workcell.name"
				:parentName="setup.pathParentName ?? ''"
				:getCurrentJointAngles="controller.handleGetCurrentJointAngles ?? null"
				:getJointNames="controller.handleGetJointNames ?? null"
				:getJointLimits="controller.handleGetJointLimits ?? null"
				:getTcpLinkNames="(name: string) => controller.getViewer()?.getTcpLinkNames(name) ?? null"
				@close="setup.onSetupClose()"
				@create-trajectory="(p: any) => setup.onCreateTrajectory(p)"
				@update-joint-angles="(p: any) => controller.handleJointAnglesChange(p)"
				@visualize-path="(name: string) => emitBridge('visualize-path', name)"
			/>
			<SetupCollisionConfig
				v-else-if="activeSetupView === 'collision-config'"
				class="panel-left__setup"
				@close="setup.onSetupClose()"
			/>
			<SetupLicense
				v-else-if="activeSetupView === 'license'"
				class="panel-left__setup"
				@close="setup.onSetupClose()"
			/>
			<SelectionInfoPanel
				v-else
				:disabled="controller.pathOnMeshActive"
				:get-viewer="controller.getViewer"
				:workcell-name="workcell.name"
				@reload-mesh="(name: string, url: string) => controller.handleReloadMesh(name, url)"
				@object-added="(name: string, url: string) => controller.handleFilteredObjectAdded(name, url)"
				@show-bbox="(c: any, o: any, e: any) => controller.handleShowBboxPreview(c, o, e)"
				@hide-bbox="controller.handleHideBboxPreview()"
				@camera-modified="(c: any) => { setup.onCameraModified(c); backToNavigator(); }"
				@camera-deleted="(n: string) => { setup.onCameraDeleted(n); backToNavigator(); }"
			/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { inject, computed, reactive, ref, watch, onUnmounted, type Ref } from 'vue';
import TreeSubCategory from '../tree/TreeSubCategory.vue';
import SelectionInfoPanel from '../info_panels/SelectionInfoPanel.vue';
import SystemDetailPanel from '../info_panels/SystemDetailPanel.vue';
import SetupSystem from '../setups/SetupSystem.vue';
import SetupCustomComponents from '../setups/SetupCustomComponents.vue';
import SetupSceneObject from '../setups/SetupSceneObject.vue';
import SetupCamera from '../setups/SetupCamera.vue';
import SetupPath from '../setups/SetupPath.vue';
import SetupArea from '../setups/SetupArea.vue';
import SetupTarget from '../setups/SetupTarget.vue';
import SetupPTPTrajectory from '../setups/SetupPTPTrajectory.vue';
import SetupLinearTrajectory from '../setups/SetupLinearTrajectory.vue';
import SetupCollisionConfig from '../setups/SetupCollisionConfig.vue';
import SetupLicense from '../setups/SetupLicense.vue';
import { useWorkcell } from '../../composables/useWorkcell';
import { useSelection } from '../../composables/useSelection';
import { useConfirm } from '../../composables/useConfirm';
import { useSceneTree } from '../../composables/tree/useSceneTree';
import { useSceneTreeSetup, type SetupState } from '../../composables/tree/useSceneTreeSetup';
import { useI18n } from '../../composables/useI18n';
import type { ChildCategory, TreeItem } from '../../types';

const { t } = useI18n();

// ── Props ─────────────────────────────────────────────────────────

const props = defineProps<{
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	controller: Record<string, any>;
}>();

// ── Event bridge ──────────────────────────────────────────────────
// Routes internal tree/setup events directly to controller methods,
// eliminating the previous SceneTree.vue emit → SceneNavigatorEditor
// event-binding chain.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emitBridge(event: string, ...args: any[]) {
	const c = props.controller;
	switch (event) {
		case 'add-group':      c.handleAddGroup?.(...args); break;
		case 'remove-group':   c.handleRemoveGroup?.(...args); break;
		case 'remove-child':   c.handleRemoveChild?.(...args); break;
		case 'select-item':    c.handleSelectItem?.(...args); break;
		case 'focus-group':    c.handleFocusItem?.(...args); break;
		case 'setup-active':   c.handleSetupActive?.(...args); break;
		case 'setup-loading':  c.handleSetupLoading?.(...args); break;
		case 'reset-view':     c.handleResetView?.(); break;
		case 'free-sketch-mode': c.handleFreeSketchMode?.(...args); break;
		case 'generate-path':  c.handleGeneratePathFromDialog?.(...args); break;
		case 'generate-area':  c.handleGenerateAreaFromDialog?.(...args); break;
		case 'generate-from-area-path': c.handleGenerateFromAreaPath?.(...args); break;
		case 'visualize-toolpath': c.handleVisualizeToolpath?.(...args); break;
		case 'visualize-path':     c.handleVisualizePath?.(...args); break;
	}
}

// ── Composables ────────────────────────────────────────────────────

const workcell = useWorkcell();
const selection = useSelection();
const { confirm } = useConfirm();

const treeDisabled = computed(() =>
	!!(props.controller.pathOnMeshActive || props.controller.areaDrawActive || props.controller.ui?.sceneEventsActive),
);

const {
	state,
	selectedItemName,
	selectedChildName,
	isSubCategoryOpen,
	toggleSubCategory,
	childrenByCategory,
	categories,
	treeOps,
	addPath,
	addArea,
	addTarget,
	addPtpTrajectory,
	addLinearTrajectory,
	removeChildItem,
	selectChildItem,
	addItem,
	clearAll,
	removeItemByName,
	removeItemByNameSilent,
	hasItem,
	removeSystemChildren,
} = useSceneTree({
	emit: emitBridge,
	workcellName: () => workcell.name,
	confirm,
});

// ── Setup wizard state ─────────────────────────────────────────────

const setupState = reactive<SetupState>({
	setupView: null,
	editSystemName: null,
	editSystemConfig: null,
	editCameraName: null,
	editCameraConfig: null,
});

const setup = reactive(useSceneTreeSetup({
	state: setupState,
	treeOps,
	addTarget,
	addPtpTrajectory,
	addLinearTrajectory,
	addArea,
	generatePath: (payload) => props.controller.handleGeneratePathFromDialog?.(payload) ?? Promise.resolve(false),
	generateArea: (payload) => props.controller.handleGenerateAreaFromDialog?.(payload) ?? Promise.resolve(false),
	emit: emitBridge,
	workcellName: () => workcell.name,
	confirm,
	treeDisabled,
	clearSelection: () => {
		selectedItemName.value = null;
		selectedChildName.value = null;
		props.controller.handleClearSelection?.();
	},
	removeSystemChildren,
	removeItemSilently: removeItemByNameSilent,
}));

const activeSetupView = computed(() => setupState.setupView);

// Which SetupSystem tab to land on when (re-)opening the 'system' setup view.
// Defaults to 'manipulator' for a fresh create/edit.
const setupSystemInitialTab = ref<'manipulator' | 'external-axis' | 'tool' | 'mounting'>('manipulator');
watch(activeSetupView, (view) => {
	if (view === 'system') {
		setupSystemInitialTab.value = 'manipulator';
	}
});

// Which tab (and, for the Setup tab, which SetupSystem sub-tab) SystemDetailPanel
// should land on the next time it mounts — reset to the defaults by selectItem()
// so a fresh selection always starts clean.
const systemDetailInitialTab = ref<'info' | 'setup' | 'position' | 'operations'>('info');
const systemDetailInitialSetupTab = ref<'manipulator' | 'external-axis' | 'tool' | 'mounting'>('manipulator');

// Custom-components, collision-config, and license are workcell-wide setup
// panels with no natural home in the scene tree, opened only from the
// hamburger menu (see Editor.vue) — so none of them needs any
// return-routing; closing any of them always goes back to the navigator.
function openCustomComponentsFromMenu() {
	setupState.setupView = 'custom-components';
}

function openCollisionConfig() {
	setupState.setupView = 'collision-config';
}

function openLicenseManager() {
	setupState.setupView = 'license';
}

// A directly-selected system (no child selected, no setup wizard open) gets
// the tabbed SystemDetailPanel — the single workspace for Info / Setup /
// Position / Operations — instead of the plain SelectionInfoPanel.
const isSystemDetail = computed(() =>
	selection.item?.type === 'system' &&
	!selectedChildName.value &&
	activeSetupView.value === null,
);

// When true, the detail panel takes over the left pane in place of the
// navigator tree. This keeps the layout to two panels (tree OR detail, plus
// the 3D viewport) rather than showing tree and detail side by side.
const showDetail = computed(() =>
	activeSetupView.value !== null ||
	selectedItemName.value !== null ||
	selectedChildName.value !== null,
);

// Return to the navigator tree: close any open setup wizard and clear the
// current selection so showDetail becomes false.
function backToNavigator() {
	if (activeSetupView.value !== null) setup.onSetupClose();
	selectedItemName.value = null;
	selectedChildName.value = null;
	props.controller.handleClearSelection?.();
}

// Live scene events take over the left panel entirely, so whatever detail
// view or setup wizard is open gets kicked back to the plain tree the moment
// they're turned on.
watch(() => props.controller.ui?.sceneEventsActive, (active) => {
	if (active) backToNavigator();
});

const pathParentAreas = computed(() => {
	const parentName = setup.pathParentName;
	if (!parentName) return [];
	const item = state.objects.find(o => o.name === parentName);
	if (!item) return [];
	return childrenByCategory(item, 'area').map(c => c.name);
});

// ── Wire ISceneTreeOps into App.vue's provided ref ────────────────
// App.vue provides a ref that its treeOps adapter delegates through.
// Set it to a plain object so the adapter can call tree ops without
// holding a component instance reference.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sceneTreeParentRef = inject<Ref<any>>('sceneTreeRef');
if (sceneTreeParentRef) {
	sceneTreeParentRef.value = { addItem, clearAll, removeItemByName, removeItemByNameSilent, hasItem, addPath, addArea, addTarget, addPtpTrajectory, addLinearTrajectory };
}
onUnmounted(() => {
	if (sceneTreeParentRef) sceneTreeParentRef.value = null;
});

// ── Selection & focus ─────────────────────────────────────────────

function focusItem(item: TreeItem) {
	if (treeDisabled.value) return;
	emitBridge('focus-group', item.name, item.type);
}

function selectItem(item: TreeItem) {
	if (treeDisabled.value) return;
	selectedItemName.value = item.name;
	selectedChildName.value = null;
	systemDetailInitialTab.value = 'info';
	systemDetailInitialSetupTab.value = 'manipulator';
	emitBridge('select-item', { name: item.name, type: item.type });
}

// ── Sub-category config ───────────────────────────────────────────

interface SubCategoryConfig {
	category: ChildCategory;
	label: string;
	emptyText: string;
	canAdd: boolean;
	addTitle?: string;
	onAdd?: () => void;
}

function buildSubCategoryConfigs(item: TreeItem): SubCategoryConfig[] {
	if (item.type === 'scene-object') {
		// Paths/areas are drawn on a mesh surface, so primitive shapes (box,
		// sphere, ...) have nothing to attach them to — hide both categories
		// rather than offering an "Add" that can't produce anything useful.
		if (workcell.sceneObjectTypes.get(item.name) === 'primitive') return [];
		return [
			{ category: 'area', label: t('tree.category.areas'), emptyText: t('tree.empty.areas'), canAdd: true, addTitle: t('tree.action.addArea'), onAdd: () => setup.openAreaSetup(item.name) },
			{ category: 'path', label: t('tree.category.paths'), emptyText: t('tree.empty.paths'), canAdd: true, addTitle: t('tree.action.addPath'), onAdd: () => setup.openPathSetup(item.name) },
		];
	}
	if (item.type === 'system') {
		return [
			{ category: 'target', label: t('tree.category.targets'), emptyText: t('tree.empty.targets'), canAdd: true, addTitle: t('tree.action.addTarget'), onAdd: () => setup.openTargetSetup(item.name) },
			{ category: 'ptp-trajectory', label: t('tree.category.ptpTrajectories'), emptyText: t('tree.empty.ptpTrajectories'), canAdd: true, addTitle: t('tree.action.addPtpTrajectory'), onAdd: () => setup.openPtpTrajectorySetup(item.name) },
			{ category: 'linear-trajectory', label: t('tree.category.linearTrajectories'), emptyText: t('tree.empty.linearTrajectories'), canAdd: true, addTitle: t('tree.action.addLinearTrajectory'), onAdd: () => setup.openLinearTrajectorySetup(item.name) },
		];
	}
	return [];
}

const subCategoryMap = computed(() => {
	const map = new Map<string, SubCategoryConfig[]>();
	for (const item of state.objects) {
		map.set(item.name, buildSubCategoryConfigs(item));
	}
	return map;
});

// Exposed so Editor.vue's hamburger menu can open these workcell-wide setup
// panels — they aren't tied to any tree item, so they have no natural home
// inside the tree itself.
defineExpose({
	openCollisionConfig,
	openCustomComponentsFromMenu,
	openLicenseManager,
});
</script>

<style scoped>
.panel-left__split {
	flex: 1;
	display: flex;
	flex-direction: row;
	align-items: stretch;
	gap: 0;
	overflow: hidden;
}

.panel-left__split__tree {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: stretch;
	overflow-y: auto;
	padding: 0.75rem;
}

.panel-left__split__info {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: stretch;
	overflow: hidden;
	background: #f7fafd;
}

/* Fixed bar hosting the "back to navigator" control. */
.panel-left__detail-bar {
	flex-shrink: 0;
	padding: 0.4rem 0.5rem;
	border-bottom: 1px solid var(--line);
	background: #eef3f8;
}

.panel-left__back {
	border: 0;
	background: transparent;
	color: var(--accent-strong);
	font-family: 'IBM Plex Sans', sans-serif;
	font-size: 0.82rem;
	font-weight: 500;
	cursor: pointer;
	padding: 0.2rem 0.3rem;
}

.panel-left__back:hover {
	color: var(--ink);
}

.panel-left__detail-body {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	align-items: stretch;
	overflow: hidden;
}

/* Whichever editor the detail body hosts (a setup wizard or the info
   panel) fills the column and scrolls on its own. Components that manage
   their own sticky header/tabs + scrollable body (setup-scene-object--fixed-tabs)
   get overflow: hidden here instead, so their own internal scroll region -
   not this outer one - does the scrolling and their sticky tabs stay put. */
.panel-left__detail-body > *:not(.setup-scene-object--fixed-tabs) {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
}

.panel-left__detail-body > .setup-scene-object--fixed-tabs {
	flex: 1;
	min-height: 0;
	overflow: hidden;
}

.panel-left__setup {
	display: flex;
	flex-direction: column;
}
</style>
