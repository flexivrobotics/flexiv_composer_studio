"""
Example: Create a workcell, add a robot system, and query the components service using the Flexiv Nebula SDK.

This script demonstrates how to:
  1. Create a new workcell
  2. Add one robot system to the scene
  3. Query the components service for information about the robot system and available components
"""
import grpc
from google.protobuf import empty_pb2

from flexiv.pdk import Client

# Services
from flexiv.pdk.workcell.workcell_service_pb2 import CreateRequest, NameRequest
from flexiv.pdk.system.system_service_pb2 import GetUrdfRequest, GetArmSerialNumberRequest
from flexiv.pdk.config_service_pb2 import SaveConfigRequest

# Protobuf messages
from flexiv.pdk.system.system_pb2 import System
from flexiv.pdk.system.components.manipulator_pb2 import Manipulator
from flexiv.pdk.config_header_pb2 import ConfigHeader
from flexiv.pdk.spatial.geometry_pb2 import SE3Pose, Vector3, Quaternion


def main():
    target = "localhost:50052"
    print(f"Connecting to Nebula at {target}...")

    # We use insecure channel, wrapped in our Client
    with Client(target) as client:
        workcell_name = "example_workcell"

        # 1. Remove any existing workcell
        print(f"Removing any existing workcell with name: {workcell_name}")
        try:
            client.workcell.stub.Remove(NameRequest(name=workcell_name))
        except grpc.RpcError as e:
            print(f"Remove workcell failed or not present: {e}")

        # 2. Create a workcell        
        print(f"Creating workcell: {workcell_name}")
        req = CreateRequest(name=workcell_name, description="A dual-robot setup with objects")
        try:
            client.workcell.stub.Create(req)
            client.workcell.stub.Load(NameRequest(name=workcell_name))
        except grpc.RpcError as e:
            print(f"Workcell operation failed or environment not running a server yet: {e}")

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

        # 3. Add a robot system to the scene
        print("Saving robot system to the scene...")

        # System 1: Placed at x=-0.7, facing +x (rz=0)
        sys1 = System(
            header=make_header("system_1", px=-0.0, py=0.0, pz=0.0),
            control_box_serial_number="CX01-01-T1-000001",
            manipulator=Manipulator(
                name="arm",
                arm_serial_number="A02L-00-M3-000001"
            )
        )
        try:
            client.config.stub.Save(SaveConfigRequest(system=sys1))
        except grpc.RpcError:
            pass

        # 4. Get the system urdf
        print("Getting system urdf...")
        try:
            urdf_response = client.system.stub.GetUrdf(GetUrdfRequest(name="system_1"))
            if (urdf_response.status.code == 0):
                print(f"URDF for system_1:\n{urdf_response.urdf_content}")
        except grpc.RpcError as e:
            print(f"GetURDF failed: {e}")   

        # 5. Get the arm serial number
        print("")
        print("Getting arm serial number...")
        try:
            arm_serial_response = client.system.stub.GetArmSerialNumber(GetArmSerialNumberRequest(system_name="system_1"))
            if (arm_serial_response.status.code == 0):
                print(f"Arm serial number for system_1: {arm_serial_response.arm_serial_number}")
                print(f"Arm public serial number for system_1: {arm_serial_response.arm_public_serial_number}")
        except grpc.RpcError as e:
            print(f"GetArmSerialNumber failed: {e}")

        # 6. List the available tool adapters
        print("")
        print("Listing tool adapters...")
        try:
            tool_adapters_response = client.system_config.stub.ListToolAdapters(empty_pb2.Empty())
            if (tool_adapters_response.status.code == 0):
                for item in tool_adapters_response.items:
                    print(f"Tool adapter manufacturer: {item.manufacturer}, model: {item.model}")   

        except grpc.RpcError as e:
            print(f"ListToolAdapters failed: {e}")

        # 7. List the available tools
        print("")
        print("Listing tools...")
        try:
            tools_response = client.system_config.stub.ListTools(empty_pb2.Empty())
            if (tools_response.status.code == 0):
                for item in tools_response.items:
                    print(f"Tool manufacturer: {item.manufacturer}, model: {item.model}")
        except grpc.RpcError as e:
            print(f"ListTools failed: {e}")

        # 8. List the available external robot axes
        print("")
        print("Listing external robot axes...")
        try:
            axes_response = client.system_config.stub.ListExternalRobotAxes(empty_pb2.Empty())
            if (axes_response.status.code == 0):
                for item in axes_response.items:
                    print(f"External robot axis manufacturer: {item.manufacturer}, model: {item.model}")
        except grpc.RpcError as e:
            print(f"ListExternalRobotAxes failed: {e}")


if __name__ == "__main__":
    main()