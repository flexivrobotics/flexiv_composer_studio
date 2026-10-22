from pathlib import Path

from fastapi import File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse


def register_system_routes(app, get_service, error_response, read_json_request, convert_local_path_to_server_path):
    """Register system and component listing API routes."""

    @app.get('/api/systems')
    def list_systems():
        service, target = get_service()
        try:
            return JSONResponse(service.list_systems())
        except Exception as error:
            return error_response(str(error), target=target, systems=[])

    @app.post('/api/systems')
    async def create_system(request: Request):
        print("[POST /api/systems] request received (Create System clicked)", flush=True)
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            print(f"[POST /api/systems] bad JSON body: {error}", flush=True)
            return error_response(str(error), 400)
        print(f"[POST /api/systems] payload={payload!r}", flush=True)

        name = payload.get('name', '').strip()
        manip_name = payload.get('manipulatorName', '').strip()
        arm_sn = payload.get('armSerialNumber', '').strip()
        box_sn = payload.get('controlBoxSerialNumber', '').strip()
        ext_axis_name = payload.get('externalAxisName', '').strip() or None
        ext_axis_manufacturer = payload.get('externalAxisManufacturer', '').strip() or None
        ext_axis_model = payload.get('externalAxisModel', '').strip() or None
        tool_name = payload.get('toolName', '').strip() or None
        tool_manufacturer = payload.get('toolManufacturer', '').strip() or None
        tool_model = payload.get('toolModel', '').strip() or None
        tool_adapter_name = payload.get('toolAdapterName', '').strip() or None
        tool_adapter_manufacturer = payload.get('toolAdapterManufacturer', '').strip() or None
        tool_adapter_model = payload.get('toolAdapterModel', '').strip() or None
        mount_xyz = payload.get('mountXyz', None)
        mount_rpy = payload.get('mountRpy', None)
        manipulator_mount_xyz = payload.get('manipulatorMountXyz', None)
        manipulator_mount_rpy = payload.get('manipulatorMountRpy', None)

        if not all([name, manip_name, arm_sn, box_sn]):
            return error_response(
                'Missing required fields: name, manipulatorName, armSerialNumber, or controlBoxSerialNumber.',
                400,
            )

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.create_system,
                name,
                manip_name,
                arm_sn,
                box_sn,
                ext_axis_name,
                ext_axis_manufacturer,
                ext_axis_model,
                tool_name,
                tool_manufacturer,
                tool_model,
                tool_adapter_name,
                tool_adapter_manufacturer,
                tool_adapter_model,
                mount_xyz,
                mount_rpy,
                manipulator_mount_xyz,
                manipulator_mount_rpy,
            )
            print(f"[POST /api/systems] create_system succeeded: {result!r}", flush=True)
            return JSONResponse(result)
        except Exception as error:
            print(f"[POST /api/systems] create_system FAILED: {error!r}", flush=True)
            return error_response(str(error), target=target)

    @app.get('/api/systems/flanges')
    def list_system_flanges():
        service, target = get_service()
        try:
            return JSONResponse(service.list_system_flanges())
        except Exception as error:
            return error_response(str(error), target=target, flanges=[])

    @app.post('/api/systems/sync-from-controller')
    async def sync_system_from_controller(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        name = payload.get('name', '').strip()
        serial_number = payload.get('serialNumber', '').strip()

        if not name or not serial_number:
            return error_response('Missing required fields: name or serialNumber.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(service.sync_system_from_controller, name, serial_number)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/systems/{system_name}/targets')
    def list_system_targets(system_name: str):
        service, target = get_service()
        try:
            names = service.list_targets_for_system(system_name)
            return JSONResponse({'targets': names})
        except Exception as error:
            return error_response(str(error), target=target, targets=[])

    @app.get('/api/systems/{system_name}/config')
    def get_system_config(system_name: str):
        service, target = get_service()
        try:
            return JSONResponse(service.get_system_config(system_name))
        except Exception as error:
            return error_response(str(error), target=target, system=system_name)

    @app.get('/api/systems/{system_name}/info')
    def get_system_info(system_name: str):
        service, target = get_service()
        try:
            return JSONResponse(service.get_system_info(system_name))
        except Exception as error:
            return error_response(str(error), target=target, system=system_name)

    @app.get('/api/workcells/{workcell_name}/systems/{system_name}/urdf')
    async def get_system_urdf(workcell_name: str, system_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.get_system_urdf_info,
                workcell_name,
                system_name,
            )
            return JSONResponse(result)
        except Exception as error:
            return error_response(
                str(error),
                target=target,
                workcell=workcell_name,
                system=system_name,
            )

    @app.post('/api/systems/{system_name}/ik')
    async def compute_ik(system_name: str, request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        target_frame = payload.get('targetFrame', '').strip()
        pos = payload.get('position')
        rpy = payload.get('rpy')
        swivel = payload.get('elbowSwivelAngle', 0.0)
        seed = payload.get('jointPositionSeed', None)
        ext_axis_pos = payload.get('externalAxisPosition', None)
        ext_axis_preset = payload.get('externalAxisPositionPreset', True)

        if not all([target_frame, pos, rpy]):
            return error_response('Missing required fields: targetFrame, position, or rpy.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.compute_ik,
                system_name,
                target_frame,
                pos,
                rpy,
                swivel,
                seed,
                ext_axis_pos,
                ext_axis_preset,
            )
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, system=system_name)

    @app.delete('/api/systems/{system_name}')
    async def remove_system(system_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_system, system_name)
            await run_in_threadpool(service.disconnect_system, system_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, system=system_name)

    @app.post('/api/systems/{system_name}/connect')
    async def connect_system(system_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.connect_system, system_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, system=system_name)

    @app.post('/api/systems/{system_name}/disconnect')
    async def disconnect_system(system_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.disconnect_system, system_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, system=system_name)

    @app.get('/api/systems/{system_name}/joint-angles')
    def get_joint_angles(system_name: str):
        service, target = get_service()
        try:
            response = service.get_joint_angles(system_name)
            return JSONResponse(service.get_joint_angles(system_name))
        except Exception as error:
            return error_response(str(error), target=target, system=system_name)

    @app.get('/api/systems/{system_name}/tcp-pose')
    def get_tcp_pose(system_name: str):
        service, target = get_service()
        try:
            return JSONResponse({"tcpPose": service.get_tcp_pose(system_name)})
        except Exception as error:
            return error_response(str(error), target=target, system=system_name)

    @app.get('/api/external-robot-axes')
    def list_external_robot_axes():
        service, target = get_service()
        try:
            return JSONResponse(service.list_external_robot_axes())
        except Exception as error:
            return error_response(str(error), target=target, axes=[])

    @app.get('/api/tools')
    def list_tools():
        service, target = get_service()
        try:
            return JSONResponse(service.list_tools())
        except Exception as error:
            return error_response(str(error), target=target, tools=[])

    @app.get('/api/custom-tools')
    def list_custom_tools():
        service, target = get_service()
        try:
            return JSONResponse(service.list_custom_tools())
        except Exception as error:
            return error_response(str(error), target=target, customTools=[])

    @app.post('/api/custom-tools')
    async def save_custom_tool(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        manufacturer = payload.get('manufacturer', '').strip()
        model = payload.get('model', '').strip()
        tcp = payload.get('tcp', None)
        visual_mesh_path = payload.get('visualMeshPath', None)
        collision_mesh_path = payload.get('collisionMeshPath', None)

        if not manufacturer or not model or not tcp:
            return error_response(
                'Missing required fields: manufacturer, model, or tcp.',
                400,
            )

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.save_custom_tool,
                manufacturer,
                model,
                tcp,
                visual_mesh_path,
                collision_mesh_path,
            )
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/custom-tools/assets/{manufacturer}/{model}')
    async def upload_custom_tool_assets(
        manufacturer: str,
        model: str,
        visual_file: UploadFile = File(None),
        collision_file: UploadFile = File(None),
    ):
        from workcell_support import get_filesystem_root

        assets_dir = get_filesystem_root() / 'custom_components' / 'tools' / f'{manufacturer}_{model}'
        assets_dir.mkdir(parents=True, exist_ok=True)

        visual_path = None
        if visual_file:
            ext = Path(visual_file.filename).suffix or '.obj'
            visual_path = assets_dir / f'visual{ext}'
            visual_path.write_bytes(await visual_file.read())

        collision_path = None
        if collision_file:
            ext = Path(collision_file.filename).suffix or '.obj'
            collision_path = assets_dir / f'collision{ext}'
            collision_path.write_bytes(await collision_file.read())

        return JSONResponse(
            {
                'visualServerPath': str(convert_local_path_to_server_path(visual_path)) if visual_path else None,
                'collisionServerPath': str(convert_local_path_to_server_path(collision_path)) if collision_path else None,
            },
            status_code=201,
        )

    @app.get('/api/custom-tools/{manufacturer}/{model}/usage')
    async def get_custom_tool_usage(manufacturer: str, model: str):
        service, target = get_service()
        try:
            systems = await run_in_threadpool(service.find_systems_using_tool, manufacturer, model)
            return JSONResponse({'systems': systems})
        except Exception as error:
            return error_response(str(error), target=target, systems=[])

    @app.delete('/api/custom-tools/{manufacturer}/{model}')
    async def delete_custom_tool(manufacturer: str, model: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_custom_tool, manufacturer, model)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/tool-adapters')
    def list_tool_adapters():
        service, target = get_service()
        try:
            return JSONResponse(service.list_tool_adapters())
        except Exception as error:
            return error_response(str(error), target=target, toolAdapters=[])

    @app.get('/api/custom-tool-adapters')
    def list_custom_tool_adapters():
        service, target = get_service()
        try:
            return JSONResponse(service.list_custom_tool_adapters())
        except Exception as error:
            return error_response(str(error), target=target, customToolAdapters=[])

    @app.post('/api/custom-tool-adapters')
    async def save_custom_tool_adapter(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        manufacturer = payload.get('manufacturer', '').strip()
        model = payload.get('model', '').strip()
        flanges = payload.get('flanges', None)
        visual_mesh_path = payload.get('visualMeshPath', None)
        collision_mesh_path = payload.get('collisionMeshPath', None)

        if not manufacturer or not model or not flanges:
            return error_response(
                'Missing required fields: manufacturer, model, or flanges.',
                400,
            )

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.save_custom_tool_adapter,
                manufacturer,
                model,
                flanges,
                visual_mesh_path,
                collision_mesh_path,
            )
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/custom-tool-adapters/assets/{manufacturer}/{model}')
    async def upload_custom_tool_adapter_assets(
        manufacturer: str,
        model: str,
        visual_file: UploadFile = File(None),
        collision_file: UploadFile = File(None),
    ):
        from workcell_support import get_filesystem_root

        assets_dir = get_filesystem_root() / 'custom_components' / 'tool_adapters' / f'{manufacturer}_{model}'
        assets_dir.mkdir(parents=True, exist_ok=True)

        visual_path = None
        if visual_file:
            ext = Path(visual_file.filename).suffix or '.obj'
            visual_path = assets_dir / f'visual{ext}'
            visual_path.write_bytes(await visual_file.read())

        collision_path = None
        if collision_file:
            ext = Path(collision_file.filename).suffix or '.obj'
            collision_path = assets_dir / f'collision{ext}'
            collision_path.write_bytes(await collision_file.read())

        return JSONResponse(
            {
                'visualServerPath': str(convert_local_path_to_server_path(visual_path)) if visual_path else None,
                'collisionServerPath': str(convert_local_path_to_server_path(collision_path)) if collision_path else None,
            },
            status_code=201,
        )

    @app.get('/api/custom-tool-adapters/{manufacturer}/{model}/usage')
    async def get_custom_tool_adapter_usage(manufacturer: str, model: str):
        service, target = get_service()
        try:
            systems = await run_in_threadpool(service.find_systems_using_tool_adapter, manufacturer, model)
            return JSONResponse({'systems': systems})
        except Exception as error:
            return error_response(str(error), target=target, systems=[])

    @app.delete('/api/custom-tool-adapters/{manufacturer}/{model}')
    async def delete_custom_tool_adapter(manufacturer: str, model: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_custom_tool_adapter, manufacturer, model)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)
