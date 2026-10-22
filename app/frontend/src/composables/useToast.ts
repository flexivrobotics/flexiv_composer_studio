import { reactive } from 'vue';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
	id: number;
	message: string;
	type: ToastType;
}

const toasts = reactive<Toast[]>([]);
let nextId = 0;

export function useToast() {
	function showToast(message: string, type: ToastType = 'info', duration = 3500) {
		const id = nextId++;
		toasts.push({ id, message, type });
		setTimeout(() => dismiss(id), duration);
	}

	function dismiss(id: number) {
		const index = toasts.findIndex((t) => t.id === id);
		if (index !== -1) toasts.splice(index, 1);
	}

	return { toasts, showToast, dismiss };
}
