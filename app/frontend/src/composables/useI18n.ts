import { reactive } from 'vue';
import type { LocaleMessages } from '../locales/en';
import en from '../locales/en';
import zh from '../locales/zh';

// ── Types ──────────────────────────────────────────────────────────

export type Locale = 'en' | 'zh';

export interface I18nState {
	locale: Locale;
	/** Translate a dotted key into the current locale's string. */
	t: (key: string, params?: Record<string, string | number>) => string;
	/** Switch the active locale. */
	setLocale: (locale: Locale) => void;
}

// ── Message Registry ───────────────────────────────────────────────

const messages: Record<Locale, LocaleMessages> = { en, zh };

// ── Resolver ───────────────────────────────────────────────────────

function resolve(key: string, msgs: Record<string, any>): string {
	const parts = key.split('.');
	let node: any = msgs;
	for (const part of parts) {
		if (node == null) return key; // fallback: raw key
		node = node[part];
	}
	return typeof node === 'string' ? node : key;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (_match, name) =>
		String(params[name] ?? `{${name}}`),
	);
}

// ── Singleton State ────────────────────────────────────────────────
// Module-level singleton, consistent with the rest of this codebase's
// composables (useWorkcell, useConfirm, ...). This makes useI18n() usable
// from plain .ts service modules and async callbacks, not only from a
// component's synchronous setup() — Vue's inject()/provide() only resolves
// inside an active component instance, so translations silently fell back
// to the raw key (e.g. "dialog.workcell.confirmDelete") whenever t() was
// called later, from inside an event-handler's async body.
const state = reactive<I18nState>({
	locale: 'en',
	setLocale(locale: Locale) {
		state.locale = locale;
	},
	t(key: string, params?: Record<string, string | number>): string {
		const msgs = messages[state.locale] ?? messages.en;
		const template = resolve(key, msgs);
		return interpolate(template, params);
	},
});

// ── Plugin Factory ─────────────────────────────────────────────────

/**
 * Install i18n into a Vue app (wires up the `$t` global property for use in
 * templates). The state itself is the module-level singleton above.
 *
 * Usage in main.ts:
 *   app.use(createI18n('en'));
 *
 * Then anywhere (component or plain module):
 *   const { t, locale } = useI18n();
 *   t('setup.target.button.create')      // 'Create Target'
 *   t('tree.confirm.removePath', { name: 'foo' })  // 'Remove path "foo"?'
 *
 * In templates (via global property):
 *   {{ $t('info.label.name') }}
 */
export function createI18n(defaultLocale: Locale = 'en') {
	state.locale = defaultLocale;

	return {
		install(app: any) {
			app.config.globalProperties.$t = (key: string, params?: Record<string, string | number>) =>
				state.t(key, params);
		},
	};
}

// ── Consumer ────────────────────────────────────────────────────────

/** Retrieve the i18n state. */
export function useI18n(): I18nState {
	return state;
}
