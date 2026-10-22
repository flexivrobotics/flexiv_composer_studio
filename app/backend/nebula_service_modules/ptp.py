from .collision import DEFAULT_COLLISION_CONFIG_NAME


class PointToPointService:
    """Point-to-point path planning methods."""

    def list_ptp_paths(self):
        """List names of all saved PTP paths from the config service."""
        print("Trying to list PTP paths from the config service...")

        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.ListConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_P2P_PATH,
        )
        with self._create_client() as client:
            response = client.config.stub.List(request)
        self._check_status(response, "List PTP paths")
        
        return list(getattr(response, "names", []))

    def get_ptp_path(self, name):
        """Retrieve a PTP path by name and return its system name."""
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.TypeNameConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_P2P_PATH,
            name=name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(request)
        self._check_status(response, "Get PTP path")

        path = response.p2p_path

        system_name = ""
        # Try direct field first, then header parent (Nebula convention)
        if hasattr(path, "system_name") and path.system_name:
            system_name = path.system_name
        elif hasattr(path, "header") and hasattr(path.header, "parent"):
            system_name = path.header.parent or ""

        joint_waypoints = [
            list(wp.position)
            for wp in getattr(path, "joint_waypoints", [])
        ]

        return {
            "name": name,
            "systemName": system_name,
            "jointWaypoints": joint_waypoints,
        }

    def delete_ptp_path(self, name):
        """Remove a saved PTP path from the config service."""
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.TypeNameConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_P2P_PATH,
            name=name,
        )
        with self._create_client() as client:
            response = client.config.stub.Remove(request)
        code, msg = self._check_status(response, "Delete PTP path")
        return {"message": f"Removed PTP path '{name}'.", "status": {"code": code, "message": msg}}

    def plan_ptp_path(self, path_name, system_name, target_names, collision_margin=None):
        """Plan a point-to-point path directly from saved target (system pose)
        names — the server resolves each target's joint angles itself via
        ``PTPTargetWaypoints``, so no per-target lookup is needed here.

        Parameters
        ----------
        path_name : str
            Unique name for the planned path.
        system_name : str
            Name of the system that will execute the path.
        target_names : list[str]
            Ordered list of target (system pose) names to visit.  At least 2
            targets are required.
        collision_margin : float, optional
            Minimum clearance distance (m) to the closest collision object.
            Persisted into the referenced collision config before planning;
            left unchanged if not given.
        """
        if len(target_names) < 2:
            raise ValueError(
                "At least 2 targets are required to plan a PTP path."
            )

        if collision_margin is not None:
            self.update_default_collision_config(collision_margin=collision_margin)

        ptp_service_pb2 = self._get_module(
            "flexiv.pdk.point_to_point_path.service_pb2"
        )

        request = ptp_service_pb2.PointToPointPathRequest(
            path_name=path_name,
            collision_config_name=DEFAULT_COLLISION_CONFIG_NAME,
            target_waypoints=ptp_service_pb2.PTPTargetWaypoints(
                target_waypoint_names=list(target_names),
            ),
        )

        with self._create_client() as client:
            response = client.point_to_point_path.stub.Plan(request)
        code, msg = self._check_status(response, "PTP path planning")

        return {
            "message": f"Planned PTP path '{path_name}' for system '{system_name}'.",
            "status": {"code": code, "message": msg},
            "pathName": path_name,
            "systemName": system_name,
            "collisionConfigName": DEFAULT_COLLISION_CONFIG_NAME,
            "waypointCount": len(target_names),
        }

    def plan_ptp_motion(self, system_name, current_joint_angles, target_joint_angles_list, path_name=None):
        """Plan a point-to-point motion from the robot's current joints through
        an ordered list of target waypoints, in one go.

        Unlike ``plan_ptp_path`` (which references saved target names), this
        accepts raw joint-angle waypoints directly, since the start pose for
        a live motion is the robot's current state rather than a named target.

        Parameters
        ----------
        system_name : str
            Name of the system that will execute the motion.
        current_joint_angles : list[float]
            The robot's current joint angles, used as the start waypoint.
        target_joint_angles_list : list[list[float]]
            Ordered joint-angle waypoints to visit after the start waypoint.
        path_name : str, optional
            Name for the planned path. Defaults to ``"<system_name>.ptp_motion"``.
        """
        path_name = path_name or f"{system_name}.ptp_motion"
        return self._plan_ptp_joint_waypoints(
            path_name, system_name, [current_joint_angles, *target_joint_angles_list]
        )

    def _plan_ptp_joint_waypoints(self, path_name, system_name, angle_waypoints):
        """Shared planning call: send joint-angle waypoints to the Plan RPC."""
        ptp_service_pb2 = self._get_module(
            "flexiv.pdk.point_to_point_path.service_pb2"
        )
        waypoint_pb2 = self._get_module("flexiv.pdk.spatial.waypoint_pb2")

        # Derive TCP name from system info: <system>.<manipulator>.flange
        info = self.get_system_info(system_name)
        manip_name = (info.get("manipulator") or {}).get("name") or "arm"
        tcp_name = f"{system_name}.{manip_name}.flange"

        joint_waypoints = [
            waypoint_pb2.JointWaypoint(position=[float(v) for v in angles])
            for angles in angle_waypoints
        ]

        request = ptp_service_pb2.PointToPointPathRequest(
            path_name=path_name,
            collision_config_name=DEFAULT_COLLISION_CONFIG_NAME,
            joint_waypoints=ptp_service_pb2.PTPJointWaypoints(
                system_name=system_name,
                tcp_name=tcp_name,
                joint_waypoints=joint_waypoints,
            ),
        )

        with self._create_client() as client:
            response = client.point_to_point_path.stub.Plan(request)
        code, msg = self._check_status(response, "PTP path planning")

        return {
            "message": f"Planned PTP path '{path_name}' for system '{system_name}'.",
            "status": {"code": code, "message": msg},
            "pathName": path_name,
            "systemName": system_name,
            "tcpName": tcp_name,
            "collisionConfigName": DEFAULT_COLLISION_CONFIG_NAME,
            "waypointCount": len(joint_waypoints),
        }
