import * as THREE from 'three';

// ── Types & Interfaces ───────────────────────────────────────────────

/** Parsed joint data from a URDF file. */
export interface UrdfJointData {
	name: string;
	type: string;
	parent: string;
	child: string;
	xyz: [number, number, number];
	rpy: [number, number, number];
	axis: [number, number, number];
	lower?: number;
	upper?: number;
	/** Link name from <parent_external>, if present. Identifies an external system link. */
	externalParent?: string;
}

// ── FK Solver ────────────────────────────────────────────────────────

/**
 * Compute world transforms for every link in the kinematic tree using
 * iterative forward kinematics.
 *
 * @param joints      Flat list of URDF joints (order does not matter).
 * @param jointAngles Optional map of joint name → angle in radians.
 * @returns Map from link name to { position, quaternion } in world space.
 */
export function computeLinkTransforms(
	joints: UrdfJointData[],
	jointAngles?: Record<string, number>,
): Map<string, { position: [number, number, number]; quaternion: [number, number, number, number] }> {
	const allLinks = new Set<string>();
	const childLinks = new Set<string>();
	for (const j of joints) {
		allLinks.add(j.parent);
		allLinks.add(j.child);
		childLinks.add(j.child);
	}

	const roots: string[] = [];
	for (const link of allLinks) {
		if (!childLinks.has(link)) roots.push(link);
	}
	if (roots.length === 0 && joints.length > 0) roots.push(joints[0].parent);

	const transforms = new Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
	for (const root of roots) {
		transforms.set(root, {
			position: new THREE.Vector3(0, 0, 0),
			quaternion: new THREE.Quaternion(0, 0, 0, 1),
		});
	}

	let changed = true;
	while (changed) {
		changed = false;
		for (const joint of joints) {
			const parentTf = transforms.get(joint.parent);
			if (!parentTf || transforms.has(joint.child)) continue;

			// Base joint transform from origin (rpy + xyz)
			const originQuat = new THREE.Quaternion().setFromEuler(
				new THREE.Euler(joint.rpy[0], joint.rpy[1], joint.rpy[2], 'ZYX'),
			);

			// Non-fixed joints move by the given value along their axis: a
			// prismatic joint slides that many metres, any other turns that
			// many radians.
			let jointQuat = originQuat;
			const localPos = new THREE.Vector3(...joint.xyz);
			if (joint.type !== 'fixed' && jointAngles && joint.name in jointAngles) {
				const value = jointAngles[joint.name];
				const axis = new THREE.Vector3(...joint.axis).normalize();
				if (joint.type === 'prismatic') {
					localPos.add(axis.applyQuaternion(originQuat).multiplyScalar(value));
				} else {
					const axisQuat = new THREE.Quaternion().setFromAxisAngle(axis, value);
					jointQuat = originQuat.clone().multiply(axisQuat);
				}
			}

			const worldQuat = parentTf.quaternion.clone().multiply(jointQuat);
			const worldPos = localPos
				.applyQuaternion(parentTf.quaternion)
				.add(parentTf.position);

			transforms.set(joint.child, { position: worldPos, quaternion: worldQuat });
			changed = true;
		}
	}

	// Convert to array format
	const result = new Map<
		string,
		{ position: [number, number, number]; quaternion: [number, number, number, number] }
	>();
	for (const [link, tf] of transforms) {
		result.set(link, {
			position: [tf.position.x, tf.position.y, tf.position.z],
			quaternion: [tf.quaternion.x, tf.quaternion.y, tf.quaternion.z, tf.quaternion.w],
		});
	}
	return result;
}

/**
 * Convert RPY angles (degrees, XYZ convention) to a quaternion.
 * Inverse of quatToRpy when both use the same Euler convention.
 */
export function rpyToQuaternion(rollDeg: number, pitchDeg: number, yawDeg: number): { x: number; y: number; z: number; w: number } {
	const q = new THREE.Quaternion().setFromEuler(
		new THREE.Euler(
			THREE.MathUtils.degToRad(rollDeg),
			THREE.MathUtils.degToRad(pitchDeg),
			THREE.MathUtils.degToRad(yawDeg),
			'XYZ',
		),
	);
	return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/**
 * Convert a quaternion to roll-pitch-yaw (radians), inverse of rpyToQuaternion's
 * THREE.Euler 'XYZ' convention. Delegates to THREE.Euler so both directions
 * always agree on convention and gimbal-lock handling.
 */
export function quatToRpy(q: { x: number; y: number; z: number; w: number }): { roll: number; pitch: number; yaw: number } {
	const euler = new THREE.Euler().setFromQuaternion(
		new THREE.Quaternion(q.x, q.y, q.z, q.w),
		'ZYX',
	);
	return { roll: euler.x, pitch: euler.y, yaw: euler.z };
}
