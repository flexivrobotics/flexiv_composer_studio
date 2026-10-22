import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { computeLinkTransforms } from './kinematics';
import { fetchAndParseUrdf, groupVisualsByLink, type UrdfVisualData } from './urdfParser';
import { loadObjMeshOffMainThread } from './workers/objMeshWorkerClient';

// Re-export for consumers that currently import these from sceneLoader
export type { UrdfJointData } from './kinematics';
export { computeLinkTransforms } from './kinematics';

// ── Shared Loaders ───────────────────────────────────────────────────

const _objLoader = new OBJLoader();
const _stlLoader = new STLLoader();
const _mtlLoader = new MTLLoader();

/**
 * Derive candidate material-file URLs from an OBJ file URL served via
 * /api/file?path=...  Tries .mtl first, then .mat as a fallback.
 */
function deriveMaterialUrls(objUrl: string): string[] {
	const match = objUrl.match(/^([^?]+\?path=)(.+?\.)(obj)(\s*)$/i);
	if (!match) return [];
	const base = match[1] + match[2];
	const suffix = match[4] || '';
	return [base + 'mtl' + suffix, base + 'mat' + suffix];
}

/**
 * Try to load a material file (MTL) from a list of candidate URLs.
 * Returns the first successfully loaded materials, or null if all fail.
 */
async function tryLoadMaterials(urls: string[]): Promise<any | null> {
	for (const url of urls) {
		try {
			return await _mtlLoader.loadAsync(url);
		} catch {
			continue;
		}
	}
	return null;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Fetch a mesh file from a URL and parse it into a THREE.Group.
 * Supports .obj and .stl formats.
 */
export async function loadMeshFromUrl(url: string, ext?: string): Promise<THREE.Group> {
	ext = (ext || url.split('.').pop()?.toLowerCase() || '');
	const group = new THREE.Group();

	if (ext === 'stl') {
		const geometry = await _stlLoader.loadAsync(url);
		const material = createVisualMaterial();
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add(mesh);
		return group;
	}

	if (ext === 'obj') {
		// Derive material URLs and try to load one (.mtl first, .mat fallback)
		const materialUrls = deriveMaterialUrls(url);
		let objGroup: THREE.Group;
		const materials = materialUrls.length > 0 ? await tryLoadMaterials(materialUrls) : null;
		if (materials) {
			const objLoader = new OBJLoader();
			objLoader.setMaterials(materials);
			objGroup = await objLoader.loadAsync(url);
			objGroup.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.castShadow = true;
					child.receiveShadow = true;
					const hasVertexColors = (child.geometry as THREE.BufferGeometry).hasAttribute('color');
					if (hasVertexColors) {
						child.material = new THREE.MeshStandardMaterial({
							vertexColors: true,
							roughness: 0.70,
							metalness: 0.15,
						});
					}
				}
			});
		} else {
			// No material file — typically a large scan/reconstruction mesh
			// (vertex-colored or plain), potentially derived from up to a
			// million points. OBJLoader.parse() is a single synchronous pass
			// with no chunking, so parse it in a worker instead of freezing
			// the tab; the worker already applies the same shadow/material
			// setup this branch does for the .mtl path.
			objGroup = await loadObjMeshOffMainThread(url);
		}
		group.add(objGroup);
		return group;
	}

	throw new Error(`Unsupported mesh format: .${ext}`);
}

/**
 * Fetch and parse a URDF file from a URL, then build a THREE.Group
 * containing all visual geometry (meshes and primitives) placed at
 * their computed world transforms.
 */
/**
 * Build a THREE.Group containing a single box primitive, for a scene object
 * whose visual is a box (size is [x, y, z] in metres). Used to render objects
 * added live via a scene event, mirroring the server's box visual.
 */
export function buildBoxGroup(size: [number, number, number]): THREE.Group {
	const group = new THREE.Group();
	const [x, y, z] = size;
	const geometry = new THREE.BoxGeometry(x || 0.001, y || 0.001, z || 0.001);
	const mesh = new THREE.Mesh(geometry, createVisualMaterial());
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	group.add(mesh);
	return group;
}

/**
 * Build a THREE.Group containing a camera's view-frustum wireframe, drawn
 * from the camera origin (apex) along +Z (the SDK's camera optical axis)
 * out to the far plane, sized from far_width/far_height/far_distance and
 * near_distance. Used to visualize a Camera scene config in the viewer.
 */
export function buildCameraFrustumGroup(params: {
	farWidth: number;
	farHeight: number;
	farDistance: number;
	nearDistance: number;
}): THREE.Group {
	const group = new THREE.Group();

	const far = Math.max(params.farDistance, 0.001);
	const near = Math.min(Math.max(params.nearDistance, 0), far - 0.001);
	const nearWidth = params.farWidth * (near / far);
	const nearHeight = params.farHeight * (near / far);

	const rectAt = (halfW: number, halfH: number, z: number) => [
		new THREE.Vector3(-halfW, -halfH, z),
		new THREE.Vector3(halfW, -halfH, z),
		new THREE.Vector3(halfW, halfH, z),
		new THREE.Vector3(-halfW, halfH, z),
	];
	const nearCorners = rectAt(nearWidth / 2, nearHeight / 2, near);
	const farCorners = rectAt(params.farWidth / 2, params.farHeight / 2, far);
	const apex = new THREE.Vector3(0, 0, 0);

	const points: THREE.Vector3[] = [];
	const addRing = (corners: THREE.Vector3[]) => {
		for (let i = 0; i < 4; i++) points.push(corners[i], corners[(i + 1) % 4]);
	};
	for (const c of nearCorners) points.push(apex, c);
	addRing(nearCorners);
	addRing(farCorners);
	for (let i = 0; i < 4; i++) points.push(nearCorners[i], farCorners[i]);

	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	const material = new THREE.LineBasicMaterial({ color: 0xffaa00 });
	group.add(new THREE.LineSegments(geometry, material));
	return group;
}

/** Fields needed to place a saved Camera's frustum in the viewer. */
export interface CameraPlacement {
	name: string;
	/** 'world' or a system's flange link name. */
	parent: string;
	/** Owning system name, only meaningful when `parent` isn't 'world'. */
	systemName: string | null;
	position: [number, number, number];
	quaternion: [number, number, number, number];
	farWidth: number;
	farHeight: number;
	farDistance: number;
	nearDistance: number;
}

/**
 * Build a camera's frustum group and add it to the viewer at its local pose
 * relative to its parent frame. For a flange-parented (in-hand) camera, the
 * group is added as a scene-graph child of that flange's link, via
 * `addGroup`'s parenting args, so it inherits the flange's transform on
 * every subsequent joint update instead of being baked to a one-time world
 * pose. Shared by both the live create/edit flow and workcell-load
 * restoration.
 */
export function placeCameraFrustum(
	camera: CameraPlacement,
	addGroup: (name: string, group: THREE.Group, parentSystemName?: string, parentLinkName?: string) => void,
): void {
	const group = buildCameraFrustumGroup({
		farWidth: camera.farWidth,
		farHeight: camera.farHeight,
		farDistance: camera.farDistance,
		nearDistance: camera.nearDistance,
	});

	group.position.fromArray(camera.position);
	group.quaternion.fromArray(camera.quaternion);

	if (camera.parent !== 'world' && camera.systemName) {
		addGroup(camera.name, group, camera.systemName, camera.parent);
	} else {
		addGroup(camera.name, group);
	}
}

export async function loadURDFFromUrl(url: string, baseDir?: string): Promise<THREE.Group> {
	const { links, joints, resolveMeshUrl } = await fetchAndParseUrdf(url, baseDir);
	const worldTransforms = computeLinkTransforms(joints);
	const visualsByLink = groupVisualsByLink(links);

	const group = new THREE.Group();
	group.name = `urdf-${url}`;
	group.userData['joints'] = joints;

	let tcpLinkGroup: THREE.Group | null = null;

	for (const [linkName, worldTf] of worldTransforms) {
		const visuals = visualsByLink.get(linkName);
		const isTcpLink = /\.(tcp|flange)\b/i.test(linkName);

		// Skip links with no visuals unless they are a TCP / flange link
		if ((!visuals || visuals.length === 0) && !isTcpLink) continue;

		const linkGroup = new THREE.Group();
		linkGroup.name = linkName;
		linkGroup.position.fromArray(worldTf.position);
		linkGroup.quaternion.fromArray(worldTf.quaternion);

		if (visuals) {
			await addVisualsToLinkGroup(linkGroup, visuals, resolveMeshUrl);
		}

		// Always add TCP/flange links to the scene even if they have no visuals
		if (linkGroup.children.length > 0 || isTcpLink) {
			group.add(linkGroup);
		}

		if (isTcpLink) tcpLinkGroup = linkGroup;
	}

	if (tcpLinkGroup) {
		tcpLinkGroup.add(new THREE.AxesHelper(0.15));
	}

	return group;
}

/**
 * Fetch and parse a scene-object URDF, returning each link as an individual
 * named group rather than one combined hierarchy.
 */
export async function loadSceneObjectURDFFromUrl(
	url: string,
	baseDir?: string,
): Promise<{ name: string; group: THREE.Group; visualType: 'primitive' | 'mesh'; parentLinkName?: string }[]> {
	const { links, joints, resolveMeshUrl } = await fetchAndParseUrdf(url, baseDir);
	const worldTransforms = computeLinkTransforms(joints);
	const visualsByLink = groupVisualsByLink(links);

	// Build child→joint map for per-link ancestry tracing.
	const jointByChild = new Map(joints.map(j => [j.child, j]));

	// Walk a link's joint chain upward; return the externalParent name if any ancestor
	// joint was declared with <parent_external> (i.e. it attaches to a system link).
	function findExternalRoot(linkName: string): string | undefined {
		let current = linkName;
		while (true) {
			const joint = jointByChild.get(current);
			if (!joint) return undefined;
			if (joint.externalParent) return joint.externalParent;
			current = joint.parent;
		}
	}

	// Determine visual type per link: 'mesh' if any visual uses a mesh geometry, else 'primitive'
	const typeByLink = new Map<string, 'primitive' | 'mesh'>();
	for (const link of links) {
		if (link.geometry.type === 'mesh') {
			typeByLink.set(link.linkName, 'mesh');
		} else if (!typeByLink.has(link.linkName)) {
			typeByLink.set(link.linkName, 'primitive');
		}
	}

	const objects: { name: string; group: THREE.Group; visualType: 'primitive' | 'mesh'; parentLinkName?: string }[] = [];

	for (const [linkName, worldTf] of worldTransforms) {
		const visuals = visualsByLink.get(linkName);
		if (!visuals || visuals.length === 0) continue;

		const linkGroup = new THREE.Group();
		linkGroup.name = linkName;
		linkGroup.position.fromArray(worldTf.position);
		linkGroup.quaternion.fromArray(worldTf.quaternion);

		await addVisualsToLinkGroup(linkGroup, visuals, resolveMeshUrl);

		if (linkGroup.children.length > 0) {
			objects.push({
				name: linkName,
				group: linkGroup,
				visualType: typeByLink.get(linkName) || 'mesh',
				parentLinkName: findExternalRoot(linkName),
			});
		}
	}

	return objects;
}

// ── Visual Builder Helpers ───────────────────────────────────────────

async function addVisualsToLinkGroup(
	linkGroup: THREE.Group,
	visuals: UrdfVisualData[],
	resolveMeshUrl: (filename: string) => string | null
) {
	for (const visual of visuals) {
		const visualGroup = new THREE.Group();
		visualGroup.position.fromArray(visual.position);
		visualGroup.rotation.set(visual.rotation[0], visual.rotation[1], visual.rotation[2], 'XYZ');

		if (visual.geometry.type === 'mesh') {
			visualGroup.scale.fromArray(visual.geometry.scale);
			const meshUrl = resolveMeshUrl(visual.geometry.meshUrl) ?? visual.geometry.meshUrl;
			await loadMeshVisual(visualGroup, meshUrl, visual.color, visual.geometry.scale);
		} else {
			addPrimitiveVisual(visualGroup, visual);
		}

		if (visualGroup.children.length > 0) linkGroup.add(visualGroup);
	}
}

async function loadMeshVisual(
	group: THREE.Group,
	url: string,
	color?: [number, number, number, number],
	scale?: [number, number, number],
): Promise<void> {
	try {
		const ext = url.split('.').pop()?.toLowerCase() || '';
		if (ext === 'stl') {
			const geometry = await _stlLoader.loadAsync(url);
			const mesh = new THREE.Mesh(geometry, createVisualMaterial(color));
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			group.add(mesh);
		} else if (ext === 'obj') {
			// Derive material URLs and try to load one (.mtl first, .mat fallback)
			const materialUrls = deriveMaterialUrls(url);
			let objGroup: THREE.Group;
			const materials = materialUrls.length > 0 ? await tryLoadMaterials(materialUrls) : null;
			if (materials) {
				const objLoader = new OBJLoader();
				objLoader.setMaterials(materials);
				objGroup = await objLoader.loadAsync(url);
			} else {
				objGroup = await _objLoader.loadAsync(url);
			}
			objGroup.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					child.castShadow = true;
					child.receiveShadow = true;
					const hasVertexColors = (child.geometry as THREE.BufferGeometry).hasAttribute('color');
					if (hasVertexColors) {
						child.material = new THREE.MeshStandardMaterial({
							vertexColors: true,
							roughness: 0.70,
							metalness: 0.15,
						});
					} else if (color) {
						(child.material as THREE.MeshStandardMaterial).color.setRGB(color[0], color[1], color[2]);
						if (color[3] < 1) {
							child.material.transparent = true;
							child.material.opacity = color[3];
						}
					}
				}
			});
			group.add(objGroup);
		}
	} catch (error) {
		console.warn(`Failed to load mesh visual: ${url}`, error);
	}
}

function createVisualMaterial(color?: [number, number, number, number]): THREE.MeshStandardMaterial {
	const opacity = color?.[3] ?? 1;
	return new THREE.MeshStandardMaterial({
		color: color ? new THREE.Color(color[0], color[1], color[2]) : 0xc0b8a8,
		roughness: 0.70,
		metalness: 0.15,
		transparent: opacity < 1,
		opacity,
	});
}

function addPrimitiveVisual(group: THREE.Group, visual: UrdfVisualData): void {
	const material = createVisualMaterial(visual.color);
	let mesh: THREE.Mesh | null = null;

	if (visual.geometry.type === 'box') {
		mesh = new THREE.Mesh(new THREE.BoxGeometry(...visual.geometry.size), material);
	} else if (visual.geometry.type === 'cylinder') {
		mesh = new THREE.Mesh(new THREE.CylinderGeometry(visual.geometry.radius, visual.geometry.radius, visual.geometry.length, 32), material);
		mesh.rotation.x = Math.PI / 2;
	} else if (visual.geometry.type === 'sphere') {
		mesh = new THREE.Mesh(new THREE.SphereGeometry(visual.geometry.radius, 32, 16), material);
	}

	if (mesh) {
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add(mesh);
	}
}
