"""Robot hardware connection & joint-angle polling singleton.

Owns :class:`flexivrdk.Robot` instances, a background poll thread, and
the latest-joint-angles cache.  A module-level singleton (``connections``)
is used so that robot state persists across per-request ``NebulaServices``
instances.
"""

import threading
import time


_POLL_INTERVAL_S = 0.1


class RobotConnectionManager:
    """Manages physical robot connections and real-time joint-angle polling."""

    def __init__(self) -> None:
        self._robots: dict[str, "flexivrdk.Robot"] = {}
        self._poll_thread: threading.Thread | None = None
        self._poll_stop = threading.Event()

        self._latest_joint_angles: dict[str, dict[str, float]] = {}
        self._angles_lock = threading.Lock()

        # tcp_pose is [x, y, z, qw, qx, qy, qz], w.r.t. the world frame.
        self._latest_tcp_pose: dict[str, list[float]] = {}
        self._pose_lock = threading.Lock()

        self._joint_names: dict[str, list[str]] = {}
        self._names_lock = threading.Lock()

    # ── Public API ──────────────────────────────────────────────────────

    def connect(
        self,
        system_name: str,
        robot_sn: str,
        joint_names: list[str] | None = None,
        expected_tool_name: str | None = None,
    ) -> dict:
        """Connect to a physical robot and start the joint-angle poll loop.

        Args:
            system_name: Logical system name (used as cache key).
            robot_sn: Hardware serial number passed to ``flexivrdk.Robot()``.
            joint_names: URDF joint names, used to name the flat angle array
                         from ``robot.states().q``.  Falls back to generic
                         ``joint1``… keys if absent.
            expected_tool_name: Tool name configured for this system in
                         Nebula. If set, the connection is rejected unless it
                         matches the tool actually mounted on the hardware.

        Returns:
            ``{connected: bool, system: str, robot_sn: str, message: str}``
        """
        if system_name in self._robots:
            return {
                "connected": True,
                "system": system_name,
                "robot_sn": robot_sn,
                "message": f"Already connected to {robot_sn}.",
            }

        def failed(message: str) -> dict:
            return {
                "connected": False,
                "system": system_name,
                "robot_sn": robot_sn,
                "message": message,
            }

        robot = None
        enabled = False
        try:
            import flexivrdk  # lazy import — only needed when connecting

            robot = flexivrdk.Robot(robot_sn)

            if robot.fault():
                if not robot.ClearFault():
                    return failed("Robot fault could not be cleared.")

            # Check the tool before enabling, so a mismatch leaves the robot
            # as it was. Reading the tool name needs no enabled robot.
            if expected_tool_name:
                try:
                    mounted_tool_name = flexivrdk.Tool(robot).name()
                except Exception as exc:
                    return failed(f"Could not read mounted tool name: {exc}")
                if mounted_tool_name != expected_tool_name:
                    return failed(
                        f"Tool mismatch: hardware has"
                        f" '{mounted_tool_name}' mounted, but system"
                        f" '{system_name}' is configured for tool"
                        f" '{expected_tool_name}'."
                    )

            robot.Enable()
            enabled = True
            timeout = 10
            start = time.monotonic()
            while not robot.operational():
                time.sleep(0.5)
                if time.monotonic() - start > timeout:
                    self._stop_robot(robot)
                    return failed(
                        "Timed out waiting for robot to become operational."
                    )

            # LockExternalAxes requires IDLE mode
            if robot.mode() != flexivrdk.Mode.IDLE:
                robot.SwitchMode(flexivrdk.Mode.IDLE)

            # Set external axis lock to false
            robot.LockExternalAxes(False)

            # Register only a fully set-up robot, so a failed connection is
            # never polled or reported as connected.
            self._robots[system_name] = robot
            if joint_names:
                with self._names_lock:
                    self._joint_names[system_name] = list(joint_names)
            self._start_poll_loop()

            print(
                f"Successfully connected to robot with serial number:"
                f" {robot_sn}"
            )
            return {
                "connected": True,
                "system": system_name,
                "robot_sn": robot_sn,
                "message": f"Connected to {robot_sn}.",
            }

        except Exception as exc:
            print(
                f"Error connecting to robot with serial number"
                f" '{robot_sn}': {exc}"
            )
            if robot is not None and enabled:
                self._stop_robot(robot)
            return failed(f"Connection failed: {exc}")

    def disconnect(self, system_name: str) -> dict:
        """Close the connection to *system_name*'s robot.

        The robot is left as it is: in IDLE mode, and still enabled. Returns
        ``{connected: False, system: str, message: str}``; disconnecting a
        system that is not connected is not an error.
        """
        robot = self._robots.pop(system_name, None)
        with self._angles_lock:
            self._latest_joint_angles.pop(system_name, None)
        with self._pose_lock:
            self._latest_tcp_pose.pop(system_name, None)
        with self._names_lock:
            self._joint_names.pop(system_name, None)
        if not self._robots:
            self._stop_poll_loop()

        if robot is None:
            return {
                "connected": False,
                "system": system_name,
                "message": f"System '{system_name}' is not connected.",
            }
        # Dropping the last reference closes the RDK connection.
        del robot
        print(f"Disconnected from robot of system '{system_name}'")
        return {
            "connected": False,
            "system": system_name,
            "message": f"Disconnected from system '{system_name}'.",
        }

    def disconnect_all(self) -> list[str]:
        """Close every robot connection. Returns the disconnected system names."""
        names = list(self._robots)
        for name in names:
            self.disconnect(name)
        return names

    def get_robot(self, system_name: str):
        """Return the ``flexivrdk.Robot`` for *system_name*, or None."""
        return self._robots.get(system_name)

    def is_connected(self, system_name: str) -> bool:
        """Return True if *system_name* has an active robot connection."""
        return system_name in self._robots

    def get_joint_angles(self, system_name: str) -> dict[str, float]:
        """Return the latest cached joint angles for *system_name*.

        Returns an empty dict if no data has been received yet.
        """
        with self._angles_lock:
            return dict(self._latest_joint_angles.get(system_name, {}))

    def get_tcp_pose(self, system_name: str) -> list[float]:
        """Return the latest cached TCP pose for *system_name*.

        ``[x, y, z, qw, qx, qy, qz]`` w.r.t. the world frame, or an empty
        list if no data has been received yet.
        """
        with self._pose_lock:
            return list(self._latest_tcp_pose.get(system_name, []))

    @staticmethod
    def _stop_robot(robot) -> None:
        """Best-effort stop of a robot whose connection failed after Enable().

        The RDK has no call to disable a robot, so it stays enabled, but
        stopped and in IDLE mode.
        """
        try:
            robot.Stop()
        except Exception as exc:
            print(f"Could not stop robot after a failed connection: {exc}")

    # ── Poll loop ──────────────────────────────────────────────────────

    def _poll_loop(self) -> None:
        """Background thread: read joint angles and TCP pose from all
        connected robots."""
        while not self._poll_stop.is_set():
            for sys_name, robot in list(self._robots.items()):
                try:
                    states = robot.states()
                except Exception:
                    continue

                q = states.q
                with self._names_lock:
                    names = self._joint_names.get(sys_name, [])
                if not names or len(names) != len(q):
                    with self._angles_lock:
                        self._latest_joint_angles[sys_name] = {
                            f"joint{i + 1}": float(q[i]) for i in range(len(q))
                        }
                else:
                    with self._angles_lock:
                        self._latest_joint_angles[sys_name] = {
                            names[i]: float(q[i]) for i in range(len(q))
                        }

                try:
                    tcp_pose = [float(v) for v in states.tcp_pose]
                except Exception:
                    tcp_pose = []
                with self._pose_lock:
                    self._latest_tcp_pose[sys_name] = tcp_pose
            self._poll_stop.wait(_POLL_INTERVAL_S)

    def _start_poll_loop(self) -> None:
        """Start the polling thread if it is not already running."""
        if self._poll_thread is not None and self._poll_thread.is_alive():
            return
        self._poll_stop.clear()
        self._poll_thread = threading.Thread(
            target=self._poll_loop, daemon=True, name="joint-poller"
        )
        self._poll_thread.start()

    def _stop_poll_loop(self) -> None:
        """Signal the polling thread to stop and wait for it to exit."""
        self._poll_stop.set()
        if self._poll_thread is not None:
            self._poll_thread.join(timeout=2)
            self._poll_thread = None


# Module-level singleton — one manager shared across all requests.
connections = RobotConnectionManager()
