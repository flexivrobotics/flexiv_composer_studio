Troubleshooting
===============

Most errors appear as a short message at the top of the window. Messages that
end in ``(code: N)`` come from the PDK server. The code is the PDK's own status
code, not a gRPC status code:

.. list-table::
   :header-rows: 1
   :widths: 15 35 50

   * - Code
     - Name
     - Meaning
   * - 1
     - ``NOT_FOUND``
     - The named item was not found.
   * - 2
     - ``INVALID_ARGUMENT``
     - The request had invalid arguments.
   * - 3
     - ``INTERNAL_ERROR``
     - The request failed on the server, for example no IK solution.
   * - 4
     - ``FAILED_PRECONDITION``
     - A precondition is not met, for example no active workcell.
   * - 5
     - ``PERMISSION_DENIED``
     - The feature needs a license this computer does not have.

The terminal running ``run_app.sh`` shows more detail.

The browser shows a blank page or ``{"detail":"Not Found"}``
   The editor was not built. Run ``npm install`` in ``app/frontend`` and start
   again with ``./run_app.sh``. Check the terminal for build errors.

``npm run build`` fails with a syntax or engine error
   Node.js is too old. Install Node.js 20.19+ or 22.12+
   (:doc:`install_composer_studio`).

``flexiv.pdk is not available``
   The backend runs in a Python environment without ``flexivpdk``. Activate
   the virtual environment you installed into, or install ``flexivpdk`` into
   it (:doc:`install_composer_studio`).

**Failed to fetch workcells.**, or other requests fail with no detail
   The backend cannot reach the PDK server. Check that the server is running,
   and that ``NEBULA_TARGET`` names it (default ``localhost:50052``). Test with
   ``pdk-scene workcell list``.

``The path "<path>" does not exist. Please specify a valid Nebula release folder to continue.``
   The PDK Release Folder is wrong. Choose the folder that holds the server's
   ``workcell/`` directory (:doc:`launch_composer_studio`).

``... (code: 4)``: ``No active Workcell is loaded``
   No workcell is active on the server, for example after the server
   restarted. Load a workcell with **Workcell Setup** (:doc:`workcells`).

``... (code: 5)``
   The feature needs a license this server does not have. Open the
   **License Manager** (:doc:`activate_licenses`).

Requests fail with a gRPC ``INTERNAL`` error and no details
   The ``flexivpdk`` version does not match the server. Install the version
   matching your server release (:doc:`install_composer_studio`).

A mesh, robot or area does not appear after loading a workcell
   Composer Studio reads these files from the PDK Release Folder. Check that
   the folder is correct, and that ``WORKCELL_ROOT`` and ``NEBULA_ROOT`` map
   the same folder as seen by Composer Studio and by the server
   (:doc:`launch_composer_studio`).

**Insert** stays disabled for a mesh
   Select an ``.obj`` file and enter a **Name**. Only ``.obj`` meshes are
   supported. If a **Required .mtl file** row is shown, select that file too.

The **+** buttons in the tree are disabled
   Load a workcell first, and make sure **Live Scene Events** is off. The
   buttons are also disabled while a **Setup Area** or **Setup Path** form is
   open; close it first.

Nothing happens when I double-click the object
   Double-clicking places points only while the **Setup Area** or **Setup
   Path** form is open, and only on that form's object.

**Create Trajectory** stays disabled for a linear path trajectory
   The robot cannot reach the first pose of the path. Adjust the **Initial
   Configuration**, the **Normal Offset**, or the position of the part or robot
   (:doc:`linear_path_trajectories`).

``Collision check failed: IK computation failed: IK solver failed due to collision (code: 3)``
   The pose collides with the scene or with the robot itself, given the
   ``default`` collision configuration. Change the pose, or adjust the margin
   and excluded pairs (:doc:`collision_configs`).

PTP planning fails
   Check that every target is collision-free and that the **Collision
   Margin** is not larger than the free space around the robot. Planning
   always uses the ``default`` collision configuration.

**Failed to connect to system:**
   See the table in :doc:`connect_to_robot`.

The robot does not move when I use the Position tab
   This is expected: jogging the real robot is not available in this release
   (:doc:`connect_to_robot`).

Composer Studio changes made in another window do not appear
   Composer Studio does not refresh on its own. Load the workcell again, or
   turn on **Live Scene Events** to follow scene-object changes
   (:doc:`live_scene_events`).

Port 8011 is already in use
   Another Composer Studio is running. Stop it, or start the backend on
   another port (:doc:`launch_composer_studio`).
