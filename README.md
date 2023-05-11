# admin

## Build Setup

```bash
# install dependencies
$ npm install

# serve with hot reload at localhost:3000
$ npm run dev

# build for production and launch server
$ npm run build
$ npm run start

# generate static project
$ npm run generate
```

```bash
npm run build --prefix ./backend/functions
npm run watch --prefix ./backend/functions | firebase emulators:start --only auth,firestore,functions,hosting,pubsub,storage --inspect-functions --import=./data-path --export-on-exit
```

# Deploy
```bash
./scripts/setEnv.sh dev
npm run generate
npm run build --prefix ./backend/functions
firebase deploy --config ./firebase.dev.json -P criptoladrillo-dev 
```

# Correr local
Backup del firestore de dev
```bash
./tools/backup_firestore.sh criptoladrillo-dev criptoladrillo-backup-dev
```
Bajamos el backup a nuestra máquina
```bash
gsutil -m cp -r gs://criptoladrillo-backup-dev/2022.06.08-18.22.18/firestore ./data-path
```
Corremos los emuladores
```bash
npm run watch | firebase emulators:start --inspect-functions --import=./data-path/firestore --export-on-exit
```

Para agregar roles o ejecutar algunos de los scripts en tools dentro del entorno emulado, tenemos que agregar unas variables de entorno
```bash 
FIRESTORE_EMULATOR_HOST=localhost:5002
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```
Por ejemplo, para agregar un admin de deposito localmente, seria
```bash
FIRESTORE_EMULATOR_HOST=localhost:5002 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 node addWarehouseAdmin.js
```

# Proteger un ws
```
server {
    listen 443 ssl; # managed by Certbot
    server_name node.criptoladrillo.ar;

    ssl_certificate     /etc/letsencrypt/live/node.criptoladrillo.ar/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/node.criptoladrillo.ar/privkey.pem; # managed by Certbot
    ssl_protocols       TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location /ws {
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;

        proxy_pass http://ws-backend;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
    
    location / {
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;

        proxy_pass http://backend;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}

upstream ws-backend {
    # enable sticky session based on IP
    ip_hash;

    server 127.0.0.1:8546;
}

upstream backend {
    server 127.0.0.1:8545;
}

server {
    if ($host = node.criptoladrillo.ar) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name node.criptoladrillo.ar;
    return 404; # managed by Certbot
}
```
## Fireway
**dev**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=google-service.dev.json
export RPC="TestNet"
```
**prod**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=google-service.prod.json 
export RPC="wss://node.criptoladrillo.ar/ws"
```
### Fireway
```bash
fireway migrate --require="ts-node/register" --projectId criptoladrillo-dev --forceWait --dryrun
```
### Tools
```bash
ts-node ./tools/getUserRoles.js
ts-node ./tools/refreshKycImages.ts
```
