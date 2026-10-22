// ── URDF Parser ───────────────────────────────────────────────────────
// Responsible solely for fetching and parsing URDF XML into structured
// data types.  Does NOT build Three.js geometry.

import type { UrdfJointData } from './kinematics';

// ── Types ─────────────────────────────────────────────────────────────

export interface UrdfVisualData {
	linkName: string;
	position: [number, number, number];
	rotation: [number, number, number];
	color?: [number, number, number, number];
	geometry:
		| { type: 'mesh'; meshUrl: string; scale: [number, number, number] }
		| { type: 'box'; size: [number, number, number] }
		| { type: 'cylinder'; radius: number; length: number }
		| { type: 'sphere'; radius: number };
}

export interface ParsedUrdf {
	links: UrdfVisualData[];
	joints: UrdfJointData[];
	resolveMeshUrl: (filename: string) => string | null;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Fetch a URDF document (or read it from an inline `text:` URI) and
 * return the parsed link visuals, joint list, and a mesh URL resolver.
 */
export async function fetchAndParseUrdf(url: string, baseDir?: string): Promise<ParsedUrdf> {
	let urdfText: string;
	if (url.startsWith('text:')) {
		urdfText = url.slice(5);
	} else {
		const response = await fetch(url, { cache: 'no-store' });
		if (!response.ok) throw new Error(`Failed to fetch URDF: ${response.status}`);
		urdfText = await response.text();
	}

	const meshPaths = extractMeshPaths(urdfText);
	const resolveMeshUrl = buildMeshUrlResolver(meshPaths, baseDir);
	const { links, joints } = parseUrdfXml(urdfText);

	return { links, joints, resolveMeshUrl };
}

// ── Helpers ───────────────────────────────────────────────────────────

export function groupVisualsByLink(links: UrdfVisualData[]): Map<string, UrdfVisualData[]> {
	const map = new Map<string, UrdfVisualData[]>();
	for (const link of links) {
		if (!map.has(link.linkName)) map.set(link.linkName, []);
		map.get(link.linkName)!.push(link);
	}
	return map;
}

function extractMeshPaths(urdfText: string): string[] {
	const paths: string[] = [];
	const regex = /<mesh[^>]*\bfilename\s*=\s*"([^"]+)"/gi;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(urdfText)) !== null) {
		paths.push(match[1]);
	}
	return paths;
}

function buildMeshUrlResolver(
	meshPaths: string[],
	baseDir?: string,
): (filename: string) => string | null {
	return (filename: string): string | null => {
		if (filename.startsWith('/')) {
			return `/api/file?path=${encodeURIComponent(filename)}`;
		}
		const pkgMatch = filename.match(/^package:\/\/[^/]+(.+)$/);
		if (pkgMatch) {
			return `/api/file?path=${encodeURIComponent(pkgMatch[1])}`;
		}
		if (baseDir) {
			const joined = `${baseDir.replace(/\/$/, '')}/${filename}`;
			return `/api/file?path=${encodeURIComponent(joined)}`;
		}
		return null;
	};
}

function parseUrdfXml(urdfText: string): { links: UrdfVisualData[]; joints: UrdfJointData[] } {
	const parser = new DOMParser();
	const xml = parser.parseFromString(urdfText, 'text/xml');
	if (xml.querySelector('parsererror')) throw new Error('Failed to parse URDF XML.');

	const links: UrdfVisualData[] = [];
	const joints: UrdfJointData[] = [];

	// Parse links
	for (const linkEl of xml.querySelectorAll('link')) {
		const linkName = linkEl.getAttribute('name') || '';
		if (!linkName) continue;

		for (const visualEl of linkEl.querySelectorAll('visual')) {
			const geometryEl = visualEl.querySelector('geometry');
			if (!geometryEl) continue;

			const originEl = visualEl.querySelector('origin');
			const pos: [number, number, number] = [0, 0, 0];
			const rot: [number, number, number] = [0, 0, 0];

			if (originEl) {
				const xyz = originEl.getAttribute('xyz')?.split(/\s+/).map(Number) || [];
				pos[0] = xyz[0] || 0; pos[1] = xyz[1] || 0; pos[2] = xyz[2] || 0;
				const rpy = originEl.getAttribute('rpy')?.split(/\s+/).map(Number) || [];
				rot[0] = rpy[0] || 0; rot[1] = rpy[1] || 0; rot[2] = rpy[2] || 0;
			}

			let color: [number, number, number, number] | undefined;
			const colorEl = visualEl.querySelector('material color');
			if (colorEl) {
				const rgba = colorEl.getAttribute('rgba')?.split(/\s+/).map(Number) || [];
				color = [rgba[0] ?? 1, rgba[1] ?? 1, rgba[2] ?? 1, rgba[3] ?? 1];
			}

			const meshEl = geometryEl.querySelector('mesh');
			if (meshEl) {
				const filename = meshEl.getAttribute('filename');
				if (filename) {
					const scaleAttr = meshEl.getAttribute('scale')?.split(/\s+/).map(Number) || [];
					const scale: [number, number, number] = [scaleAttr[0] || 1, scaleAttr[1] || 1, scaleAttr[2] || 1];
					links.push({ linkName, position: pos, rotation: rot, color, geometry: { type: 'mesh', meshUrl: filename, scale } });
				}
				continue;
			}

			const boxEl = geometryEl.querySelector('box');
			if (boxEl) {
				const s = boxEl.getAttribute('size')?.split(/\s+/).map(Number) || [];
				links.push({ linkName, position: pos, rotation: rot, color, geometry: { type: 'box', size: [s[0] || 0, s[1] || 0, s[2] || 0] } });
				continue;
			}

			const cylinderEl = geometryEl.querySelector('cylinder');
			if (cylinderEl) {
				links.push({
					linkName, position: pos, rotation: rot, color,
					geometry: { type: 'cylinder', radius: Number(cylinderEl.getAttribute('radius')) || 0, length: Number(cylinderEl.getAttribute('length')) || 0 },
				});
				continue;
			}

			const sphereEl = geometryEl.querySelector('sphere');
			if (sphereEl) {
				links.push({ linkName, position: pos, rotation: rot, color, geometry: { type: 'sphere', radius: Number(sphereEl.getAttribute('radius')) || 0 } });
			}
		}
	}

	// Parse joints
	for (const jointEl of xml.querySelectorAll('joint')) {
		const name = jointEl.getAttribute('name') || '';
		const type = jointEl.getAttribute('type') || 'fixed';
		const parentEl = jointEl.querySelector('parent_external') ?? jointEl.querySelector('parent');
		const parent = parentEl?.getAttribute('link');
		const child = jointEl.querySelector('child')?.getAttribute('link');
		if (!name || !parent || !child) continue;

		const originEl = jointEl.querySelector('origin_external') ?? jointEl.querySelector('origin');
		const xyz: [number, number, number] = [0, 0, 0];
		const rpy: [number, number, number] = [0, 0, 0];
		if (originEl) {
			const p = originEl.getAttribute('xyz')?.split(/\s+/).map(Number) || [];
			xyz[0] = p[0] || 0; xyz[1] = p[1] || 0; xyz[2] = p[2] || 0;
			const r = originEl.getAttribute('rpy')?.split(/\s+/).map(Number) || [];
			rpy[0] = r[0] || 0; rpy[1] = r[1] || 0; rpy[2] = r[2] || 0;
		}

		const axisEl = jointEl.querySelector('axis');
		const a = axisEl?.getAttribute('xyz')?.split(/\s+/).map(Number) || [1, 0, 0];
		const axis: [number, number, number] = [a[0] ?? 1, a[1] ?? 0, a[2] ?? 0];

		const limitEl = jointEl.querySelector('limit');
		const lower = limitEl ? Number(limitEl.getAttribute('lower')) : undefined;
		const upper = limitEl ? Number(limitEl.getAttribute('upper')) : undefined;

		const externalParent = jointEl.querySelector('parent_external')?.getAttribute('link') ?? undefined;

		joints.push({ name, type, parent, child, xyz, rpy, axis, lower, upper, externalParent });
	}

	return { links, joints };
}
