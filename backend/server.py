from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import base64
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ======================== MODELS ========================

class UserCreate(BaseModel):
    name: str
    age: int
    gender: str
    height: float
    weight: float
    target_weight: float
    activity_level: str
    goal: str

class UserResponse(BaseModel):
    id: str
    name: str
    age: int
    gender: str
    height: float
    weight: float
    target_weight: float
    activity_level: str
    goal: str
    daily_calorie_target: int
    daily_protein: int
    daily_carbs: int
    daily_fat: int
    created_at: str

class FoodItem(BaseModel):
    id: str
    name: str
    calories: int
    protein: float
    carbs: float
    fat: float
    serving_size: str
    category: str
    is_custom: bool = False

class MealLogCreate(BaseModel):
    user_id: str
    food_name: str
    calories: int
    protein: float
    carbs: float
    fat: float
    serving_size: str
    meal_type: str

class ExerciseLogCreate(BaseModel):
    user_id: str
    exercise_name: str
    duration_minutes: int
    calories_burned: int

class WeightLogCreate(BaseModel):
    user_id: str
    weight: float

class ScanRequest(BaseModel):
    image_base64: str
    scan_type: str = "plate"

# ======================== UTILITY FUNCTIONS ========================

def calculate_bmr(gender: str, weight: float, height: float, age: int) -> float:
    if gender.lower() in ["erkek", "male"]:
        return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    else:
        return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)

def calculate_tdee(bmr: float, activity_level: str) -> float:
    multipliers = {
        "sedanter": 1.2, "hafif_aktif": 1.375, "orta_aktif": 1.55,
        "aktif": 1.725, "cok_aktif": 1.9
    }
    return bmr * multipliers.get(activity_level, 1.2)

def calculate_daily_targets(gender: str, weight: float, height: float, age: int, activity_level: str, goal: str):
    bmr = calculate_bmr(gender, weight, height, age)
    tdee = calculate_tdee(bmr, activity_level)
    if goal == "kilo_ver":
        calories = int(tdee - 500)
    elif goal == "kilo_al":
        calories = int(tdee + 400)
    else:
        calories = int(tdee)
    protein = int(weight * 1.8)
    fat = int(calories * 0.25 / 9)
    carbs = int((calories - (protein * 4) - (fat * 9)) / 4)
    return calories, protein, carbs, fat

# ======================== DATABASE SEEDING ========================

TURKISH_FOODS = [
    {"name": "Mercimek Çorbası", "calories": 120, "protein": 7, "carbs": 18, "fat": 2, "serving_size": "1 kase (250ml)", "category": "Çorbalar"},
    {"name": "Ezogelin Çorbası", "calories": 130, "protein": 6, "carbs": 20, "fat": 3, "serving_size": "1 kase (250ml)", "category": "Çorbalar"},
    {"name": "Domates Çorbası", "calories": 90, "protein": 3, "carbs": 14, "fat": 2, "serving_size": "1 kase (250ml)", "category": "Çorbalar"},
    {"name": "Tarhana Çorbası", "calories": 110, "protein": 5, "carbs": 17, "fat": 2, "serving_size": "1 kase (250ml)", "category": "Çorbalar"},
    {"name": "Tavuk Göğsü (Izgara)", "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6, "serving_size": "100g", "category": "Et & Tavuk"},
    {"name": "Dana Köfte", "calories": 250, "protein": 17, "carbs": 8, "fat": 17, "serving_size": "100g", "category": "Et & Tavuk"},
    {"name": "Döner (Tavuk)", "calories": 200, "protein": 22, "carbs": 5, "fat": 10, "serving_size": "100g", "category": "Et & Tavuk"},
    {"name": "Döner (Et)", "calories": 250, "protein": 18, "carbs": 5, "fat": 17, "serving_size": "100g", "category": "Et & Tavuk"},
    {"name": "Adana Kebap", "calories": 280, "protein": 20, "carbs": 2, "fat": 21, "serving_size": "1 porsiyon", "category": "Et & Tavuk"},
    {"name": "Lahmacun", "calories": 210, "protein": 10, "carbs": 25, "fat": 8, "serving_size": "1 adet", "category": "Hamur İşleri"},
    {"name": "Pide (Kıymalı)", "calories": 320, "protein": 14, "carbs": 35, "fat": 13, "serving_size": "1 dilim", "category": "Hamur İşleri"},
    {"name": "Simit", "calories": 250, "protein": 8, "carbs": 45, "fat": 4, "serving_size": "1 adet", "category": "Hamur İşleri"},
    {"name": "Börek (Peynirli)", "calories": 300, "protein": 10, "carbs": 28, "fat": 16, "serving_size": "1 dilim", "category": "Hamur İşleri"},
    {"name": "Gözleme (Peynirli)", "calories": 280, "protein": 12, "carbs": 30, "fat": 12, "serving_size": "1 adet", "category": "Hamur İşleri"},
    {"name": "Mantı", "calories": 300, "protein": 14, "carbs": 32, "fat": 12, "serving_size": "1 porsiyon", "category": "Hamur İşleri"},
    {"name": "Karnıyarık", "calories": 250, "protein": 12, "carbs": 18, "fat": 15, "serving_size": "1 porsiyon", "category": "Ana Yemekler"},
    {"name": "İmam Bayıldı", "calories": 200, "protein": 4, "carbs": 20, "fat": 12, "serving_size": "1 porsiyon", "category": "Ana Yemekler"},
    {"name": "Kuru Fasulye", "calories": 180, "protein": 10, "carbs": 28, "fat": 3, "serving_size": "1 porsiyon", "category": "Ana Yemekler"},
    {"name": "Nohut Yemeği", "calories": 190, "protein": 9, "carbs": 30, "fat": 4, "serving_size": "1 porsiyon", "category": "Ana Yemekler"},
    {"name": "Zeytinyağlı Yaprak Sarma", "calories": 160, "protein": 4, "carbs": 22, "fat": 6, "serving_size": "5 adet", "category": "Ana Yemekler"},
    {"name": "Menemen", "calories": 200, "protein": 10, "carbs": 12, "fat": 13, "serving_size": "1 porsiyon", "category": "Ana Yemekler"},
    {"name": "Pilav", "calories": 130, "protein": 2.7, "carbs": 28, "fat": 1, "serving_size": "100g", "category": "Garnitürler"},
    {"name": "Bulgur Pilavı", "calories": 120, "protein": 4, "carbs": 25, "fat": 1.5, "serving_size": "100g", "category": "Garnitürler"},
    {"name": "Makarna (Haşlanmış)", "calories": 131, "protein": 5, "carbs": 25, "fat": 1.1, "serving_size": "100g", "category": "Garnitürler"},
    {"name": "Çoban Salata", "calories": 60, "protein": 2, "carbs": 8, "fat": 2, "serving_size": "1 porsiyon", "category": "Salatalar"},
    {"name": "Mevsim Salata", "calories": 45, "protein": 2, "carbs": 6, "fat": 1.5, "serving_size": "1 porsiyon", "category": "Salatalar"},
    {"name": "Cacık", "calories": 80, "protein": 4, "carbs": 6, "fat": 4, "serving_size": "1 kase", "category": "Salatalar"},
    {"name": "Yumurta (Haşlanmış)", "calories": 78, "protein": 6, "carbs": 0.6, "fat": 5, "serving_size": "1 adet", "category": "Kahvaltılık"},
    {"name": "Peynir (Beyaz)", "calories": 90, "protein": 6, "carbs": 1, "fat": 7, "serving_size": "30g", "category": "Kahvaltılık"},
    {"name": "Zeytin", "calories": 45, "protein": 0.3, "carbs": 1, "fat": 4, "serving_size": "10 adet", "category": "Kahvaltılık"},
    {"name": "Bal", "calories": 64, "protein": 0, "carbs": 17, "fat": 0, "serving_size": "1 yemek kaşığı", "category": "Kahvaltılık"},
    {"name": "Tam Buğday Ekmeği", "calories": 70, "protein": 3, "carbs": 12, "fat": 1, "serving_size": "1 dilim", "category": "Ekmekler"},
    {"name": "Beyaz Ekmek", "calories": 80, "protein": 2.5, "carbs": 15, "fat": 1, "serving_size": "1 dilim", "category": "Ekmekler"},
    {"name": "Elma", "calories": 52, "protein": 0.3, "carbs": 14, "fat": 0.2, "serving_size": "1 orta boy", "category": "Meyveler"},
    {"name": "Muz", "calories": 89, "protein": 1.1, "carbs": 23, "fat": 0.3, "serving_size": "1 adet", "category": "Meyveler"},
    {"name": "Portakal", "calories": 47, "protein": 0.9, "carbs": 12, "fat": 0.1, "serving_size": "1 adet", "category": "Meyveler"},
    {"name": "Çilek", "calories": 32, "protein": 0.7, "carbs": 7.7, "fat": 0.3, "serving_size": "100g", "category": "Meyveler"},
    {"name": "Karpuz", "calories": 30, "protein": 0.6, "carbs": 7.6, "fat": 0.2, "serving_size": "100g", "category": "Meyveler"},
    {"name": "Süt (Yarım Yağlı)", "calories": 50, "protein": 3.3, "carbs": 4.8, "fat": 1.8, "serving_size": "1 bardak (200ml)", "category": "İçecekler"},
    {"name": "Ayran", "calories": 40, "protein": 2, "carbs": 3, "fat": 2, "serving_size": "1 bardak (200ml)", "category": "İçecekler"},
    {"name": "Türk Kahvesi", "calories": 5, "protein": 0.3, "carbs": 0.7, "fat": 0, "serving_size": "1 fincan", "category": "İçecekler"},
    {"name": "Çay (Şekersiz)", "calories": 2, "protein": 0, "carbs": 0.5, "fat": 0, "serving_size": "1 bardak", "category": "İçecekler"},
    {"name": "Yoğurt", "calories": 60, "protein": 3.5, "carbs": 4, "fat": 3, "serving_size": "100g", "category": "Süt Ürünleri"},
    {"name": "Lor Peyniri", "calories": 72, "protein": 11, "carbs": 2, "fat": 2, "serving_size": "100g", "category": "Süt Ürünleri"},
    {"name": "Badem", "calories": 160, "protein": 6, "carbs": 6, "fat": 14, "serving_size": "30g (bir avuç)", "category": "Kuruyemişler"},
    {"name": "Ceviz", "calories": 185, "protein": 4.3, "carbs": 4, "fat": 18.5, "serving_size": "30g (bir avuç)", "category": "Kuruyemişler"},
    {"name": "Fındık", "calories": 178, "protein": 4.2, "carbs": 5, "fat": 17, "serving_size": "30g (bir avuç)", "category": "Kuruyemişler"},
    {"name": "Tavuk Sote", "calories": 220, "protein": 25, "carbs": 8, "fat": 10, "serving_size": "1 porsiyon", "category": "Ana Yemekler"},
    {"name": "Balık (Izgara)", "calories": 150, "protein": 26, "carbs": 0, "fat": 5, "serving_size": "100g", "category": "Et & Tavuk"},
    {"name": "Ton Balığı (Konserve)", "calories": 120, "protein": 25, "carbs": 0, "fat": 1.5, "serving_size": "100g", "category": "Et & Tavuk"},
    {"name": "Avokado", "calories": 160, "protein": 2, "carbs": 9, "fat": 15, "serving_size": "1/2 adet", "category": "Meyveler"},
    {"name": "Yulaf Ezmesi", "calories": 150, "protein": 5, "carbs": 27, "fat": 2.5, "serving_size": "40g", "category": "Kahvaltılık"},
    {"name": "Baklava", "calories": 330, "protein": 6, "carbs": 38, "fat": 18, "serving_size": "1 dilim", "category": "Tatlılar"},
    {"name": "Künefe", "calories": 400, "protein": 8, "carbs": 45, "fat": 20, "serving_size": "1 porsiyon", "category": "Tatlılar"},
    {"name": "Sütlaç", "calories": 180, "protein": 5, "carbs": 30, "fat": 4, "serving_size": "1 porsiyon", "category": "Tatlılar"},
]

EXERCISES = [
    {"name": "Yürüyüş", "type": "Kardiyo", "calories_per_min": 5, "difficulty": "Kolay", "description": "Orta tempolu düz zeminde yürüyüş"},
    {"name": "Koşu", "type": "Kardiyo", "calories_per_min": 10, "difficulty": "Orta", "description": "Orta tempolu koşu"},
    {"name": "Bisiklet", "type": "Kardiyo", "calories_per_min": 8, "difficulty": "Orta", "description": "Açık havada veya sabit bisiklet"},
    {"name": "Yüzme", "type": "Kardiyo", "calories_per_min": 9, "difficulty": "Orta", "description": "Serbest stil yüzme"},
    {"name": "İp Atlama", "type": "Kardiyo", "calories_per_min": 12, "difficulty": "Zor", "description": "Orta tempolu ip atlama"},
    {"name": "Yoga", "type": "Esneklik", "calories_per_min": 4, "difficulty": "Kolay", "description": "Temel yoga pozisyonları"},
    {"name": "Pilates", "type": "Esneklik", "calories_per_min": 5, "difficulty": "Orta", "description": "Pilates mat egzersizleri"},
    {"name": "Şınav", "type": "Kuvvet", "calories_per_min": 7, "difficulty": "Orta", "description": "Klasik şınav hareketi"},
    {"name": "Squat", "type": "Kuvvet", "calories_per_min": 6, "difficulty": "Kolay", "description": "Vücut ağırlığı ile squat"},
    {"name": "Plank", "type": "Kuvvet", "calories_per_min": 5, "difficulty": "Orta", "description": "Düz plank pozisyonu"},
    {"name": "Mekik", "type": "Kuvvet", "calories_per_min": 6, "difficulty": "Kolay", "description": "Klasik mekik hareketi"},
    {"name": "Burpee", "type": "HIIT", "calories_per_min": 14, "difficulty": "Zor", "description": "Tam burpee hareketi"},
    {"name": "Dağ Tırmanma", "type": "HIIT", "calories_per_min": 10, "difficulty": "Orta", "description": "Mountain climber hareketi"},
    {"name": "Jumping Jack", "type": "Kardiyo", "calories_per_min": 8, "difficulty": "Kolay", "description": "Açma kapama hareketi"},
    {"name": "Lunges", "type": "Kuvvet", "calories_per_min": 6, "difficulty": "Orta", "description": "İleri adım hareketi"},
    {"name": "Ağırlık Kaldırma", "type": "Kuvvet", "calories_per_min": 8, "difficulty": "Zor", "description": "Genel ağırlık antrenmanı"},
    {"name": "Dans", "type": "Kardiyo", "calories_per_min": 7, "difficulty": "Kolay", "description": "Serbest dans veya zumba"},
    {"name": "Merdiven Çıkma", "type": "Kardiyo", "calories_per_min": 9, "difficulty": "Orta", "description": "Merdiven çıkıp inme egzersizi"},
]

ACHIEVEMENTS = [
    {"key": "first_meal", "title": "İlk Adım!", "description": "İlk öğününü kayıt ettin", "icon": "🎯", "condition": "meal_count >= 1"},
    {"key": "week_streak", "title": "Kararlı!", "description": "7 gün üst üste öğün kaydı", "icon": "🔥", "condition": "streak >= 7"},
    {"key": "first_exercise", "title": "Sporcu!", "description": "İlk egzersizini yaptın", "icon": "💪", "condition": "exercise_count >= 1"},
    {"key": "calorie_goal", "title": "Hedefi Tutturdun!", "description": "Günlük kalori hedefine ulaştın", "icon": "⭐", "condition": "daily_goal_met"},
    {"key": "photo_scan", "title": "Teknoloji Gurusu!", "description": "İlk yemek fotoğrafını taradın", "icon": "📸", "condition": "scan_count >= 1"},
    {"key": "diet_plan", "title": "Planlı Yaşam!", "description": "İlk diyet planını oluşturdun", "icon": "📋", "condition": "has_diet_plan"},
    {"key": "weight_log", "title": "Takipçi!", "description": "İlk kilo kaydını yaptın", "icon": "⚖️", "condition": "weight_log_count >= 1"},
    {"key": "ten_meals", "title": "Düzenli Beslenme!", "description": "10 öğün kayıt ettin", "icon": "🏆", "condition": "meal_count >= 10"},
    {"key": "five_exercises", "title": "Fitness Master!", "description": "5 egzersiz tamamladın", "icon": "🥇", "condition": "exercise_count >= 5"},
    {"key": "menu_scan", "title": "Menü Dedektifi!", "description": "Kurum menüsünü taradın", "icon": "🔍", "condition": "menu_scan_count >= 1"},
]

MOTIVATIONAL_MESSAGES = [
    "Bugün harika gidiyorsun! Devam et 💪",
    "Her sağlıklı öğün, hedefine bir adım daha yaklaştırır!",
    "Vücudun sana teşekkür ediyor! 🌟",
    "Küçük adımlar, büyük değişimler yaratır!",
    "Bugünkü egzersizin yarının enerjisi olacak!",
    "Kendine yatırım yapıyorsun, en değerli yatırım! 🎯",
    "Disiplin, motivasyonun yerini aldığında başarı gelir!",
    "Sağlıklı yaşam bir maraton, sprint değil 🏃",
    "Her gün biraz daha iyi olmak yeterli!",
    "Hedefine olan inancını asla kaybetme! ⭐",
]

async def seed_database():
    food_count = await db.foods.count_documents({})
    if food_count == 0:
        logger.info("Seeding food database...")
        for food in TURKISH_FOODS:
            food["id"] = str(uuid.uuid4())
            food["is_custom"] = False
        await db.foods.insert_many(TURKISH_FOODS)
        logger.info(f"Seeded {len(TURKISH_FOODS)} foods")

    exercise_count = await db.exercises.count_documents({})
    if exercise_count == 0:
        logger.info("Seeding exercise database...")
        for ex in EXERCISES:
            ex["id"] = str(uuid.uuid4())
        await db.exercises.insert_many(EXERCISES)
        logger.info(f"Seeded {len(EXERCISES)} exercises")

    achievement_count = await db.achievement_templates.count_documents({})
    if achievement_count == 0:
        logger.info("Seeding achievements...")
        await db.achievement_templates.insert_many(ACHIEVEMENTS)
        logger.info(f"Seeded {len(ACHIEVEMENTS)} achievements")

@app.on_event("startup")
async def startup():
    await seed_database()

# ======================== USER ENDPOINTS ========================

@api_router.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate):
    calories, protein, carbs, fat = calculate_daily_targets(
        user.gender, user.weight, user.height, user.age, user.activity_level, user.goal
    )
    user_doc = {
        "id": str(uuid.uuid4()),
        "name": user.name,
        "age": user.age,
        "gender": user.gender,
        "height": user.height,
        "weight": user.weight,
        "target_weight": user.target_weight,
        "activity_level": user.activity_level,
        "goal": user.goal,
        "daily_calorie_target": calories,
        "daily_protein": protein,
        "daily_carbs": carbs,
        "daily_fat": fat,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    return UserResponse(**{k: v for k, v in user_doc.items() if k != "_id"})

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return UserResponse(**user)

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user: UserCreate):
    calories, protein, carbs, fat = calculate_daily_targets(
        user.gender, user.weight, user.height, user.age, user.activity_level, user.goal
    )
    update_doc = {
        "name": user.name, "age": user.age, "gender": user.gender,
        "height": user.height, "weight": user.weight, "target_weight": user.target_weight,
        "activity_level": user.activity_level, "goal": user.goal,
        "daily_calorie_target": calories, "daily_protein": protein,
        "daily_carbs": carbs, "daily_fat": fat,
    }
    result = await db.users.update_one({"id": user_id}, {"$set": update_doc})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    updated = await db.users.find_one({"id": user_id}, {"_id": 0})
    return UserResponse(**updated)

# ======================== DIET PLAN ENDPOINTS ========================

@api_router.post("/diet/generate/{user_id}")
async def generate_diet_plan(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    prompt = f"""Kullanıcı bilgileri:
- İsim: {user['name']}, Yaş: {user['age']}, Cinsiyet: {user['gender']}
- Boy: {user['height']}cm, Kilo: {user['weight']}kg, Hedef: {user['target_weight']}kg
- Aktivite: {user['activity_level']}, Hedef: {user['goal']}
- Günlük kalori hedefi: {user['daily_calorie_target']} kcal
- Makrolar: Protein {user['daily_protein']}g, Karbonhidrat {user['daily_carbs']}g, Yağ {user['daily_fat']}g

Lütfen 7 günlük kişiselleştirilmiş bir Türk mutfağı ağırlıklı diyet planı oluştur.

YANITI MUTLAKA aşağıdaki JSON formatında ver, başka metin ekleme:
{{
  "plan_name": "Plan adı",
  "description": "Kısa açıklama",
  "daily_plans": [
    {{
      "day": 1,
      "day_name": "Pazartesi",
      "meals": [
        {{
          "meal_type": "Kahvaltı",
          "foods": ["Yemek 1 - porsiyon", "Yemek 2 - porsiyon"],
          "total_calories": 400,
          "protein": 20,
          "carbs": 40,
          "fat": 15
        }}
      ],
      "total_calories": 1800,
      "tip": "Günlük ipucu"
    }}
  ]
}}"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"diet-gen-{uuid.uuid4()}",
            system_message="Sen deneyimli bir Türk diyetisyensin. Sağlıklı, dengeli ve Türk mutfağına uygun diyet planları hazırlıyorsun. Yanıtlarını SADECE JSON formatında ver."
        )
        chat.with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1] if "\n" in response_text else response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()

        plan_data = json.loads(response_text)

        plan_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "plan_name": plan_data.get("plan_name", "Kişisel Diyet Planı"),
            "description": plan_data.get("description", ""),
            "daily_plans": plan_data.get("daily_plans", []),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_active": True
        }

        await db.diet_plans.update_many({"user_id": user_id, "is_active": True}, {"$set": {"is_active": False}})
        await db.diet_plans.insert_one(plan_doc)

        return {k: v for k, v in plan_doc.items() if k != "_id"}
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, response: {response_text[:200]}")
        raise HTTPException(status_code=500, detail="Diyet planı oluşturulurken hata oluştu. Lütfen tekrar deneyin.")
    except Exception as e:
        logger.error(f"Diet generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Diyet planı oluşturma hatası: {str(e)}")

@api_router.get("/diet/plan/{user_id}")
async def get_diet_plan(user_id: str):
    plan = await db.diet_plans.find_one({"user_id": user_id, "is_active": True}, {"_id": 0})
    if not plan:
        return {"message": "Henüz diyet planınız yok", "has_plan": False}
    return {**plan, "has_plan": True}

# ======================== FOOD ENDPOINTS ========================

@api_router.get("/foods")
async def get_foods(search: str = "", category: str = ""):
    query = {}
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    if category:
        query["category"] = category
    foods = await db.foods.find(query, {"_id": 0}).to_list(200)
    return foods

@api_router.get("/foods/categories")
async def get_food_categories():
    categories = await db.foods.distinct("category")
    return categories

@api_router.post("/foods/custom")
async def add_custom_food(food: FoodItem):
    food_doc = food.dict()
    food_doc["id"] = str(uuid.uuid4())
    food_doc["is_custom"] = True
    await db.foods.insert_one(food_doc)
    return {k: v for k, v in food_doc.items() if k != "_id"}

# ======================== MEAL LOG ENDPOINTS ========================

@api_router.post("/meals/log")
async def log_meal(meal: MealLogCreate):
    meal_doc = meal.dict()
    meal_doc["id"] = str(uuid.uuid4())
    meal_doc["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meal_doc["timestamp"] = datetime.now(timezone.utc).isoformat()
    await db.meal_logs.insert_one(meal_doc)
    return {k: v for k, v in meal_doc.items() if k != "_id"}

@api_router.get("/meals/{user_id}/today")
async def get_today_meals(user_id: str):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meals = await db.meal_logs.find({"user_id": user_id, "date": today}, {"_id": 0}).to_list(100)
    total_calories = sum(m.get("calories", 0) for m in meals)
    total_protein = sum(m.get("protein", 0) for m in meals)
    total_carbs = sum(m.get("carbs", 0) for m in meals)
    total_fat = sum(m.get("fat", 0) for m in meals)
    return {
        "meals": meals,
        "totals": {
            "calories": total_calories,
            "protein": round(total_protein, 1),
            "carbs": round(total_carbs, 1),
            "fat": round(total_fat, 1)
        }
    }

@api_router.get("/meals/{user_id}/history")
async def get_meal_history(user_id: str, days: int = 7):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    meals = await db.meal_logs.find(
        {"user_id": user_id, "date": {"$gte": start_date}}, {"_id": 0}
    ).to_list(500)
    daily_summary = {}
    for meal in meals:
        date = meal["date"]
        if date not in daily_summary:
            daily_summary[date] = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "meal_count": 0}
        daily_summary[date]["calories"] += meal.get("calories", 0)
        daily_summary[date]["protein"] += meal.get("protein", 0)
        daily_summary[date]["carbs"] += meal.get("carbs", 0)
        daily_summary[date]["fat"] += meal.get("fat", 0)
        daily_summary[date]["meal_count"] += 1
    return {"history": daily_summary}

# ======================== SCAN ENDPOINTS ========================

@api_router.post("/scan/plate")
async def scan_plate(request: ScanRequest):
    try:
        image_content = ImageContent(image_base64=request.image_base64)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"scan-plate-{uuid.uuid4()}",
            system_message="Sen bir yemek tanıma ve kalori hesaplama uzmanısın. Fotoğraftaki yemekleri tanımla ve besin değerlerini hesapla. Yanıtlarını SADECE JSON formatında ver."
        )
        chat.with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(
            text="""Bu fotoğraftaki tabaktaki/masadaki yemekleri tanımla ve her birinin kalori ve besin değerlerini hesapla.

YANITI MUTLAKA aşağıdaki JSON formatında ver:
{
  "foods": [
    {
      "name": "Yemek adı",
      "estimated_portion": "Tahmini porsiyon",
      "calories": 250,
      "protein": 15,
      "carbs": 20,
      "fat": 10
    }
  ],
  "total_calories": 500,
  "total_protein": 30,
  "total_carbs": 40,
  "total_fat": 20,
  "diet_suitability": "Diyete uygunluk değerlendirmesi",
  "suggestions": "Öneriler"
}""",
            file_contents=[image_content]
        ))

        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1] if "\n" in response_text else response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()

        result = json.loads(response_text)
        return result
    except json.JSONDecodeError:
        return {"error": "Yemek analizi yapılamadı. Lütfen daha net bir fotoğraf çekin."}
    except Exception as e:
        logger.error(f"Plate scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Tarama hatası: {str(e)}")

@api_router.post("/scan/menu")
async def scan_menu(request: ScanRequest):
    try:
        image_content = ImageContent(image_base64=request.image_base64)
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"scan-menu-{uuid.uuid4()}",
            system_message="Sen bir menü okuma ve kalori hesaplama uzmanısın. Fotoğraftaki menüdeki yemekleri oku ve her birinin tahmini besin değerlerini hesapla. Yanıtlarını SADECE JSON formatında ver."
        )
        chat.with_model("openai", "gpt-4o")

        response = await chat.send_message(UserMessage(
            text="""Bu fotoğraftaki kurum/restoran menüsünü oku. Menüdeki tüm yemekleri listele ve her birinin tahmini kalori ve besin değerlerini hesapla.

YANITI MUTLAKA aşağıdaki JSON formatında ver:
{
  "menu_items": [
    {
      "name": "Yemek adı",
      "calories": 250,
      "protein": 15,
      "carbs": 20,
      "fat": 10,
      "serving_size": "1 porsiyon",
      "category": "Kategori"
    }
  ],
  "menu_source": "Menünün kaynağı/açıklaması"
}""",
            file_contents=[image_content]
        ))

        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1] if "\n" in response_text else response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()

        result = json.loads(response_text)

        if "menu_items" in result:
            for item in result["menu_items"]:
                existing = await db.foods.find_one({"name": item["name"]}, {"_id": 0})
                if not existing:
                    food_doc = {
                        "id": str(uuid.uuid4()),
                        "name": item["name"],
                        "calories": item.get("calories", 0),
                        "protein": item.get("protein", 0),
                        "carbs": item.get("carbs", 0),
                        "fat": item.get("fat", 0),
                        "serving_size": item.get("serving_size", "1 porsiyon"),
                        "category": item.get("category", "Kurum Menüsü"),
                        "is_custom": True
                    }
                    await db.foods.insert_one(food_doc)

        return result
    except json.JSONDecodeError:
        return {"error": "Menü okunamadı. Lütfen daha net bir fotoğraf çekin."}
    except Exception as e:
        logger.error(f"Menu scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Menü tarama hatası: {str(e)}")

# ======================== EXERCISE ENDPOINTS ========================

@api_router.get("/exercises")
async def get_exercises(exercise_type: str = ""):
    query = {}
    if exercise_type:
        query["type"] = exercise_type
    exercises = await db.exercises.find(query, {"_id": 0}).to_list(50)
    return exercises

@api_router.get("/exercises/suggestions/{user_id}")
async def get_exercise_suggestions(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    goal = user.get("goal", "kilo_ver")
    activity = user.get("activity_level", "sedanter")

    if goal == "kilo_ver":
        preferred = ["Kardiyo", "HIIT"]
    elif goal == "kilo_al":
        preferred = ["Kuvvet"]
    else:
        preferred = ["Kardiyo", "Kuvvet", "Esneklik"]

    if activity in ["sedanter", "hafif_aktif"]:
        difficulty_filter = ["Kolay", "Orta"]
    else:
        difficulty_filter = ["Kolay", "Orta", "Zor"]

    exercises = await db.exercises.find(
        {"type": {"$in": preferred}, "difficulty": {"$in": difficulty_filter}}, {"_id": 0}
    ).to_list(10)

    import random
    random.shuffle(exercises)
    return exercises[:5]

@api_router.post("/exercises/log")
async def log_exercise(exercise: ExerciseLogCreate):
    log_doc = exercise.dict()
    log_doc["id"] = str(uuid.uuid4())
    log_doc["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    log_doc["timestamp"] = datetime.now(timezone.utc).isoformat()
    await db.exercise_logs.insert_one(log_doc)
    return {k: v for k, v in log_doc.items() if k != "_id"}

@api_router.get("/exercises/{user_id}/today")
async def get_today_exercises(user_id: str):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    exercises = await db.exercise_logs.find({"user_id": user_id, "date": today}, {"_id": 0}).to_list(50)
    total_burned = sum(e.get("calories_burned", 0) for e in exercises)
    total_minutes = sum(e.get("duration_minutes", 0) for e in exercises)
    return {"exercises": exercises, "total_burned": total_burned, "total_minutes": total_minutes}

# ======================== PROGRESS ENDPOINTS ========================

@api_router.post("/progress/weight")
async def log_weight(data: WeightLogCreate):
    log_doc = {
        "id": str(uuid.uuid4()),
        "user_id": data.user_id,
        "weight": data.weight,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.weight_logs.insert_one(log_doc)
    await db.users.update_one({"id": data.user_id}, {"$set": {"weight": data.weight}})
    return {k: v for k, v in log_doc.items() if k != "_id"}

@api_router.get("/progress/{user_id}")
async def get_progress(user_id: str):
    weight_logs = await db.weight_logs.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("date", -1).to_list(30)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    today_meals = await db.meal_logs.find({"user_id": user_id, "date": today}, {"_id": 0}).to_list(100)
    today_exercises = await db.exercise_logs.find({"user_id": user_id, "date": today}, {"_id": 0}).to_list(50)

    total_meals = await db.meal_logs.count_documents({"user_id": user_id})
    total_exercises = await db.exercise_logs.count_documents({"user_id": user_id})
    total_scans = await db.scan_logs.count_documents({"user_id": user_id}) if "scan_logs" in await db.list_collection_names() else 0

    calories_consumed = sum(m.get("calories", 0) for m in today_meals)
    calories_burned = sum(e.get("calories_burned", 0) for e in today_exercises)

    return {
        "weight_history": weight_logs,
        "today_calories_consumed": calories_consumed,
        "today_calories_burned": calories_burned,
        "total_meals_logged": total_meals,
        "total_exercises_done": total_exercises,
        "total_scans": total_scans,
    }

# ======================== MOTIVATION ENDPOINTS ========================

@api_router.get("/motivation/{user_id}")
async def get_motivation(user_id: str):
    import random
    total_meals = await db.meal_logs.count_documents({"user_id": user_id})
    total_exercises = await db.exercise_logs.count_documents({"user_id": user_id})
    has_plan = await db.diet_plans.count_documents({"user_id": user_id, "is_active": True}) > 0
    weight_logs = await db.weight_logs.count_documents({"user_id": user_id})

    unlocked = []
    templates = await db.achievement_templates.find({}, {"_id": 0}).to_list(20)
    for t in templates:
        key = t["key"]
        is_unlocked = False
        if key == "first_meal" and total_meals >= 1:
            is_unlocked = True
        elif key == "ten_meals" and total_meals >= 10:
            is_unlocked = True
        elif key == "first_exercise" and total_exercises >= 1:
            is_unlocked = True
        elif key == "five_exercises" and total_exercises >= 5:
            is_unlocked = True
        elif key == "diet_plan" and has_plan:
            is_unlocked = True
        elif key == "weight_log" and weight_logs >= 1:
            is_unlocked = True

        unlocked.append({**t, "unlocked": is_unlocked})

    message = random.choice(MOTIVATIONAL_MESSAGES)

    surprises = []
    if total_meals == 5:
        surprises.append({"type": "milestone", "message": "🎉 5 öğünü tamamladın! Harika gidiyorsun!"})
    if total_exercises == 3:
        surprises.append({"type": "milestone", "message": "🏋️ 3 egzersizi tamamladın! Sporcu modunda!"})
    if total_meals >= 1 and total_exercises >= 1:
        surprises.append({"type": "combo", "message": "⚡ Hem yemek hem egzersiz takibi yapıyorsun! Muhteşem!"})

    return {
        "motivational_message": message,
        "achievements": unlocked,
        "surprises": surprises,
        "stats": {
            "total_meals": total_meals,
            "total_exercises": total_exercises,
            "has_plan": has_plan,
        }
    }

# ======================== ROOT & HEALTH ========================

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
