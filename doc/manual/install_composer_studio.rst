Install Composer Studio
=======================

Composer Studio runs from source. You install its Python backend into a Python
environment and build its web editor with npm. You also need a running **PDK
server**; starting the server is covered by the server's own documentation.

.. important::

   Install Composer Studio on the **same computer as the Flexiv PDK server**.
   Its backend reads and writes workcell files directly in the server's PDK
   Release Folder, so it cannot work with a server on another computer. See
   :doc:`environment_compatibility`.

.. note::

   The ``flexivpdk`` version must match the PDK server version. Replace
   ``<version>`` below with the version of the PDK release you are running.

Get the source
--------------

.. code-block:: bash

   git clone https://github.com/flexivrobotics/flexiv_composer_studio.git
   cd flexiv_composer_studio

Paths on the rest of this page are relative to this folder.

Install Node.js
---------------

The editor needs Node.js 20.19+ or 22.12+ (:doc:`environment_compatibility`).
Ubuntu's own ``nodejs`` package is older than this on both 22.04 and 24.04, so
install the current LTS release with `nvm <https://github.com/nvm-sh/nvm>`_:

.. code-block:: bash

   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
   source ~/.bashrc
   nvm install --lts
   node --version

Install the Python packages
---------------------------

Composer Studio's backend needs the ``flexivpdk`` package, installed as the
Flexiv PDK manual describes (*Install for Python*), and its own packages.

1. Create and activate a virtual environment:

   .. code-block:: bash

      python3 -m venv .venv
      source .venv/bin/activate

2. Install ``flexivpdk`` and its dependencies from PyPI:

   .. code-block:: bash

      pip install "flexivpdk==<version>"

   Use the version of your Flexiv PDK release, such as ``1.0.0``.

3. Install the backend packages: the web server (FastAPI, Uvicorn and others)
   and ``flexivrdk``, pinned in ``app/backend/requirements.txt``:

   .. code-block:: bash

      pip install -r app/backend/requirements.txt

Install the editor packages
---------------------------

.. code-block:: bash

   cd app/frontend
   npm install

Do this once after cloning and again after each update. ``run_app.sh`` builds
the editor but does not install its packages.

Check the installation
----------------------

With the virtual environment active:

.. code-block:: bash

   python -c "import flexiv.pdk, flexivrdk; print('flexiv.pdk and flexivrdk OK')"
   pdk-scene --help

``pdk-scene`` is the PDK's command-line tool. It is installed with
``flexivpdk`` and is useful alongside Composer Studio, for example to check
what the server holds.

Next, start Composer Studio: :doc:`launch_composer_studio`.
