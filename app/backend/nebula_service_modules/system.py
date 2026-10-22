from robot_connection import connections
from .utils import quat_to_rpy, rpy_to_quat


class SystemService:
    """System configuration and component listing methods."""

    def create_system(
        self,
        name,
        manipulator_name,
        arm_serial_number,
        control_box_serial_number,
        ext_axis_name=None,
        ext_axis_manufacturer=None,
        ext_axis_model=None,
        tool_name=None,
        tool_manufacturer=None,
        tool_model=None,
        tool_adapter_name=None,
        tool_adapter_manufacturer=None,
        tool_adapter_model=None,
        mount_xyz=None,
        mount_rpy=None,
        manipulator_mount_xyz=None,
        manipulator_mount_rpy=None,
    ):
        """Create a new system in the nebula server."""
        print(
            f"[create_system] called: name={name!r} manipulator={manipulator_name!r} "
            f"arm_sn={arm_serial_number!r} control_box_sn={control_box_serial_number!r} "
            f"target={self.target!r}",
            flush=True,
        )
        system_pb2 = self._get_module("flexiv.pdk.system.system_pb2")
        config_header_pb2 = self._get_module("flexiv.pdk.config_header_pb2")
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")

        x, y, z = (float(v) for v in mount_xyz) if mount_xyz else (0.0, 0.0, 0.0)
        system = system_pb2.System(
            header=config_header_pb2.ConfigHeader(
                name=name,
                parent="world",
                pose_in_parent=geometry_pb2.SE3Pose(
                    position=geometry_pb2.Vector3(x=x, y=y, z=z),
                    rotation=geometry_pb2.Quaternion(**rpy_to_quat(mount_rpy or [0.0, 0.0, 0.0])),
                ),
            ),
            control_box_serial_number=control_box_serial_number,
        )

        system.manipulator_adapter.name = "manipulator_adapter"
        system.manipulator_adapter.mass = 0.0
        system.manipulator_adapter.inertia.extend([0.0] * 9)
        if manipulator_mount_xyz:
            system.manipulator_adapter.xyz.extend([float(v) for v in manipulator_mount_xyz])
        else:
            system.manipulator_adapter.xyz.extend([0.0, 0.0, 0.0])
        if manipulator_mount_rpy:
            system.manipulator_adapter.rpy.extend([float(v) for v in manipulator_mount_rpy])
        else:
            system.manipulator_adapter.rpy.extend([0.0, 0.0, 0.0])

        system.manipulator.name = manipulator_name
        system.manipulator.arm_serial_number = arm_serial_number
        system.manipulator.lower_limit.extend([-2.76] * 7)
        system.manipulator.upper_limit.extend([2.76] * 7)
        system.manipulator.home_position.extend([0.0] * 7)

        if tool_adapter_name:
            system.tool_adapter.name = tool_adapter_name
            if tool_adapter_manufacturer:
                system.tool_adapter.manufacturer = tool_adapter_manufacturer
            if tool_adapter_model:
                system.tool_adapter.model = tool_adapter_model
            system.tool_adapter.rotation = 0.0

        if ext_axis_name:
            system.external_robot_axis.name = ext_axis_name
            if ext_axis_manufacturer:
                system.external_robot_axis.manufacturer = ext_axis_manufacturer
            if ext_axis_model:
                system.external_robot_axis.model = ext_axis_model
            system.external_robot_axis.position_lower_limit.extend([-3.14])
            system.external_robot_axis.position_upper_limit.extend([3.14])
            system.external_robot_axis.home_position.extend([0.0])

        if tool_name:
            tool = system.tool.add()
            tool.name = tool_name
            if tool_manufacturer:
                tool.manufacturer = tool_manufacturer
            if tool_model:
                tool.model = tool_model

        print(f"[create_system] connecting to nebula server at {self.target!r} ...", flush=True)
        with self._create_client() as client:
            print("[create_system] connected; calling ConfigService.Save (SDK gRPC) ...", flush=True)
            response = client.config.stub.Save(config_service_pb2.SaveConfigRequest(system=system))
        status = getattr(response, "status", None)
        print(
            f"[create_system] Save returned: status.code="
            f"{getattr(status, 'code', 'n/a')} status.message="
            f"{getattr(status, 'message', '')!r}",
            flush=True,
        )
        code, msg = self._check_status(response, "System creation")

        try:
            self.update_default_collision_config()
        except Exception as e:
            print(f"Warning: Failed to update default collision config after creating system '{name}': {e}")

        return {
            "message": f"Created system '{name}'.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "system": name,
        }

    def list_external_robot_axes(self):
        """List all available external robot axes from the Nebula components service."""
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        try:
            with self._create_client() as client:
                response = client.system_config.stub.ListExternalRobotAxes(empty_pb2.Empty())
            code, msg = self._check_status(response, "List external robot axes")
            items = []
            for item in getattr(response, "items", []):
                items.append(
                    {
                        "manufacturer": getattr(item, "manufacturer", ""),
                        "model": getattr(item, "model", ""),
                    }
                )
            return {
                "axes": items,
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "axes": [],
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def list_tools(self):
        """List all available tools from the Nebula components service."""
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        try:
            with self._create_client() as client:
                response = client.system_config.stub.ListTools(empty_pb2.Empty())
            code, msg = self._check_status(response, "List tools")
            items = []
            for item in getattr(response, "items", []):
                items.append(
                    {
                        "manufacturer": getattr(item, "manufacturer", ""),
                        "model": getattr(item, "model", ""),
                    }
                )
            return {
                "tools": items,
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "tools": [],
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def list_custom_tools(self):
        """List all custom tools from the Nebula components service."""
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        try:
            with self._create_client() as client:
                response = client.system_config.stub.ListCustomTools(empty_pb2.Empty())
            code, msg = self._check_status(response, "List custom tools")
            items = []
            for item in getattr(response, "items", []):
                items.append(
                    {
                        "manufacturer": getattr(item, "manufacturer", ""),
                        "model": getattr(item, "model", ""),
                    }
                )
            return {
                "customTools": items,
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "customTools": [],
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def _add_mesh_visual_and_collision(self, proto_message, visual_mesh_path, collision_mesh_path):
        """Append a single Visual (Mesh) and/or Collision (ConvexMesh) to a
        CustomTool/CustomToolAdapter message's ``visual``/``collision`` repeated
        fields, at the identity pose relative to the component's base.
        """
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        shape_pb2 = self._get_module("flexiv.pdk.spatial.shape_pb2")

        identity_origin = geometry_pb2.SE3Pose(
            position=geometry_pb2.Vector3(x=0.0, y=0.0, z=0.0),
            rotation=geometry_pb2.Quaternion(x=0.0, y=0.0, z=0.0, w=1.0),
        )
        unit_scale = geometry_pb2.Vector3(x=1.0, y=1.0, z=1.0)

        if visual_mesh_path:
            proto_message.visual.add(
                origin=identity_origin,
                shape=shape_pb2.Shape(mesh=shape_pb2.Mesh(filename=visual_mesh_path, scale=unit_scale)),
            )
        if collision_mesh_path:
            proto_message.collision.add(
                origin=identity_origin,
                shape=shape_pb2.Shape(convex_mesh=shape_pb2.ConvexMesh(filename=collision_mesh_path, scale=unit_scale)),
            )

    def save_custom_tool(self, manufacturer, model, tcp, visual_mesh_path=None, collision_mesh_path=None):
        """Save (create or overwrite) a custom tool, identified by manufacturer + model.

        ``tcp`` is a dict with ``position`` ([x, y, z]) and ``quaternion``
        ([x, y, z, w]) keys, describing the tool control point relative to the
        tool base. ``visual_mesh_path``/``collision_mesh_path`` are optional
        Nebula-server-side file paths for a single visual/collision mesh.
        """
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        custom_tool_pb2 = self._get_module("flexiv.pdk.system.components.custom_tool_pb2")
        components_service_pb2 = self._get_module("flexiv.pdk.system.components_service_pb2")

        try:
            px, py, pz = tcp["position"]
            qx, qy, qz, qw = tcp["quaternion"]
            custom_tool = custom_tool_pb2.CustomTool(
                manufacturer=manufacturer,
                model=model,
                tcp=geometry_pb2.SE3Pose(
                    position=geometry_pb2.Vector3(x=px, y=py, z=pz),
                    rotation=geometry_pb2.Quaternion(x=qx, y=qy, z=qz, w=qw),
                ),
            )
            self._add_mesh_visual_and_collision(custom_tool, visual_mesh_path, collision_mesh_path)

            with self._create_client() as client:
                response = client.system_config.stub.SaveCustomTool(
                    components_service_pb2.SaveCustomToolRequest(custom_tool=custom_tool)
                )
            code, msg = self._check_status(response, "Save custom tool")
            return {
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def list_tool_adapters(self):
        """List all available tool adapters from the Nebula components service."""
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        try:
            with self._create_client() as client:
                response = client.system_config.stub.ListToolAdapters(empty_pb2.Empty())
            code, msg = self._check_status(response, "List tool adapters")
            items = []
            for item in getattr(response, "items", []):
                items.append(
                    {
                        "manufacturer": getattr(item, "manufacturer", ""),
                        "model": getattr(item, "model", ""),
                    }
                )
            return {
                "toolAdapters": items,
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "toolAdapters": [],
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def list_custom_tool_adapters(self):
        """List all custom tool adapters from the Nebula components service."""
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        try:
            with self._create_client() as client:
                response = client.system_config.stub.ListCustomToolAdapters(empty_pb2.Empty())
            code, msg = self._check_status(response, "List custom tool adapters")
            items = []
            for item in getattr(response, "items", []):
                items.append(
                    {
                        "manufacturer": getattr(item, "manufacturer", ""),
                        "model": getattr(item, "model", ""),
                    }
                )
            return {
                "customToolAdapters": items,
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "customToolAdapters": [],
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def save_custom_tool_adapter(self, manufacturer, model, flanges, visual_mesh_path=None, collision_mesh_path=None):
        """Save (create or overwrite) a custom tool adapter, identified by manufacturer + model.

        ``flanges`` is a list of dicts, each with ``position`` ([x, y, z]) and
        ``quaternion`` ([x, y, z, w]) keys, describing the flange poses relative
        to the tool adapter base. ``visual_mesh_path``/``collision_mesh_path``
        are optional Nebula-server-side file paths for a single visual/collision
        mesh.
        """
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        custom_tool_adapter_pb2 = self._get_module("flexiv.pdk.system.components.custom_tool_adapter_pb2")
        components_service_pb2 = self._get_module("flexiv.pdk.system.components_service_pb2")

        try:
            custom_tool_adapter = custom_tool_adapter_pb2.CustomToolAdapter(
                manufacturer=manufacturer,
                model=model,
            )
            for flange in flanges:
                px, py, pz = flange["position"]
                qx, qy, qz, qw = flange["quaternion"]
                custom_tool_adapter.flange.add(
                    position=geometry_pb2.Vector3(x=px, y=py, z=pz),
                    rotation=geometry_pb2.Quaternion(x=qx, y=qy, z=qz, w=qw),
                )
            self._add_mesh_visual_and_collision(custom_tool_adapter, visual_mesh_path, collision_mesh_path)

            with self._create_client() as client:
                response = client.system_config.stub.SaveCustomToolAdapter(
                    components_service_pb2.SaveCustomToolAdapterRequest(custom_tool_adapter=custom_tool_adapter)
                )
            code, msg = self._check_status(response, "Save custom tool adapter")
            return {
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def find_systems_using_tool_adapter(self, manufacturer, model):
        """Return the names of systems whose tool adapter matches manufacturer + model."""
        return self._find_systems_using(
            lambda cfg: cfg.get("toolAdapterManufacturer") == manufacturer and cfg.get("toolAdapterModel") == model
        )

    def find_systems_using_tool(self, manufacturer, model):
        """Return the names of systems whose tool matches manufacturer + model."""
        return self._find_systems_using(
            lambda cfg: cfg.get("toolManufacturer") == manufacturer and cfg.get("toolModel") == model
        )

    def _find_systems_using(self, matches_config):
        names = self.list_systems().get("systems", [])
        used_by = []
        for name in names:
            try:
                cfg = self.get_system_config(name)
            except Exception:
                continue
            if matches_config(cfg):
                used_by.append(name)
        return used_by

    def remove_custom_tool_adapter(self, manufacturer, model):
        """Remove a custom tool adapter, identified by manufacturer + model."""
        components_service_pb2 = self._get_module("flexiv.pdk.system.components_service_pb2")
        try:
            with self._create_client() as client:
                response = client.system_config.stub.RemoveCustomToolAdapter(
                    components_service_pb2.ManufacturerModel(manufacturer=manufacturer, model=model)
                )
            code, msg = self._check_status(response, "Remove custom tool adapter")
            return {
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def remove_custom_tool(self, manufacturer, model):
        """Remove a custom tool, identified by manufacturer + model."""
        components_service_pb2 = self._get_module("flexiv.pdk.system.components_service_pb2")
        try:
            with self._create_client() as client:
                response = client.system_config.stub.RemoveCustomTool(
                    components_service_pb2.ManufacturerModel(manufacturer=manufacturer, model=model)
                )
            code, msg = self._check_status(response, "Remove custom tool")
            return {
                "status": {"code": code, "message": msg},
            }
        except Exception as e:
            return {
                "status": {"code": -1, "message": str(e)},
                "error": str(e),
            }

    def remove_system(self, system_name):
        """Remove a system from the nebula server."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_SYSTEM,
            name=system_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Remove(request)
        code, msg = self._check_status(response, "System removal")

        return {
            "message": f"Removed system '{system_name}' from the nebula server.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "system": system_name,
        }

    def list_systems(self):
        """List all system names registered in the nebula server."""
        with self._create_client() as client:
            names = self._list_loaded_system_names(client)
        return {"systems": names}

    def _get_actual_flange_name(self, system_name):
        """Return the manipulator flange frame name for a system.

        Parses the system URDF for a link ending in '.flange'; falls back to
        a name constructed from the system config when the URDF is
        unavailable. Used to offer systems' flanges as camera mount points.
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
            flange_links = [n for n in link_names if n.lower().endswith(".flange")]
            if flange_links:
                return flange_links[0]
        except Exception as e:
            print(f"Warning: could not determine flange from URDF for '{system_name}': {e}")

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

    def list_system_flanges(self):
        """Return {systemName, flangeName} for every system.

        Used to populate the camera parent-frame combobox (world or a
        system's flange) without exposing full URDF parsing to the frontend.
        """
        names = self.list_systems().get("systems", [])
        flanges = []
        for name in names:
            try:
                flanges.append({"systemName": name, "flangeName": self._get_actual_flange_name(name)})
            except Exception as e:
                print(f"Warning: failed to resolve flange for system '{name}': {e}")
        return {"flanges": flanges}

    def get_system_info(self, system_name):
        """Get information about a specific system using the Nebula server.

        Joint DOF and limits are obtained by parsing the URDF fetched from
        the Nebula server via GetUrdf. Falls back to protobuf fields if
        GetUrdf is unavailable.
        """
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        comp_pb2 = self._get_module("flexiv.pdk.system.components_service_pb2")
        system_pb2 = self._get_module("flexiv.pdk.system.system_service_pb2")

        with self._create_client() as client:
            request = config_pb2.TypeNameConfigRequest(
                type=config_pb2.ConfigType.CONFIG_TYPE_SYSTEM,
                name=system_name,
            )
            response = client.config.stub.Get(request)
            code, msg = self._check_status(response, "Get system info")

            system = response.system

            manipulator = getattr(system, "manipulator", None)
            manipulator_info = {}
            if manipulator is not None:
                manipulator_info = {
                    "name": getattr(manipulator, "name", ""),
                    "serialNumber": getattr(manipulator, "arm_serial_number", ""),
                }

            external_axis = getattr(system, "external_robot_axis", None)
            external_axis_info = None
            if external_axis is not None and getattr(external_axis, "name", ""):
                external_axis_info = {
                    "name": external_axis.name,
                    "dof": len(getattr(external_axis, "home_position", [])),
                    "lowerLimit": list(getattr(external_axis, "position_lower_limit", []) or []),
                    "upperLimit": list(getattr(external_axis, "position_upper_limit", []) or []),
                }

            if manipulator is not None:
                try:
                    serial_req = system_pb2.GetArmSerialNumberRequest(system_name=system_name)
                    serial_resp = client.system.stub.GetArmSerialNumber(serial_req)
                    if serial_resp.status.code == 0:
                        manipulator_info["publicSerialNumber"] = getattr(
                            serial_resp, "arm_public_serial_number", ""
                        )                        
                    else:
                        manipulator_info["publicSerialNumberError"] = serial_resp.status.message
                except Exception as e:
                    manipulator_info["publicSerialNumberError"] = str(e)

            manip_name = manipulator_info.get("name") or None
            ext_name = getattr(external_axis, "name", None) if external_axis is not None else None

            try:
                urdf_req = system_pb2.GetUrdfRequest(name=system_name)
                urdf_resp = client.system.stub.GetUrdf(urdf_req)
                if urdf_resp.status.code == 0 and urdf_resp.urdf_content:
                    limits = self._parse_urdf(
                        urdf_resp.urdf_content,
                        manipulator_name=manip_name,
                        external_axis_name=ext_name,
                    )
                    if limits:
                        manip = limits.get("manipulator")
                        if manip:
                            manipulator_info["dof"] = manip["dof"]
                            manipulator_info["lowerLimit"] = manip["lower"]
                            manipulator_info["upperLimit"] = manip["upper"]
                            manipulator_info["jointTypes"] = manip["jointTypes"]

                        ext = limits.get("externalAxis")
                        if ext:
                            if external_axis_info is None:
                                external_axis_info = {"name": ext_name or ""}
                            external_axis_info["dof"] = ext["dof"]
                            external_axis_info["lowerLimit"] = ext["lower"]
                            external_axis_info["upperLimit"] = ext["upper"]
                            external_axis_info["jointTypes"] = ext["jointTypes"]
                            external_axis_info["jointNames"] = ext["jointNames"]
                else:
                    raise RuntimeError(f"GetUrdf status: {urdf_resp.status.message}")
            except Exception as e:
                print(
                    f"Warning: Failed to get URDF from Nebula server for '{system_name}', falling back to protobuf fields: {e}"
                )
                if manipulator is not None:
                    manipulator_info["dof"] = len(getattr(manipulator, "home_position", []))
                    manipulator_info["lowerLimit"] = list(getattr(manipulator, "lower_limit", []) or [])
                    manipulator_info["upperLimit"] = list(getattr(manipulator, "upper_limit", []) or [])
                    # Flexiv manipulators are always fully revolute; URDF is
                    # the only source of external-axis joint types, so those
                    # remain unset in this fallback path.
                    manipulator_info["jointTypes"] = ["revolute"] * manipulator_info["dof"]

        return {
            "name": getattr(system.header, "name", system_name)
            if hasattr(system, "header")
            else system_name,
            "manipulator": manipulator_info,
            "externalAxis": external_axis_info,
            "status": {"code": code, "message": msg},
        }

    @staticmethod
    def _parse_urdf(urdf_content, manipulator_name=None, external_axis_name=None):
        """Parse URDF XML to extract joint limits and names.

        Returns a dict with ``manipulator`` and ``externalAxis`` keys,
        each containing ``dof``, ``lower``, ``upper``, and ``jointNames``.
        """
        import xml.etree.ElementTree as ET

        root = ET.fromstring(urdf_content)

        manip_lower: list[float] = []
        manip_upper: list[float] = []
        manip_names: list[str] = []
        manip_types: list[str] = []
        ext_lower: list[float] = []
        ext_upper: list[float] = []
        ext_names: list[str] = []
        ext_types: list[str] = []

        for joint in root.findall("joint"):
            joint_type = joint.get("type", "fixed")
            if joint_type == "fixed":
                continue

            joint_name = joint.get("name", "")
            limit = joint.find("limit")
            lo = (
                float(limit.get("lower"))
                if limit is not None and limit.get("lower")
                else -3.14
            )
            hi = (
                float(limit.get("upper"))
                if limit is not None and limit.get("upper")
                else 3.14
            )
            # URDF joint type: "prismatic" moves in metres, everything else
            # (revolute/continuous) rotates and is expressed in radians.
            unit_type = "prismatic" if joint_type == "prismatic" else "revolute"

            if manipulator_name and manipulator_name in joint_name:
                manip_lower.append(lo)
                manip_upper.append(hi)
                manip_names.append(joint_name)
                manip_types.append(unit_type)
            elif external_axis_name and external_axis_name in joint_name:
                ext_lower.append(lo)
                ext_upper.append(hi)
                ext_names.append(joint_name)
                ext_types.append(unit_type)

        result: dict = {
            "manipulator": {
                "dof": len(manip_lower),
                "lower": manip_lower,
                "upper": manip_upper,
                "jointNames": manip_names,
                "jointTypes": manip_types,
            },
        }
        if ext_lower:
            result["externalAxis"] = {
                "dof": len(ext_lower),
                "lower": ext_lower,
                "upper": ext_upper,
                "jointNames": ext_names,
                "jointTypes": ext_types,
            }
        else:
            result["externalAxis"] = None

        return result

    def get_system_config(self, system_name):
        """Return the full system configuration for editing."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.TypeNameConfigRequest(
            type=config_pb2.ConfigType.CONFIG_TYPE_SYSTEM,
            name=system_name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(request)
        self._check_status(response, "Get system config")

        system = response.system

        config = {
            "name": getattr(system.header, "name", system_name)
            if hasattr(system, "header")
            else system_name,
            "controlBoxSerialNumber": getattr(system, "control_box_serial_number", ""),
        }

        manip = getattr(system, "manipulator", None)
        if manip is not None:
            config["manipulatorName"] = getattr(manip, "name", "")
            config["armSerialNumber"] = getattr(manip, "arm_serial_number", "")

        ext = getattr(system, "external_robot_axis", None)
        if ext is not None and getattr(ext, "name", ""):
            config["externalAxisName"] = getattr(ext, "name", "")
            config["externalAxisManufacturer"] = getattr(ext, "manufacturer", "")
            config["externalAxisModel"] = getattr(ext, "model", "")

        ta = getattr(system, "tool_adapter", None)
        if ta is not None and getattr(ta, "name", ""):
            config["toolAdapterName"] = getattr(ta, "name", "")
            config["toolAdapterManufacturer"] = getattr(ta, "manufacturer", "")
            config["toolAdapterModel"] = getattr(ta, "model", "")

        tools = getattr(system, "tool", [])
        if tools:
            t = tools[0]
            config["toolName"] = getattr(t, "name", "")
            config["toolManufacturer"] = getattr(t, "manufacturer", "")
            config["toolModel"] = getattr(t, "model", "")

        # The server returns the system base in the world
        pose = system.header.pose_in_parent
        config["mountXyz"] = [pose.position.x, pose.position.y, pose.position.z]
        config["mountRpy"] = quat_to_rpy({
            "x": pose.rotation.x, "y": pose.rotation.y,
            "z": pose.rotation.z, "w": pose.rotation.w,
        })

        ma = getattr(system, "manipulator_adapter", None)
        if ma is not None:
            xyz = list(getattr(ma, "xyz", []) or [])
            rpy = list(getattr(ma, "rpy", []) or [])
            config["manipulatorMountXyz"] = xyz if len(xyz) == 3 else [0.0, 0.0, 0.0]
            config["manipulatorMountRpy"] = rpy if len(rpy) == 3 else [0.0, 0.0, 0.0]

        return config

    def sync_system_from_controller(self, target_name, serial_number):
        """Connect to the RDK by serial number and pull its system config.

        Adds a temporary connected system under a throwaway name, reads back
        the resulting configuration, then removes the temporary system again.
        """
        import uuid

        system_service_pb2 = self._get_module("flexiv.pdk.system.system_service_pb2")
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")

        temp_name = f"_sync_tmp_{uuid.uuid4().hex[:8]}"

        with self._create_client() as client:
            response = client.system.stub.AddConnectedSystem(
                system_service_pb2.AddConnectedSystemRequest(name=temp_name, serial_number=serial_number)
            )
        self._check_status(response, "Sync system from controller")

        try:
            config = self.get_system_config(temp_name)
        finally:
            try:
                remove_req = config_pb2.TypeNameConfigRequest(
                    type=config_pb2.ConfigType.CONFIG_TYPE_SYSTEM,
                    name=temp_name,
                )
                with self._create_client() as client:
                    client.config.stub.Remove(remove_req)
            except Exception as cleanup_err:
                print(f"Warning: failed to remove temp system '{temp_name}': {cleanup_err}")

        config["name"] = target_name
        return config

    def connect_system(self, system_name):
        """Connect to the physical robot via Flexiv RDK.

        Resolves the public serial number from Nebula, extracts URDF joint
        names, then delegates the hardware connection to the module-level
        ``RobotConnectionManager`` singleton.
        """
        info = self.get_system_info(system_name)
        manip = info.get("manipulator", {})
        robot_sn = (manip.get("publicSerialNumber") or "").strip()

        config = self.get_system_config(system_name)
        if not robot_sn:
            robot_sn = config.get("armSerialNumber", "").strip()

        if not robot_sn:
            return {
                "connected": False,
                "system": system_name,
                "message": (
                    f"No serial number available for system"
                    f" '{system_name}'."
                ),
            }

        joint_names = self._resolve_joint_names(system_name)
        expected_tool_name = config.get("toolName", "").strip()

        return connections.connect(system_name, robot_sn, joint_names, expected_tool_name)

    def disconnect_system(self, system_name):
        """Close the connection to a system's physical robot, if any."""
        return connections.disconnect(system_name)

    def get_joint_angles(self, system_name):
        """Return the latest cached joint angles for a connected system."""
        return connections.get_joint_angles(system_name)

    def get_tcp_pose(self, system_name):
        """Return the latest cached TCP pose for a connected system.

        ``[x, y, z, qw, qx, qy, qz]`` w.r.t. the world frame.
        """
        return connections.get_tcp_pose(system_name)

    def _resolve_joint_names(self, system_name):
        """Return the list of non-fixed URDF joint names for *system_name*,
        or ``None`` if they cannot be determined.

        Order matches ``flexivrdk.RobotStates.q`` (external-axis DoF followed
        by manipulator DoF), so the external axis's joint name must be
        included alongside the manipulator's for the two lists to line up.
        """
        try:
            info = self.get_system_info(system_name)
            manip_name = (info.get("manipulator") or {}).get("name") or ""
            ext_name = (info.get("externalAxis") or {}).get("name") or ""
        except Exception:
            return None

        system_pb2 = self._get_module("flexiv.pdk.system.system_service_pb2")
        try:
            with self._create_client() as client:
                req = system_pb2.GetUrdfRequest(name=system_name)
                resp = client.system.stub.GetUrdf(req)
            if resp.status.code != 0 or not resp.urdf_content:
                return None
            parsed = self._parse_urdf(
                resp.urdf_content,
                manipulator_name=manip_name,
                external_axis_name=ext_name,
            )
            manip = parsed.get("manipulator")
            ext = parsed.get("externalAxis")
            names = list(ext.get("jointNames")) if ext else []
            if manip:
                names.extend(manip.get("jointNames") or [])
            return names or None
        except Exception:
            return None

    # ------------------------------------------------------------------
    # System Pose / Target Waypoint CRUD
    # ------------------------------------------------------------------

    def save_system_pose(self, name, system_name, joint_angles=None, cartesian_pose=None, pose_in_parent=None, tcp_name=None):
        """Save a TargetWaypoint (system pose) to the nebula server.

        Parameters
        ----------
        name : str
            Unique name for the system pose.
        system_name : str
            Name of the parent system this pose is attached to.
        joint_angles : dict or list or None
            Joint angles. If a dict, values are extracted as a list.
        cartesian_pose : dict or None
            World-frame Cartesian pose with ``position`` (list of 3) and
            ``quaternion`` (list of 4: x, y, z, w). Stored in
            ``TargetWaypoint.cartesian``.
        pose_in_parent : dict or None
            System-base-relative Cartesian pose with ``position`` (list
            of 3) and ``quaternion`` (list of 4: x, y, z, w). Stored in
            ``ConfigHeader.pose_in_parent``.
        tcp_name : str or None
            Name of the TCP/flange frame this pose's cartesian data is
            expressed for (e.g. ``"<system>.arm.flange"``). Stored in
            ``TargetWaypoint.tcp_name``; falls back to the system's actual
            TCP name (tool if attached, else flange) if not given.
        """
        config_header_pb2 = self._get_module("flexiv.pdk.config_header_pb2")
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        target_waypoint_pb2 = self._get_module("flexiv.pdk.scene.target_waypoint_pb2")
        waypoint_pb2 = self._get_module("flexiv.pdk.spatial.waypoint_pb2")

        header = config_header_pb2.ConfigHeader(
            name=name,
            parent=system_name,
        )

        if pose_in_parent is not None:
            pos = pose_in_parent.get("position", [0.0, 0.0, 0.0])
            quat = pose_in_parent.get("quaternion", [0.0, 0.0, 0.0, 1.0])
            header.pose_in_parent.CopyFrom(
                geometry_pb2.SE3Pose(
                    position=geometry_pb2.Vector3(
                        x=float(pos[0]), y=float(pos[1]), z=float(pos[2]),
                    ),
                    rotation=geometry_pb2.Quaternion(
                        x=float(quat[0]), y=float(quat[1]),
                        z=float(quat[2]), w=float(quat[3]),
                    ),
                )
            )

        tw = target_waypoint_pb2.TargetWaypoint(
            header=header,
            tcp_name=tcp_name or self._get_actual_tcp_name(system_name),
        )

        if cartesian_pose is not None:
            pos = cartesian_pose.get("position", [0.0, 0.0, 0.0])
            quat = cartesian_pose.get("quaternion", [0.0, 0.0, 0.0, 1.0])
            tw.cartesian.CopyFrom(
                waypoint_pb2.CartesianWaypoint(
                    pose=geometry_pb2.SE3Pose(
                        position=geometry_pb2.Vector3(
                            x=float(pos[0]), y=float(pos[1]), z=float(pos[2]),
                        ),
                        rotation=geometry_pb2.Quaternion(
                            x=float(quat[0]), y=float(quat[1]),
                            z=float(quat[2]), w=float(quat[3]),
                        ),
                    ),
                )
            )

        if joint_angles is not None:
            if isinstance(joint_angles, dict):
                joint_list = [float(v) for v in joint_angles.values()]
            else:
                joint_list = [float(v) for v in joint_angles]
            tw.joint.CopyFrom(
                waypoint_pb2.JointWaypoint(position=joint_list)
            )

        with self._create_client() as client:
            response = client.config.stub.Save(
                config_service_pb2.SaveConfigRequest(system_pose=tw)
            )
        code, msg = self._check_status(response, "System pose save")

        return {
            "message": f"Saved system pose '{name}' for system '{system_name}'.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "name": name,
            "systemName": system_name,
        }

    def list_system_poses(self):
        """List names of all saved system pose (TargetWaypoint) objects."""
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.ListConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_SYSTEM_POSE,
        )
        with self._create_client() as client:
            response = client.config.stub.List(request)
        self._check_status(response, "List system poses")

        return list(getattr(response, "names", []))

    def list_targets_for_system(self, system_name: str) -> list:
        """List pose names whose parent system matches system_name."""
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        list_req = config_service_pb2.ListConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_SYSTEM_POSE,
        )
        with self._create_client() as client:
            list_resp = client.config.stub.List(list_req)
            self._check_status(list_resp, "List system poses")
            all_names = list(getattr(list_resp, "names", []))

            result = []
            for name in all_names:
                get_req = config_service_pb2.TypeNameConfigRequest(
                    type=config_service_pb2.ConfigType.CONFIG_TYPE_SYSTEM_POSE,
                    name=name,
                )
                get_resp = client.config.stub.Get(get_req)
                parent = getattr(get_resp.system_pose.header, "parent", "")
                if parent == system_name:
                    result.append(name)

        return result

    def get_system_pose(self, name):
        """Retrieve a single system pose (TargetWaypoint) by name.

        Returns a dict with ``name``, ``systemName``, ``tcpName``,
        ``jointAngles``, and ``cartesianPose`` fields.
        """
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.TypeNameConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_SYSTEM_POSE,
            name=name,
        )
        with self._create_client() as client:
            response = client.config.stub.Get(request)
        self._check_status(response, "Get system pose")

        sp = response.system_pose
        result = {
            "name": name,
            "systemName": getattr(sp.header, "parent", ""),
            "tcpName": getattr(sp, "tcp_name", "") or "",
        }

        if sp.HasField("cartesian") and sp.cartesian.HasField("pose"):
            pos = sp.cartesian.pose.position
            rot = sp.cartesian.pose.rotation
            result["cartesianPose"] = {
                "position": [pos.x, pos.y, pos.z],
                "quaternion": [rot.x, rot.y, rot.z, rot.w],
            }
        else:
            result["cartesianPose"] = None

        if sp.HasField("joint") and sp.joint.position:
            result["jointAngles"] = list(sp.joint.position)
        else:
            result["jointAngles"] = None

        if sp.header.HasField("pose_in_parent"):
            pip = sp.header.pose_in_parent
            result["poseInParent"] = {
                "position": [pip.position.x, pip.position.y, pip.position.z],
                "quaternion": [pip.rotation.x, pip.rotation.y, pip.rotation.z, pip.rotation.w],
            }
        else:
            result["poseInParent"] = None

        return result

    def remove_system_pose(self, name):
        """Remove a system pose (TargetWaypoint) from the nebula server."""
        config_service_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_service_pb2.TypeNameConfigRequest(
            type=config_service_pb2.ConfigType.CONFIG_TYPE_SYSTEM_POSE,
            name=name,
        )
        with self._create_client() as client:
            response = client.config.stub.Remove(request)
        code, msg = self._check_status(response, "System pose removal")

        return {
            "message": f"Removed system pose '{name}'.",
            "status": {"code": code, "message": msg},
            "target": self.target,
            "name": name,
        }
