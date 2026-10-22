#!/usr/bin/env python3

import argparse
import logging
from pathlib import Path

import uvicorn
from web_app import create_app


# Default directory: <project>/frontend/dist
_DEFAULT_DIRECTORY = Path(__file__).resolve().parent.parent / 'frontend' / 'dist'

app = create_app(_DEFAULT_DIRECTORY)

# Endpoints polled frequently enough that their access-log lines would drown
# out everything else (e.g. joint-angle polling for the 3D viewer).
_QUIET_ACCESS_LOG_PATHS = ('/joint-angles',
						   '/tcp-pose')


class _QuietPathsFilter(logging.Filter):
	def filter(self, record: logging.LogRecord) -> bool:
		message = record.getMessage()
		return not any(path in message for path in _QUIET_ACCESS_LOG_PATHS)


logging.getLogger('uvicorn.access').addFilter(_QuietPathsFilter())

def main():
	parser = argparse.ArgumentParser(
		description='Serve composer_studio with disabled caching and file API endpoints.'
	)
	parser.add_argument('port', nargs='?', type=int, default=8011)
	parser.add_argument('--directory', default=str(_DEFAULT_DIRECTORY))
	args = parser.parse_args()
	directory = Path(args.directory).expanduser().resolve()
	application = app if directory == _DEFAULT_DIRECTORY else create_app(directory)

	print(f'Serving {directory} on http://0.0.0.0:{args.port}/ with caching disabled')
	uvicorn.run(application, host='0.0.0.0', port=args.port, log_level='info')


if __name__ == '__main__':
	main()
