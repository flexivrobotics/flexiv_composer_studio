<template>
	<div class="selection-info-panel">
		<div v-if="selection.loading" class="info-loading">{{ $t('info.loading') }}</div>
		<SystemInfoPanel
			v-else-if="selection.item?.type === 'system'"
			:disabled="disabled"
		/>
		<SceneObjectInfoPanel
			v-else-if="selection.item?.type === 'scene-object'"
			:disabled="disabled"
			:get-viewer="getViewer"
			@reload-mesh="(name: string, url: string) => $emit('reload-mesh', name, url)"
			@object-added="(name: string, url: string) => $emit('object-added', name, url)"
			@show-bbox="(c: any, o: any, e: any) => $emit('show-bbox', c, o, e)"
			@hide-bbox="$emit('hide-bbox')"
		/>
		<CameraInfoPanel
			v-else-if="selection.item?.type === 'camera'"
			:disabled="disabled"
			@camera-modified="(c: any) => $emit('camera-modified', c)"
			@camera-deleted="(n: string) => $emit('camera-deleted', n)"
		/>
		<PathInfoPanel
			v-else-if="selection.item?.type === 'path'"
			:disabled="disabled"
			:get-viewer="getViewer"
			:workcell-name="workcellName"
		/>
		<TargetInfoPanel
			v-else-if="selection.item?.type === 'target'"
			:disabled="disabled"
		/>
		<AreaInfoPanel
			v-else-if="selection.item?.type === 'area'"
			:disabled="disabled"
		/>
		<PtpTrajectoryInfoPanel
			v-else-if="selection.item?.type === 'ptp-trajectory'"
			:disabled="disabled"
			:get-viewer="getViewer"
		/>
		<LinearTrajectoryInfoPanel
			v-else-if="selection.item?.type === 'linear-trajectory'"
			:disabled="disabled"
			:get-viewer="getViewer"
		/>
		<div v-else class="info-empty">{{ $t('info.empty') }}</div>
	</div>
</template>

<script setup lang="ts">
import { useSelection } from '../../composables/useSelection';
import SystemInfoPanel from './SystemInfoPanel.vue';
import SceneObjectInfoPanel from './SceneObjectInfoPanel.vue';
import CameraInfoPanel from './CameraInfoPanel.vue';
import PathInfoPanel from './PathInfoPanel.vue';
import TargetInfoPanel from './TargetInfoPanel.vue';
import AreaInfoPanel from './AreaInfoPanel.vue';
import PtpTrajectoryInfoPanel from './PtpTrajectoryInfoPanel.vue';
import LinearTrajectoryInfoPanel from './LinearTrajectoryInfoPanel.vue';

// ── Props & Emits ──────────────────────────────────────────────────

defineProps<{
	disabled?: boolean;
	getViewer?: () => any;
	workcellName?: string;
}>();

defineEmits<{
	'reload-mesh': [name: string, meshUrl: string];
	'object-added': [name: string, meshUrl: string];
	'show-bbox': [center: { x: number; y: number; z: number }, orientation: { x: number; y: number; z: number; w: number }, extents: { x: number; y: number; z: number }];
	'hide-bbox': [];
	'camera-modified': [camera: any];
	'camera-deleted': [name: string];
}>();

// ── Composables ────────────────────────────────────────────────────

const selection = useSelection();
</script>
