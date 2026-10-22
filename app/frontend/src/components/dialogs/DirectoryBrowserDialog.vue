<template>
	<div class="dialog-overlay" @click.self="$emit('cancel')">
		<div class="dialog dir-browser">
			<div class="dialog__header">
				<h2 class="dialog__title">{{ $t('dirBrowser.title') }}</h2>
				<button class="dialog__close" @click="$emit('cancel')">&times;</button>
			</div>

			<div class="dir-browser__path-bar">
				<button
					class="dir-browser__up-btn"
					:disabled="!state.parent"
					@click="navigate(state.parent!)"
					title="Go up"
				>&#8593;</button>
				<span class="dir-browser__current-path">{{ state.path }}</span>
			</div>

			<div class="dialog__body dir-browser__list-wrap">
				<div v-if="state.loading" class="dialog__loading">{{ $t('dirBrowser.loading') }}</div>
				<ul v-else class="dir-browser__list">
					<li
						v-for="dir in state.dirs"
						:key="dir"
						class="dir-browser__item"
						@click="navigate(state.path + '/' + dir)"
					>
						<span class="dir-browser__icon">&#128193;</span>
						{{ dir }}
					</li>
					<li v-if="state.dirs.length === 0" class="dir-browser__empty">
						{{ $t('dirBrowser.empty') }}
					</li>
				</ul>
			</div>

			<div class="dialog__footer">
				<button class="btn btn--outline" @click="$emit('cancel')">{{ $t('dialog.workcell.button.cancel') }}</button>
				<button class="btn" @click="$emit('select', state.path)">{{ $t('dirBrowser.select') }}</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue';
import { apiGet } from '../../services/api';
import { useToast } from '../../composables/useToast';

const props = defineProps<{ initialPath: string }>();
const emit = defineEmits<{ cancel: []; select: [path: string] }>();
const { showToast } = useToast();

interface BrowseResult {
	path: string;
	parent: string | null;
	dirs: string[];
}

const state = reactive({
	path: props.initialPath,
	parent: null as string | null,
	dirs: [] as string[],
	loading: false,
});

async function navigate(path: string, silent = false) {
	state.loading = true;
	try {
		const result = await apiGet<BrowseResult>(`/api/browse-directories?path=${encodeURIComponent(path)}`);
		state.path = result.path;
		state.parent = result.parent;
		state.dirs = result.dirs;
	} catch (err: any) {
		if (!silent) showToast(err.message ?? String(err), 'error');
		throw err;
	} finally {
		state.loading = false;
	}
}

onMounted(async () => {
	try {
		await navigate(props.initialPath, true);
	} catch {
		await navigate('', true);
	}
});
</script>

<style scoped>
.dir-browser {
	width: min(90vw, 520px);
	max-height: 70vh;
}

.dir-browser__path-bar {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 1.25rem;
	border-bottom: 1px solid var(--line);
	background: #f8fafc;
}

.dir-browser__up-btn {
	flex-shrink: 0;
	width: 1.8rem;
	height: 1.8rem;
	border: 1px solid var(--line);
	border-radius: 4px;
	background: #fff;
	color: var(--ink);
	font-size: 1rem;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
}

.dir-browser__up-btn:hover:not(:disabled) {
	background: var(--accent-muted);
	border-color: var(--accent);
}

.dir-browser__up-btn:disabled {
	opacity: 0.35;
	cursor: not-allowed;
}

.dir-browser__current-path {
	flex: 1;
	font-size: 0.8rem;
	color: var(--ink-muted);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-family: monospace;
}

.dir-browser__list-wrap {
	padding: 0;
	overflow-y: auto;
	flex: none;
	height: calc(70vh - 12rem);
}

.dir-browser__list {
	list-style: none;
	margin: 0;
	padding: 0.25rem 0;
}

.dir-browser__item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.45rem 1.25rem;
	font-size: 0.88rem;
	color: var(--ink);
	cursor: pointer;
	transition: background-color 80ms ease;
}

.dir-browser__item:hover {
	background: var(--accent-muted);
}

.dir-browser__icon {
	font-size: 0.95rem;
	flex-shrink: 0;
}

.dir-browser__empty {
	padding: 1.5rem 1.25rem;
	font-size: 0.85rem;
	color: var(--ink-muted);
	font-style: italic;
}
</style>
