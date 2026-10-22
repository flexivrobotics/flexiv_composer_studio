import { reactive } from 'vue';

// ── usePrompt ─────────────────────────────────────────────────────────
// Provides a `prompt(message, options): Promise<string | null>` that is
// backed by the PromptDialog.vue component placed once in App.vue.
// Call `prompt(msg)` anywhere — it resolves to the entered text when the
// user clicks OK and null when they click Cancel or close the dialog.

interface PromptState {
	visible: boolean;
	message: string;
	value: string;
	placeholder: string;
	resolve: ((value: string | null) => void) | null;
}

const state = reactive<PromptState>({
	visible: false,
	message: '',
	value: '',
	placeholder: '',
	resolve: null,
});

export function usePrompt() {
	function prompt(message: string, options?: { placeholder?: string; initialValue?: string }): Promise<string | null> {
		state.message = message;
		state.placeholder = options?.placeholder ?? '';
		state.value = options?.initialValue ?? '';
		state.visible = true;
		return new Promise<string | null>((res) => {
			state.resolve = res;
		});
	}

	function _accept() {
		state.visible = false;
		state.resolve?.(state.value);
		state.resolve = null;
	}

	function _cancel() {
		state.visible = false;
		state.resolve?.(null);
		state.resolve = null;
	}

	return { prompt, _accept, _cancel, state };
}
