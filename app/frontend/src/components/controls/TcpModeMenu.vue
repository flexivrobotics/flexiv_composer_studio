<template>
	<div
		ref="menuEl"
		class="tcp-menu"
		:style="{ left: x + 'px', top: y + 'px' }"
	>
		<div
			v-for="item in items"
			:key="item.mode"
			class="tcp-menu__item"
			:class="{ 'tcp-menu__item--active': currentMode === item.mode }"
			@click="onSelect(item.mode)"
		>
			<span>{{ item.label }}</span>
			<span v-if="currentMode === item.mode" class="tcp-menu__check">✓</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import type { TcpMode } from '../../types';

const props = defineProps<{
	x: number;
	y: number;
	currentMode: TcpMode;
}>();

const emit = defineEmits<{
	select: [mode: TcpMode];
	dismiss: [];
}>();

const items: Array<{ label: string; mode: TcpMode }> = [
	{ label: 'Translation',       mode: 'translate'     },
	{ label: 'Rotation - World',  mode: 'rotate-world'  },
	{ label: 'Rotation - TCP',    mode: 'rotate-tcp'    },
];

function onSelect(mode: TcpMode) {
	emit('select', mode);
}

const menuEl = ref<HTMLDivElement | null>(null);

function onOutsideClick(e: MouseEvent) {
	if (menuEl.value?.contains(e.target as Node)) return;
	emit('dismiss');
}

onMounted(() => {
	// Defer so the click that opened the menu doesn't immediately dismiss it
	setTimeout(() => document.addEventListener('mousedown', onOutsideClick), 0);
});

onUnmounted(() => {
	document.removeEventListener('mousedown', onOutsideClick);
});
</script>

<style scoped>
.tcp-menu {
	position: fixed;
	z-index: 9999;
	min-width: 160px;
	background: var(--surface, #fff);
	border: 1px solid var(--line, #d0d7de);
	border-radius: 6px;
	padding: 4px 0;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	font-size: 0.875rem;
}

.tcp-menu__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 7px 14px;
	cursor: pointer;
	color: var(--ink, #1a1a1a);
	gap: 8px;
}

.tcp-menu__item:hover {
	background: var(--surface-hover, #f0f4f8);
}

.tcp-menu__item--active {
	color: var(--accent, #0f766e);
	font-weight: 500;
}

.tcp-menu__check {
	font-size: 0.75rem;
	color: var(--accent, #0f766e);
}
</style>
