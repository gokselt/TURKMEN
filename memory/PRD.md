# NutriAI - Kişisel Diyet & Fitness Takip Uygulaması

## Product Requirements Document (PRD)

### Overview
NutriAI, kullanıcıların fiziksel özelliklerini toplayarak kişiselleştirilmiş diyet planları oluşturan, yemek kalori takibi yapan, fotoğraftan yemek analizi gerçekleştiren ve egzersiz önerileri sunan kapsamlı bir mobil uygulamadır.

### Tech Stack
- **Frontend**: React Native (Expo SDK 54) with expo-router
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI**: OpenAI GPT-4o via Emergent LLM Key (for diet plan generation and food image analysis)
- **Image**: expo-image-picker for camera/gallery

### Core Features

#### 1. Onboarding Flow
- 4-step gamified onboarding: Personal Info → Body Measurements → Activity Level → Goal
- Calculates BMR, TDEE, daily calorie target, and macros (protein, carbs, fat)
- Creates user profile in MongoDB

#### 2. Home Dashboard
- Daily calorie summary (consumed vs target vs burned)
- Macro breakdown (protein, carbs, fat) with progress bars
- Motivational messages
- Today's meal log
- Achievement surprises

#### 3. AI Diet Plan Generator
- Generates 7-day personalized diet plan via GPT-4o
- Turkish cuisine focused meal suggestions
- Per-meal calorie and macro breakdown
- Day-by-day navigation with tips

#### 4. Food Database & Meal Logging
- 55+ pre-seeded Turkish and international foods
- Search functionality
- Manual meal logging with meal type selection
- Daily calorie/macro totals

#### 5. Food Photo Scanner (AI Vision)
- **Plate Scan**: Take photo of plate/table, AI estimates calories and diet suitability
- **Menu Scan**: Take photo of workplace/restaurant menu, AI extracts items and saves to food database
- Camera and gallery support

#### 6. Exercise Tracking
- 18+ pre-seeded exercises (Cardio, Strength, Flexibility, HIIT)
- Personalized exercise suggestions based on user profile and goal
- Exercise logging with duration and calorie burn calculation
- Today's exercise summary

#### 7. Motivation System
- 10 achievement badges (first meal, streak, first exercise, etc.)
- Milestone surprises
- Random motivational messages
- Progress statistics

#### 8. Profile & Progress
- User info display and management
- Weight logging and history
- Daily calorie consumed/burned stats
- Achievement gallery
- Logout functionality

### API Endpoints
- `POST /api/users` - Create user
- `GET /api/users/{id}` - Get user
- `PUT /api/users/{id}` - Update user
- `POST /api/diet/generate/{user_id}` - Generate AI diet plan
- `GET /api/diet/plan/{user_id}` - Get active diet plan
- `GET /api/foods` - Search foods
- `GET /api/foods/categories` - Get categories
- `POST /api/meals/log` - Log meal
- `GET /api/meals/{user_id}/today` - Today's meals
- `POST /api/scan/plate` - AI plate scan
- `POST /api/scan/menu` - AI menu scan
- `GET /api/exercises` - Get exercises
- `GET /api/exercises/suggestions/{user_id}` - Get suggestions
- `POST /api/exercises/log` - Log exercise
- `POST /api/progress/weight` - Log weight
- `GET /api/progress/{user_id}` - Get progress
- `GET /api/motivation/{user_id}` - Get achievements

### Database Collections
- users, diet_plans, foods, meal_logs, exercises, exercise_logs, weight_logs, achievement_templates

### Design
- Organic & Earthy theme (Warm Sand #FAFAF7, Terracotta #D97352, Sage Green #8B9A80)
- 5-tab navigation: Home, Diet, Scanner, Exercise, Profile
- Bottom sheet modals for data entry
- Minimum 44px touch targets
