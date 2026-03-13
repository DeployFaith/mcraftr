#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"

mkdir -p "$DATA_DIR"
chown -R mcraftr:mcraftr "$DATA_DIR"

exec su-exec mcraftr "$@"
