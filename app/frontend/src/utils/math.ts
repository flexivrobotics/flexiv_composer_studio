export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function degToRad(deg: number): number {
	return deg * DEG_TO_RAD;
}

export function radToDeg(rad: number): number {
	return rad * RAD_TO_DEG;
}

// ── Joint positions ──────────────────────────────────────────────────
// Joint positions are radians for a revolute joint and metres for a
// prismatic one (a linear axis such as a rail). The UI shows revolute
// joints in degrees and prismatic joints in metres.

/** A joint position as shown in the UI: degrees, or metres if prismatic. */
export function jointToDisplay(value: number, prismatic = false): number {
	return prismatic ? value : radToDeg(value);
}

/** A joint position entered in the UI, back to radians or metres. */
export function jointFromDisplay(value: number, prismatic = false): number {
	return prismatic ? value : degToRad(value);
}

/** Decimals shown for a joint position: 0.01° or 1 mm. */
export function jointDecimals(prismatic = false): number {
	return prismatic ? 3 : 2;
}

/** Unit suffix for a displayed joint position. */
export function jointUnit(prismatic = false): string {
	return prismatic ? ' m' : '°';
}

/** A displayed joint position, rounded and with its unit, e.g. "12.50°" or "0.250 m". */
export function formatJoint(value: number, prismatic = false): string {
	return jointToDisplay(value, prismatic).toFixed(jointDecimals(prismatic)) + jointUnit(prismatic);
}
