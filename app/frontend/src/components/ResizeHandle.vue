<template>
	<div
		class="resize-handle"
		:class="{ 'resize-handle--active': active, 'resize-handle--collapsed': collapsed }"
		role="separator"
		aria-orientation="vertical"
		@pointerdown="onPointerDown"
	>
		<div class="resize-handle__grip"></div>
		<button
			v-if="collapsible"
			class="resize-handle__toggle"
			type="button"
			:title="collapsed ? expandTitle : collapseTitle"
			:aria-label="collapsed ? expandTitle : collapseTitle"
			@pointerdown.stop
			@click="$emit('toggle')"
		>{{ collapsed ? '›' : '‹' }}</button>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	active?: boolean;
	/** Show a collapse/expand button on the handle. */
	collapsible?: boolean;
	/** Whether the left column is currently collapsed. */
	collapsed?: boolean;
	collapseTitle?: string;
	expandTitle?: string;
}>();

const emit = defineEmits<{
	(e: 'start', ev: PointerEvent): void;
	(e: 'toggle'): void;
}>();

// Dragging is disabled while collapsed — only the toggle button is live then.
function onPointerDown(ev: PointerEvent) {
	if (props.collapsed) return;
	emit('start', ev);
}
</script>

<style scoped>
/*
 * A thin vertical divider between two columns. It renders as a 1px line but
 * exposes a wider (~9px) invisible hit area so it is easy to grab.
 */
.resize-handle {
	flex: 0 0 auto;
	width: 9px;
	margin: 0 -4px; /* overlap the neighbours so it reads as a 1px line */
	position: relative;
	z-index: 5;
	cursor: col-resize;
	align-self: stretch;
	touch-action: none;
}

.resize-handle--collapsed {
	cursor: default;
}

.resize-handle__grip {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 1px;
	background: rgba(0, 0, 0, 0.25);
	transition: background 120ms ease, width 120ms ease;
}

.resize-handle:hover .resize-handle__grip,
.resize-handle--active .resize-handle__grip {
	width: 3px;
	background: var(--accent, #1a6fd8);
}

.resize-handle--collapsed .resize-handle__grip {
	width: 1px;
	background: rgba(0, 0, 0, 0.25);
}

/* ── Collapse / expand button ─────────────────────────────── */
.resize-handle__toggle {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 16px;
	height: 44px;
	padding: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px solid rgba(0, 0, 0, 0.2);
	border-radius: 4px;
	background: var(--dark-panel, #1e3450);
	color: var(--dark-ink-muted, rgba(226, 234, 245, 0.7));
	font-size: 13px;
	line-height: 1;
	cursor: pointer;
	z-index: 6;
	transition: background 120ms ease, color 120ms ease;
}

.resize-handle__toggle:hover {
	background: var(--accent, #1a6fd8);
	color: #fff;
	border-color: var(--accent, #1a6fd8);
}
</style>
