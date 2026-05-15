export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8082/api',
  alfresco: {
    shareUrl: 'http://localhost:8091/share'
  },
  keycloak: {
    url: 'http://localhost:8180',
    realm: 'supportflow',
    clientId: 'supportflow-frontend'
  },
  websocket: {
    url: 'ws://127.0.0.1:8082/api/ws'
  }
};
