from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
#from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import random
import string
from datetime import datetime, timedelta
import bcrypt
import jwt
import shutil


# --- Configuration and variable setup ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = MongoClient(mongo_url, server_api=ServerApi('1'))
db = client[os.environ['DB_NAME']]

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

app = FastAPI()
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

class UserLogin(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = Field(default="citizen")  # citizen or admin

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

# ComplaintCreate must be defined before use in create_complaint
class ComplaintCreate(BaseModel):
    title: str
    description: str
    category: str
    priority: str = Field(default="medium")  # low, medium, high
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None

class CommentEntry(BaseModel):
    author_id: str
    author_name: str
    author_role: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    type: str = Field(default="public")  # public or internal

class Complaint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tracking_id: str = Field(default_factory=lambda: "")
    title: str
    description: str
    category: str
    priority: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    status: str = Field(default="open")
    user_id: str
    user_name: str
    user_email: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    image_url: Optional[str] = None
    assigned_to: Optional[str] = None
    admin_comments: Optional[str] = None
    comments: Optional[list] = Field(default_factory=list)
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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        user_data =  db.users.find_one({"email": email})
        if user_data is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user_data)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Add a comment to a complaint
@api_router.post("/complaints/{complaint_id}/comments")
def add_comment(
    complaint_id: str,
    message: str,
    type: str = "public",  # public or internal
    current_user: User = Depends(get_current_user)
):
    complaint = db.complaints.find_one({"id": complaint_id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    comment = {
        "author_id": current_user.id,
        "author_name": current_user.full_name,
        "author_role": current_user.role,
        "message": message,
        "timestamp": datetime.utcnow(),
        "type": type
    }
    db.complaints.update_one({"id": complaint_id}, {"$push": {"comments": comment}, "$set": {"updated_at": datetime.utcnow()}})
    return {"success": True, "comment": comment}

# Get all comments for a complaint
@api_router.get("/complaints/{complaint_id}/comments")
def get_comments(
    complaint_id: str,
    current_user: User = Depends(get_current_user)
):
    complaint = db.complaints.find_one({"id": complaint_id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    comments = complaint.get("comments", [])
    # Only show internal notes to admins/staff
    if current_user.role not in ["admin", "staff", "superadmin"]:
        comments = [c for c in comments if c.get("type") != "internal"]
    return comments
# WebSocket manager for broadcasting updates
class ConnectionManager:
    def __init__(self):
        self.active_connections = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user_data =  db.users.find_one({"email": email})
        if user_data is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user_data)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Routes
@api_router.get("/")
def root():
    return {"message": "CMRP API is running"}

@api_router.post("/auth/register", response_model=Token)
def register(user_data: UserCreate):
    # Check if user already exists
    existing_user = db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = hash_password(user_data.password)
    
    # Create user
    user_dict = user_data.dict()
    user_dict["password"] = hashed_password
    user_obj = User(**{k: v for k, v in user_dict.items() if k != "password"})
    
    # Insert user
    db.users.insert_one({**user_obj.dict(), "password": hashed_password})
    
    # Create access token
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
def login(user_data: UserLogin):
    # Find user
    user_doc = db.users.find_one({"email": user_data.email})
    if not user_doc or not verify_password(user_data.password, user_doc["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_obj = User(**{k: v for k, v in user_doc.items() if k != "password"})
    
    # Create access token
    access_token = create_access_token(data={"sub": user_obj.email})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

def generate_tracking_id():
    date_str = datetime.utcnow().strftime("%Y%m%d")
    rand_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"CMP{date_str}-{rand_str}"

@api_router.post("/complaints", response_model=Complaint)
async def create_complaint(
    complaint_data: ComplaintCreate,
    current_user: User = Depends(get_current_user)
):
    complaint_dict = complaint_data.dict()
    complaint_dict.update({
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "user_email": current_user.email,
        "tracking_id": generate_tracking_id()
    })
    complaint_obj = Complaint(**complaint_dict)
    db.complaints.insert_one(complaint_obj.dict())
    # Broadcast new complaint event
    await manager.broadcast({
        "event": "new_complaint",
        "complaint": complaint_obj.dict()
    })
    return complaint_obj
# Public endpoint: Track complaint by tracking ID (no login)
@app.get("/public/complaints/track/{tracking_id}")
def public_track_complaint(tracking_id: str):
    complaint = db.complaints.find_one({"tracking_id": tracking_id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    # Only return safe/public fields
    public_fields = [
        "tracking_id", "status", "category", "priority", "created_at", "updated_at", "address", "latitude", "longitude", "image_url", "admin_comments"
    ]
    return {k: complaint.get(k) for k in public_fields}

# Public dashboard endpoint: Anonymous view with filters
@app.get("/public/complaints/dashboard")
def public_dashboard(
    status: Optional[str] = None,
    category: Optional[str] = None,
    zone: Optional[str] = None,
    from_date: Optional[str] = None,  # YYYY-MM-DD
    to_date: Optional[str] = None
):
    filter_dict = {}
    if status:
        filter_dict["status"] = status
    if category:
        filter_dict["category"] = category
    if zone:
        filter_dict["address"] = {"$regex": zone, "$options": "i"}
    if from_date:
        try:
            from_dt = datetime.strptime(from_date, "%Y-%m-%d")
            filter_dict["created_at"] = {"$gte": from_dt}
        except Exception:
            pass
    if to_date:
        try:
            to_dt = datetime.strptime(to_date, "%Y-%m-%d")
            if "created_at" in filter_dict:
                filter_dict["created_at"]["$lte"] = to_dt
            else:
                filter_dict["created_at"] = {"$lte": to_dt}
        except Exception:
            pass
    complaints = db.complaints.find(filter_dict, {"tracking_id": 1, "status": 1, "category": 1, "priority": 1, "created_at": 1, "address": 1, "image_url": 1, "admin_comments": 1}).sort("created_at", -1).to_list(1000)
    return complaints
# WebSocket endpoint for real-time updates
@app.websocket("/ws/complaints")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@api_router.post("/complaints/{complaint_id}/upload")
def upload_complaint_image(
    complaint_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Check if complaint exists and belongs to user
    complaint = db.complaints.find_one({"id": complaint_id, "user_id": current_user.id})
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
    db.complaints.update_one(
        {"id": complaint_id},
        {"$set": {"image_url": image_url, "updated_at": datetime.utcnow()}}
    )
    
    return {"image_url": image_url}

@api_router.get("/complaints/my", response_model=List[Complaint])
def get_my_complaints(current_user: User = Depends(get_current_user)):
    complaints = db.complaints.find({"user_id": current_user.id}).sort("created_at", -1).to_list(1000)
    return [Complaint(**complaint) for complaint in complaints]


# Enhanced: Get all complaints with optional filters, including geolocation/zone
@api_router.get("/complaints", response_model=List[Complaint])
def get_all_complaints(
    status: Optional[str] = None,
    category: Optional[str] = None,
    zone: Optional[str] = None,  # e.g., "North Zone"
    has_location: Optional[bool] = None,  # Only complaints with lat/lng
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    filter_dict = {}
    if status:
        filter_dict["status"] = status
    if category:
        filter_dict["category"] = category
    if has_location:
        filter_dict["latitude"] = {"$ne": None}
        filter_dict["longitude"] = {"$ne": None}
    if zone:
        # Example: zone-based filtering by address substring (customize as needed)
        filter_dict["address"] = {"$regex": zone, "$options": "i"}
    complaints = db.complaints.find(filter_dict).sort("created_at", -1).to_list(1000)
    return [Complaint(**complaint) for complaint in complaints]

# Public endpoint: Get all complaints with location (for map/heatmap, no auth)
@app.get("/public/complaints/locations")
def public_complaints_locations(
    status: Optional[str] = None,
    category: Optional[str] = None,
    zone: Optional[str] = None
):
    filter_dict = {"latitude": {"$ne": None}, "longitude": {"$ne": None}}
    if status:
        filter_dict["status"] = status
    if category:
        filter_dict["category"] = category
    if zone:
        filter_dict["address"] = {"$regex": zone, "$options": "i"}
    complaints = db.complaints.find(filter_dict, {"id": 1, "latitude": 1, "longitude": 1, "category": 1, "status": 1, "priority": 1, "created_at": 1, "address": 1}).sort("created_at", -1).to_list(1000)
    # Return only minimal info for map
    return [
        {
            "id": c.get("id"),
            "latitude": c.get("latitude"),
            "longitude": c.get("longitude"),
            "category": c.get("category"),
            "status": c.get("status"),
            "priority": c.get("priority"),
            "created_at": c.get("created_at"),
            "address": c.get("address"),
        }
        for c in complaints
    ]

@api_router.put("/complaints/{complaint_id}", response_model=Complaint)
def update_complaint(
    complaint_id: str,
    update_data: ComplaintUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    complaint = db.complaints.find_one({"id": complaint_id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    db.complaints.update_one({"id": complaint_id}, {"$set": update_dict})
    
    updated_complaint = db.complaints.find_one({"id": complaint_id})
    return Complaint(**updated_complaint)

@api_router.get("/dashboard/stats")
def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_complaints =  db.complaints.count_documents({})
    open_complaints =  db.complaints.count_documents({"status": "open"})
    in_progress_complaints =  db.complaints.count_documents({"status": "in_progress"})
    resolved_complaints =  db.complaints.count_documents({"status": "resolved"})
    
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

# @app.on_event("shutdown")
# async def shutdown_db_client():
#     client.close()