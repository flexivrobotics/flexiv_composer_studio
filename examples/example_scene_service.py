import grpc
from google.protobuf import empty_pb2
from flexiv.pdk import Client

# Services
from flexiv.pdk.workcell.workcell_service_pb2 import (
    CreateRequest,
    NameRequest,
)
from flexiv.pdk.config_service_pb2 import SaveConfigRequest

# Protobuf messages
from flexiv.pdk.scene.object_pb2 import Object
from flexiv.pdk.system.system_pb2 import System
from flexiv.pdk.config_header_pb2 import ConfigHeader
from flexiv.pdk.spatial.geometry_pb2 import SE3Pose, Vector3, Quaternion

# Helper to construct header
def make_header(name, parent="world", px=0.0, py=0.0, pz=0.0, rw=1.0, rx=0.0, ry=0.0, rz=0.0):
    return ConfigHeader(
        name=name,
        parent=parent,
        pose_in_parent=SE3Pose(
            position=Vector3(x=px, y=py, z=pz),
            rotation=Quaternion(x=rx, y=ry, z=rz, w=rw)
        )
    )

def create_system(name, arm_serial_number, control_box_serial_number, pose, tool_info):
    system = System(
        header=ConfigHeader(name=name, parent="world", pose_in_parent=pose),
        control_box_serial_number=control_box_serial_number,
    )

    system.manipulator_adapter.name = "manipulator_adapter"
    system.manipulator_adapter.mass = 0.0
    system.manipulator_adapter.inertia.extend([0.0] * 9)
    system.manipulator_adapter.xyz.extend([0.0, 0.0, 0.0])
    system.manipulator_adapter.rpy.extend([0.0, 0.0, 0.0])

    system.manipulator.name = "manipulator"
    system.manipulator.arm_serial_number = arm_serial_number
    system.manipulator.lower_limit.extend([-2.76] * 7)
    system.manipulator.upper_limit.extend([2.76] * 7)
    system.manipulator.home_position.extend([0.0] * 7)

    system.tool_adapter.name = "tool_adapter"
    system.tool_adapter.manufacturer = "Mirka"
    system.tool_adapter.model = "AIROS-adapter"
    system.tool_adapter.rotation = 0.0

    if tool_info is not None:
        tool1 = system.tool.add()
        tool1.name = tool_info.get("name", "tool1")
        tool1.manufacturer = tool_info.get("manufacturer", "OnRobot")
        tool1.model = tool_info.get("model", "Sander")

    return system

def make_box(name, px, py, pz, size_x, size_y, size_z):
    obj = Object(header=make_header(name, px=px, py=py, pz=pz))

    collision = obj.collision.add()
    collision.origin.position.x = 0.0
    collision.origin.position.y = 0.0
    collision.origin.position.z = 0.0
    collision.origin.rotation.x = 0.0
    collision.origin.rotation.y = 0.0
    collision.origin.rotation.z = 0.0
    collision.origin.rotation.w = 1.0

    collision.shape.box.size.extend([size_x, size_y, size_z])

    visual = obj.visual.add()
    visual.origin.position.x = 0.0
    visual.origin.position.y = 0.0
    visual.origin.position.z = 0.0
    visual.origin.rotation.x = 0.0
    visual.origin.rotation.y = 0.0
    visual.origin.rotation.z = 0.0
    visual.origin.rotation.w = 1.0

    visual.shape.box.size.extend([size_x, size_y, size_z])

    return obj

def main():

    target = "localhost:50052"
    print(f"Connecting to Nebula at {target}...")

    try:
        channel = grpc.insecure_channel(target)
        grpc.channel_ready_future(channel).result(timeout=5)
        print("Successfully connected to Nebula.")
    except grpc.FutureTimeoutError:
        print(f"Failed to connect to Nebula at {target}. Please ensure the server is running.")
        return
    
    client = Client(target)

    # List existing workcells
    list_response = client.workcell.stub.List(empty_pb2.Empty())
    print("Existing workcells:")
    for wc in list_response.workcells:
        print(f"- {wc.name}: {wc.description}")

    workcell_name = "example_workcell"

    # Delete workcell if it already exists
    list_response = client.workcell.stub.List(empty_pb2.Empty())
    for wc in list_response.workcells:
        if wc.name == workcell_name:
            delete_response =  client.workcell.stub.Remove(NameRequest(name=workcell_name))
            status = delete_response.status
            if status.code != 0:
                print(f"Failed to delete existing workcell: {status.message}")
                return
            else:
                print(f"Deleted existing workcell with name: {workcell_name}")
            break

    # Create a new workcell    
    create_response = client.workcell.stub.Create(CreateRequest(name=workcell_name))
    status = create_response.status
    if status.code != 0:
        print(f"Failed to create workcell: {status.message}")
        return
    else:
        print(f"Workcell created with name: {workcell_name}")

    # Load the new workcell into the scene
    load_response = client.workcell.stub.Load(NameRequest(name=workcell_name))
    if load_response.status.code != 0:
        print(f"Failed to load workcell into scene: {load_response.status.message}")
        return

    # Create a new system_1
    system_1 = create_system(
        name="system_1",
        arm_serial_number="A02L-00-M3-000001",
        control_box_serial_number="CX01-01-T1-000001",
        pose=SE3Pose(
            position=Vector3(x=-0.0, y=0.0, z=0.0),
            rotation=Quaternion(x=0.0, y=0.0, z=0.0, w=1.0)
        ),
        tool_info={
            "name": "tool1",
            "manufacturer": "OnRobot",
            "model": "Sander"
        }
    )
    
    system_response = client.config.stub.Save(SaveConfigRequest(system=system_1))
    if system_response.status.code != 0:
        print(f"Failed to save system: {system_response.status.message}")
    else:
        print(f"System saved successfully: {system_1.header.name}")

  
    # Add a box object to the scene
    obj1 = make_box("box_1", px=0.5, py=0.0, pz=0.0, size_x=0.1, size_y=0.1, size_z=0.1)
    add_object_response = client.config.stub.Save(SaveConfigRequest(object=obj1))
    if add_object_response.status.code != 0:
        print(f"Failed to add object to scene: {add_object_response.status.message}")
    else:
        print(f"Object added to scene successfully: {obj1.header.name}")

    # Add a box object to the scene
    obj2 = make_box("box_2", px=-0.5, py=0.0, pz=0.0, size_x=0.1, size_y=0.1, size_z=0.1)
    add_object_response = client.config.stub.Save(SaveConfigRequest(object=obj2))
    if add_object_response.status.code != 0:
        print(f"Failed to add object to scene: {add_object_response.status.message}")
    else:
        print(f"Object added to scene successfully: {obj2.header.name}")
    

if __name__ == "__main__":
    main()