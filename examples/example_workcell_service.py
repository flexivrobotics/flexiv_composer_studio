import grpc
from google.protobuf import empty_pb2
from flexiv.pdk import Client

# Services
from flexiv.pdk.workcell.workcell_service_pb2 import (
    CreateRequest,
    NameRequest
)

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


if __name__ == "__main__":
    main()