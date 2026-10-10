#!/bin/bash
set -euo pipefail

topics=(
  user.registered
  user.password_reset_requested
  job.created
  job.updated
  job.deleted
  application.submitted
  application.status_changed
)

for topic in "${topics[@]}"; do
  for name in "$topic" "$topic.dlq"; do
    /opt/kafka/bin/kafka-topics.sh \
      --bootstrap-server kafka:9092 \
      --create \
      --if-not-exists \
      --topic "$name" \
      --partitions 1 \
      --replication-factor 1
  done
done
