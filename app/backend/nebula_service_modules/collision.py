DEFAULT_COLLISION_CONFIG_NAME = "default"


class CollisionService:
    """Collision configuration management methods."""

    def list_collision_components(self):
        """List all valid component names for collision pairs (scene objects and system components)."""
        collision_service_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_service_pb2"
        )
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        with self._create_client() as client:
            response = client.collision.stub.ListComponents(empty_pb2.Empty())
        self._check_status(response, "List collision components")
        return list(getattr(response, "names", []))

    def list_collision_configs(self):
        """List names of all saved collision configurations."""
        collision_service_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_service_pb2"
        )
        empty_pb2 = self._get_module("google.protobuf.empty_pb2")
        with self._create_client() as client:
            response = client.collision.stub.List(empty_pb2.Empty())
        self._check_status(response, "List collision configs")
        return list(getattr(response, "names", []))

    def get_collision_config(self, name):
        """Get a collision config's margin and excluded pairs by name.

        The config named DEFAULT_COLLISION_CONFIG_NAME is relied on everywhere
        else in the app (IK checks, PTP planning) as always gettable, so if it
        hasn't been explicitly saved yet this returns its zero-value defaults
        instead of raising. Any other name that fails to load raises normally.
        """
        collision_service_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_service_pb2"
        )
        try:
            with self._create_client() as client:
                response = client.collision.stub.Get(
                    collision_service_pb2.NameRequest(name=name)
                )
            self._check_status(response, "Get collision config")
        except RuntimeError:
            if name == DEFAULT_COLLISION_CONFIG_NAME:
                return {"name": name, "pairs": [], "collisionMargin": 0.0}
            raise

        config = response.collision_config
        pairs = [
            {"name1": p.name1, "name2": p.name2}
            for p in getattr(config, "pairs", [])
        ]
        return {
            "name": name,
            "pairs": pairs,
            "collisionMargin": config.collision_margin,
        }

    def create_collision_config(self, name, collision_margin=0.0):
        """Create a new, empty collision config (no excluded pairs)."""
        return self._save_collision_config(name, collision_margin, pairs=[])

    def update_collision_config_margin(self, name, collision_margin):
        """Update a collision config's margin, preserving its existing pairs."""
        current = self.get_collision_config(name)
        return self._save_collision_config(name, collision_margin, pairs=current["pairs"])

    def _save_collision_config(self, name, collision_margin, pairs):
        """Save a collision config with the given name, margin, and full pairs list."""
        collision_config_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_config_pb2"
        )
        collision_service_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_service_pb2"
        )
        config = collision_config_pb2.CollisionConfig(
            name=name,
            pairs=[
                collision_config_pb2.CollisionPair(name1=p["name1"], name2=p["name2"])
                for p in pairs
            ],
            collision_margin=float(collision_margin),
        )
        with self._create_client() as client:
            response = client.collision.stub.Save(
                collision_service_pb2.SaveRequest(collision_config=config)
            )
        code, msg = self._check_status(response, "Save collision config")
        return {
            "name": name,
            "pairs": pairs,
            "collisionMargin": float(collision_margin),
            "status": {"code": code, "message": msg},
        }

    def update_default_collision_config(self, collision_margin=0.0):
        """Update the default collision config's margin, preserving its pairs.

        Kept for backward compatibility: this is what PTP motion planning calls
        (see ptp.py's plan_ptp_path) after a per-motion collision-margin override.
        """
        return self.update_collision_config_margin(DEFAULT_COLLISION_CONFIG_NAME, collision_margin)

    def rename_collision_config(self, old_name, new_name):
        """Rename a saved collision config."""
        collision_service_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_service_pb2"
        )
        with self._create_client() as client:
            response = client.collision.stub.Rename(
                collision_service_pb2.RenameRequest(old_name=old_name, new_name=new_name)
            )
        code, msg = self._check_status(response, "Rename collision config")
        return {
            "message": f"Renamed collision config '{old_name}' to '{new_name}'.",
            "status": {"code": code, "message": msg},
        }

    def remove_collision_config(self, name):
        """Remove a saved collision config."""
        collision_service_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_service_pb2"
        )
        with self._create_client() as client:
            response = client.collision.stub.Remove(
                collision_service_pb2.NameRequest(name=name)
            )
        code, msg = self._check_status(response, "Remove collision config")
        return {
            "message": f"Removed collision config '{name}'.",
            "status": {"code": code, "message": msg},
        }

    def add_collision_pair(self, name, name1, name2):
        """Add an excluded collision pair to a config."""
        collision_config_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_config_pb2"
        )
        collision_service_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_service_pb2"
        )
        with self._create_client() as client:
            response = client.collision.stub.AddPair(
                collision_service_pb2.AddPairRequest(
                    name=name,
                    pair=collision_config_pb2.CollisionPair(name1=name1, name2=name2),
                )
            )
        code, msg = self._check_status(response, "Add collision pair")
        return {
            "message": f"Added pair ({name1}, {name2}) to collision config '{name}'.",
            "status": {"code": code, "message": msg},
        }

    def remove_collision_pair(self, name, name1, name2):
        """Remove an excluded collision pair from a config."""
        collision_config_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_config_pb2"
        )
        collision_service_pb2 = self._get_module(
            "flexiv.pdk.scene.collision.collision_service_pb2"
        )
        with self._create_client() as client:
            response = client.collision.stub.RemovePair(
                collision_service_pb2.RemovePairRequest(
                    name=name,
                    pair=collision_config_pb2.CollisionPair(name1=name1, name2=name2),
                )
            )
        code, msg = self._check_status(response, "Remove collision pair")
        return {
            "message": f"Removed pair ({name1}, {name2}) from collision config '{name}'.",
            "status": {"code": code, "message": msg},
        }
