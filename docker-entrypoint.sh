#!/bin/bash

# Not currently being used, logic has been added to /usr/local/bin/docker-entrypoint.py
# instead



# Store in /usr/local/bin/docker-entrypoint.sh and then start containers with
# -entrypoint /usr/local/bin/docker-entrypoint.sh
set -e

# Replace placeholder mongoX with actual container hostname
sed -i "s/app0/$(hostname)/g" /etc/mongod.conf

# Run the given command
exec "$@"