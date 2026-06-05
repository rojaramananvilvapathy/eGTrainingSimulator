#!/bin/bash
echo "eG Sim Lab Environment Ready"
echo "Session: $EG_SIM_SESSION_ID"
echo "Room: $EG_SIM_ROOM_ID"

# Keep container running — exec replaces this process with the command
# If no command given, sleep forever so the container stays alive for exec-based terminal
if [ "$#" -eq 0 ] || [ "$1" = "/bin/bash" ]; then
    exec tail -f /dev/null
else
    exec "$@"
fi
