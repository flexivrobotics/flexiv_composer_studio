import { reactive } from 'vue';

// ── useConfirm ────────────────────────────────────────────────────────
// Provides a `confirm(message): Promise<boolean>` that is backed by
// the ConfirmDialog.vue component placed once in App.vue.
// Call `confirm(msg)` anywhere — it resolves to true when the user
// clicks OK and false when they click Cancel or close the dialog.

interface ConfirmState {
	visible: boolean;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	resolve: ((value: boolean) => void) | null;
}

const state = reactive<ConfirmState>({
	visible: false,
	message: '',
	confirmLabel: undefined,
	cancelLabel: undefined,
	resolve: null,
});

export function useConfirm() {
	function confirm(message: string): Promise<boolean> {
		state.message = message;
		state.visible = true;
		return new Promise<boolean>((res) => {
			state.resolve = res;
		});
	}

	function _accept() {
		state.visible = false;
		state.resolve?.(true);
		state.resolve = null;
	}

	function _cancel() {
		state.visible = false;
		state.resolve?.(false);
		state.resolve = null;
	}

	return { confirm, _accept, _cancel, state };
}
