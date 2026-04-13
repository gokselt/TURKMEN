"""Comprehensive API tests for NutriAI backend
Tests: health, users, foods, meals, exercises, diet plans, scanning, progress, motivation
"""
import pytest
import requests
import json
import base64
from pathlib import Path

class TestHealth:
    """Health check endpoint"""
    
    def test_health_check(self, api_client, base_url):
        response = api_client.get(f"{base_url}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print("✓ Health check passed")

class TestUsers:
    """User CRUD operations"""
    
    def test_create_user_and_verify(self, api_client, base_url):
        """Create user and verify persistence"""
        user_data = {
            "name": "TEST_Ahmet",
            "age": 28,
            "gender": "erkek",
            "height": 175.0,
            "weight": 80.0,
            "target_weight": 75.0,
            "activity_level": "orta_aktif",
            "goal": "kilo_ver"
        }
        
        # Create user
        response = api_client.post(f"{base_url}/api/users", json=user_data)
        assert response.status_code == 200
        
        created = response.json()
        assert created["name"] == user_data["name"]
        assert created["age"] == user_data["age"]
        assert created["gender"] == user_data["gender"]
        assert "id" in created
        assert "daily_calorie_target" in created
        assert created["daily_calorie_target"] > 0
        assert "daily_protein" in created
        assert "daily_carbs" in created
        assert "daily_fat" in created
        
        user_id = created["id"]
        print(f"✓ User created: {user_id}")
        
        # Verify persistence with GET
        get_response = api_client.get(f"{base_url}/api/users/{user_id}")
        assert get_response.status_code == 200
        
        fetched = get_response.json()
        assert fetched["id"] == user_id
        assert fetched["name"] == user_data["name"]
        assert fetched["weight"] == user_data["weight"]
        print(f"✓ User verified in database")
        
        return user_id
    
    def test_get_nonexistent_user(self, api_client, base_url):
        """Test 404 for non-existent user"""
        response = api_client.get(f"{base_url}/api/users/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ 404 returned for non-existent user")
    
    def test_update_user(self, api_client, base_url):
        """Create, update, and verify user changes"""
        # Create user first
        user_data = {
            "name": "TEST_Ayşe",
            "age": 25,
            "gender": "kadin",
            "height": 165.0,
            "weight": 65.0,
            "target_weight": 60.0,
            "activity_level": "hafif_aktif",
            "goal": "kilo_ver"
        }
        create_response = api_client.post(f"{base_url}/api/users", json=user_data)
        assert create_response.status_code == 200
        user_id = create_response.json()["id"]
        
        # Update user
        update_data = {
            "name": "TEST_Ayşe_Updated",
            "age": 26,
            "gender": "kadin",
            "height": 165.0,
            "weight": 63.0,
            "target_weight": 58.0,
            "activity_level": "orta_aktif",
            "goal": "kilo_ver"
        }
        update_response = api_client.put(f"{base_url}/api/users/{user_id}", json=update_data)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["name"] == update_data["name"]
        assert updated["age"] == update_data["age"]
        assert updated["weight"] == update_data["weight"]
        print("✓ User updated successfully")
        
        # Verify with GET
        get_response = api_client.get(f"{base_url}/api/users/{user_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["name"] == update_data["name"]
        assert fetched["weight"] == update_data["weight"]
        print("✓ User update verified in database")

class TestFoods:
    """Food database operations"""
    
    def test_get_all_foods(self, api_client, base_url):
        """Test getting all foods"""
        response = api_client.get(f"{base_url}/api/foods")
        assert response.status_code == 200
        
        foods = response.json()
        assert isinstance(foods, list)
        assert len(foods) > 0
        
        # Check first food structure
        food = foods[0]
        assert "id" in food
        assert "name" in food
        assert "calories" in food
        assert "protein" in food
        assert "carbs" in food
        assert "fat" in food
        assert "serving_size" in food
        assert "category" in food
        print(f"✓ Retrieved {len(foods)} foods")
    
    def test_search_foods(self, api_client, base_url):
        """Test food search functionality"""
        response = api_client.get(f"{base_url}/api/foods?search=mercimek")
        assert response.status_code == 200
        
        foods = response.json()
        assert isinstance(foods, list)
        assert len(foods) > 0
        
        # Verify search results contain search term
        for food in foods:
            assert "mercimek" in food["name"].lower()
        print(f"✓ Food search returned {len(foods)} results")
    
    def test_get_food_categories(self, api_client, base_url):
        """Test getting food categories"""
        response = api_client.get(f"{base_url}/api/foods/categories")
        assert response.status_code == 200
        
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) > 0
        print(f"✓ Retrieved {len(categories)} food categories")
    
    def test_filter_by_category(self, api_client, base_url):
        """Test filtering foods by category"""
        # Get categories first
        cat_response = api_client.get(f"{base_url}/api/foods/categories")
        categories = cat_response.json()
        
        if len(categories) > 0:
            test_category = categories[0]
            response = api_client.get(f"{base_url}/api/foods?category={test_category}")
            assert response.status_code == 200
            
            foods = response.json()
            for food in foods:
                assert food["category"] == test_category
            print(f"✓ Category filter working: {test_category}")

class TestMeals:
    """Meal logging operations"""
    
    def test_log_meal_and_verify(self, api_client, base_url):
        """Log meal and verify it appears in today's meals"""
        # Create test user first
        user_data = {
            "name": "TEST_MealUser",
            "age": 30,
            "gender": "erkek",
            "height": 180.0,
            "weight": 85.0,
            "target_weight": 80.0,
            "activity_level": "orta_aktif",
            "goal": "kilo_ver"
        }
        user_response = api_client.post(f"{base_url}/api/users", json=user_data)
        user_id = user_response.json()["id"]
        
        # Log a meal
        meal_data = {
            "user_id": user_id,
            "food_name": "TEST_Mercimek Çorbası",
            "calories": 120,
            "protein": 7.0,
            "carbs": 18.0,
            "fat": 2.0,
            "serving_size": "1 kase",
            "meal_type": "Öğle"
        }
        
        log_response = api_client.post(f"{base_url}/api/meals/log", json=meal_data)
        assert log_response.status_code == 200
        
        logged = log_response.json()
        assert logged["food_name"] == meal_data["food_name"]
        assert logged["calories"] == meal_data["calories"]
        assert "id" in logged
        assert "date" in logged
        print("✓ Meal logged successfully")
        
        # Verify meal appears in today's meals
        today_response = api_client.get(f"{base_url}/api/meals/{user_id}/today")
        assert today_response.status_code == 200
        
        today_data = today_response.json()
        assert "meals" in today_data
        assert "totals" in today_data
        assert len(today_data["meals"]) > 0
        
        # Check totals are calculated
        assert today_data["totals"]["calories"] >= meal_data["calories"]
        assert today_data["totals"]["protein"] >= meal_data["protein"]
        print("✓ Meal verified in today's log")
    
    def test_get_meal_history(self, api_client, base_url):
        """Test meal history endpoint"""
        # Create user and log meal
        user_data = {
            "name": "TEST_HistoryUser",
            "age": 27,
            "gender": "kadin",
            "height": 168.0,
            "weight": 62.0,
            "target_weight": 58.0,
            "activity_level": "hafif_aktif",
            "goal": "kilo_ver"
        }
        user_response = api_client.post(f"{base_url}/api/users", json=user_data)
        user_id = user_response.json()["id"]
        
        # Log a meal
        meal_data = {
            "user_id": user_id,
            "food_name": "TEST_Yumurta",
            "calories": 78,
            "protein": 6.0,
            "carbs": 0.6,
            "fat": 5.0,
            "serving_size": "1 adet",
            "meal_type": "Kahvaltı"
        }
        api_client.post(f"{base_url}/api/meals/log", json=meal_data)
        
        # Get history
        history_response = api_client.get(f"{base_url}/api/meals/{user_id}/history?days=7")
        assert history_response.status_code == 200
        
        history = history_response.json()
        assert "history" in history
        print("✓ Meal history retrieved")

class TestExercises:
    """Exercise operations"""
    
    def test_get_all_exercises(self, api_client, base_url):
        """Test getting all exercises"""
        response = api_client.get(f"{base_url}/api/exercises")
        assert response.status_code == 200
        
        exercises = response.json()
        assert isinstance(exercises, list)
        assert len(exercises) > 0
        
        # Check structure
        ex = exercises[0]
        assert "id" in ex
        assert "name" in ex
        assert "type" in ex
        assert "calories_per_min" in ex
        assert "difficulty" in ex
        print(f"✓ Retrieved {len(exercises)} exercises")
    
    def test_get_exercise_suggestions(self, api_client, base_url):
        """Test personalized exercise suggestions"""
        # Create user
        user_data = {
            "name": "TEST_ExerciseUser",
            "age": 32,
            "gender": "erkek",
            "height": 178.0,
            "weight": 88.0,
            "target_weight": 82.0,
            "activity_level": "sedanter",
            "goal": "kilo_ver"
        }
        user_response = api_client.post(f"{base_url}/api/users", json=user_data)
        user_id = user_response.json()["id"]
        
        # Get suggestions
        response = api_client.get(f"{base_url}/api/exercises/suggestions/{user_id}")
        assert response.status_code == 200
        
        suggestions = response.json()
        assert isinstance(suggestions, list)
        assert len(suggestions) > 0
        print(f"✓ Got {len(suggestions)} exercise suggestions")
    
    def test_log_exercise_and_verify(self, api_client, base_url):
        """Log exercise and verify in today's log"""
        # Create user
        user_data = {
            "name": "TEST_ExLogUser",
            "age": 29,
            "gender": "kadin",
            "height": 170.0,
            "weight": 68.0,
            "target_weight": 65.0,
            "activity_level": "orta_aktif",
            "goal": "kilo_ver"
        }
        user_response = api_client.post(f"{base_url}/api/users", json=user_data)
        user_id = user_response.json()["id"]
        
        # Log exercise
        exercise_data = {
            "user_id": user_id,
            "exercise_name": "TEST_Yürüyüş",
            "duration_minutes": 30,
            "calories_burned": 150
        }
        
        log_response = api_client.post(f"{base_url}/api/exercises/log", json=exercise_data)
        assert log_response.status_code == 200
        
        logged = log_response.json()
        assert logged["exercise_name"] == exercise_data["exercise_name"]
        assert logged["duration_minutes"] == exercise_data["duration_minutes"]
        print("✓ Exercise logged")
        
        # Verify in today's log
        today_response = api_client.get(f"{base_url}/api/exercises/{user_id}/today")
        assert today_response.status_code == 200
        
        today_data = today_response.json()
        assert "exercises" in today_data
        assert "total_burned" in today_data
        assert "total_minutes" in today_data
        assert today_data["total_burned"] >= exercise_data["calories_burned"]
        print("✓ Exercise verified in today's log")

class TestProgress:
    """Progress tracking operations"""
    
    def test_log_weight_and_verify(self, api_client, base_url):
        """Log weight and verify in progress"""
        # Create user
        user_data = {
            "name": "TEST_WeightUser",
            "age": 26,
            "gender": "erkek",
            "height": 182.0,
            "weight": 90.0,
            "target_weight": 85.0,
            "activity_level": "aktif",
            "goal": "kilo_ver"
        }
        user_response = api_client.post(f"{base_url}/api/users", json=user_data)
        user_id = user_response.json()["id"]
        
        # Log weight
        weight_data = {
            "user_id": user_id,
            "weight": 89.5
        }
        
        log_response = api_client.post(f"{base_url}/api/progress/weight", json=weight_data)
        assert log_response.status_code == 200
        
        logged = log_response.json()
        assert logged["weight"] == weight_data["weight"]
        assert "date" in logged
        print("✓ Weight logged")
        
        # Verify in progress
        progress_response = api_client.get(f"{base_url}/api/progress/{user_id}")
        assert progress_response.status_code == 200
        
        progress = progress_response.json()
        assert "weight_history" in progress
        assert len(progress["weight_history"]) > 0
        assert progress["weight_history"][0]["weight"] == weight_data["weight"]
        print("✓ Weight verified in progress")
    
    def test_get_progress_stats(self, api_client, base_url):
        """Test progress statistics"""
        # Create user
        user_data = {
            "name": "TEST_ProgressUser",
            "age": 31,
            "gender": "kadin",
            "height": 166.0,
            "weight": 64.0,
            "target_weight": 60.0,
            "activity_level": "orta_aktif",
            "goal": "kilo_ver"
        }
        user_response = api_client.post(f"{base_url}/api/users", json=user_data)
        user_id = user_response.json()["id"]
        
        # Get progress
        response = api_client.get(f"{base_url}/api/progress/{user_id}")
        assert response.status_code == 200
        
        progress = response.json()
        assert "weight_history" in progress
        assert "today_calories_consumed" in progress
        assert "today_calories_burned" in progress
        assert "total_meals_logged" in progress
        assert "total_exercises_done" in progress
        print("✓ Progress stats retrieved")

class TestMotivation:
    """Motivation and achievements"""
    
    def test_get_motivation(self, api_client, base_url):
        """Test motivation endpoint"""
        # Create user
        user_data = {
            "name": "TEST_MotivationUser",
            "age": 24,
            "gender": "erkek",
            "height": 176.0,
            "weight": 78.0,
            "target_weight": 74.0,
            "activity_level": "hafif_aktif",
            "goal": "kilo_ver"
        }
        user_response = api_client.post(f"{base_url}/api/users", json=user_data)
        user_id = user_response.json()["id"]
        
        # Get motivation
        response = api_client.get(f"{base_url}/api/motivation/{user_id}")
        assert response.status_code == 200
        
        motivation = response.json()
        assert "motivational_message" in motivation
        assert "achievements" in motivation
        assert "surprises" in motivation
        assert "stats" in motivation
        
        # Check achievements structure
        assert isinstance(motivation["achievements"], list)
        if len(motivation["achievements"]) > 0:
            ach = motivation["achievements"][0]
            assert "key" in ach
            assert "title" in ach
            assert "description" in ach
            assert "icon" in ach
            assert "unlocked" in ach
        
        print("✓ Motivation data retrieved")
        print(f"  Message: {motivation['motivational_message']}")
        print(f"  Achievements: {len(motivation['achievements'])}")
