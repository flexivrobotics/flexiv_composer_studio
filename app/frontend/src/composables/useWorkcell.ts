import { reactive, type Ref } from 'vue';
import type { WorkcellState } from '../types';

// ── useWorkcell ───────────────────────────────────────────────────────
// Module-level reactive singleton: tracks the active workcell and
// scene-object visual-type metadata so that any component can read
// these without prop drilling from App.vue.

const state = reactive({
	name: '',
	active: false,
	sceneObjectTypes: new Map<string, import('../types').VisualType>(),
	connectedSystems: [] as string[],
}) as WorkcellState;

/**
 * Callback invoked after ``connectedSystems`` changes.  Set by
 * ``useSceneController`` so that polling start/stop can be triggered
 * from any component that modifies the connection list.
 */
let _onConnectionChanged: (() => void) | null = null;

export function setConnectionChangeHandler(fn: (() => void) | null): void {
	_onConnectionChanged = fn;
}

export function notifyConnectionChanged(): void {
	_onConnectionChanged?.();
}

export function useWorkcell(): WorkcellState {
	return state;
}
