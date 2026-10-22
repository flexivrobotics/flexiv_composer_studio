import time

from .utils import local_to_world_pose, local_to_world_point, world_to_local_point, world_rotation_to_local


class ToolpathService:
    """Surface finish and toolpath methods."""

    def _get_parent_pose(self, parent_object_name):
        """Resolve a scene object's world pose ({position, quaternion} dicts
        keyed x/y/z/w), or None if it can't be resolved (e.g. no parent, or
        not a saved scene object)."""
        if not parent_object_name:
            return None
        try:
            parent_pose = self.get_scene_object_pose(parent_object_name)
        except Exception as e:
            print(f"Warning: could not resolve pose of parent object '{parent_object_name}': {e}")
            return None
        px, py, pz = parent_pose["position"]
        pqx, pqy, pqz, pqw = parent_pose["quaternion"]
        return {"x": px, "y": py, "z": pz}, {"x": pqx, "y": pqy, "z": pqz, "w": pqw}

    def _to_world_entries(self, parent_object_name, entries):
        """Convert a list of {position, rotation} entries — as returned by
        GenerateNominalPath/GenerateNominalPathRequest, which are relative to
        the path's parent object — into world frame, e.g. for immediate
        preview rendering or for display/editing via get_toolpath. Returns
        ``entries`` unchanged if the parent's pose cannot be resolved."""
        if not entries:
            return entries
        parent_pose = self._get_parent_pose(parent_object_name)
        if parent_pose is None:
            return entries
        parent_position, parent_quaternion = parent_pose

        world_entries = []
        for entry in entries:
            pos = entry.get("position", {"x": 0.0, "y": 0.0, "z": 0.0})
            rot = entry.get("rotation", {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0})
            world_pos, world_rot = local_to_world_pose(parent_position, parent_quaternion, pos, rot)
            world_entries.append({"position": world_pos, "rotation": world_rot})
        return world_entries

    def _to_world_points(self, parent_object_name, points):
        """Convert a list of flat {x, y, z} points — relative to the path's
        parent object — into world frame. Returns ``points`` unchanged if the
        parent's pose cannot be resolved."""
        if not points:
            return points
        parent_pose = self._get_parent_pose(parent_object_name)
        if parent_pose is None:
            return points
        parent_position, parent_quaternion = parent_pose
        return [local_to_world_point(parent_position, parent_quaternion, pt) for pt in points]

    def _to_local_sketch_points(self, parent_object_name, points):
        """Convert a list of flat {x, y, z} points from world frame into
        ``parent_object_name``'s local frame, e.g. before sending sketch
        points to GenerateNominalPath (which expects points relative to the
        path's parent). Returns ``points`` unchanged if the parent's pose
        cannot be resolved.

        Named distinctly from SceneObjectService's own _to_local_points:
        NebulaServices mixes both classes in, so two identically-named
        methods would silently collide via MRO — only one would ever run.
        """
        if not points:
            return points
        parent_pose = self._get_parent_pose(parent_object_name)
        if parent_pose is None:
            return points
        parent_position, parent_quaternion = parent_pose
        return [world_to_local_point(parent_position, parent_quaternion, pt) for pt in points]

    def _get_surface_path(self, name):
        """Fetch a CONFIG_TYPE_SURFACE_PATH by name from Nebula.

        Returns (path_data, code, msg); path_data is None if not found.
        """
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        get_req = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH,
            name=name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(get_req)
        code, msg = self._check_status(response, "Get surface path")
        return getattr(response, "surface_path", None), code, msg

    def _list_surface_path_names(self):
        """List the names of all CONFIG_TYPE_SURFACE_PATH configs in Nebula —
        both raw/unsolved toolpaths and solved linear trajectories."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        list_req = config_pb2.ListConfigRequest(type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH)
        with self._create_client() as client:
            list_resp = client.config.stub.List(list_req)
        self._check_status(list_resp, "List surface paths")
        return list(getattr(list_resp, "names", []))

    def list_all_surface_path_names(self):
        """List every CONFIG_TYPE_SURFACE_PATH name in Nebula, toolpaths and
        trajectories alike. Toolpaths and trajectories share one Nebula
        namespace, so this is what a new name must be checked against to
        avoid a collision — checking only toolpath names (or only trajectory
        names) would miss a clash with the other kind."""
        return self._list_surface_path_names()

    @staticmethod
    def _surface_path_system_name(path_data):
        """The system name from a surface path's solver_preferences, or '' if unset.

        A linear path trajectory and a raw/unsolved toolpath are both stored as
        CONFIG_TYPE_SURFACE_PATH; they're told apart by this field — it's only
        set once CreateRobotMotion has solved the path for a system (see
        create_linear_path_trajectory), so an empty system name means the path
        is still just a toolpath.
        """
        solver_preferences = getattr(path_data, "solver_preferences", None)
        return getattr(solver_preferences, "system_name", "") or ""

    def generate_toolpath_between_points(
        self,
        parent_object_name,
        from_point,
        to_point,
        fixed_spacing,
    ):
        """Generate intermediate cartesian waypoints between two points on an object mesh."""
        import uuid

        surface_finish_pb2 = self._get_module("flexiv.pdk.surface_finish.service_pb2")
        config_header_pb2 = self._get_module("flexiv.pdk.config_header_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        mesh_sketch_path_pb2 = self._get_module(
            "flexiv.pdk.surface_finish.generator.mesh_sketch_path_pb2"
        )

        path_name = f"_temp_path_{uuid.uuid4().hex[:8]}"

        # GenerateNominalPath expects sketch points relative to the parent
        # object, not world; from_point/to_point arrive in world frame.
        local_from, local_to = self._to_local_sketch_points(parent_object_name, [
            {"x": from_point[0], "y": from_point[1], "z": from_point[2]},
            {"x": to_point[0], "y": to_point[1], "z": to_point[2]},
        ])

        req = surface_finish_pb2.GenerateNominalPathRequest(
            header=config_header_pb2.ConfigHeader(
                name=path_name,
                parent=parent_object_name,
            ),
            mesh_sketch_path=mesh_sketch_path_pb2.MeshSketchPath(
                points=[
                    geometry_pb2.Vector3(x=local_from["x"], y=local_from["y"], z=local_from["z"]),
                    geometry_pb2.Vector3(x=local_to["x"], y=local_to["y"], z=local_to["z"]),
                ],
                blending_radius=0,
                fixed_spacing=fixed_spacing,
            ),
        )
        with self._create_client() as client:
            gen_response = client.surface_finish.stub.GenerateNominalPath(req)
        code, msg = self._check_status(gen_response, "Toolpath generation")

        # The server assigns the actual path name — read it from path_names.
        generated_names = list(getattr(gen_response, "path_names", []))
        actual_path_name = generated_names[0] if generated_names else path_name

        # Retrieve the path config to get Cartesian waypoints.
        get_req = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH,
            name=actual_path_name,
        )
        with self._create_client() as client:
            path_config = client.config.stub.Get(get_req)
        code, msg = self._check_status(path_config, "Get toolpath")

        intermediate = []
        path_data = getattr(path_config, "surface_path", None)
        if path_data is not None:
            for wp in getattr(path_data, "nominal_cartesian", []):
                pose = getattr(wp, "pose", None)
                if pose is None:
                    continue
                pos = getattr(pose, "position", None)
                if pos is None:
                    continue
                intermediate.append({"x": pos.x, "y": pos.y, "z": pos.z})

        # Delete the temp path from Nebula immediately — caller no longer needs to.
        try:
            remove_req = config_pb2.TypeNameConfigRequest(
                type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH,
                name=actual_path_name,
            )
            with self._create_client() as client:
                client.config.stub.Remove(remove_req)
        except Exception:
            pass

        return {
            # nominal_cartesian from GenerateNominalPath is relative to the
            # path's parent object; convert to world for immediate preview.
            "intermediatePoints": self._to_world_points(parent_object_name, intermediate),
            "status": {"code": code, "message": msg},
        }

    def generate_toolpath_from_points(
        self,
        parent_object_name,
        path_name_ref,
        points,
        blending_radius,
        fixed_spacing,
        workcell_name='',
        flag_auto_name=True,
        orientation_alignment_type='initial_direction',
        orientation_alignment_direction=None,
    ):
        """Generate a complete toolpath through all given points on an object mesh."""
        surface_finish_pb2 = self._get_module("flexiv.pdk.surface_finish.service_pb2")
        config_header_pb2 = self._get_module("flexiv.pdk.config_header_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        mesh_sketch_path_pb2 = self._get_module(
            "flexiv.pdk.surface_finish.generator.mesh_sketch_path_pb2"
        )

        # Toolpaths and trajectories share one Nebula namespace (both are
        # CONFIG_TYPE_SURFACE_PATH), so check against every existing name —
        # not just toolpaths — to avoid colliding with a saved trajectory.
        path_names = self._list_surface_path_names()

        path_name = path_name_ref
        if (flag_auto_name):
            counter = 1
            while True:
                path_name = f"{path_name_ref}_{counter}"
                counter += 1
                if path_name not in path_names:
                    break
        else:
            if (path_name in path_names):
                return {
                    "pathName": path_name,
                    "CartesianWaypoints": [],
                    "status": {
                        "code": 1,
                        "message": f"Path name '{path_name}' already exists.",
                    },
                }

        # GenerateNominalPath expects sketch points relative to the parent
        # object, not world; `points` arrives in world frame.
        local_points = self._to_local_sketch_points(parent_object_name, points)
        proto_points = []
        for pt in local_points:
            proto_points.append(geometry_pb2.Vector3(x=pt["x"], y=pt["y"], z=pt["z"]))

        if orientation_alignment_direction is None:
            orientation_alignment_direction = {"x": 1.0, "y": 0.0, "z": 0.0}

        sketch_kwargs = dict(
            points=proto_points,
            blending_radius=blending_radius,
            fixed_spacing=fixed_spacing,
        )
        if orientation_alignment_type == "initial_direction":
            sketch_kwargs["align_with_initial_direction"] = True
        elif orientation_alignment_type == "previous":
            sketch_kwargs["align_with_previous"] = True
        elif orientation_alignment_type == "direction":
            sketch_kwargs["align_with_direction"] = geometry_pb2.Vector3(
                x=orientation_alignment_direction["x"],
                y=orientation_alignment_direction["y"],
                z=orientation_alignment_direction["z"],
            )

        req = surface_finish_pb2.GenerateNominalPathRequest(
            header=config_header_pb2.ConfigHeader(
                name=path_name,
                parent=parent_object_name,
            ),
            mesh_sketch_path=mesh_sketch_path_pb2.MeshSketchPath(**sketch_kwargs),
        )
        with self._create_client() as client:
            gen_response = client.surface_finish.stub.GenerateNominalPath(req)
        code, msg = self._check_status(gen_response, "Toolpath generation")

        # The server assigns the actual path name — read it from path_names.
        generated_names = list(getattr(gen_response, "path_names", []))
        actual_path_name = generated_names[0] if generated_names else path_name

        # Retrieve the path config to get Cartesian waypoints.
        get_req = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH,
            name=actual_path_name,
        )
        with self._create_client() as client:
            path_config = client.config.stub.Get(get_req)
        code, msg = self._check_status(path_config, "Get toolpath")

        cartesian = []
        path_data = getattr(path_config, "surface_path", None)
        if path_data is not None:
            for wp in getattr(path_data, "nominal_cartesian", []):
                pose = getattr(wp, "pose", None)
                if pose is None:
                    continue
                pos = getattr(pose, "position", None)
                rot = getattr(pose, "rotation", None)
                if pos is None:
                    continue
                entry = {"position": {"x": pos.x, "y": pos.y, "z": pos.z}}
                if rot is not None:
                    entry["rotation"] = {"x": rot.x, "y": rot.y, "z": rot.z, "w": rot.w}
                cartesian.append(entry)

        # The generated surface path is already persisted in Nebula (that's
        # what the Get above just read) — nothing further to save, and it's
        # kept there (rather than removed) so it can be read back later.

        return {
            "pathName": actual_path_name,
            # Convert to world for immediate preview rendering.
            "CartesianWaypoints": self._to_world_entries(parent_object_name, cartesian),
            "status": {"code": code, "message": msg},
        }

    def generate_raster_toolpath(
        self,
        parent_object_name,
        path_name_ref,
        fixed_spacing,
        blending_radius,
        border_offset,
        raster_line_spacing,
        raster_joining_threshold,
        direction_type,
        principal_rotation_angle,
        specified_direction,
        workcell_name='',
        orientation_alignment_type='initial_direction',
        orientation_alignment_direction=None,
        save_as_parent=None,
    ):
        """Generate a raster toolpath on a mesh (or area mesh) using MeshRasterPath.

        ``save_as_parent``, if given and different from ``parent_object_name``,
        re-parents each persisted generated path to it afterward by mutating
        its header and re-submitting it via ConfigService.Save. Used when
        ``parent_object_name`` is a throwaway object registered just to give
        the raster generator something to raster against (e.g. an extracted
        area's mesh), so the saved path ends up parented to the area's real
        parent instead.
        """
        surface_finish_pb2 = self._get_module("flexiv.pdk.surface_finish.service_pb2")
        config_header_pb2 = self._get_module("flexiv.pdk.config_header_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        mesh_raster_path_pb2 = self._get_module(
            "flexiv.pdk.surface_finish.generator.mesh_raster_path_pb2"
        )

        if orientation_alignment_direction is None:
            orientation_alignment_direction = {"x": 1.0, "y": 0.0, "z": 0.0}

        raster_kwargs = dict(
            fixed_spacing=fixed_spacing,
            blending_radius=blending_radius,
            border_offset=border_offset,
            raster_line_spacing=raster_line_spacing,
            raster_path_joining_distance_threshold=raster_joining_threshold,
        )
        if direction_type == "specified":
            raster_kwargs["specified_direction"] = geometry_pb2.Vector3(
                x=specified_direction["x"],
                y=specified_direction["y"],
                z=specified_direction["z"],
            )
        else:
            raster_kwargs["principal_rotation_angle"] = principal_rotation_angle

        if orientation_alignment_type == "initial_direction":
            raster_kwargs["align_with_initial_direction"] = True
        elif orientation_alignment_type == "previous":
            raster_kwargs["align_with_previous"] = True
        elif orientation_alignment_type == "direction":
            raster_kwargs["align_with_direction"] = geometry_pb2.Vector3(
                x=orientation_alignment_direction["x"],
                y=orientation_alignment_direction["y"],
                z=orientation_alignment_direction["z"],
            )

        raster_path = mesh_raster_path_pb2.MeshRasterPath(**raster_kwargs)

        req = surface_finish_pb2.GenerateNominalPathRequest(
            header=config_header_pb2.ConfigHeader(
                name=path_name_ref,
                parent=parent_object_name,
            ),
            mesh_raster_path=raster_path,
        )

        with self._create_client() as client:
            gen_response = client.surface_finish.stub.GenerateNominalPath(req)
        code, msg = self._check_status(gen_response, "Raster toolpath generation")

        generated_names = list(getattr(gen_response, "path_names", []))

        paths = []
        for pname in generated_names:
            get_req = config_pb2.TypeNameConfigRequest(
                type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH,
                name=pname,
            )
            with self._create_client() as client:
                path_config = client.config.stub.Get(get_req)

            cartesian = []
            path_data = getattr(path_config, "surface_path", None)
            if path_data is not None:
                for wp in getattr(path_data, "nominal_cartesian", []):
                    pose = getattr(wp, "pose", None)
                    if pose is None:
                        continue
                    pos = getattr(pose, "position", None)
                    rot = getattr(pose, "rotation", None)
                    if pos is None:
                        continue
                    entry = {"position": {"x": pos.x, "y": pos.y, "z": pos.z}}
                    if rot is not None:
                        entry["rotation"] = {"x": rot.x, "y": rot.y, "z": rot.z, "w": rot.w}
                    cartesian.append(entry)

            if not workcell_name:
                # No workcell to persist into — this is a scratch/preview-only
                # call (e.g. live raster preview before saving), so discard
                # the generated surface path instead of leaving it in Nebula.
                try:
                    remove_req = config_pb2.TypeNameConfigRequest(
                        type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH,
                        name=pname,
                    )
                    with self._create_client() as client:
                        client.config.stub.Remove(remove_req)
                except Exception as e:
                    print(f"Warning: failed to remove raster path '{pname}' from Nebula: {e}")
            elif save_as_parent and save_as_parent != parent_object_name and path_data is not None:
                try:
                    path_data.header.parent = save_as_parent
                    with self._create_client() as client:
                        client.config.stub.Save(config_pb2.SaveConfigRequest(surface_path=path_data))
                except Exception as e:
                    print(f"Warning: failed to reparent raster path '{pname}' to '{save_as_parent}': {e}")

            # Convert to world for immediate preview rendering.
            paths.append({"pathName": pname, "CartesianWaypoints": self._to_world_entries(parent_object_name, cartesian)})

        return {
            "paths": paths,
            "status": {"code": code, "message": msg},
        }

    def update_toolpath_waypoints(self, path_name, cartesian_waypoints):
        """Overwrite the nominal_cartesian and refined_cartesian rotations of an
        existing toolpath's surface path in Nebula."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")

        path_data, _code, _msg = self._get_surface_path(path_name)
        if path_data is None:
            raise RuntimeError(f"Path '{path_name}' not found")

        parent_name = getattr(getattr(path_data, "header", None), "parent", "") or ""
        nominal = list(path_data.nominal_cartesian)
        refined = list(path_data.refined_cartesian)
        if len(nominal) != len(cartesian_waypoints):
            raise RuntimeError(
                f"Waypoint count mismatch: stored has {len(nominal)}, "
                f"client sent {len(cartesian_waypoints)}"
            )

        # Resolve the parent's pose once (it's the same for every waypoint)
        # instead of re-fetching it via gRPC on every iteration.
        parent_pose = self._get_parent_pose(parent_name)
        parent_quaternion = parent_pose[1] if parent_pose else None

        has_refined = len(refined) == len(cartesian_waypoints)
        for i, wp_data in enumerate(cartesian_waypoints):
            rot = wp_data.get("rotation")
            if rot is None:
                continue
            # Waypoints are round-tripped through the client in world frame
            # (see get_toolpath), but stored relative to the path's parent.
            local_rot = world_rotation_to_local(parent_quaternion, rot) if parent_quaternion else rot
            nominal[i].pose.rotation.x = local_rot["x"]
            nominal[i].pose.rotation.y = local_rot["y"]
            nominal[i].pose.rotation.z = local_rot["z"]
            nominal[i].pose.rotation.w = local_rot["w"]
            if has_refined:
                refined[i].pose.rotation.x = local_rot["x"]
                refined[i].pose.rotation.y = local_rot["y"]
                refined[i].pose.rotation.z = local_rot["z"]
                refined[i].pose.rotation.w = local_rot["w"]

        with self._create_client() as client:
            save_resp = client.config.stub.Save(config_pb2.SaveConfigRequest(surface_path=path_data))
        self._check_status(save_resp, "Update toolpath waypoints")

        return {
            "message": f"Updated waypoints for path '{path_name}'.",
            "status": {"code": 0, "message": "OK"},
        }

    def remove_toolpath(self, path_name):
        """Remove a toolpath: its surface path in Nebula."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        remove_req = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH,
            name=path_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Remove(remove_req)
        code, msg = self._check_status(response, "Remove toolpath")
        return {
            "message": f"Removed path '{path_name}'.",
            "status": {"code": code, "message": msg},
        }

    def list_toolpaths(self):
        """List names of raw, unsolved toolpaths.

        Toolpaths and linear trajectories are both stored as
        CONFIG_TYPE_SURFACE_PATH in Nebula; only entries whose
        solver_preferences.system_name is unset are toolpaths (see
        _surface_path_system_name) — trajectories are excluded here.
        """
        names = []
        for name in self._list_surface_path_names():
            try:
                path_data, _code, _msg = self._get_surface_path(name)
            except Exception as e:
                print(f"Warning: failed to read surface path '{name}': {e}")
                continue
            if not self._surface_path_system_name(path_data):
                names.append(name)
        return names

    def _get_actual_tcp_name(self, system_name):
        """Return the actual tool TCP frame name for a system.

        Parses the system URDF to find links whose name ends with '.tcp'.
        If a tool TCP link is found it is preferred over the flange; the
        flange is returned as a fallback when no tool is attached.
        """
        import xml.etree.ElementTree as ET
        system_pb2 = self._get_module("flexiv.pdk.system.system_service_pb2")

        try:
            with self._create_client() as client:
                urdf_req = system_pb2.GetUrdfRequest(name=system_name)
                urdf_resp = client.system.stub.GetUrdf(urdf_req)
            if urdf_resp.status.code != 0 or not urdf_resp.urdf_content:
                raise RuntimeError(urdf_resp.status.message)

            root = ET.fromstring(urdf_resp.urdf_content)
            link_names = [link.get("name", "") for link in root.findall("link")]

            # Prefer a tool TCP link (name ends with '.tcp', case-insensitive)
            tcp_links = [n for n in link_names if n.lower().endswith(".tcp")]
            if tcp_links:
                return tcp_links[0]

            # Fall back to the flange link
            flange_links = [n for n in link_names if n.lower().endswith(".flange")]
            if flange_links:
                return flange_links[0]

        except Exception as e:
            print(f"Warning: could not determine TCP from URDF for '{system_name}': {e}")

        # Last resort: construct from system config
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_SYSTEM,
            name=system_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(request)
        manipulator = getattr(response.system, "manipulator", None)
        manip_name = getattr(manipulator, "name", "") if manipulator else ""
        if manip_name:
            return f"{system_name}.{manip_name}.flange"
        return f"{system_name}.flange"

    def create_linear_path_trajectory(self, path_name, system_name, workcell_name, trajectory_name, tcp_name='', normal_offset=0.0, elbow_swivel_angle=0.0, external_axis_position=None, external_axis_preset=True, force=None, moment=None, velocity=0.1, acceleration=0.5):
        """Duplicate path_name to a new named surface path, run a basic solve, and persist it in Nebula.

        The solved path (cartesian poses + joint angles) is saved as a
        CONFIG_TYPE_SURFACE_PATH named `trajectory_name` in Nebula. Normal
        offset is baked directly into the refined waypoints' positions, and
        force/moment/velocity/acceleration are baked into every waypoint's
        wrench/velocity/acceleration fields. System name and TCP name are
        likewise persisted server-side, in the path's solver_preferences (set
        via CreateRobotMotion below) — so nothing about this trajectory needs
        separate local storage; it can all be read back from Nebula.
        """
        import time

        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        surface_finish_pb2 = self._get_module("flexiv.pdk.surface_finish.service_pb2")
        solver_prefs_pb2 = self._get_module("flexiv.pdk.surface_finish.solver_preferences_pb2")
        waypoint_pb2 = self._get_module("flexiv.pdk.spatial.waypoint_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        config_header_pb2 = self._get_module("flexiv.pdk.config_header_pb2")
        surface_path_pb2 = self._get_module("flexiv.pdk.surface_finish.path_pb2")
        solver_options_pb2 = self._get_module("flexiv.pdk.common.solver_options_pb2")

        # Load the source toolpath's surface path from Nebula.
        source_path_data, _code, _msg = self._get_surface_path(path_name)
        if source_path_data is None:
            raise RuntimeError(f"Path '{path_name}' not found")

        def _waypoint_to_entry(wp):
            pose = getattr(wp, "pose", None)
            if pose is None:
                return None
            pos = getattr(pose, "position", None)
            rot = getattr(pose, "rotation", None)
            if pos is None:
                return None
            entry = {"position": {"x": pos.x, "y": pos.y, "z": pos.z}}
            if rot is not None:
                entry["rotation"] = {"x": rot.x, "y": rot.y, "z": rot.z, "w": rot.w}
            return entry

        parent_name = getattr(getattr(source_path_data, "header", None), "parent", "") or ""
        nominal_json = [e for e in (_waypoint_to_entry(wp) for wp in source_path_data.nominal_cartesian) if e is not None]
        refined_json = [e for e in (_waypoint_to_entry(wp) for wp in source_path_data.refined_cartesian) if e is not None]

        null_space_kwargs = {"elbow_swivel_angle": elbow_swivel_angle}
        if external_axis_position is not None:
            null_space_kwargs["external_robot_position"] = [float(v) for v in external_axis_position]

        wrench = self._make_wrench(geometry_pb2, force, moment)

        def _make_wp(entry):
            pos = entry.get("position", {})
            rot = entry.get("rotation", {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0})
            return waypoint_pb2.CartesianWaypoint(
                pose=geometry_pb2.SE3Pose(
                    position=geometry_pb2.Vector3(x=pos.get("x", 0.0), y=pos.get("y", 0.0), z=pos.get("z", 0.0)),
                    rotation=geometry_pb2.Quaternion(x=rot.get("x", 0.0), y=rot.get("y", 0.0), z=rot.get("z", 0.0), w=rot.get("w", 1.0)),
                ),
                velocity=velocity,
                acceleration=acceleration,
                wrench=wrench,
                null_space=waypoint_pb2.NullSpace(**null_space_kwargs),
            )

        # Apply normal offset to refined cartesian poses.
        import copy
        refined_json_mod = copy.deepcopy(refined_json) if refined_json else []
        if normal_offset != 0.0:
            for entry in refined_json_mod:
                pos = entry.get("position", {})
                rot = entry.get("rotation", {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0})
                qx, qy, qz, qw = rot.get("x", 0.0), rot.get("y", 0.0), rot.get("z", 0.0), rot.get("w", 1.0)
                zx = 2.0 * (qx * qz + qw * qy)
                zy = 2.0 * (qy * qz - qw * qx)
                zz = 1.0 - 2.0 * (qx * qx + qy * qy)
                pos["x"] = pos.get("x", 0.0) - normal_offset * zx
                pos["y"] = pos.get("y", 0.0) - normal_offset * zy
                pos["z"] = pos.get("z", 0.0) - normal_offset * zz

        if not tcp_name:
            tcp_name = self._get_actual_tcp_name(system_name)

        # nominal_json/refined_json_mod are already relative to the path's
        # parent scene object (GenerateNominalPath's own convention, stored
        # as-is by generate_toolpath_from_points/generate_raster_toolpath);
        # persist them as-is, so Nebula resolves them against `parent` itself.
        path_data = surface_path_pb2.Path(
            header=config_header_pb2.ConfigHeader(name=trajectory_name, parent=parent_name),
            nominal_cartesian=[_make_wp(e) for e in nominal_json],
            refined_cartesian=[_make_wp(e) for e in refined_json_mod],
        )
        with self._create_client() as client:
            save_resp = client.config.stub.Save(
                config_pb2.SaveConfigRequest(surface_path=path_data)
            )
        self._check_status(save_resp, "Save linear path trajectory")

        time.sleep(0.1)

        solver_prefs_kwargs = {
            "system_name": system_name,
            "tcp_ecp_name": tcp_name,
            "solver_type": solver_prefs_pb2.SolverPreferences.SOLVER_TYPE_BASIC,
            "null_space": waypoint_pb2.NullSpace(**null_space_kwargs),
        }
        if external_axis_position is not None:
            solver_prefs_kwargs["external_robot_axis"] = (
                solver_options_pb2.EXTERNAL_ROBOT_PRESET
                if external_axis_preset
                else solver_options_pb2.EXTERNAL_ROBOT_PREFERRED
            )

        solve_req = surface_finish_pb2.CreateRobotMotionRequest(
            path_name=trajectory_name,
            solver_preferences=solver_prefs_pb2.SolverPreferences(**solver_prefs_kwargs),
        )
        with self._create_client() as client:
            solve_resp = client.surface_finish.stub.CreateRobotMotion(solve_req)

        code, msg = self._check_status(solve_resp, "Basic solve")

        return {
            "trajectoryName": trajectory_name,
            "pathName": path_name,
            "systemName": system_name,
            "tcpName": tcp_name,
            "waypointCount": len(nominal_json),
            "status": {"code": code, "message": msg},
        }

    @staticmethod
    def _make_wrench(geometry_pb2, force, moment):
        """Build a spatial.Wrench from {x,y,z,xEnabled,yEnabled,zEnabled} force/moment dicts."""

        def _axis_value(d, axis):
            if not d:
                return 0.0
            if d.get(f"{axis}Enabled", True) is False:
                return 0.0
            return float(d.get(axis, 0.0))

        return geometry_pb2.Wrench(
            force=geometry_pb2.Vector3(
                x=_axis_value(force, "x"), y=_axis_value(force, "y"), z=_axis_value(force, "z"),
            ),
            torque=geometry_pb2.Vector3(
                x=_axis_value(moment, "x"), y=_axis_value(moment, "y"), z=_axis_value(moment, "z"),
            ),
        )

    @staticmethod
    def _wrench_axes_from_waypoint(wp):
        """Read back force/moment as {x,y,z,xEnabled,yEnabled,zEnabled} dicts from a
        CartesianWaypoint's wrench field (all axes are always enabled — every
        linear trajectory waypoint carries the same wrench, baked in at
        generation time)."""
        wrench = getattr(wp, "wrench", None)
        force_vec = getattr(wrench, "force", None)
        torque_vec = getattr(wrench, "torque", None)
        force = {
            "x": getattr(force_vec, "x", 0.0), "y": getattr(force_vec, "y", 0.0), "z": getattr(force_vec, "z", 0.0),
            "xEnabled": True, "yEnabled": True, "zEnabled": True,
        }
        moment = {
            "x": getattr(torque_vec, "x", 0.0), "y": getattr(torque_vec, "y", 0.0), "z": getattr(torque_vec, "z", 0.0),
            "xEnabled": True, "yEnabled": True, "zEnabled": True,
        }
        return force, moment

    def list_linear_path_trajectories(self):
        """List all saved linear path trajectories with their system/TCP names.

        Toolpaths and linear trajectories are both stored as
        CONFIG_TYPE_SURFACE_PATH in Nebula; only entries whose
        solver_preferences.system_name is set are trajectories (see
        _surface_path_system_name) — raw/unsolved toolpaths are excluded here.
        """
        trajectories = []
        for name in self._list_surface_path_names():
            try:
                path_data, _code, _msg = self._get_surface_path(name)
            except Exception as e:
                print(f"Warning: failed to read surface path '{name}': {e}")
                continue
            system_name = self._surface_path_system_name(path_data)
            if not system_name:
                continue
            solver_preferences = getattr(path_data, "solver_preferences", None)
            trajectories.append({
                "name": name,
                "systemName": system_name,
                "tcpName": getattr(solver_preferences, "tcp_ecp_name", "") or "",
            })
        return trajectories

    def get_linear_path_trajectory(self, trajectory_name):
        """Retrieve a linear path trajectory: cartesian poses, joint angles, system
        name, TCP name, and motion parameters (force, moment, velocity,
        acceleration — identical on every waypoint) all read live from
        Nebula's surface path. System/TCP name come from the path's
        solver_preferences (set via CreateRobotMotion at generation time); the
        motion parameters are baked into the waypoints. None of this is
        surfaced or editable in the trajectory info panel — it's used
        internally to drive execution (e.g. force control during polish
        motions).

        nominal_cartesian/refined_cartesian poses are stored relative to the
        path's parent object (see create_linear_path_trajectory), so they are
        converted to world frame here before being returned, e.g. for
        rendering the Cartesian path in the 3D viewer.
        """
        surface_finish_pb2 = self._get_module("flexiv.pdk.surface_finish.service_pb2")
        get_req = surface_finish_pb2.GetRequest(path_name=trajectory_name)
        with self._create_client() as client:
            get_resp = client.surface_finish.stub.Get(get_req)
        code, msg = self._check_status(get_resp, "Get linear path trajectory")
        path_result = getattr(get_resp, "path", None)

        solver_preferences = getattr(path_result, "solver_preferences", None)
        system_name = getattr(solver_preferences, "system_name", "") or ""
        tcp_name = getattr(solver_preferences, "tcp_ecp_name", "") or ""
        parent_name = getattr(getattr(path_result, "header", None), "parent", "") or ""

        cartesian_poses = []
        for wp in getattr(path_result, "nominal_cartesian", []):
            pose = getattr(wp, "pose", None)
            if pose is None:
                continue
            pos = getattr(pose, "position", None)
            rot = getattr(pose, "rotation", None)
            if pos is None:
                continue
            wp_force, wp_moment = self._wrench_axes_from_waypoint(wp)
            entry = {
                "position": {"x": pos.x, "y": pos.y, "z": pos.z},
                "rotation": {"x": rot.x, "y": rot.y, "z": rot.z, "w": rot.w} if rot is not None
                    else {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0},
                "velocity": wp.velocity,
                "acceleration": wp.acceleration,
                "force": wp_force,
                "moment": wp_moment,
            }
            cartesian_poses.append(entry)

        # Positions/rotations above are parent-relative; convert to world
        # frame in place (velocity/acceleration/force/moment are untouched).
        world_poses = self._to_world_entries(parent_name, [
            {"position": e["position"], "rotation": e["rotation"]} for e in cartesian_poses
        ])
        for entry, world_pose in zip(cartesian_poses, world_poses):
            entry["position"] = world_pose["position"]
            entry["rotation"] = world_pose["rotation"]

        joint_angles = []
        for jw in getattr(path_result, "basic_solution", []):
            joint_angles.append(list(getattr(jw, "position", [])))

        first_wp = next(iter(getattr(path_result, "refined_cartesian", [])), None) \
            or next(iter(getattr(path_result, "nominal_cartesian", [])), None)
        if first_wp is not None:
            force, moment = self._wrench_axes_from_waypoint(first_wp)
            velocity = first_wp.velocity
            acceleration = first_wp.acceleration
        else:
            force, moment = {}, {}
            velocity, acceleration = 0.1, 0.5

        return {
            "trajectoryName": trajectory_name,
            "systemName": system_name,
            "tcpName": tcp_name,
            "force": force,
            "moment": moment,
            "velocity": velocity,
            "acceleration": acceleration,
            "cartesianPoses": cartesian_poses,
            "jointAngles": joint_angles,
            "status": {"code": code, "message": msg},
        }

    def remove_linear_path_trajectory(self, trajectory_name):
        """Remove a linear path trajectory: its surface path in Nebula."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        remove_req = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_SURFACE_PATH,
            name=trajectory_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Remove(remove_req)
        code, msg = self._check_status(response, "Remove linear path trajectory")

        return {
            "message": f"Removed trajectory '{trajectory_name}'.",
            "status": {"code": code, "message": msg},
        }

    def generate_linear_path_trajectory_file(self, trajectory_name):
        """Generate the RDK-executable .traj file for a linear path trajectory's
        robot motion. Saved server-side (Nebula) as
        {workcell}/linear_path/{trajectory_name}/{trajectory_name}.traj.
        """
        surface_finish_pb2 = self._get_module("flexiv.pdk.surface_finish.service_pb2")
        request = surface_finish_pb2.GenerateRCATrajectoryFileRequest(path_name=trajectory_name)
        with self._create_client() as client:
            response = client.surface_finish.stub.GenerateRCATrajectoryFile(request)
        code, msg = self._check_status(response, "Generate linear path trajectory file")

        return {
            "trajectoryName": trajectory_name,
            "status": {"code": code, "message": msg},
        }

    def get_toolpath(self, path_name):
        """Retrieve cartesian waypoints and parent info for a toolpath, read live
        from its surface path in Nebula."""
        path_data, _code, _msg = self._get_surface_path(path_name)
        if path_data is None:
            raise RuntimeError(f"Path '{path_name}' not found")

        parent_name = getattr(getattr(path_data, "header", None), "parent", "") or ""

        nominal = []
        for wp in getattr(path_data, "nominal_cartesian", []):
            pose = getattr(wp, "pose", None)
            if pose is None:
                continue
            pos = getattr(pose, "position", None)
            rot = getattr(pose, "rotation", None)
            if pos is None:
                continue
            entry = {"position": {"x": pos.x, "y": pos.y, "z": pos.z}}
            if rot is not None:
                entry["rotation"] = {"x": rot.x, "y": rot.y, "z": rot.z, "w": rot.w}
            nominal.append(entry)

        return {
            "pathName": path_name,
            "parentName": parent_name,
            "CartesianWaypoints": self._to_world_entries(parent_name, nominal),
            "status": {"code": 0, "message": "OK"},
        }
