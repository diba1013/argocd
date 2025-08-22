#!/bin/bash

# Retrieve the grafana password from the kubernetes secret

GRAFANA_PASSWORD=$(kubectl get secret victoria-metrics-grafana -n victoria-metrics -o jsonpath="{.data.admin-password}" | base64 --decode)

echo "$GRAFANA_PASSWORD"
