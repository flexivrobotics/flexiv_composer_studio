from .utils import world_to_local_point


class SceneObjectService:
    """Scene object management methods."""

    def _to_local_points(self, parent_object_name, points):
        """Convert a list of flat {x, y, z} points from world frame into
        ``parent_object_name``'s local frame, e.g. before sending an area
        boundary to ExtractArea (which expects points relative to the
        object being extracted from). Returns ``points`` unchanged if the
        parent's pose cannot be resolved."""
        if not parent_object_name or not points:
            return points
        try:
            parent_pose = self.get_scene_object_pose(parent_object_name)
        except Exception as e:
            print(f"Warning: could not resolve pose of object '{parent_object_name}', "
                  f"sending boundary points in world frame instead: {e}")
            return points

        px, py, pz = parent_pose["position"]
        pqx, pqy, pqz, pqw = parent_pose["quaternion"]
        parent_position = {"x": px, "y": py, "z": pz}
        parent_quaternion = {"x": pqx, "y": pqy, "z": pqz, "w": pqw}
        return [world_to_local_point(parent_position, parent_quaternion, pt) for pt in points]

    def add_scene_object_box(self, object_name, size_x, size_y, size_z, position=None, quaternion=None, parent=None):
        """Add a box-shaped object to the scene.

        ``position`` is [x, y, z] (m) and ``quaternion`` is [x, y, z, w],
        relative to ``parent`` (default "world"); they default to the
        origin/identity. ``parent`` may also name a robot flange link, in
        which case the object's pose is relative to that flange.
        """
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        object_pb2 = self._get_module("flexiv.pdk.scene.object_pb2")

        position = position or [0.0, 0.0, 0.0]
        quaternion = quaternion or [0.0, 0.0, 0.0, 1.0]

        obj = object_pb2.Object()
        obj.header.name = object_name
        obj.header.parent = parent or "world"
        obj.header.pose_in_parent.position.x = position[0]
        obj.header.pose_in_parent.position.y = position[1]
        obj.header.pose_in_parent.position.z = position[2]
        obj.header.pose_in_parent.rotation.x = quaternion[0]
        obj.header.pose_in_parent.rotation.y = quaternion[1]
        obj.header.pose_in_parent.rotation.z = quaternion[2]
        obj.header.pose_in_parent.rotation.w = quaternion[3]

        visual = obj.visual.add()
        visual.origin.position.x = 0.0
        visual.origin.position.y = 0.0
        visual.origin.position.z = 0.0
        visual.origin.rotation.x = 0.0
        visual.origin.rotation.y = 0.0
        visual.origin.rotation.z = 0.0
        visual.origin.rotation.w = 1.0
        visual.shape.box.size.extend([size_x, size_y, size_z])

        collision = obj.collision.add()
        collision.origin.CopyFrom(visual.origin)
        collision.shape.box.size.extend([size_x, size_y, size_z])

        with self._create_client() as client:
            response = client.config.stub.Save(config_pb2.SaveConfigRequest(object=obj))
        code, msg = self._check_status(response, "Box object addition")

        try:
            self.update_default_collision_config()
        except Exception as e:
            print(f"Warning: Failed to update default collision config after adding box '{object_name}': {e}")

        return {
            "message": f"Added box object '{object_name}' to the nebula server scene.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "object": object_name,
        }

    def add_scene_object_mesh(self, object_name, mesh_filename, position=None, quaternion=None, parent=None):
        """Add a mesh-based object to the scene.

        ``position`` is [x, y, z] (m) and ``quaternion`` is [x, y, z, w],
        relative to ``parent`` (default "world"); they default to the
        origin/identity. ``parent`` may also name a robot flange link, in
        which case the object's pose is relative to that flange.
        """
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        object_pb2 = self._get_module("flexiv.pdk.scene.object_pb2")

        position = position or [0.0, 0.0, 0.0]
        quaternion = quaternion or [0.0, 0.0, 0.0, 1.0]

        obj = object_pb2.Object()
        obj.header.name = object_name
        obj.header.parent = parent or "world"
        obj.header.pose_in_parent.position.x = position[0]
        obj.header.pose_in_parent.position.y = position[1]
        obj.header.pose_in_parent.position.z = position[2]
        obj.header.pose_in_parent.rotation.x = quaternion[0]
        obj.header.pose_in_parent.rotation.y = quaternion[1]
        obj.header.pose_in_parent.rotation.z = quaternion[2]
        obj.header.pose_in_parent.rotation.w = quaternion[3]

        visual = obj.visual.add()
        visual.origin.position.x = 0.0
        visual.origin.position.y = 0.0
        visual.origin.position.z = 0.0
        visual.origin.rotation.x = 0.0
        visual.origin.rotation.y = 0.0
        visual.origin.rotation.z = 0.0
        visual.origin.rotation.w = 1.0
        visual.shape.mesh.filename = mesh_filename
        visual.shape.mesh.scale.x = 1.0
        visual.shape.mesh.scale.y = 1.0
        visual.shape.mesh.scale.z = 1.0

        collision = obj.collision.add()
        collision.origin.CopyFrom(visual.origin)
        collision.shape.mesh.filename = mesh_filename
        collision.shape.mesh.scale.x = 1.0
        collision.shape.mesh.scale.y = 1.0
        collision.shape.mesh.scale.z = 1.0

        with self._create_client() as client:
            response = client.config.stub.Save(config_pb2.SaveConfigRequest(object=obj))
        code, msg = self._check_status(response, "Mesh object addition")

        try:
            self.update_default_collision_config()
        except Exception as e:
            print(f"Warning: Failed to update default collision config after adding mesh object '{object_name}': {e}")

        return {
            "message": f"Added object '{object_name}' with mesh '{mesh_filename}' to the nebula server scene.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "object": object_name,
        }

    @staticmethod
    def _pose_to_dict(pose):
        """Serialize an SE3Pose to the frontend's {position, quaternion} shape."""
        return {
            "position": [pose.position.x, pose.position.y, pose.position.z],
            "quaternion": [
                pose.rotation.x,
                pose.rotation.y,
                pose.rotation.z,
                pose.rotation.w,
            ],
        }

    def _object_to_dict(self, obj):
        """Describe an Object proto's geometry + pose for incremental rendering.

        ``visualType`` is 'mesh' (with ``meshFilename``) or 'primitive' (with a
        ``box`` size); pose is the object's ``header.pose_in_parent``.
        """
        result = {
            "name": obj.header.name,
            "parent": obj.header.parent,
            "pose": self._pose_to_dict(obj.header.pose_in_parent),
            "visualType": None,
            "box": None,
            "meshFilename": None,
        }
        for visual in getattr(obj, "visual", []):
            kind = visual.shape.WhichOneof("type")
            if kind == "mesh" and getattr(visual.shape.mesh, "filename", ""):
                result["visualType"] = "mesh"
                result["meshFilename"] = visual.shape.mesh.filename
                break
            if kind == "box":
                result["visualType"] = "primitive"
                result["box"] = {"size": list(visual.shape.box.size)}
                break
        return result

    def get_scene_object(self, object_name):
        """Fetch a single object's geometry + pose (used when it is added live)."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_OBJECT,
            name=object_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(request)
        self._check_status(response, "Get scene object")
        return self._object_to_dict(response.object)

    def get_scene_object_pose(self, object_name):
        """Return an object's current pose ({position, quaternion}).

        Reads ``header.pose_in_parent`` (the same frame SetPose writes), so it
        reflects live CHANGE_UPDATED moves and seeds the editable pose editor.
        """
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_OBJECT,
            name=object_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(request)
        self._check_status(response, "Get scene object pose")
        return self._pose_to_dict(response.object.header.pose_in_parent)

    def move_scene_object(self, object_name, position, quaternion):
        """Persist a new pose for an object via ConfigService.SetPose.

        ``position`` is [x, y, z] (m); ``quaternion`` is [x, y, z, w]. The server
        re-emits CHANGE_UPDATED, which the live stream forwards to the browser.
        """
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        pose = geometry_pb2.SE3Pose(
            position=geometry_pb2.Vector3(
                x=float(position[0]), y=float(position[1]), z=float(position[2])
            ),
            rotation=geometry_pb2.Quaternion(
                x=float(quaternion[0]),
                y=float(quaternion[1]),
                z=float(quaternion[2]),
                w=float(quaternion[3]),
            ),
        )
        request = config_pb2.SetPoseRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_OBJECT,
            name=object_name,
            pose=pose,
        )
        with self._create_client() as client:
            response = client.config.stub.SetPose(request)
        code, msg = self._check_status(response, "Move scene object")
        return {
            "message": f"Moved object '{object_name}'.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "object": object_name,
            "pose": {"position": list(position), "quaternion": list(quaternion)},
        }

    def get_scene_object_mesh_filename(self, object_name):
        """Retrieve the mesh filename for a scene object, or None if not a mesh."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_OBJECT,
            name=object_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(request)
        self._check_status(response, "Get scene object")

        obj = response.object
        for visual in getattr(obj, "visual", []):
            mesh = getattr(visual.shape, "mesh", None)
            if mesh is not None and getattr(mesh, "filename", ""):
                return mesh.filename
        return None

    def remove_scene_object(self, object_name):
        """Remove an object from the scene."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_OBJECT,
            name=object_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Remove(request)
        code, msg = self._check_status(response, "Object removal")

        return {
            "message": f"Removed object '{object_name}' from the nebula server scene.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "object": object_name,
        }

    def extract_area_mesh(self, object_name, extracted_object_name, boundary):
        """Extract an area from a mesh using a boundary polygon.

        ``boundary`` arrives in world frame (picked in the 3D viewer); it is
        converted to be relative to ``object_name`` before being sent, since
        ExtractArea expects the boundary in the source object's own frame.
        """
        mesh_op_pb2 = self._get_module("flexiv.pdk.mesh_operation.service_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")

        local_boundary = self._to_local_points(object_name, boundary)
        boundary_vectors = [
            geometry_pb2.Vector3(x=float(pt["x"]), y=float(pt["y"]), z=float(pt["z"]))
            for pt in local_boundary
        ]

        request = mesh_op_pb2.AreaExtractionRequest(
            object_name=object_name,
            extracted_object_name=extracted_object_name,
            boundary=boundary_vectors,
        )

        with self._create_client() as client:
            response = client.mesh_operation.stub.ExtractArea(request)
        code, msg = self._check_status(response, "Area extraction")

        return {
            "message": f"Extracted area '{extracted_object_name}' from '{object_name}'.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "source_object": object_name,
            "extracted_object": extracted_object_name,
        }

    def list_scene_objects(self):
        """List names of all scene objects in the current config."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.ListConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_OBJECT,
        )
        with self._create_client() as client:
            response = client.config.stub.List(request)
        self._check_status(response, "List scene objects")
        return list(getattr(response, "names", []))

    def filter_scene_object_mesh(
        self,
        object_name,
        filter_type,
        pass_band=0.1,
        num_iterations=10,
        replace_object=True,
        bbox_center=None,
        bbox_orientation=None,
        bbox_extents=None,
        enable_z_bound=True,
    ):
        """Apply a mesh filter to a scene object.

        Args:
            object_name: Name of the source object to filter.
            filter_type: One of 'smoothMesh', 'largestRegion', or 'boundingBox'.
            pass_band: Pass band for smooth mesh filter (default 0.1).
            num_iterations: Number of iterations for smooth mesh filter (default 10).
            replace_object: If True, replace the original object with the filtered
                result; if False, save as a new object with '_filtered' suffix.
            bbox_center: Dict with x, y, z for bounding box center.
            bbox_orientation: Dict with x, y, z, w quaternion for bounding box orientation.
            bbox_extents: Dict with x, y, z for bounding box extents.
            enable_z_bound: Whether to bound along the z axis (default True).

        Returns:
            dict with message, status, target, source_object, filtered_objects keys.
        """
        mesh_op_pb2 = self._get_module("flexiv.pdk.mesh_operation.service_pb2")
        filter_params_pb2 = self._get_module(
            "flexiv.pdk.mesh_operation.filter.parameters_pb2"
        )
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")

        counter = 1
        if (replace_object):
            filtered_name_prefix = object_name
        else:
            # Get the list of existing scene objects to check for name conflicts
            existing_objects = self.list_scene_objects()

            # Check whether the filtered name already exists. If so, increase the counter until we find a unique name.
            filtered_name_prefix = f"{object_name}_filtered_{counter}"
            while filtered_name_prefix in existing_objects:
                counter += 1
                filtered_name_prefix = f"{object_name}_filtered_{counter}"

        request = mesh_op_pb2.FilterMeshRequest(
            object_name=object_name,
            filtered_object_name_prefix=filtered_name_prefix,
        )

        if filter_type == "smoothMesh":
            request.smooth_mesh.CopyFrom(
                filter_params_pb2.SmoothMesh(
                    pass_band=pass_band,
                    num_iterations=num_iterations,
                )
            )
        elif filter_type == "largestRegion":
            request.largest_region.CopyFrom(filter_params_pb2.LargestRegion())
        elif filter_type == "boundingBox":
            if not bbox_center or not bbox_extents:
                raise ValueError(
                    "boundingBox filter requires bbox_center and bbox_extents."
                )
            orientation = bbox_orientation or {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0}
            request.bounding_box.CopyFrom(
                filter_params_pb2.BoundingBox(
                    bbox_center=geometry_pb2.Vector3(
                        x=bbox_center.get("x", 0.0),
                        y=bbox_center.get("y", 0.0),
                        z=bbox_center.get("z", 0.0),
                    ),
                    bbox_orientation=geometry_pb2.Quaternion(
                        x=orientation.get("x", 0.0),
                        y=orientation.get("y", 0.0),
                        z=orientation.get("z", 0.0),
                        w=orientation.get("w", 1.0),
                    ),
                    bbox_size=geometry_pb2.Vector3(
                        x=bbox_extents.get("x", 0.0),
                        y=bbox_extents.get("y", 0.0),
                        z=bbox_extents.get("z", 0.0),
                    ),
                )
            )
        else:
            raise ValueError(f"Unknown filter type: {filter_type}")

        with self._create_client() as client:
            response = client.mesh_operation.stub.FilterMesh(request)
        code, msg = self._check_status(response, "Mesh filter")

        filtered_names = list(response.filtered_object_names)

        if replace_object:
            message = (
                f"Applied '{filter_type}' filter to '{object_name}' "
                f"(replaced in place)."
            )
        else:
            message = (
                f"Applied '{filter_type}' filter to '{object_name}', "
                f"saved as {filtered_names}."
            )

        return {
            "message": message,
            "status": {"code": code, "message": msg},
            "target": self.target,
            "source_object": object_name,
            "filtered_objects": filtered_names,
        }
