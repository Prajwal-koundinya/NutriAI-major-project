from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import base64
from io import BytesIO
from PIL import Image
import json
import random
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
JWT_EXPIRATION_MINUTES = int(os.environ['JWT_EXPIRATION_MINUTES'])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# DeepSeek Configuration
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY')
DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
if DEEPSEEK_API_KEY:
    logger.info("DeepSeek API key loaded from environment")
else:
    logger.warning("DeepSeek API key is not set. Set DEEPSEEK_API_KEY in backend/.env")

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    diet_pref: Optional[str] = None
    allergies: Optional[List[str]] = None
    medical: Optional[List[str]] = None
    timezone: Optional[str] = None
    consent_given: Optional[bool] = None

class UserProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    gender: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    goal: Optional[str] = "health"
    activity_level: Optional[str] = "moderate"
    diet_pref: Optional[str] = None
    allergies: Optional[List[str]] = None
    medical: Optional[List[str]] = None
    timezone: str = "Asia/Kolkata"
    daily_calorie_target: int = 2000
    daily_protein_target: int = 50
    consent_given: bool = False
    onboarding_completed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FoodItem(BaseModel):
    name: str
    probability: float
    portion_estimate_g: float

class MealEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    image_base64: str
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: Optional[float] = 0
    sugar_g: Optional[float] = 0
    sodium_mg: Optional[float] = 0
    confidence_score: float
    items: List[FoodItem]
    recommendations: List[str]
    explanation: List[str]
    user_confirmed: bool = False
    tag: str = "snack"

class MealAnalysisRequest(BaseModel):
    image_base64: str
    tag: Optional[str] = "snack"
    # Optional user-entered portion override
    portion_amount: Optional[float] = None
    portion_unit: Optional[str] = None

class MealAnalysisResponse(BaseModel):
    calories_kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    sugar_g: float
    sodium_mg: float
    confidence_score: float
    items: List[FoodItem]
    recommendations: List[str]
    explanation: List[str]
    needs_confirmation: bool
    needs_portion_confirmation: Optional[bool] = False
    very_low_confidence: Optional[bool] = False

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def calculate_nutrition_targets(user: dict) -> dict:
    """Calculate daily calorie and protein targets based on user profile"""
    if not all([user.get('weight_kg'), user.get('height_cm'), user.get('age'), user.get('gender')]):
        return {"daily_calorie_target": 2000, "daily_protein_target": 50}
    
    weight = user['weight_kg']
    height = user['height_cm']
    age = user['age']
    gender = user['gender'].lower()
    activity = user.get('activity_level', 'moderate').lower()
    goal = user.get('goal', 'health').lower()
    
    # BMR calculation (Mifflin-St Jeor Equation)
    if gender == 'male':
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    
    # Activity multiplier
    activity_multipliers = {
        'sedentary': 1.2,
        'light': 1.375,
        'moderate': 1.55,
        'active': 1.725,
        'very_active': 1.9
    }
    tdee = bmr * activity_multipliers.get(activity, 1.55)
    
    # Goal adjustment
    if goal == 'fat_loss':
        calories = tdee - 500
    elif goal == 'muscular':
        calories = tdee + 300
    elif goal == 'lean':
        calories = tdee
    else:
        calories = tdee
    
    # Protein calculation (1.6-2.2g per kg for active individuals)
    if goal == 'muscular':
        protein = weight * 2.0
    elif goal == 'fat_loss':
        protein = weight * 1.8
    else:
        protein = weight * 1.6
    
    return {
        "daily_calorie_target": int(calories),
        "daily_protein_target": int(protein)
    }

async def analyze_meal_with_gemini(image_base64: str, user_context: dict = None, portion_override: Optional[float] = None, portion_unit: Optional[str] = None) -> dict:
    """Analyze meal image using DeepSeek Vision via chat completions with user context and optional portion override"""
    try:
        if not DEEPSEEK_API_KEY:
            raise HTTPException(status_code=500, detail="DeepSeek API key not configured")

        # Ensure image is in data URL format for DeepSeek
        if image_base64.startswith('data:'):
            image_data_url = image_base64
        else:
            image_data_url = f"data:image/jpeg;base64,{image_base64}"

        # Build user context string safely
        context_str = ""
        if user_context:
            goal = user_context.get('goal', 'health')
            if goal:
                goal = str(goal).replace('_', ' ').title()
            
            activity = user_context.get('activity_level', 'moderate')
            if activity:
                activity = str(activity).title()
            
            diet_pref = user_context.get('diet_pref') or 'None'
            
            # Safely handle allergies list
            allergies = user_context.get('allergies', [])
            if allergies and isinstance(allergies, list):
                allergies_str = ', '.join(str(a) for a in allergies)
            else:
                allergies_str = 'None'
            
            # Safely handle medical conditions list
            medical = user_context.get('medical', [])
            if medical and isinstance(medical, list):
                medical_str = ', '.join(str(m) for m in medical)
            else:
                medical_str = 'None'

            portion_context = ""
            if portion_override is not None and portion_override > 0:
                unit = portion_unit or 'g'
                portion_context = f"- User-estimated portion: {portion_override} {unit}\n"
            
            context_str = f"""
USER PROFILE CONTEXT:
- Goal: {goal}
- Activity Level: {activity}
- Daily Calorie Target: {user_context.get('daily_calorie_target', 2000)} kcal
- Daily Protein Target: {user_context.get('daily_protein_target', 50)}g
- Diet Preference: {diet_pref}
- Allergies: {allergies_str}
- Medical Conditions: {medical_str}
{portion_context}
Tailor your recommendations based on this user profile and portion estimate when provided.
"""
        
        # Create enhanced prompt for DeepSeek
        prompt = f"""You are an expert nutrition analyst specializing in Indian and global cuisine.

{context_str}

TASK: Analyze this meal image and provide detailed nutritional information.

IMPORTANT INSTRUCTIONS:
1. Identify all visible food items with confidence scores
2. Estimate portion sizes in grams or appropriate local units
3. Calculate total nutritional values
4. Provide personalized recommendations based on user profile
5. Explain the nutritional breakdown

CRITICAL: Return ONLY a valid JSON object. No prose, no markdown, no explanations outside JSON.

EXACT JSON SCHEMA REQUIRED:
{{
  "calories_kcal": <number>,
  "macros": {{
    "protein_g": <number>,
    "carbs_g": <number>,
    "fat_g": <number>,
    "fiber_g": <number or null>,
    "sugar_g": <number or null>,
    "sodium_mg": <number or null>
  }},
  "confidence_score": <number 0-1>,
  "food_items": [
    {{
      "name": "<food name>",
      "probability": <number 0-1>,
      "portion_estimate_g": <number>
    }}
  ],
  "recommendations": ["<personalized recommendation 1>", "<recommendation 2>"],
  "explainability": ["<explanation point 1>", "<explanation point 2>"]
}}

VALIDATION RULES:
- All numeric values must be positive numbers
- confidence_score must be between 0 and 1
- probability must be between 0 and 1
- Include at least 2-3 recommendations
- Include at least 2-3 explainability points
- Consider user's dietary restrictions and allergies
- Tailor recommendations to user's goals (weight loss, muscle gain, etc.)

Return ONLY the JSON schema provided. No prose."""

        # Call DeepSeek chat completions API with image + prompt
        payload = {
            "model": "deepseek-chat",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data_url},
                        },
                    ],
                }
            ],
            "temperature": 0.4,
            "max_tokens": 800,
        }

        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        }

        ds_response = requests.post(DEEPSEEK_API_URL, headers=headers, json=payload, timeout=60)

        if ds_response.status_code != 200:
            logger.error(f"DeepSeek API error {ds_response.status_code}: {ds_response.text[:300]}")
            raise HTTPException(status_code=500, detail="DeepSeek service error while analyzing the meal.")

        ds_json = ds_response.json()
        message = ds_json.get("choices", [{}])[0].get("message", {})
        content = message.get("content", "")

        # Some providers may return content as a list of parts
        if isinstance(content, list):
            content_text = "".join(part.get("text", "") for part in content)
        else:
            content_text = content or ""

        response_text = content_text.strip()

        # Remove markdown code blocks if present
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        elif response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Parse JSON
        result = json.loads(response_text)

        # Transform to expected format
        transformed_result = {
            "calories_kcal": result.get("calories_kcal", 0),
            "protein_g": result.get("macros", {}).get("protein_g", 0),
            "carbs_g": result.get("macros", {}).get("carbs_g", 0),
            "fat_g": result.get("macros", {}).get("fat_g", 0),
            "fiber_g": result.get("macros", {}).get("fiber_g", 0),
            "sugar_g": result.get("macros", {}).get("sugar_g", 0),
            "sodium_mg": result.get("macros", {}).get("sodium_mg", 0),
            "confidence_score": result.get("confidence_score", 0.5),
            "items": result.get("food_items", []),
            "recommendations": result.get("recommendations", []),
            "explanation": result.get("explainability", []),
        }

        # Add confidence flags
        confidence = transformed_result['confidence_score']
        transformed_result['needs_confirmation'] = confidence < 0.80
        transformed_result['needs_portion_confirmation'] = confidence < 0.80 and confidence >= 0.50
        transformed_result['very_low_confidence'] = confidence < 0.50

        return transformed_result

    except json.JSONDecodeError as e:
        logger.error(f"DeepSeek JSON parse error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to parse DeepSeek response. Please try again with better lighting.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DeepSeek analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze meal: {str(e)}")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = UserProfile(
        email=user_data.email,
        name=user_data.name,
    )
    user_dict = user.dict()
    user_dict['password'] = hash_password(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_access_token({"sub": user.id})
    
    return {
        "token": token,
        "user": {k: v for k, v in user_dict.items() if k not in ['password', '_id']}
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_access_token({"sub": user['id']})
    
    return {
        "token": token,
        "user": {k: v for k, v in user.items() if k not in ['password', '_id']}
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k not in ['password', '_id']}

@api_router.put("/auth/profile")
async def update_profile(profile_update: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in profile_update.dict().items() if v is not None}
    
    # Calculate nutrition targets if relevant fields updated
    if any(k in update_data for k in ['weight_kg', 'height_cm', 'age', 'gender', 'activity_level', 'goal']):
        merged_user = {**current_user, **update_data}
        targets = calculate_nutrition_targets(merged_user)
        update_data.update(targets)
    
    # Check if onboarding is complete
    required_fields = ['gender', 'age', 'height_cm', 'weight_kg', 'goal', 'activity_level']
    if all(update_data.get(f) or current_user.get(f) for f in required_fields):
        update_data['onboarding_completed'] = True
    
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"id": current_user['id']})
    return {k: v for k, v in updated_user.items() if k not in ['password', '_id']}

# ==================== MEAL ENDPOINTS ====================

@api_router.post("/meals/analyze")
async def analyze_meal(request: MealAnalysisRequest, current_user: dict = Depends(get_current_user)):
    """Analyze a meal image using DeepSeek with user context and strict validation"""
    logger.info("=== ANALYZE MEAL REQUEST START ===")
    logger.info(f"User: {current_user.get('email')}")
    logger.info(f"Image size: {len(request.image_base64)} bytes")
    if request.portion_amount:
        logger.info(f"User portion override: {request.portion_amount} {request.portion_unit or 'g'}")
    
    try:
        # Pass user context to DeepSeek for personalized analysis
        user_context = {
            'goal': current_user.get('goal'),
            'activity_level': current_user.get('activity_level'),
            'daily_calorie_target': current_user.get('daily_calorie_target'),
            'daily_protein_target': current_user.get('daily_protein_target'),
            'diet_pref': current_user.get('diet_pref'),
            'allergies': current_user.get('allergies', []),
            'medical': current_user.get('medical', []),
        }
        
        logger.info("Calling DeepSeek API...")
        result = await analyze_meal_with_gemini(
            request.image_base64,
            user_context,
            portion_override=request.portion_amount,
            portion_unit=request.portion_unit,
        )
        logger.info(f"DeepSeek response received. Keys: {list(result.keys())}")
        
        # Validate required fields
        required_fields = ['calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence_score', 'items']
        for field in required_fields:
            if field not in result or result[field] is None:
                logger.error(f"Missing required field: {field}")
                raise ValueError(f"Missing required field: {field}")
        
        # Validate data types and ranges
        if not isinstance(result['calories_kcal'], (int, float)) or result['calories_kcal'] < 0:
            logger.error(f"Invalid calories: {result['calories_kcal']}")
            raise ValueError("Invalid calories value")
        if not isinstance(result['confidence_score'], (int, float)) or not (0 <= result['confidence_score'] <= 1):
            logger.error(f"Invalid confidence: {result['confidence_score']}")
            raise ValueError("Invalid confidence score")
        if not isinstance(result['items'], list) or len(result['items']) == 0:
            logger.error(f"Invalid items: {result.get('items')}")
            raise ValueError("No food items detected")
        
        logger.info(f"Validation successful. Returning {result['calories_kcal']} kcal, {len(result['items'])} items")
        return {"status": "success", "data": result}
        
    except ValueError as e:
        logger.error(f"Schema validation error: {str(e)}")
        return {
            "status": "error",
            "code": "SCHEMA_VALIDATION_ERROR",
            "message": f"Validation failed: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Analysis exception: {type(e).__name__}: {str(e)}", exc_info=True)
        error_code = "ANALYSIS_ERROR"
        error_message = f"Analysis failed: {str(e)}"
        
        if "quota" in str(e).lower() or "rate" in str(e).lower():
            error_code = "RATE_LIMIT"
            error_message = "Service temporarily busy — please wait 60 seconds and try again."
        elif "timeout" in str(e).lower():
            error_code = "TIMEOUT"
            error_message = "Analysis took too long — try again."
        elif "network" in str(e).lower() or "connection" in str(e).lower():
            error_code = "NETWORK"
            error_message = "Network issue — please retry."
        
        return {
            "status": "error",
            "code": error_code,
            "message": error_message
        }

@api_router.post("/meals")
async def save_meal(meal_data: dict, current_user: dict = Depends(get_current_user)):
    """Save a meal entry"""
    meal = MealEntry(
        user_id=current_user['id'],
        **meal_data
    )
    
    meal_dict = meal.dict()
    await db.meals.insert_one(meal_dict)
    
    # Keep only last 30 meals
    meals = await db.meals.find({"user_id": current_user['id']}).sort("timestamp", -1).to_list(None)
    if len(meals) > 30:
        to_delete = meals[30:]
        await db.meals.delete_many({"id": {"$in": [m['id'] for m in to_delete]}})
    
    return {k: v for k, v in meal_dict.items() if k != '_id'}

@api_router.get("/meals")
async def get_meals(limit: int = 30, current_user: dict = Depends(get_current_user)):
    """Get user's meal history (last 30 meals)"""
    meals = await db.meals.find({"user_id": current_user['id']}).sort("timestamp", -1).limit(limit).to_list(limit)
    return [{k: v for k, v in meal.items() if k != '_id'} for meal in meals]

@api_router.get("/meals/{meal_id}")
async def get_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific meal"""
    meal = await db.meals.find_one({"id": meal_id, "user_id": current_user['id']})
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {k: v for k, v in meal.items() if k != '_id'}

@api_router.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a meal"""
    result = await db.meals.delete_one({"id": meal_id, "user_id": current_user['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    return {"message": "Meal deleted successfully"}

@api_router.get("/meals/today/summary")
async def get_today_summary(current_user: dict = Depends(get_current_user)):
    """Get today's nutrition summary"""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    meals = await db.meals.find({
        "user_id": current_user['id'],
        "timestamp": {"$gte": today_start}
    }).to_list(None)
    
    total_calories = sum(m.get('calories_kcal', 0) for m in meals)
    total_protein = sum(m.get('protein_g', 0) for m in meals)
    total_carbs = sum(m.get('carbs_g', 0) for m in meals)
    total_fat = sum(m.get('fat_g', 0) for m in meals)
    
    return {
        "total_calories": total_calories,
        "total_protein": total_protein,
        "total_carbs": total_carbs,
        "total_fat": total_fat,
        "meal_count": len(meals),
        "calorie_target": current_user.get('daily_calorie_target', 2000),
        "protein_target": current_user.get('daily_protein_target', 50)
    }

# ==================== INSIGHTS ENDPOINTS ====================

@api_router.get("/insights/trends")
async def get_trends(days: int = 7, current_user: dict = Depends(get_current_user)):
    """Get nutrition trends for last N days"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    meals = await db.meals.find({
        "user_id": current_user['id'],
        "timestamp": {"$gte": start_date}
    }).to_list(None)
    
    # Group by date
    daily_data = {}
    for meal in meals:
        date_key = meal['timestamp'].strftime('%Y-%m-%d')
        if date_key not in daily_data:
            daily_data[date_key] = {
                'date': date_key,
                'calories': 0,
                'protein': 0,
                'carbs': 0,
                'fat': 0,
                'meal_count': 0
            }
        daily_data[date_key]['calories'] += meal.get('calories_kcal', 0)
        daily_data[date_key]['protein'] += meal.get('protein_g', 0)
        daily_data[date_key]['carbs'] += meal.get('carbs_g', 0)
        daily_data[date_key]['fat'] += meal.get('fat_g', 0)
        daily_data[date_key]['meal_count'] += 1
    
    trends = list(daily_data.values())
    trends.sort(key=lambda x: x['date'])
    
    # Calculate averages
    if trends:
        avg_calories = sum(d['calories'] for d in trends) / len(trends)
        avg_protein = sum(d['protein'] for d in trends) / len(trends)
        calorie_target = current_user.get('daily_calorie_target', 2000)
        protein_target = current_user.get('daily_protein_target', 50)
        
        surplus_days = sum(1 for d in trends if d['calories'] > calorie_target)
        deficit_days = len(trends) - surplus_days
        protein_met_days = sum(1 for d in trends if d['protein'] >= protein_target)
    else:
        avg_calories = 0
        avg_protein = 0
        surplus_days = 0
        deficit_days = 0
        protein_met_days = 0
    
    return {
        "trends": trends,
        "summary": {
            "avg_calories": round(avg_calories, 1),
            "avg_protein": round(avg_protein, 1),
            "surplus_days": surplus_days,
            "deficit_days": deficit_days,
            "protein_met_days": protein_met_days,
            "total_days": len(trends)
        }
    }

@api_router.get("/insights/who-recommendations")
async def get_who_recommendations(current_user: dict = Depends(get_current_user)):
    """Get WHO-style health recommendations (randomized placeholders)"""
    recommendations = [
        {
            "title": "Balanced Diet",
            "description": "Include a variety of foods: fruits, vegetables, legumes, nuts and whole grains.",
            "icon": "nutrition"
        },
        {
            "title": "Reduce Salt Intake",
            "description": "Limit salt intake to less than 5g per day to prevent hypertension and heart disease.",
            "icon": "salt"
        },
        {
            "title": "Sugar Moderation",
            "description": "Limit free sugars to less than 10% of total energy intake for optimal health.",
            "icon": "sugar"
        },
        {
            "title": "Healthy Fats",
            "description": "Replace saturated fats with unsaturated fats found in fish, nuts, and vegetable oils.",
            "icon": "fats"
        },
        {
            "title": "Stay Hydrated",
            "description": "Drink 8-10 glasses of water daily to maintain proper bodily functions.",
            "icon": "water"
        }
    ]
    
    # Return random recommendation
    return random.choice(recommendations)

# ==================== ROOT & HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "NutriTrack AI API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include router and middleware
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
