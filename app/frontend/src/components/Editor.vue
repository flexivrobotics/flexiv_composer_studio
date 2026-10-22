<template>
	<section class="panel panel--left surface-dark" style="position: relative;">
		<div v-if="controller.setupLoading" class="panel-left__loading-overlay">
			<p class="panel-left__loading-text">{{ $t('app.loading') }}</p>
		</div>
		<nav class="panel-left__tabs">
			<div class="panel-left__menu" ref="menuWrapperRef">
				<button
					class="panel-left__menu-trigger"
					:disabled="controller.ui?.sceneEventsActive"
					@click.stop="menuOpen = !menuOpen"
					:title="$t('app.tabs.moreSetup')"
					:aria-label="$t('app.tabs.moreSetup')"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<line x1="3" y1="6" x2="21" y2="6" />
						<line x1="3" y1="12" x2="21" y2="12" />
						<line x1="3" y1="18" x2="21" y2="18" />
					</svg>
				</button>
				<div v-if="menuOpen" class="panel-left__menu-dropdown">
					<button class="panel-left__menu-item" @click="handleOpenCollisionConfig">
						{{ $t('tree.category.collisionConfigs') }}
					</button>
					<button class="panel-left__menu-item" @click="handleOpenCustomComponents">
						{{ $t('tree.category.customComponents') }}
					</button>
					<button class="panel-left__menu-item" @click="handleOpenLicenseManager">
						{{ $t('tree.category.license') }}
					</button>
				</div>
			</div>
		</nav>
		<SceneNavigatorEditor ref="sceneNavigatorRef" :controller="controller" />
	</section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import SceneNavigatorEditor from './editors/SceneNavigatorEditor.vue';

defineProps<{
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	controller: Record<string, any>;
}>();

// ── Hamburger menu (Collision Configs / Custom Components / License) ──
// These are workcell-wide setup panels with no natural home in the scene
// tree (they aren't tied to any tree item), so they're opened from here via
// SceneNavigatorEditor's exposed methods rather than being tree rows.

const sceneNavigatorRef = ref<InstanceType<typeof SceneNavigatorEditor> | null>(null);
const menuOpen = ref(false);
const menuWrapperRef = ref<HTMLElement | null>(null);

function handleOpenCollisionConfig() {
	sceneNavigatorRef.value?.openCollisionConfig();
	menuOpen.value = false;
}

function handleOpenCustomComponents() {
	sceneNavigatorRef.value?.openCustomComponentsFromMenu();
	menuOpen.value = false;
}

function handleOpenLicenseManager() {
	sceneNavigatorRef.value?.openLicenseManager();
	menuOpen.value = false;
}

function onOutsideMenuClick(event: MouseEvent) {
	if (menuOpen.value && menuWrapperRef.value && !menuWrapperRef.value.contains(event.target as Node)) {
		menuOpen.value = false;
	}
}

onMounted(() => document.addEventListener('mousedown', onOutsideMenuClick));
onUnmounted(() => document.removeEventListener('mousedown', onOutsideMenuClick));
</script>

<style scoped>
.panel--left {
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.panel-left__tabs {
	display: flex;
	justify-content: flex-end;
	flex-shrink: 0;
	border-bottom: 1px solid var(--line);
}

/* ── Hamburger menu ────────────────────────────────────── */

.panel-left__menu {
	position: relative;
	display: flex;
	align-items: center;
	flex-shrink: 0;
	padding: 0 0.5rem;
}

.panel-left__menu-trigger {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.9rem;
	height: 1.9rem;
	border: 0;
	border-radius: 5px;
	background: transparent;
	color: var(--ink-muted);
	cursor: pointer;
	transition: background-color 140ms ease, color 140ms ease;
}

.panel-left__menu-trigger:hover {
	color: var(--ink);
}

.panel-left__menu-trigger:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.panel-left__menu-dropdown {
	position: absolute;
	top: 100%;
	right: 0.25rem;
	margin-top: 0.25rem;
	min-width: 11rem;
	background: var(--surface, #fff);
	border: 1px solid var(--line, #d0d7de);
	border-radius: 6px;
	padding: 4px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	z-index: 20;
	display: flex;
	flex-direction: column;
	gap: 1px;
}

.panel-left__menu-item {
	text-align: left;
	padding: 0.45rem 0.6rem;
	border: 0;
	border-radius: 4px;
	background: transparent;
	font-family: 'IBM Plex Sans', sans-serif;
	font-size: 0.82rem;
	color: var(--ink, #1a1a1a);
	cursor: pointer;
}

.panel-left__menu-item:hover {
	background: rgba(0, 0, 0, 0.05);
}

</style>
