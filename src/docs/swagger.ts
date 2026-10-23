const bearer = [{ bearerAuth: [] }];
const json = (ref: string) => ({ content: { 'application/json': { schema: { $ref: `#/components/schemas/${ref}` } } } });

export const swaggerSpec = {
  openapi: '3.0.3',
  info: { title: 'AgriConnect API', version: '1.0.0', description: 'Agricultural marketplace REST API' },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Register: { type: 'object', required: ['name', 'email', 'password', 'role'], properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, password: { type: 'string', minLength: 8 }, role: { type: 'string', enum: ['FARMER', 'BUYER'] } } },
      Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
      Product: { type: 'object', required: ['title', 'description', 'price', 'unit', 'quantityAvailable', 'categoryId'], properties: { title: { type: 'string' }, description: { type: 'string' }, price: { type: 'number' }, unit: { type: 'string' }, quantityAvailable: { type: 'integer' }, categoryId: { type: 'integer' }, imageUrl: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' }, address: { type: 'string' } } },
      OrderCreate: { type: 'object', required: ['items', 'deliveryAddress'], properties: { deliveryAddress: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { productId: { type: 'integer' }, quantity: { type: 'integer' } } } } } },
      OrderStatus: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'SHIPPED', 'DELIVERED', 'REJECTED', 'CANCELLED'] } } },
    },
  },
  paths: {
    '/auth/register': { post: { tags: ['Auth'], summary: 'Create account', requestBody: { required: true, ...json('Register') }, responses: { 201: { description: 'Created' }, 409: { description: 'Email exists' }, 422: { description: 'Validation error' } } } },
    '/auth/login': { post: { tags: ['Auth'], summary: 'Log in', requestBody: { required: true, ...json('Login') }, responses: { 200: { description: 'Tokens + user' }, 401: { description: 'Bad credentials' } } } },
    '/auth/refresh': { post: { tags: ['Auth'], summary: 'New access token from refresh token', responses: { 200: { description: 'OK' }, 401: { description: 'Expired' } } } },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Log out', responses: { 204: { description: 'No content' } } } },
    '/users/me': {
      get: { tags: ['Users'], security: bearer, summary: 'Current user', responses: { 200: { description: 'OK' } } },
      put: { tags: ['Users'], security: bearer, summary: 'Update profile', responses: { 200: { description: 'OK' } } },
    },
    '/users/{id}': { get: { tags: ['Users'], security: bearer, summary: 'Seller/public profile', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } } },
    '/categories': { get: { tags: ['Categories'], security: bearer, summary: 'List categories', responses: { 200: { description: 'OK' } } } },
    '/products': {
      get: { tags: ['Products'], security: bearer, summary: 'Search, filter, sort, paginate', parameters: ['search', 'category', 'minPrice', 'maxPrice', 'sort', 'mine', 'page', 'limit'].map((n) => ({ name: n, in: 'query', schema: { type: 'string' } })), responses: { 200: { description: 'Paginated list' } } },
      post: { tags: ['Products'], security: bearer, summary: 'Create product (farmer)', requestBody: { required: true, ...json('Product') }, responses: { 201: { description: 'Created' }, 403: { description: 'Not a farmer' }, 422: { description: 'Validation error' } } },
    },
    '/products/{id}': {
      get: { tags: ['Products'], security: bearer, summary: 'Product details', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } },
      put: { tags: ['Products'], security: bearer, summary: 'Update own product', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { ...json('Product') }, responses: { 200: { description: 'OK' }, 403: { description: 'Not owner' } } },
      delete: { tags: ['Products'], security: bearer, summary: 'Delete own product', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 204: { description: 'Deleted' }, 409: { description: 'Has orders' } } },
    },
    '/upload': { post: { tags: ['Upload'], security: bearer, summary: 'Upload an image (multipart field "image")', responses: { 201: { description: '{ url }' }, 400: { description: 'Bad file' } } } },
    '/favorites': { get: { tags: ['Favorites'], security: bearer, summary: 'My favorites', responses: { 200: { description: 'OK' } } } },
    '/favorites/{productId}': {
      post: { tags: ['Favorites'], security: bearer, summary: 'Add favorite', parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 201: { description: 'Added' } } },
      delete: { tags: ['Favorites'], security: bearer, summary: 'Remove favorite', parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 204: { description: 'Removed' } } },
    },
    '/orders': {
      get: { tags: ['Orders'], security: bearer, summary: 'My orders (buyer) or received orders (farmer)', responses: { 200: { description: 'OK' } } },
      post: { tags: ['Orders'], security: bearer, summary: 'Place order (buyer). Split per seller.', requestBody: { required: true, ...json('OrderCreate') }, responses: { 201: { description: 'Created' }, 409: { description: 'Not enough stock' } } },
    },
    '/orders/{id}': { get: { tags: ['Orders'], security: bearer, summary: 'Order details', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 403: { description: 'Not your order' } } } },
    '/orders/{id}/status': { patch: { tags: ['Orders'], security: bearer, summary: 'Change order status', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { required: true, ...json('OrderStatus') }, responses: { 200: { description: 'OK' }, 400: { description: 'Invalid transition' } } } },
    '/notifications': { get: { tags: ['Notifications'], security: bearer, summary: 'My notifications', responses: { 200: { description: 'OK' } } } },
    '/notifications/{id}/read': { patch: { tags: ['Notifications'], security: bearer, summary: 'Mark as read', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } } },
  },
};
