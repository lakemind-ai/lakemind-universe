#!/bin/sh

# Generate runtime config.js
cat <<EOF > /usr/share/nginx/html/config.js
window.env = {
  API_SERVICE_URL: "${API_SERVICE_URL}",
  DATABRICKS_HOST: "${DATABRICKS_HOST}",
  AUTH_PROVIDER: "${AUTH_PROVIDER:-databricks}"
};
EOF

# Generate runtime importmap.json
cat <<EOF > /usr/share/nginx/html/importmap.json
{
  "imports": {
    "@lakemind/root-config": "${ROOT_CONFIG_URL:-//localhost:3000/lakemind-root-config.js}",
    "@lakemind/main-portal": "${MAIN_PORTAL_URL:-//localhost:8080/lakemind-main.js}"
  }
}
EOF

exec "$@"
