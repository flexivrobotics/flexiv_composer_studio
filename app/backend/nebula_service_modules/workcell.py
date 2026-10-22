from workcell_support import (
    check_scene_object_local_urdf_path,
    check_system_local_urdf_path,
    convert_urdf_content_paths_from_server_path_to_local_path,
    list_areas,
)


class WorkcellService:
    """Workcell management methods."""

    def list_workcells(self):
        """List all available workcells on the server."""
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        with self._create_client() as client:
            response = client.workcell.stub.List(empty_pb2.Empty())

            active_workcell = None
            try:
                active_response = client.workcell.stub.GetActive(empty_pb2.Empty())
                active_workcell = getattr(active_response, "name", None)
                if not active_workcell and hasattr(active_response, "workcell"):
                    active_workcell = getattr(active_response.workcell, "name", None)
            except Exception:
                active_workcell = None

        workcells = []
        for wc in getattr(response, "workcells", []):
            workcells.append(
                {
                    "name": getattr(wc, "name", ""),
                    "description": getattr(wc, "description", ""),
                }
            )

        return {
            "source": "nebula",
            "target": self.target,
            "activeWorkcell": active_workcell,
            "workcells": workcells,
        }

    def create_workcell(self, workcell_name, description=""):
        """Create a new workcell."""
        workcell_pb2 = self._get_module("flexiv.pdk.workcell.workcell_service_pb2")
        with self._create_client() as client:
            request = workcell_pb2.CreateRequest(name=workcell_name, description=description)
            response = client.workcell.stub.Create(request)

        code, message = self._check_status(response, "Workcell creation")

        created_wc = getattr(response, "workcell", None)
        return {
            "message": f"Created workcell '{workcell_name}'.",
            "status": {"code": code, "message": message},
            "target": self.target,
            "workcell": getattr(created_wc, "name", workcell_name)
            if created_wc
            else workcell_name,
            "description": getattr(created_wc, "description", description)
            if created_wc
            else description,
        }

    def delete_workcell(self, workcell_name):
        """Delete an existing workcell."""
        workcell_pb2 = self._get_module("flexiv.pdk.workcell.workcell_service_pb2")
        with self._create_client() as client:
            response = client.workcell.stub.Remove(workcell_pb2.NameRequest(name=workcell_name))

        code, message = self._check_status(response, "Workcell deletion")

        return {
            "message": f"Deleted workcell '{workcell_name}'.",
            "status": {"code": code, "message": message},
            "target": self.target,
            "workcell": workcell_name,
        }

    def load_workcell(self, workcell_name):
        """Load a workcell and prepare local URDF files for visualization."""
        print(
            f"[load_workcell] called: workcell={workcell_name!r} target={self.target!r}",
            flush=True,
        )
        workcell_pb2 = self._get_module("flexiv.pdk.workcell.workcell_service_pb2")
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        print(f"[load_workcell] connecting to nebula server at {self.target!r} ...", flush=True)
        with self._create_client() as client:
            print("[load_workcell] connected; calling WorkcellService.Load (SDK gRPC) ...", flush=True)
            response = client.workcell.stub.Load(workcell_pb2.NameRequest(name=workcell_name))
            status = getattr(response, "status", None)
            print(
                f"[load_workcell] Load returned: status.code="
                f"{getattr(status, 'code', 'n/a')} status.message="
                f"{getattr(status, 'message', '')!r}",
                flush=True,
            )
            code, message = self._check_status(response, "Workcell load")

            # Read back what the server now reports as active, on the SAME
            # connection, to confirm the Load actually took effect on the
            # instance that answered (and that later ConfigService calls will
            # hit the same active-workcell state).
            try:
                active_resp = client.workcell.stub.GetActive(empty_pb2.Empty())
                active_name = getattr(active_resp, "name", None) or getattr(
                    getattr(active_resp, "workcell", None), "name", None
                )
                print(f"[load_workcell] server reports active workcell = {active_name!r}", flush=True)
            except Exception as e:
                print(f"[load_workcell] could not read active workcell: {e!r}", flush=True)

        systems_info = self._get_systems_info(workcell_name)
        scene_object_info = self._get_scene_object_info(workcell_name)
        area_registry = list_areas(workcell_name)

        return {
            "workcell": workcell_name,
            "systems": systems_info,
            "sceneObjects": scene_object_info,
            "areas": area_registry,
            "status": {"code": code},
        }

    def _get_systems_info(self, workcell_name):
        """Collect URDF info for all systems in a loaded workcell."""
        with self._create_client() as client:
            system_names = self._list_loaded_system_names(client)
        systems_info = []
        for system_name in system_names:
            try:
                urdf_local_path = check_system_local_urdf_path(workcell_name, system_name)
                mod_urdf_path = convert_urdf_content_paths_from_server_path_to_local_path(
                    urdf_local_path
                )
                systems_info.append(
                    {
                        "name": system_name,
                        "urdf_local_path": str(urdf_local_path),
                        "modified_urdf_local_path": str(mod_urdf_path),
                    }
                )
            except FileNotFoundError:
                systems_info.append(
                    {
                        "name": system_name,
                        "urdf_local_path": None,
                        "modified_urdf_local_path": None,
                        "error": f"URDF file not found for system: {system_name}",
                    }
                )
        return systems_info

    def _get_scene_object_info(self, workcell_name):
        """Collect URDF info for scene objects in a loaded workcell."""
        try:
            scene_urdf_path = check_scene_object_local_urdf_path(workcell_name)
            mod_scene_urdf_path = (
                convert_urdf_content_paths_from_server_path_to_local_path(scene_urdf_path)
            )
            return {
                "urdf_local_path": str(scene_urdf_path),
                "modified_urdf_local_path": str(mod_scene_urdf_path),
            }
        except FileNotFoundError:
            return None

    def get_system_urdf_info(self, workcell_name, system_name):
        """Load the workcell and return URDF info for a specific system."""
        workcell_pb2 = self._get_module("flexiv.pdk.workcell.workcell_service_pb2")
        with self._create_client() as client:
            client.workcell.stub.Load(workcell_pb2.NameRequest(name=workcell_name))

        systems_info = self._get_systems_info(workcell_name)
        for sys_info in systems_info:
            if sys_info.get("name") == system_name:
                return sys_info
        raise RuntimeError(
            f'System "{system_name}" not found in workcell "{workcell_name}".'
        )
