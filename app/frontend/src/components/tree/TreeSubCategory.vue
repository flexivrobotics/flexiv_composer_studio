<template>
	<div class="tree-subcategory">
		<div class="tree-subcategory__header" @click="$emit('toggle')">
			<span class="tree-category__arrow" :class="{ expanded: open }">&#9654;</span>
			<span class="tree-subcategory__label">{{ label }}</span>
			<span class="tree-category__count">{{ items.length }}</span>
			<button
				v-if="canAdd"
				class="tree-category__add"
				:disabled="addDisabled"
				@click.stop="$emit('add')"
				:title="addTitle"
			>+</button>
		</div>
		<div v-if="open" class="tree-subcategory__children">
			<div
				v-for="child in items"
				:key="child.name"
				class="tree-item tree-item--child"
				:class="{ 'tree-item--selected': selectedChildName === child.name }"
				@click="$emit('select', child)"
			>
				<div class="tree-item__info">
					<span class="tree-item__name tree-item__name--child">{{ child.name }}</span>
				</div>
				<button
					class="tree-item__remove"
					:disabled="disabled"
					@click.stop="$emit('remove', child)"
					title="Remove"
				>×</button>
			</div>
			<div v-if="items.length === 0" class="tree-empty">{{ emptyText }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { TreeChildItem } from '../../types';

defineProps<{
	label: string;
	open: boolean;
	items: TreeChildItem[];
	selectedChildName: string | null;
	disabled?: boolean;
	canAdd?: boolean;
	addDisabled?: boolean;
	addTitle?: string;
	emptyText: string;
}>();

defineEmits<{
	toggle: [];
	add: [];
	select: [child: TreeChildItem];
	remove: [child: TreeChildItem];
}>();
</script>
