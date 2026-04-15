#!/bin/bash
echo "Enter the choice:(start/stop/status)"
read action
case $action in
	Start|start|START)
		echo "Starting the service";;

	stop|STOP|Stop)
                echo "Stopping the service";;
        status|STATUS|Status)
                echo "Service is running";;
          *)
                echo "invalid service name";;
esac

