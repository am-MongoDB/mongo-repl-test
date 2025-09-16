# ==========================
# Stage 1: Node.js Builder
# ==========================
FROM debian:bullseye-slim AS node-builder
ARG TARGETARCH
ENV NODE_VERSION=20.16.0

# Map Docker's $TARGETARCH to Node.js naming
RUN if [ "$TARGETARCH" = "amd64" ]; then ARCH="x64"; \
    elif [ "$TARGETARCH" = "arm64" ]; then ARCH="arm64"; \
    else echo "Unsupported arch: $TARGETARCH" && exit 1; fi \
 && apt-get update && apt-get install -y curl xz-utils \
 && curl -fsSL https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.xz \
    | tar -xJ -C /usr/local --strip-components=1 \
 && node --version \
 && npm --version

# ==========================
# Stage 2: Final Mongo Image
# ==========================
FROM mongodb/mongodb-community-server:8.0-ubi8

# Use root to copy files and install things
USER root

# Create dbpath directory
RUN mkdir -p /var/lib/mongodb

# Replace entrypoint with your modified version
COPY docker-entrypoint.py /usr/local/bin/docker-entrypoint.py
RUN chmod 755 /usr/local/bin/docker-entrypoint.py

# Add the custom MongoDB config file
COPY mongod.conf /etc/mongod.conf

# Copy Node.js + npm from builder
COPY --from=node-builder /usr/local /usr/local

# Install git to clone repo
RUN yum install -y git \
 && git clone https://github.com/am-MongoDB/mongo-repl-test.git /home/src/mongo-repl-test \
 && yum clean all

WORKDIR /home/src

# By default do nothing (so mongod won’t start automatically)
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.py"]
CMD ["bash"]