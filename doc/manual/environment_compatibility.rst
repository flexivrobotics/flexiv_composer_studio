Environment Compatibility
=========================

Composer Studio runs on the following operating systems, runtimes and
browsers.

Requirements
------------

.. list-table::
   :header-rows: 1
   :widths: 30 25 45

   * - Component
     - Version
     - Notes
   * - Operating system
     - Ubuntu 22.04, 24.04
     - The launch scripts are Bash and open the browser with ``xdg-open``.
   * - Python
     - 3.10, 3.12 or 3.14
     - ``flexivpdk`` needs 3.10 or newer, and the pinned ``flexivrdk`` has
       builds only for these three. Ubuntu 22.04 ships 3.10 and 24.04 ships
       3.12.
   * - Node.js and npm
     - 20.19+ or 22.12+
     - Needed to build the editor. Older Node.js releases fail during
       ``npm run build``.
   * - Flexiv PDK (``flexivpdk``)
     - Same release as the server
     - Installed from PyPI (:doc:`install_composer_studio`).
   * - Flexiv RDK (``flexivrdk``)
     - 1.9.4.1
     - Pinned in ``app/backend/requirements.txt``; used to connect to real
       robots running Flexiv software package v3.11.3.
   * - PDK server
     - |version_full|
     - Running on the same computer, ``localhost:50052`` by default.
   * - Web browser
     - Current Chrome, Edge or Firefox
     - WebGL and WebSocket support are required.

Version compatibility
---------------------

Composer Studio has no version number of its own: it follows the PDK release
of the ``flexivpdk`` package it runs with. Install the ``flexivpdk`` version
that matches your PDK server. A mismatch usually shows up as gRPC errors from
every request.

Same machine as the server
--------------------------

Install and run Composer Studio on the same computer as the Flexiv PDK
server. The backend reads and writes mesh, URDF and area files directly in the
PDK Release Folder, then passes the server the matching path, so a server on
another computer is not supported. A server running in a container on the
same computer works; see :doc:`launch_composer_studio`.
