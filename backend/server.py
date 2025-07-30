from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create uploads directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# JWT Configuration
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create the main app
app = FastAPI()

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Models
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = Field(default="citizen")  # citizen or admin

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class ComplaintCreate(BaseModel):
    title: str
    description: str
    category: str
    priority: str = Field(default="medium")  # low, medium, high
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None

class Complaint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    priority: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    status: str = Field(default="open")  # open, in_progress, resolved, closed
    user_id: str
    user_name: str
    user_email: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    image_url: Optional[str] = None
    assigned_to: Optional[str] = None
    admin_comments: Optional[str] = None

class ComplaintUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    admin_comments: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user_data = await db.users.find_one({"email": email})
        if user_data is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user_data)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Routes
@api_router.get("/")
async def root():
    return {"message": "CMRP API is running"}

@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user
    user_dict = user_data.dict()
    user_dict["password"] = hashed_password
    user_obj = User(**{k: v for k, v in user_dict.items() if k != "password"})
    
    # Insert user
    await db.users.insert_one({**user_obj.dict(), "password": hashed_password})
    
    # Create access token
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"email": user_data.email})
    if not user_doc or not verify_password(user_data.password, user_doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_obj = User(**{k: v for k, v in user_doc.items() if k != "password"})
    
    # Create access token
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/complaints", response_model=Complaint)
async def create_complaint(
    complaint_data: ComplaintCreate,
    current_user: User = Depends(get_current_user)
):
    complaint_dict = complaint_data.dict()
    complaint_dict.update({
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "user_email": current_user.email
    })
    
    complaint_obj = Complaint(**complaint_dict)
    await db.complaints.insert_one(complaint_obj.dict())
    
    return complaint_obj

@api_router.post("/complaints/{complaint_id}/upload")
async def upload_complaint_image(
    complaint_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Check if complaint exists and belongs to user
    complaint = await db.complaints.find_one({"id": complaint_id, "user_id": current_user.id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    # Save file
    file_extension = Path(file.filename).suffix
    filename = f"{complaint_id}_{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update complaint with image URL
    image_url = f"/uploads/{filename}"
    await db.complaints.update_one(
        {"id": complaint_id},
        {"$set": {"image_url": image_url, "updated_at": datetime.utcnow()}}
    )
    
    return {"image_url": image_url}

@api_router.get("/complaints/my", response_model=List[Complaint])
async def get_my_complaints(current_user: User = Depends(get_current_user)):
    complaints = await db.complaints.find({"user_id": current_user.id}).sort("created_at", -1).to_list(1000)
    return [Complaint(**complaint) for complaint in complaints]

@api_router.get("/complaints", response_model=List[Complaint])
async def get_all_complaints(
    status: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    filter_dict = {}
    if status:
        filter_dict["status"] = status
    if category:
        filter_dict["category"] = category
    
    complaints = await db.complaints.find(filter_dict).sort("created_at", -1).to_list(1000)
    return [Complaint(**complaint) for complaint in complaints]

@api_router.put("/complaints/{complaint_id}", response_model=Complaint)
async def update_complaint(
    complaint_id: str,
    update_data: ComplaintUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    complaint = await db.complaints.find_one({"id": complaint_id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    await db.complaints.update_one({"id": complaint_id}, {"$set": update_dict})
    
    updated_complaint = await db.complaints.find_one({"id": complaint_id})
    return Complaint(**updated_complaint)

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_complaints = await db.complaints.count_documents({})
    open_complaints = await db.complaints.count_documents({"status": "open"})
    in_progress_complaints = await db.complaints.count_documents({"status": "in_progress"})
    resolved_complaints = await db.complaints.count_documents({"status": "resolved"})
    
    return {
        "total_complaints": total_complaints,
        "open_complaints": open_complaints,
        "in_progress_complaints": in_progress_complaints,
        "resolved_complaints": resolved_complaints
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()