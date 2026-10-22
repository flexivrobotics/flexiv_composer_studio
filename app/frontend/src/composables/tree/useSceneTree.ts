import { computed, reactive, ref } from 'vue';
import type { ObjectType, ChildCategory, ChildType, TreeItem, TreeChildItem } from '../../types';
import { apiDelete } from '../../services/api';
import { useI18n } from '../useI18n';

// ── useSceneTree ──────────────────────────────────────────────────────
// Extracted data model and operations for the SceneTree panel.
// Keeps all tree state, categories, child management, and CRUD logic
// in one place so SceneTree.vue can focus on the template and setup
// view orchestration.

export interface UseSceneTreeOptions {
	/** Event emitter from the parent component (for 'remove-group', 'remove-child'). */
	emit: (event: string, ...args: any[]) => void;
	/** Active workcell name (used for Nebula API URLs). */
	workcellName: () => string;
	/** Confirmation dialog (returns true if user confirmed). */
	confirm: (message: string) => Promise<boolean>;
}

export function useSceneTree(opts: UseSceneTreeOptions) {
	const { emit, workcellName, confirm } = opts;
	const { t } = useI18n();

	// ── Core State ──────────────────────────────────────────────────

	const state = reactive({
		objects: [] as TreeItem[],
		systemsOpen: true,
		sceneObjectsOpen: true,
		camerasOpen: true,
	});

	const selectedItemName = ref<string | null>(null);
	const selectedChildName = ref<string | null>(null);

	// ── Sub-Category Accordion State ────────────────────────────────

	const openSubCategories = reactive(new Set<string>());

	function subCategoryKey(parentName: string, category: ChildCategory): string {
		return `${parentName}:${category}`;
	}

	function isSubCategoryOpen(parentName: string, category: ChildCategory): boolean {
		return openSubCategories.has(subCategoryKey(parentName, category));
	}

	function toggleSubCategory(parentName: string, category: ChildCategory): void {
		const key = subCategoryKey(parentName, category);
		if (openSubCategories.has(key)) openSubCategories.delete(key);
		else openSubCategories.add(key);
	}

	function childrenByCategory(item: TreeItem, category: ChildCategory): TreeChildItem[] {
		return (item.children ?? []).filter(c => c.category === category);
	}

	// ── Computed ────────────────────────────────────────────────────

	const categories = computed(() => [
		{
			label: t('tree.category.systems'),
			type: 'system' as ObjectType,
			items: state.objects.filter(i => i.type === 'system'),
			isOpen: state.systemsOpen,
			toggle: () => (state.systemsOpen = !state.systemsOpen),
			add: () => { /* handled by SceneTree.vue via useSceneTreeSetup */ },
		},
		{
			label: t('tree.category.cameras'),
			type: 'camera' as ObjectType,
			items: state.objects.filter(i => i.type === 'camera'),
			isOpen: state.camerasOpen,
			toggle: () => (state.camerasOpen = !state.camerasOpen),
			add: () => { /* handled by SceneTree.vue via useSceneTreeSetup */ },
		},
		{
			label: t('tree.category.sceneObjects'),
			type: 'scene-object' as ObjectType,
			items: state.objects.filter(i => i.type === 'scene-object'),
			isOpen: state.sceneObjectsOpen,
			toggle: () => (state.sceneObjectsOpen = !state.sceneObjectsOpen),
			add: () => { /* handled by SceneTree.vue via useSceneTreeSetup */ },
		},
	]);

	// ── Tree CRUD Operations ────────────────────────────────────────

	const treeOps = {
		add: (name: string, type: ObjectType) => {
			// Guard against double-adding: a locally-triggered creation flow and
			// the live CHANGE_ADDED scene event for the same object can both
			// race to add it (whichever resolves first wins, the other is a no-op).
			if (state.objects.some(o => o.name === name)) return;
			state.objects.push({ name, type });
		},

		hasItem,

		remove: async (name: string, type: ObjectType) => {
			if (type !== 'system') {
				const key = type === 'scene-object'
					? 'tree.confirm.removeSceneObject'
					: type === 'camera'
						? 'tree.confirm.removeCamera'
						: 'tree.confirm.removeItem';
				const ok = await confirm(t(key, { name }));
				if (!ok) return;
			}

			// Cascade-remove any child items (paths, areas, etc.) first
			const parent = state.objects.find(o => o.name === name);
			if (parent?.children) {
				for (const child of [...parent.children]) {
					emit('remove-child', {
						name: child.name,
						type: child.type,
						category: child.category,
						parentName: child.parentName,
					});
				}
			}

			emit('remove-group', name);
			const idx = state.objects.findIndex(o => o.name === name);
			if (idx !== -1) state.objects.splice(idx, 1);

			// Call Nebula API
			try {
				const apiType = type === 'system' ? 'systems' : type === 'camera' ? 'cameras' : 'scene-objects';
				const wc = workcellName() ? `/${encodeURIComponent(workcellName())}` : '';
				const url = `/api${wc}/${apiType}/${encodeURIComponent(name)}`;
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 5000);
				await apiDelete(url, { signal: controller.signal });
				clearTimeout(timeout);
			} catch (err) {
				console.warn('Error calling Nebula remove API:', err);
			}
		},
	};

	// ── Child Item Management ───────────────────────────────────────

	function _findParent(name: string, expectedType: ObjectType): TreeItem | undefined {
		return state.objects.find(o => o.name === name && o.type === expectedType);
	}

	/** If `name` is an area, return that area's own parent (a scene-object). */
	function _findAreaParent(name: string): string | undefined {
		for (const obj of state.objects) {
			const area = obj.children?.find(c => c.category === 'area' && c.name === name);
			if (area) return area.parentName;
		}
		return undefined;
	}

	function _addChild(parentName: string, parentType: ObjectType, childName: string, category: ChildCategory, logLabel: string): void {
		const parent = _findParent(parentName, parentType);
		if (!parent) {
			console.warn(`Cannot add ${logLabel}: parent '${parentName}' not found in ${parentType}s.`);
			return;
		}
		if (!parent.children) parent.children = [];
		if (parent.children.some(c => c.name === childName)) return;
		const childType: ChildType = category === 'target' ? 'target' : category === 'area' ? 'area' : category === 'ptp-trajectory' ? 'ptp-trajectory' : category === 'linear-trajectory' ? 'linear-trajectory' : 'path';
		parent.children.push({ name: childName, type: childType, category, parentName });
	}

	function addPath(parentName: string, pathName: string) {
		const resolvedParentName = _findAreaParent(parentName) ?? parentName;
		_addChild(resolvedParentName, 'scene-object', pathName, 'path', 'path');
	}

	function addArea(parentName: string, areaName: string) {
		_addChild(parentName, 'scene-object', areaName, 'area', 'area');
	}

	function addTarget(parentName: string, targetName: string) {
		_addChild(parentName, 'system', targetName, 'target', 'target');
	}

	function addPtpTrajectory(parentName: string, trajectoryName: string) {
		_addChild(parentName, 'system', trajectoryName, 'ptp-trajectory', 'ptp-trajectory');
	}

	function addLinearTrajectory(parentName: string, trajectoryName: string) {
		_addChild(parentName, 'system', trajectoryName, 'linear-trajectory', 'linear-trajectory');
	}

	async function removeChildItem(child: TreeChildItem): Promise<void> {
		const confirmKey = child.category === 'target'
			? 'tree.confirm.removeTarget'
			: child.category === 'area'
				? 'tree.confirm.removeArea'
				: child.category === 'ptp-trajectory' || child.category === 'linear-trajectory'
					? 'tree.confirm.removeTrajectory'
					: 'tree.confirm.removePath';
		const ok = await confirm(t(confirmKey, { name: child.name }));
		if (!ok) return;

		const parent = state.objects.find(o => o.name === child.parentName);
		if (!parent || !parent.children) return;
		const idx = parent.children.findIndex(c => c.name === child.name);
		if (idx !== -1) parent.children.splice(idx, 1);
		emit('remove-child', {
			name: child.name,
			type: child.type,
			category: child.category,
			parentName: child.parentName,
		});
	}

	function selectChildItem(child: TreeChildItem): void {
		selectedItemName.value = null;
		selectedChildName.value = child.name;
		emit('select-item', { name: child.name, type: child.category, parentName: child.parentName, category: child.category });
	}

	// ── Bulk / Public API ───────────────────────────────────────────

	function addItem(name: string, type: ObjectType): void {
		treeOps.add(name, type);
	}

	function removeSystemChildren(systemName: string): void {
		const parent = state.objects.find(o => o.name === systemName && o.type === 'system');
		if (!parent?.children) return;
		for (const child of [...parent.children]) {
			emit('remove-child', {
				name: child.name,
				type: child.type,
				category: child.category,
				parentName: child.parentName,
			});
		}
		parent.children.splice(0, parent.children.length);
	}

	function clearAll(): void {
		for (const item of state.objects) {
			if (item.children) {
				for (const child of item.children) {
					emit('remove-group', child.name);
				}
			}
			emit('remove-group', item.name);
		}
		state.objects.splice(0, state.objects.length);
	}

	function removeItemByName(name: string): void {
		const item = state.objects.find(o => o.name === name);
		if (item) {
			treeOps.remove(name, item.type);
			return;
		}
		for (const parent of state.objects) {
			if (!parent.children) continue;
			const idx = parent.children.findIndex(c => c.name === name);
			if (idx !== -1) {
				parent.children.splice(idx, 1);
				return;
			}
		}
	}

	/**
	 * Remove a tree item by name without a confirm dialog or the Nebula DELETE
	 * call. Used to reflect a server-originated REMOVED scene event, where the
	 * object is already gone on the server and the viewer group is removed by
	 * the caller — so we must not prompt or echo a delete back.
	 */
	/** True if a top-level item with this name already exists (any type). */
	function hasItem(name: string): boolean {
		return state.objects.some(o => o.name === name);
	}

	function removeItemByNameSilent(name: string): void {
		const idx = state.objects.findIndex(o => o.name === name);
		if (idx !== -1) {
			state.objects.splice(idx, 1);
			return;
		}
		for (const parent of state.objects) {
			if (!parent.children) continue;
			const cidx = parent.children.findIndex(c => c.name === name);
			if (cidx !== -1) {
				parent.children.splice(cidx, 1);
				return;
			}
		}
	}

	// ── Return ──────────────────────────────────────────────────────

	return {
		// Core state
		state,
		selectedItemName,
		selectedChildName,
		// Sub-categories
		openSubCategories,
		subCategoryKey,
		isSubCategoryOpen,
		toggleSubCategory,
		childrenByCategory,
		// Computed
		categories,
		// Tree operations
		treeOps,
		// Child management
		addPath,
		addArea,
		addTarget,
		addPtpTrajectory,
		addLinearTrajectory,
		removeChildItem,
		selectChildItem,
		// Bulk operations
		addItem,
		clearAll,
		removeItemByName,
		removeItemByNameSilent,
		hasItem,
		removeSystemChildren,
	};
}
