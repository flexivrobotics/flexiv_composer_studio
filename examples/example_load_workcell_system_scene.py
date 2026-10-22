import grpc
from google.protobuf import empty_pb2
from flexiv.pdk import Client

# Services
from flexiv.pdk.workcell.workcell_service_pb2 import NameRequest
from flexiv.pdk.config_service_pb2 import ListConfigRequest, TypeNameConfigRequest, ConfigType
from flexiv.pdk.system.system_service_pb2 import GetArmSerialNumberRequest

# Protobuf messages
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

    system.manipulator.name = name
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

    workcell_name = "example_workcell"

    # Check that workcell exists
    list_response = client.workcell.stub.List(empty_pb2.Empty())
    workcell_exists = any(wc.name == workcell_name for wc in list_response.workcells)
    if not workcell_exists:
        print(f"Workcell '{workcell_name}' does not exist.")
        return
    

    # Load the workcell into the scene
    load_response = client.workcell.stub.Load(NameRequest(name=workcell_name))
    if load_response.status.code != 0:
        print(f"Failed to load workcell into scene: {load_response.status.message}")
        return
    
    # List existing systems in the scene
    list_systems_response = client.config.stub.List(ListConfigRequest(type=ConfigType.CONFIG_TYPE_SYSTEM))
    print("Existing systems in the scene:")
    for sys in list_systems_response.names:
        print(f"- {sys}")

        # Get system details
        system_response = client.config.stub.Get(TypeNameConfigRequest(type=ConfigType.CONFIG_TYPE_SYSTEM, name=sys))
        system = system_response.system
        print(f"  System name: {system.header.name}")
        print(f"  External axis name: {system.external_robot_axis.name}")
        print(f"  External axis DoF: {len(system.external_robot_axis.home_position)}")
        print(f"  Manipulator name: {system.manipulator.name}")
        print(f"  Manipulator serial number: {system.manipulator.arm_serial_number}")
        print(f"  Manipulator DoF: {len(system.manipulator.home_position)}")

        # Print manipulator joint limits
        print(f"  Manipulator joint limits:")
        for i in range(len(system.manipulator.home_position)):
            lower = system.manipulator.lower_limit[i]
            upper = system.manipulator.upper_limit[i]
            print(f"    Joint {i+1}: [{lower}, {upper}]")

        # Get the public serial number of the manipulator (if available)
        system_serial_response = client.system.stub.GetArmSerialNumber(GetArmSerialNumberRequest(system_name=sys))
        if system_serial_response.status.code == 0:
            print(f"  Public manipulator serial number: {system_serial_response.arm_public_serial_number}")
        else:
            print(f"  Failed to get public manipulator serial number: {system_serial_response.status.message}") 
            
    # List existing objects in the scene
    list_objects_response = client.config.stub.List(ListConfigRequest(type=ConfigType.CONFIG_TYPE_OBJECT))
    print("Existing objects in the scene:")
    for obj in list_objects_response.names:
        print(f"- {obj}")

    # List existing coordinate frames in the scene
    list_frames_response = client.config.stub.List(ListConfigRequest(type=ConfigType.CONFIG_TYPE_COORDINATE))
    print("Existing coordinate frames in the scene:")
    for frame in list_frames_response.names:
        print(f"- {frame}")

    # Get the URDF of the scene of the loaded workcell
    urdf_response = client.config.stub.GetUrdf(empty_pb2.Empty())
    if (urdf_response.status.code == 0):
        print("Successfully retrieved URDF of the loaded workcell scene.")
        print(urdf_response.urdf_content)
        
    

if __name__ == "__main__":
    main()