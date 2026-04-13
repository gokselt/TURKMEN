const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const API_BASE = `${BACKEND_URL}/api`;

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

export const api = {
  // User
  createUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  getUser: (id: string) => request(`/users/${id}`),
  updateUser: (id: string, data: any) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Diet
  generateDiet: (userId: string) => request(`/diet/generate/${userId}`, { method: 'POST' }),
  getDietPlan: (userId: string) => request(`/diet/plan/${userId}`),

  // Foods
  getFoods: (search = '', category = '') => request(`/foods?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`),
  getCategories: () => request('/foods/categories'),
  addCustomFood: (data: any) => request('/foods/custom', { method: 'POST', body: JSON.stringify(data) }),

  // Meals
  logMeal: (data: any) => request('/meals/log', { method: 'POST', body: JSON.stringify(data) }),
  getTodayMeals: (userId: string) => request(`/meals/${userId}/today`),
  getMealHistory: (userId: string, days = 7) => request(`/meals/${userId}/history?days=${days}`),

  // Scan
  scanPlate: (imageBase64: string) => request('/scan/plate', { method: 'POST', body: JSON.stringify({ image_base64: imageBase64, scan_type: 'plate' }) }),
  scanMenu: (imageBase64: string) => request('/scan/menu', { method: 'POST', body: JSON.stringify({ image_base64: imageBase64, scan_type: 'menu' }) }),

  // Exercises
  getExercises: (type = '') => request(`/exercises?exercise_type=${encodeURIComponent(type)}`),
  getSuggestions: (userId: string) => request(`/exercises/suggestions/${userId}`),
  logExercise: (data: any) => request('/exercises/log', { method: 'POST', body: JSON.stringify(data) }),
  getTodayExercises: (userId: string) => request(`/exercises/${userId}/today`),

  // Progress
  logWeight: (data: any) => request('/progress/weight', { method: 'POST', body: JSON.stringify(data) }),
  getProgress: (userId: string) => request(`/progress/${userId}`),

  // Motivation
  getMotivation: (userId: string) => request(`/motivation/${userId}`),
};
