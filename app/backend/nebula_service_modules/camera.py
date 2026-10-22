class CameraService:
    """Scene camera configuration methods."""

    def create_camera(
        self,
        name,
        parent,
        position,
        quaternion,
        camera_id,
        far_width,
        far_height,
        far_distance,
        near_distance,
        depth_scale,
    ):
        """Create or overwrite a scene camera in the nebula server."""
        camera_pb2 = self._get_module("flexiv.pdk.scene.camera_pb2")
        config_header_pb2 = self._get_module("flexiv.pdk.config_header_pb2")
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")

        camera = camera_pb2.Camera(
            header=config_header_pb2.ConfigHeader(
                name=name,
                parent=parent,
                pose_in_parent=geometry_pb2.SE3Pose(
                    position=geometry_pb2.Vector3(
                        x=float(position[0]), y=float(position[1]), z=float(position[2]),
                    ),
                    rotation=geometry_pb2.Quaternion(
                        x=float(quaternion[0]), y=float(quaternion[1]),
                        z=float(quaternion[2]), w=float(quaternion[3]),
                    ),
                ),
            ),
            camera_id=camera_id,
            far_width=far_width,
            far_height=far_height,
            far_distance=far_distance,
            near_distance=near_distance,
            depth_scale=depth_scale,
        )

        with self._create_client() as client:
            response = client.config.stub.Save(config_service_pb2.SaveConfigRequest(camera=camera))
        code, msg = self._check_status(response, "Camera creation")

        return {
            "message": f"Created camera '{name}'.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "camera": name,
        }

    def list_cameras(self):
        """List all camera names registered in the nebula server."""
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.ListConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_CAMERA,
        )
        with self._create_client() as client:
            response = client.config.stub.List(request)
        self._check_status(response, "List cameras")
        return {"cameras": list(getattr(response, "names", []))}

    def get_camera_config(self, camera_name):
        """Return the full camera configuration for editing."""
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.TypeNameConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_CAMERA,
            name=camera_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(request)
        self._check_status(response, "Get camera config")

        camera = response.camera
        pose = camera.header.pose_in_parent
        return {
            "name": getattr(camera.header, "name", camera_name),
            "parent": getattr(camera.header, "parent", "world"),
            "position": [pose.position.x, pose.position.y, pose.position.z],
            "quaternion": [pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w],
            "cameraId": camera.camera_id,
            "farWidth": camera.far_width,
            "farHeight": camera.far_height,
            "farDistance": camera.far_distance,
            "nearDistance": camera.near_distance,
            "depthScale": camera.depth_scale,
        }

    def get_camera_device_resolution(self, camera_name):
        """Sync far_width/far_height from the physical camera device, used to
        populate those fields from the connected hardware rather than
        entering them by hand.

        UpdateCameraIntrinsicFromDevice updates the camera's stored config
        (far_width/far_height included) on the nebula server from the
        device's live intrinsics; the updated values are then read back via
        ConfigService.Get, mirroring examples/example_camera.py's "update
        intrinsics from device" step.
        """
        camera_service_pb2 = self._get_module("flexiv.pdk.camera.service_pb2")
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")

        with self._create_client() as client:
            online_resp = client.camera.stub.IsCameraOnline(
                camera_service_pb2.CameraNameRequest(camera_name=camera_name)
            )
            if not getattr(online_resp, "online", False):
                raise RuntimeError(f"Camera device '{camera_name}' is not online.")

            update_resp = client.camera.stub.UpdateCameraIntrinsicFromDevice(
                camera_service_pb2.CameraNameRequest(camera_name=camera_name)
            )
            code, msg = self._check_status(update_resp, "Update camera intrinsics from device")

            get_resp = client.config.stub.Get(
                config_service_pb2.TypeNameConfigRequest(
                    type=config_service_pb2.ConfigType.CONFIG_TYPE_CAMERA,
                    name=camera_name,
                )
            )
        self._check_status(get_resp, "Get camera config")

        far_width = get_resp.camera.far_width
        far_height = get_resp.camera.far_height

        return {
            "farWidth": far_width,
            "farHeight": far_height,
            "status": {"code": code, "message": msg},
        }

    def remove_camera(self, camera_name):
        """Remove a camera from the nebula server."""
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.TypeNameConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_CAMERA,
            name=camera_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Remove(request)
        code, msg = self._check_status(response, "Camera removal")

        return {
            "message": f"Removed camera '{camera_name}'.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "camera": camera_name,
        }
