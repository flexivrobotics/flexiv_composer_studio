<template>
	<Teleport to="body">
		<div class="toast-container" aria-live="polite" aria-atomic="false">
			<TransitionGroup name="toast">
				<div
					v-for="toast in toasts"
					:key="toast.id"
					:class="['toast', `toast--${toast.type}`]"
					role="alert"
					@click="dismiss(toast.id)"
				>
					<span class="toast__icon">{{ icons[toast.type] }}</span>
					<span class="toast__message">{{ toast.message }}</span>
					<button class="toast__close" :aria-label="'Dismiss'" @click.stop="dismiss(toast.id)">✕</button>
				</div>
			</TransitionGroup>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../../composables/useToast';
import type { ToastType } from '../../composables/useToast';

const { toasts, dismiss } = useToast();

const icons: Record<ToastType, string> = {
	success: '✓',
	error: '✕',
	warning: '⚠',
	info: 'ℹ',
};
</script>

<style scoped>
.toast-container {
	position: fixed;
	top: 1.5rem;
	left: 50%;
	transform: translateX(-50%);
	z-index: 2000;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	pointer-events: none;
	align-items: center;
}

.toast {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	padding: 0.65rem 0.875rem;
	border-radius: 8px;
	min-width: 240px;
	max-width: 380px;
	font-size: 0.875rem;
	font-weight: 500;
	box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
	pointer-events: all;
	cursor: pointer;
	border-left: 3px solid transparent;
	background: var(--surface);
	color: var(--ink);
	border-color: transparent;
}

.toast--success {
	border-left-color: #22c55e;
	background: #f0fdf4;
	color: #15803d;
}

.toast--error {
	border-left-color: #ef4444;
	background: #fef2f2;
	color: #b91c1c;
}

.toast--warning {
	border-left-color: #f59e0b;
	background: #fffbeb;
	color: #92400e;
}

.toast--info {
	border-left-color: var(--accent);
	background: var(--accent-muted);
	color: var(--accent-strong);
}

.toast__icon {
	flex-shrink: 0;
	font-size: 0.8rem;
	font-weight: 700;
}

.toast__message {
	flex: 1;
	line-height: 1.4;
}

.toast__close {
	flex-shrink: 0;
	background: none;
	border: none;
	cursor: pointer;
	font-size: 0.75rem;
	opacity: 0.5;
	padding: 0 0 0 0.25rem;
	color: inherit;
	line-height: 1;
}

.toast__close:hover {
	opacity: 1;
}

/* TransitionGroup animations */
.toast-enter-active {
	transition: all 0.25s ease-out;
}

.toast-leave-active {
	transition: all 0.2s ease-in;
}

.toast-enter-from {
	opacity: 0;
	transform: translateY(-0.75rem);
}

.toast-leave-to {
	opacity: 0;
	transform: translateY(-0.75rem);
}

.toast-move {
	transition: transform 0.2s ease;
}
</style>
