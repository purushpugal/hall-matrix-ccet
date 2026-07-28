const BASE_URL = window.location.origin.includes('localhost')
  ? 'http://localhost:3000/api'
  : '/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  
  // Set credentials for cross-origin cookies
  options.credentials = 'include';
  
  if (options.body && !(options.body instanceof FormData)) {
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, options);
  
  if (response.status === 401) {
    // Session expired or unauthorized
    const isPublicOrStudentRoute =
      path.startsWith('/auth/me') ||
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/register') ||
      path.startsWith('/auth/student') ||
      path.startsWith('/student') ||
      path.startsWith('/t/');

    if (!isPublicOrStudentRoute) {
      window.location.href = '/login';
    }
  }

  // Handle PDF file downloads / binary response
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    return response.blob();
  }

  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

export const api = {
  get: (path, options) => request(path, { method: 'GET', ...options }),
  post: (path, body, options) => request(path, { method: 'POST', body, ...options }),
  postFormData: (path, formData, options) => request(path, { method: 'POST', body: formData, ...options }),
  delete: (path, options) => request(path, { method: 'DELETE', ...options }),
};
