#!/usr/bin/env bash
# stop pm2 processes for Peacock Time
pm2 stop deploy/pm2/ecosystem.config.js || true
pm2 delete deploy/pm2/ecosystem.config.js || true
pm2 save
echo "pm2 processes stopped"
