#!/usr/bin/env bash
# start pm2 processes for Peacock Time
echo "pm2 processes started"
pm2 start deploy/pm2/ecosystem.config.js --env production
pm2 save
echo "pm2 processes started"

# show status
pm2 ls
