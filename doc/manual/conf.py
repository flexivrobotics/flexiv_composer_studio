"""Sphinx configuration for the Flexiv Composer Studio manual.

Look and layout follow the Flexiv PDK manual (flexiv_pdk_client/doc/manual), which in turn
follows the Flexiv RDK manual (https://www.flexiv.com/software/rdk/manual/).
"""

import importlib.metadata
import pathlib
import re

# The Composer Studio checkout this manual documents.
_ROOT = pathlib.Path(__file__).resolve().parents[2]


def _read_pdk_version():
    """Reads the flexivpdk version Composer Studio is built and tested against.

    Composer Studio carries no version string of its own, so the manual is
    versioned by the flexivpdk wheel the checkout pins in lib/, or else by the
    installed flexivpdk, without a test build number.
    """
    for wheel in sorted((_ROOT / "lib").glob("flexivpdk-*.whl")):
        match = re.match(r"flexivpdk-([^-]+)-", wheel.name)
        if match:
            return match.group(1)
    try:
        installed = importlib.metadata.version("flexivpdk")
    except importlib.metadata.PackageNotFoundError:
        return "unknown"
    return ".".join(installed.split(".")[:3])


# Shown under the logo in the sidebar.
project = "Composer Studio"
author = "Flexiv Ltd."
# The theme appends the final period.
copyright = "2016–2026 Flexiv Ltd. All Rights Reserved"
release = _read_pdk_version()
version = ".".join(release.split(".")[:2])

extensions = [
    "sphinx.ext.autosectionlabel",
    "sphinx_rtd_theme",
]

# Prefix section labels with the document name so headings like "Overview"
# can repeat across pages.
autosectionlabel_prefix_document = True
autosectionlabel_maxdepth = 2

exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

highlight_language = "bash"

html_theme = "sphinx_rtd_theme"
# "<page> — <project> documentation", without the version, as in the RDK manual.
html_title = "Flexiv Composer Studio documentation"
html_logo = "_static/flexiv_logo.svg"
html_favicon = "_static/flexiv_logo.ico"
html_static_path = ["_static"]
html_css_files = ["style_override.css"]

rst_prolog = f"""
.. |version_full| replace:: {release}
"""
