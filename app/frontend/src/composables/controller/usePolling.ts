import { ref, onUnmounted } from 'vue';
import { apiGet } from '../../services/api';
import { setConnectionChangeHandler } from '../useWorkcell';

const POLL_INTERVAL_MS = 100;

// ── usePolling ────────────────────────────────────────────────────────
// Owns the joint-angle (and TCP-pose) polling loop. Starts when connected
// systems are present, stops when the list empties, and can pause a single
// system (used while the target-trajectory setup wizard is open for that
// system).

export function usePolling(
	getConnectedSystems: () => string[],
	onAngles: (sysName: string, angles: Record<string, number>) => void,
	onPose?: (
		sysName: string,
		position: [number, number, number],
		quaternion: [number, number, number, number],
	) => void,
): {
	startPolling(): void;
	stopPolling(): void;
	pauseSystem(name: string | null): void;
} {
	const pollTimer = ref<ReturnType<typeof setInterval> | null>(null);
	const pollActive = ref(false);
	let _pausedSystemName: string | null = null;

	function pauseSystem(name: string | null): void {
		_pausedSystemName = name;
	}

	function _tick(): void {
		for (const sysName of getConnectedSystems()) {
			if (sysName === _pausedSystemName) continue;
			apiGet<Record<string, number>>(
				`/api/systems/${encodeURIComponent(sysName)}/joint-angles`,
			)
				.then((angles) => {
					if (Object.keys(angles).length > 0) {
						onAngles(sysName, angles);
					}
				})
				.catch(() => {
					// system may not have data yet — skip silently
				});

			if (!onPose) continue;
			apiGet<{ tcpPose: number[] }>(
				`/api/systems/${encodeURIComponent(sysName)}/tcp-pose`,
			)
				.then(({ tcpPose }) => {
					// Backend order is [x, y, z, qw, qx, qy, qz]; three.js
					// quaternions are [x, y, z, w].
					if (tcpPose?.length === 7) {
						const [x, y, z, qw, qx, qy, qz] = tcpPose;
						onPose(sysName, [x, y, z], [qx, qy, qz, qw]);
					}
				})
				.catch(() => {
					// system may not have data yet — skip silently
				});
		}
	}

	function startPolling(): void {
		if (pollActive.value) return;
		pollActive.value = true;
		console.debug('[poll] starting joint-angle poll loop');
		pollTimer.value = setInterval(_tick, POLL_INTERVAL_MS);
	}

	function stopPolling(): void {
		if (!pollActive.value) return;
		pollActive.value = false;
		console.debug('[poll] stopping joint-angle poll loop');
		if (pollTimer.value) {
			clearInterval(pollTimer.value);
			pollTimer.value = null;
		}
	}

	function _onConnectionChanged(): void {
		if (getConnectedSystems().length > 0) {
			startPolling();
		} else {
			stopPolling();
		}
	}

	setConnectionChangeHandler(_onConnectionChanged);

	onUnmounted(() => {
		setConnectionChangeHandler(null);
		stopPolling();
	});

	return { startPolling, stopPolling, pauseSystem };
}
