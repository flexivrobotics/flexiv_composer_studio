// Augment Vue's ComponentCustomProperties so that vue-tsc recognises
// the $t global property installed by the i18n plugin (useI18n.ts).
export {};

declare module 'vue' {
	interface ComponentCustomProperties {
		$t: (key: string, params?: Record<string, string | number>) => string;
	}
}
