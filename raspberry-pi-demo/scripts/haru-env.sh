#!/usr/bin/env bash

# Source from every Pi launcher so Desktop autostart does not depend on a login shell.
if [[ -x /opt/haru/node-current/bin/node ]]; then
  export PATH="/opt/haru/node-current/bin:$PATH"
fi
