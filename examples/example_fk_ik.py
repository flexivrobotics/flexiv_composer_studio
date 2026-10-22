"""
Example: Create a simple scene with a robot system and compute Forward Kinematics.
"""
import time
import grpc
import numpy as np

from google.protobuf import empty_pb2

from flexiv.pdk import Client

# Services
from flexiv.pdk.workcell.workcell_service_pb2 import CreateRequest, NameRequest
from flexiv.pdk.system.kinematics_service_pb2 import FKRequest, IKRequest
from flexiv.pdk.scene.collision.collision_service_pb2 import SaveRequest as CollisionSaveRequest

# Protobuf messages
from flexiv.pdk.config_service_pb2 import SaveConfigRequest
from flexiv.pdk.system.system_pb2 import System
from flexiv.pdk.config_header_pb2 import ConfigHeader
from flexiv.pdk.spatial.geometry_pb2 import SE3Pose, Vector3, Quaternion
from flexiv.pdk.scene.collision.collision_config_pb2 import CollisionConfig


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

def create_system(name, arm_serial_number, control_box_serial_number, pose):
    system = System(
        header=ConfigHeader(name=name, parent="world", pose_in_parent=pose),
        control_box_serial_number=control_box_serial_number,
    )

    system.manipulator_adapter.name = "manipulator_adapter"
    system.manipulator_adapter.mass = 0.0
    system.manipulator_adapter.inertia.extend([0.0] * 9)
    system.manipulator_adapter.xyz.extend([0.0, 0.0, 0.0])
    system.manipulator_adapter.rpy.extend([0.0, 0.0, 0.0])

    system.manipulator.name = "arm"
    system.manipulator.arm_serial_number = arm_serial_number
    system.manipulator.lower_limit.extend([-2.76] * 7)
    system.manipulator.upper_limit.extend([2.76] * 7)
    system.manipulator.home_position.extend([0.0] * 7)

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
        )
    )
    
    system_response = client.config.stub.Save(SaveConfigRequest(system=system_1))
    if system_response.status.code != 0:
        print(f"Failed to save system: {system_response.status.message}")
    else:
        print(f"System saved successfully: {system_1.header.name}")

    print("Computing Forward Kinematics for system_1.arm.flange...")

    # Save collision configuration
    print("Saving collision configuration...")
    collision_config_name = "default_collision_config"
    try:
        client.collision.stub.Save(CollisionSaveRequest(
            collision_config=CollisionConfig(name=collision_config_name, collision_margin=0.0)
        ))
    except grpc.RpcError as e:
        print(f"Save collision config failed: {e}")

    # Run forward kinematics
    fk_pose = SE3Pose(
        position=Vector3(x=0.13599999999999995, y=-0.11000000000000004, z=1.2550000000000001),
        rotation=Quaternion(x=8.65956056235493e-17, y=0.70710678118654746, z=-1.7319121124709863e-16, w=0.70710678118654757)
    )
    try:
        fk_req = FKRequest(
            system_name="system_1", 
            target_frame_name="system_1.arm.flange", 
            joint_positions=[1.0, 0.4, 0.3, 1.5708, 0.5, 0.4, 0.0]
        )
        t0 = time.time()
        fk_res = client.kinematics.stub.ComputeFK(fk_req)
        elapsed_fk = (time.time() - t0) * 1000
        fk_pose = fk_res.pose
        print(f"\n--- Forward Kinematics Result ({elapsed_fk:.2f} ms) ---")
        print(fk_res)
        print("---------------------------------")
    except grpc.RpcError as e:
        print(f"Kinematics error: {e}")

    # Run inverse kinematics without seed
    print("Computing Inverse Kinematics for system_1.arm.flange without seed...")
    try:
        target_pose = fk_pose
        ik_req = IKRequest(
            system_name="system_1", 
            target_frame_name="system_1.arm.flange", 
            target_pose=target_pose,
            collision_config_name=collision_config_name,
        )
        t0 = time.time()
        ik_res = client.kinematics.stub.ComputeIK(ik_req)
        elapsed_ik = (time.time() - t0) * 1000
        print(f"\n--- Inverse Kinematics Result ({elapsed_ik:.2f} ms) ---")
        print(ik_res)
        print("---------------------------------")
    except grpc.RpcError as e:
        print(f"Kinematics error: {e}")

    # Run inverse kinematics with seed
    time.sleep(0.1)
    print("Computing Inverse Kinematics for system_1.arm.flange with seed...")
    try:
        target_pose = fk_pose
        ik_req = IKRequest(
            system_name="system_1", 
            target_frame_name="system_1.arm.flange", 
            target_pose=target_pose, 
            joint_position_seed=[1.0, 0.4, 0.3, 1.5708, 0.5, 0.4, 0.0],
            collision_config_name=collision_config_name,
        )
        t0 = time.time()
        ik_res = client.kinematics.stub.ComputeIK(ik_req)
        elapsed_ik = (time.time() - t0) * 1000
        print(f"\n--- Inverse Kinematics Result ({elapsed_ik:.2f} ms) ---")
        print(ik_res)
        print("---------------------------------")
    except grpc.RpcError as e:
        print(f"Kinematics error: {e}")

if __name__ == "__main__":
    main()
