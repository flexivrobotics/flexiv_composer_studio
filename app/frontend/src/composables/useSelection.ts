import { reactive } from 'vue';
import type { SelectionState } from '../types';

// ── useSelection ──────────────────────────────────────────────────────
// Module-level reactive singleton: tracks the currently selected scene
// object so that any component can read it without prop drilling.

const state = reactive<SelectionState>({
	item: null,
	jointNames: null,
	prismaticJointNames: null,
	tcpLinkNames: null,
	loading: false,
});

export function useSelection(): SelectionState {
	return state;
}
