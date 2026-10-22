Launch Composer Studio
======================

Start the app
-------------

Make sure the PDK server is running, activate the virtual environment from
:doc:`install_composer_studio`, then run from the root of the Composer Studio
checkout:

.. code-block:: bash

   cd app
   ./run_app.sh

The script:

1. Builds the editor into ``app/frontend/dist`` (``npm run build``).
2. Starts the backend on port **8011**.
3. Opens ``http://localhost:8011`` in your default browser. If no browser
   opens, browse to that address yourself.

Stop it with :kbd:`Ctrl+C` in the terminal. The port is fixed at 8011 in
``run_app.sh``; to use another, start the backend yourself:

.. code-block:: bash

   python3 backend/web_server.py 8012 --directory frontend/dist

Choose the PDK server
---------------------

The backend connects to ``localhost:50052`` by default. To use a server on
another port of this computer, set ``NEBULA_TARGET`` before starting:

.. code-block:: bash

   NEBULA_TARGET=localhost:50053 ./run_app.sh

There is no setting for this in the editor. A server on another computer is not
supported (:doc:`environment_compatibility`).

Set the PDK Release Folder
--------------------------

The **PDK Release Folder** is the folder that holds the server's
``workcell/`` directory, where workcell files such as meshes and URDFs are
kept. The backend reads and writes those files directly, so it must know where
the folder is, both on your computer and as the server sees it.

.. list-table:: Environment variables
   :header-rows: 1
   :widths: 22 30 48

   * - Variable
     - Default
     - Meaning
   * - ``NEBULA_TARGET``
     - ``localhost:50052``
     - Address of the PDK server on this computer.
   * - ``WORKCELL_ROOT``
     - See below
     - The PDK Release Folder on this computer.
   * - ``NEBULA_ROOT``
     - ``/home/flexiv``
     - The same folder as the server sees it. For a PDK server running in a
       container, this is the path inside the container.

When ``WORKCELL_ROOT`` is not set, the backend uses the path written in
``/tmp/flexiv_nebula_sdk_server_path.txt`` if that file exists, and otherwise
the folder that contains the Composer Studio checkout.

You can also change the folder while the app is running: type a path into
**PDK Release Folder:** in the header bar and press :kbd:`Enter`, or click the
folder button to browse (:doc:`workcells`). The setting lasts until the backend
restarts. If the folder does not exist, the field turns red. Composer Studio
shows ``Directory not found: <path>`` when you enter it, and this message when
the page loads or you click **Workcell Setup**:

.. code-block:: text

   The path "<path>" does not exist. Please specify a valid Nebula release folder to continue.

Develop the editor with hot reload
----------------------------------

To change the editor's code and see the result without rebuilding, run the
backend and the Vite development server separately:

.. code-block:: bash

   python3 backend/web_server.py 8011 --directory frontend/dist   # terminal 1
   cd frontend && npm run dev                                     # terminal 2

The editor calls the backend on the same address it was loaded from (paths
starting ``/api``), and the Vite configuration has no proxy for them. Add a
``server.proxy`` entry for ``/api`` to ``frontend/vite.config.ts`` that points
at ``http://localhost:8011`` (with ``ws: true``, for live scene events) before
using the development server.

Network access
--------------

.. important::

   The backend listens on **all network interfaces** (``0.0.0.0:8011``) and has
   no login. Anyone who can reach port 8011 can edit your workcells and read
   files on this computer through the backend. Run Composer Studio only on a
   trusted network, or block port 8011 with a firewall.
