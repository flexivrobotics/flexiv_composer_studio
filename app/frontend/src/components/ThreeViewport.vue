<template>
	<div ref="mountEl" class="viewport">
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { SceneViewer } from '../services/viewer/sceneViewer';

// --- Props & Emits ---

const props = defineProps<{
	selectedObjectName?: string | null;
	pathOnMeshActive?: boolean;
}>();

const emit = defineEmits<{
	'point-added': [point: { x: number; y: number; z: number }];
}>();

// --- State ---

const mountEl = ref<HTMLDivElement | null>(null);
const viewer = shallowRef<SceneViewer | null>(null);

// --- Click handler (connected on mount) ---

function onViewerClick(hit: { name: string; point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } }) {
	if (!props.pathOnMeshActive) return;
	if (!props.selectedObjectName) return;
	if (hit.name !== props.selectedObjectName) return;

	emit('point-added', hit.point);
}

// --- Lifecycle ---

onMounted(() => {
	if (!mountEl.value) return;
	const sv = new SceneViewer(mountEl.value);
	sv.init();
	sv.onDblClick = (hit) => onViewerClick(hit);
	viewer.value = sv;
});

onBeforeUnmount(() => {
	viewer.value?.dispose();
	viewer.value = null;
});

// --- Public API (Exposed) ---

defineExpose({ viewer, getViewer: () => viewer.value });
</script>