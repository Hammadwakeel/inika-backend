#!/bin/bash
export OPENROUTER_API_KEY="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"

# Proxy gateway commands to systemd to prevent duplicate processes
case "$1" in
  gateway)
    case "$2" in
      start|restart)
        echo "Use systemctl to manage the gateway service instead:"
        echo "  systemctl --user start openclaw-gateway"
        echo "  systemctl --user stop openclaw-gateway"
        echo "  systemctl --user status openclaw-gateway"
        exit 1
        ;;
    esac
    ;;
esac

exec openclaw "$@"