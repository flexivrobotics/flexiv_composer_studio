"""Nebula service facade composed from category-specific modules."""

from nebula_service_modules import (
    CameraService,
    CollisionService,
    KinematicsService,
    LicenseService,
    NebulaServiceBase,
    PointToPointService,
    SceneObjectService,
    SystemService,
    ToolpathService,
    WorkcellService,
)


class NebulaServices(
    WorkcellService,
    SystemService,
    SceneObjectService,
    CameraService,
    CollisionService,
    PointToPointService,
    KinematicsService,
    ToolpathService,
    LicenseService,
    NebulaServiceBase,
):
    """Service to interact with Flexiv Nebula server for workcell management."""

    pass
