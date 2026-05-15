export const environment = {
  production: true,
  apiUrl: '/api',
  alfresco: {
    shareUrl: 'http://localhost:8091/share'
  },
  keycloak: {
    url: 'http://localhost:8180',
    realm: 'supportflow',
    clientId: 'supportflow-frontend'
  },
  websocket: {
    // Relative path — nginx proxies /api/ws → backend STOMP endpoint
    url: '/api/ws'
  }
};
