"""Route registration modules for the web app."""

from .camera_routes import register_camera_routes
from .collision_routes import register_collision_routes
from .config_routes import register_config_routes
from .general_routes import register_general_routes
from .license_routes import register_license_routes
from .ptp_routes import register_ptp_routes
from .scene_event_routes import register_scene_event_routes
from .scene_object_routes import register_scene_object_routes
from .system_routes import register_system_routes
from .target_routes import register_target_routes
from .toolpath_routes import register_toolpath_routes
from .workcell_routes import register_workcell_routes

__all__ = [
    "register_camera_routes",
    "register_collision_routes",
    "register_config_routes",
    "register_license_routes",
    "register_ptp_routes",
    "register_workcell_routes",
    "register_system_routes",
    "register_scene_object_routes",
    "register_scene_event_routes",
    "register_toolpath_routes",
    "register_target_routes",
    "register_general_routes",
]
