import { ref, type Ref } from 'vue';

/**
 * Drag-to-resize logic for a two-column flex layout.
 *
 * The left column's flex-basis (as a percentage of the container width) is
 * driven by the returned `leftBasis` ref; the right column is left as
 * `flex: 1` so it soaks up the remainder. A `<ResizeHandle>` sitting between
 * the two columns calls `startDrag` on pointerdown and this composable tracks
 * the pointer until release.
 *
 * @param containerRef  the flex row that holds both columns
 * @param initialPercent starting width of the left column, in percent
 * @param minPercent     clamp: smallest left-column width, in percent
 * @param maxPercent     clamp: largest left-column width, in percent
 */
export function useResizableColumns(
	containerRef: Ref<HTMLElement | null>,
	initialPercent = 50,
	minPercent = 15,
	maxPercent = 85,
) {
	const leftPercent = ref(initialPercent);
	const dragging = ref(false);

	function onPointerMove(e: PointerEvent) {
		const container = containerRef.value;
		if (!container) return;
		const rect = container.getBoundingClientRect();
		if (rect.width === 0) return;
		let pct = ((e.clientX - rect.left) / rect.width) * 100;
		pct = Math.min(maxPercent, Math.max(minPercent, pct));
		leftPercent.value = pct;
	}

	function endDrag() {
		if (!dragging.value) return;
		dragging.value = false;
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', endDrag);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
	}

	function startDrag(e: PointerEvent) {
		e.preventDefault();
		dragging.value = true;
		window.addEventListener('pointermove', onPointerMove);
		window.addEventListener('pointerup', endDrag);
		// Prevent text selection / cursor flicker while dragging anywhere.
		document.body.style.userSelect = 'none';
		document.body.style.cursor = 'col-resize';
	}

	return { leftPercent, dragging, startDrag };
}
