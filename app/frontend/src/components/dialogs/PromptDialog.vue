<template>
	<Teleport to="body">
		<div v-if="promptState.visible" class="confirm-overlay" @click.self="cancel">
			<div class="confirm-dialog" role="dialog" aria-modal="true">
				<p class="confirm-message">{{ promptState.message }}</p>
				<input
					class="setup-field__input"
					type="text"
					v-model="promptState.value"
					:placeholder="promptState.placeholder"
					@keyup.enter="accept"
				/>
				<div class="confirm-actions">
					<button class="btn btn--outline" @click="cancel">{{ $t('dialog.confirm.cancel') }}</button>
					<button class="btn" @click="accept">{{ $t('dialog.confirm.ok') }}</button>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { usePrompt } from "../../composables/usePrompt";
import { useI18n } from "../../composables/useI18n";

const { t } = useI18n();
const { state: promptState, _accept: accept, _cancel: cancel } = usePrompt();
</script>

<style scoped>
.confirm-overlay {
	position: fixed;
	inset: 0;
	background: rgba(24, 52, 49, 0.35);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
}

.confirm-dialog {
	background: var(--surface);
	border: 1px solid var(--line);
	border-radius: 12px;
	box-shadow: 0 18px 48px rgba(24, 52, 49, 0.18);
	padding: 1.5rem;
	min-width: 280px;
	max-width: 400px;
}

.confirm-message {
	margin: 0 0 1.25rem;
	font-size: 0.95rem;
	color: var(--ink);
	line-height: 1.5;
}

.confirm-dialog .setup-field__input {
	width: 100%;
	margin-bottom: 1.25rem;
}

.confirm-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
}

.btn--outline {
	background: transparent;
	border: 1px solid var(--line);
	color: var(--ink);
}

.btn--outline:hover {
	background: rgba(24, 52, 49, 0.06);
}
</style>
