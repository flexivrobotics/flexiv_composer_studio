import { reactive } from 'vue';
import { jointToDisplay, jointDecimals } from '../../utils/math';

export interface IkSeedSlider {
	name: string;
	value: number; // degrees, or metres if prismatic
	min: number;
	max: number;
	/** True for a linear joint, such as a rail. */
	prismatic?: boolean;
}

// ── useIkSeedSliders ──────────────────────────────────────────────────
// Manages the reactive list of external-axis IK seed sliders and the
// input handlers for the range/spinbox pair.

export function useIkSeedSliders(props: {
	externalAxisData: { name?: string; lowerLimit?: number[]; upperLimit?: number[]; prismatic?: boolean[] } | null;
	jointNames: string[];
}) {
	const ikSeedSliders = reactive<IkSeedSlider[]>([]);

	function rebuildIkSeedSliders() {
		const ea = props.externalAxisData;
		if (!ea) {
			ikSeedSliders.splice(0, ikSeedSliders.length);
			return;
		}
		const lower = (ea.lowerLimit as number[]) ?? [];
		const upper = (ea.upperLimit as number[]) ?? [];
		const extName = ea.name as string | undefined;
		const categoryNames = extName
			? props.jointNames.filter(n => n.includes(extName))
			: props.jointNames;
		const count = Math.min(lower.length, upper.length, categoryNames.length);
		const rows: IkSeedSlider[] = [];
		for (let i = 0; i < count; i++) {
			const prismatic = ea.prismatic?.[i] ?? false;
			const decimals = jointDecimals(prismatic);
			rows.push({
				name: categoryNames[i] ?? `Ext Joint ${i + 1}`,
				value: 0,
				min: +jointToDisplay(lower[i], prismatic).toFixed(decimals),
				max: +jointToDisplay(upper[i], prismatic).toFixed(decimals),
				prismatic,
			});
		}
		ikSeedSliders.splice(0, ikSeedSliders.length, ...rows);
	}

	function onSeedRangeInput(slider: IkSeedSlider) {
		slider.value = +slider.value.toFixed(jointDecimals(slider.prismatic));
	}

	function onSeedSpinboxInput(slider: IkSeedSlider, event: Event) {
		const raw = (event.target as HTMLInputElement).valueAsNumber;
		if (!isNaN(raw)) slider.value = +raw.toFixed(jointDecimals(slider.prismatic));
	}

	return { ikSeedSliders, rebuildIkSeedSliders, onSeedRangeInput, onSeedSpinboxInput };
}
