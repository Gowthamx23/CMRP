from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, WebSocket, WebSocketDisconnect, Form
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

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
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
    role: str = Field(default="CITIZEN")  # CITIZEN | OFFICER | ADMIN
    officerRequestStatus: str = Field(default="NONE")  # NONE | PENDING | APPROVED | REJECTED
    locationsAssigned: List[str] = Field(default_factory=list)

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str  # CITIZEN | OFFICER | ADMIN
    officerRequestStatus: str = Field(default="NONE")
    locationsAssigned: List[str] = Field(default_factory=list)
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
    pincode: Optional[str] = None

class CommentEntry(BaseModel):
    author_id: str
    author_name: str
    author_role: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    type: str = Field(default="public")  # public or internal

class Complaint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    public_id: str = Field(default_factory=lambda: "")
    title: str
    description: str
    category: str
    priority: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    pincode: Optional[str] = None
    status: str = Field(default="PENDING")
    location: Optional[str] = None
    user_id: str
    user_name: str
    user_email: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    image_url: Optional[str] = None
    assigned_to: Optional[str] = None
    admin_comments: Optional[str] = None
    comments: Optional[list] = Field(default_factory=list)
    # Officer work notes
    workNotes: Optional[list] = Field(default_factory=list)

class Location(BaseModel):
    id: str
    name: str
    officerId: Optional[str] = None
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
        
        # Check if this is admin
        if email == "admin@cmrp.com":
            return User(
                id="admin",
                email="admin@cmrp.com",
                full_name="Administrator",
                phone="",
                role="ADMIN",
                officerRequestStatus="NONE",
                locationsAssigned=[],
                created_at=datetime.utcnow(),
                is_active=True
            )
        
        # Check if this is a database officer
        if email.endswith("@cmrp.com"):
            username = email.replace("@cmrp.com", "")
            officer = db.officers.find_one({"username": username, "is_active": True})
            if officer:
                return User(
                    id=officer["id"],
                    email=email,
                    full_name=officer["full_name"],
                    phone="",
                    role="OFFICER",
                    officerRequestStatus="NONE",
                    locationsAssigned=officer.get("pincodes", []),
                    created_at=officer.get("created_at", datetime.utcnow()),
                    is_active=True
                )
            else:
                raise HTTPException(status_code=401, detail="Officer not found or inactive")
        
        # For regular users, look in database
        user_data = db.users.find_one({"email": email})
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
    # Only show internal notes to admins and officers
    if current_user.role not in ["ADMIN", "admin", "OFFICER", "staff", "superadmin"]:
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

# Officer Management Models
class OfficerCreate(BaseModel):
    username: str
    password: str
    full_name: str
    pincodes: List[str] = []

class OfficerUpdate(BaseModel):
    full_name: Optional[str] = None
    pincodes: Optional[List[str]] = None
    is_active: Optional[bool] = None

class OfficerPasswordUpdate(BaseModel):
    new_password: str

class Officer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    full_name: str
    pincodes: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = "admin"

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

# Routes
@api_router.get("/")
def root():
    return {"message": "CMRP API is running"}

@api_router.get("/analytics")
def get_analytics():
    total = db.complaints.count_documents({})
    by_status = {
        "PENDING": db.complaints.count_documents({"status": "PENDING"}),
        "IN_PROGRESS": db.complaints.count_documents({"status": "IN_PROGRESS"}),
        "RESOLVED": db.complaints.count_documents({"status": "RESOLVED"}),
    }
    
    # Get category breakdown
    category_pipeline = [
        {"$group": {
            "_id": "$category", 
            "total": {"$sum": 1},
            "resolved": {"$sum": {"$cond": [{"$eq": ["$status", "RESOLVED"]}, 1, 0]}}
        }},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    by_category = [{"name": doc.get("_id", "Unknown"), "total": doc.get("total", 0), "resolved": doc.get("resolved", 0)} for doc in db.complaints.aggregate(category_pipeline)]
    
    return {
        "total": total, 
        "byStatus": by_status, 
        "byCategory": by_category
    }

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


def generate_public_id():
    year = datetime.utcnow().strftime("%Y")
    for _ in range(5):
        number = ''.join(random.choices(string.digits, k=6))
        public_id = f"CMP-{year}-{number}"
        if not db.complaints.find_one({"public_id": public_id}):
            return public_id
    return f"CMP-{year}-{str(uuid.uuid4())[:6].upper()}"

@api_router.post("/complaints", response_model=Complaint)
async def create_complaint(
    complaint_data: ComplaintCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["CITIZEN", "citizen"]:
        raise HTTPException(status_code=403, detail="Only citizens can submit complaints")

    # Assign officer based on pincode using database lookup
    assigned_officer_id = None
    print(f"🔍 Complaint pincode: {complaint_data.pincode}")
    
    if complaint_data.pincode:
        # Find officer in database for this pincode
        officer = db.officers.find_one({
            "pincodes": complaint_data.pincode,
            "is_active": True
        })
        if officer:
            assigned_officer_id = officer["id"]
            print(f"✅ Assigned to {officer['full_name']} ({officer['username']}) for pincode {complaint_data.pincode}")
        else:
            print(f"⚠️ No officer found for pincode {complaint_data.pincode}")
    else:
        print(f"⚠️ No pincode provided for complaint")

    complaint_dict = complaint_data.dict()
    # Set status based on whether officer is assigned
    final_status = "PENDING" if assigned_officer_id else "NO_OFFICER"
    print(f"🔍 Final complaint status: {final_status}, assigned_to: {assigned_officer_id}")
    
    complaint_dict.update({
        "user_id": current_user.id,
        "user_name": current_user.full_name,
        "user_email": current_user.email,
        "public_id": generate_public_id(),
        "status": final_status,
        "assigned_to": assigned_officer_id,
    })
    complaint_obj = Complaint(**complaint_dict)
    db.complaints.insert_one(complaint_obj.dict())
    await manager.broadcast({
        "event": "new_complaint",
        "complaint": complaint_obj.dict()
    })
    return complaint_obj
# Public endpoint: Track complaint by tracking ID (no login)
@api_router.get("/complaints/public/{public_id}")
def public_complaint_by_public_id(public_id: str):
    complaint = db.complaints.find_one({"public_id": public_id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    return {
        "publicId": complaint.get("public_id"),
        "description": complaint.get("description"),
        "photoUrl": complaint.get("image_url"),
        "location": complaint.get("address"),
        "status": complaint.get("status"),
        "updatedAt": complaint.get("updated_at"),
    }

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
    complaints_cursor = db.complaints.find(
        filter_dict,
        {"public_id": 1, "status": 1, "category": 1, "priority": 1, "created_at": 1, "address": 1, "image_url": 1, "admin_comments": 1}
    ).sort("created_at", -1)
    return list(complaints_cursor.limit(1000))
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

# Officer adds work note with optional photo
@api_router.post("/officer/complaints/{complaint_id}/notes")
def add_work_note(
    complaint_id: str,
    note: str = "",
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "OFFICER":
        raise HTTPException(status_code=403, detail="Officer access required")
    complaint = db.complaints.find_one({"id": complaint_id, "assigned_to": current_user.id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found or not assigned to you")
    photo_url = None
    if file is not None:
        file_extension = Path(file.filename).suffix
        filename = f"{complaint_id}_note_{uuid.uuid4()}{file_extension}"
        file_path = UPLOAD_DIR / filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        photo_url = f"/uploads/{filename}"
    work_note = {
        "officerId": current_user.id,
        "note": note,
        "photoUrl": photo_url,
        "timestamp": datetime.utcnow(),
    }
    db.complaints.update_one(
        {"id": complaint_id},
        {"$push": {"workNotes": work_note}, "$set": {"updated_at": datetime.utcnow()}}
    )
    return {"success": True, "workNote": work_note}

@api_router.get("/complaints/my", response_model=List[Complaint])
def get_my_complaints(current_user: User = Depends(get_current_user)):
    # Check if this is an officer requesting their assigned complaints
    if current_user.role == "OFFICER":
        print(f"🔍 Officer {current_user.id} ({current_user.full_name}) requesting assigned complaints")
        complaints = list(db.complaints.find({"assigned_to": current_user.id}).sort("created_at", -1).limit(1000))
        print(f"🔍 Found {len(complaints)} complaints for officer {current_user.id}")
        return [Complaint(**complaint) for complaint in complaints]
    
    # Regular user requesting their own complaints
    complaints = list(db.complaints.find({"user_id": current_user.id}).sort("created_at", -1).limit(1000))
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
    print(f"🔍 Admin complaints request - User ID: {current_user.id}, Role: {current_user.role}")
    if current_user.role not in ["ADMIN", "admin"]:
        print(f"❌ Admin access denied - Role: {current_user.role}")
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
    complaints = list(db.complaints.find(filter_dict).sort("created_at", -1).limit(1000))
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
    complaints = list(db.complaints.find(filter_dict, {"id": 1, "latitude": 1, "longitude": 1, "category": 1, "status": 1, "priority": 1, "created_at": 1, "address": 1}).sort("created_at", -1).limit(1000))
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
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    complaint = db.complaints.find_one({"id": complaint_id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    db.complaints.update_one({"id": complaint_id}, {"$set": update_dict})
    
    updated_complaint = db.complaints.find_one({"id": complaint_id})
    return Complaint(**updated_complaint)

# Officer update endpoint
@api_router.put("/officer/complaints/{complaint_id}")
def officer_update_complaint(
    complaint_id: str,
    update_data: ComplaintUpdate,
    current_user: User = Depends(get_current_user)
):
    # Check if user is an officer
    if current_user.role != "OFFICER":
        raise HTTPException(status_code=403, detail="Officer access required")
    
    # Find complaint assigned to this officer
    complaint = db.complaints.find_one({"id": complaint_id, "assigned_to": current_user.id})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found or not assigned to you")
    
    # Officers can update status and admin_comments
    update_dict = {}
    if update_data.status in ["IN_PROGRESS", "RESOLVED"]:
        update_dict["status"] = update_data.status
    if update_data.admin_comments is not None:
        update_dict["admin_comments"] = update_data.admin_comments
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_dict["updated_at"] = datetime.utcnow()
    db.complaints.update_one({"id": complaint_id}, {"$set": update_dict})
    
    updated_complaint = db.complaints.find_one({"id": complaint_id})
    return Complaint(**updated_complaint)

@api_router.get("/dashboard/stats")
def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_complaints =  db.complaints.count_documents({})
    open_complaints =  db.complaints.count_documents({"status": "PENDING"})
    in_progress_complaints =  db.complaints.count_documents({"status": "IN_PROGRESS"})
    resolved_complaints =  db.complaints.count_documents({"status": "RESOLVED"})
    
    return {
        "total_complaints": total_complaints,
        "open_complaints": open_complaints,
        "in_progress_complaints": in_progress_complaints,
        "resolved_complaints": resolved_complaints
    }

# Officer Management Endpoints
@api_router.post("/admin/officers", response_model=Officer)
def create_officer(
    officer_data: OfficerCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new officer (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if username already exists
    existing_officer = db.officers.find_one({"username": officer_data.username})
    if existing_officer:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create officer
    officer = Officer(
        username=officer_data.username,
        full_name=officer_data.full_name,
        pincodes=officer_data.pincodes,
        created_by=current_user.id
    )
    
    # Hash password and store separately
    hashed_password = hash_password(officer_data.password)
    
    officer_dict = officer.dict()
    officer_dict["password_hash"] = hashed_password
    
    db.officers.insert_one(officer_dict)
    
    # Automatically assign existing "NO_OFFICER" complaints to this officer
    if officer_data.pincodes:
        assigned_count = 0
        for pincode in officer_data.pincodes:
            result = db.complaints.update_many(
                {
                    "pincode": pincode,
                    "status": "NO_OFFICER"
                },
                {
                    "$set": {
                        "assigned_to": officer.id,
                        "status": "PENDING",
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            assigned_count += result.modified_count
            print(f"✅ Assigned {result.modified_count} complaints with pincode {pincode} to officer {officer.full_name}")
        
        if assigned_count > 0:
            print(f"🎉 Total {assigned_count} complaints assigned to {officer.full_name}")
    
    return Officer(**officer_dict)

@api_router.get("/admin/officers", response_model=List[Officer])
def get_officers(current_user: User = Depends(get_current_user)):
    """Get all officers (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officers = list(db.officers.find({"is_active": True}).sort("created_at", -1))
    return [Officer(**officer) for officer in officers]

@api_router.put("/admin/officers/{officer_id}", response_model=Officer)
def update_officer(
    officer_id: str,
    officer_data: OfficerUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update officer details (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officer = db.officers.find_one({"id": officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    update_dict = {k: v for k, v in officer_data.dict().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        db.officers.update_one({"id": officer_id}, {"$set": update_dict})
    
    updated_officer = db.officers.find_one({"id": officer_id})
    return Officer(**updated_officer)

@api_router.put("/admin/officers/{officer_id}/password")
def update_officer_password(
    officer_id: str,
    password_data: OfficerPasswordUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update officer password (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officer = db.officers.find_one({"id": officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    hashed_password = hash_password(password_data.new_password)
    db.officers.update_one(
        {"id": officer_id}, 
        {"$set": {"password_hash": hashed_password, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Password updated successfully"}

@api_router.delete("/admin/officers/{officer_id}")
def deactivate_officer(
    officer_id: str,
    current_user: User = Depends(get_current_user)
):
    """Deactivate officer (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officer = db.officers.find_one({"id": officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    db.officers.update_one(
        {"id": officer_id}, 
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Officer deactivated successfully"}

@api_router.get("/admin/officers/{officer_id}/pincodes")
def get_officer_pincodes(
    officer_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get pincodes assigned to an officer (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officer = db.officers.find_one({"id": officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    return {"pincodes": officer.get("pincodes", [])}

# Officer Login Endpoint
@api_router.post("/officer/login", response_model=Token)
def officer_login(username: str = Form(...), password: str = Form(...)):
    """Login for officers and admin"""
    
    # Check if this is admin login
    if username == "admin" and password == os.getenv("ADMIN_PASSWORD", "admin"):
        user_obj = User(
            id="admin",
            email="admin@cmrp.com",
            full_name="Administrator",
            phone="",
            role="ADMIN",
            officerRequestStatus="NONE",
            locationsAssigned=[],
            created_at=datetime.utcnow(),
            is_active=True
        )
        access_token = create_access_token(data={"sub": user_obj.email})
        return Token(access_token=access_token, token_type="bearer", user=user_obj)
    
    # Find officer in database
    officer = db.officers.find_one({"username": username, "is_active": True})
    if not officer:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(password, officer["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create user object for database officer
    user_obj = User(
        id=officer["id"],
        email=f"{officer['username']}@cmrp.com",
        full_name=officer["full_name"],
        phone="",
        role="OFFICER",
        officerRequestStatus="NONE",
        locationsAssigned=officer.get("pincodes", []),
        created_at=officer.get("created_at", datetime.utcnow()),
        is_active=True
    )
    
    # Generate token
    access_token = create_access_token(data={"sub": user_obj.email})
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

# Officer Complaints
@api_router.get("/officer/complaints")
def officer_complaints(status: Optional[str] = None, page: int = 1, page_size: int = 20, current_user: User = Depends(get_current_user)):
    print(f"🔍 Officer complaints request - User ID: {current_user.id}, Role: {current_user.role}")
    print(f"🔍 User object: {current_user}")
    if current_user.role != "OFFICER":
        print(f"❌ Access denied - Role: {current_user.role}")
        raise HTTPException(status_code=403, detail="Officer access required")
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Invalid pagination params")
    # Filter complaints assigned to this officer
    filters = {"assigned_to": current_user.id}
    print(f"🔍 Looking for complaints assigned to: {current_user.id}")
    if status:
        filters["status"] = status
    skip = (page - 1) * page_size
    cursor = db.complaints.find(filters).sort("created_at", -1).skip(skip).limit(page_size)
    items = list(cursor)
    total = db.complaints.count_documents(filters)
    
    # Convert to Complaint objects for proper JSON serialization
    complaint_objects = [Complaint(**item) for item in items]
    
    # Debug: Check all complaints in database
    all_complaints = list(db.complaints.find({}, {"id": 1, "assigned_to": 1, "pincode": 1, "title": 1}))
    print(f"🔍 All complaints in database: {all_complaints}")
    print(f"🔍 Found {total} complaints for officer {current_user.id}")
    
    return {"items": [item.dict() for item in complaint_objects], "page": page, "pageSize": page_size, "total": total}

# Public endpoint to get officers for displaying names (read-only)
@api_router.get("/officers", response_model=List[Officer])
def get_officers_public(current_user: User = Depends(get_current_user)):
    """Get all officers (read-only, for displaying names)"""
    officers = list(db.officers.find({"is_active": True}).sort("created_at", -1))
    return [Officer(**officer) for officer in officers]

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

# Officer Request Flow
@api_router.post("/users/request-officer")
def request_officer(
    full_name: str = Form(...),
    phone: str = Form(...),
    locations: str = Form(""),
    experience_years: Optional[int] = Form(None),
    id_proof: UploadFile = File(None),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["CITIZEN", "citizen"]:
        raise HTTPException(status_code=403, detail="Only citizens can request officer role")
    user_doc = db.users.find_one({"id": current_user.id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    status_val = user_doc.get("officerRequestStatus", "NONE")
    if status_val == "PENDING":
        raise HTTPException(status_code=409, detail="Officer request already pending")
    id_proof_url = None
    if id_proof is not None:
        ext = Path(id_proof.filename).suffix
        filename = f"officer_request_{current_user.id}_{uuid.uuid4()}{ext}"
        file_path = UPLOAD_DIR / filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(id_proof.file, buffer)
        id_proof_url = f"/uploads/{filename}"
    request_payload = {
        "officerRequestStatus": "PENDING",
        "updated_at": datetime.utcnow(),
        "officerRequest": {
            "fullName": full_name,
            "phone": phone,
            "locations": [l.strip() for l in locations.split(',') if l.strip()] if locations else [],
            "experienceYears": experience_years,
            "idProofUrl": id_proof_url,
            "submittedAt": datetime.utcnow(),
        }
    }
    db.users.update_one({"id": current_user.id}, {"$set": request_payload})
    return {"success": True, "idProofUrl": id_proof_url}

@api_router.get("/admin/officer-requests")
def list_officer_requests(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    users = list(db.users.find({"officerRequestStatus": "PENDING"}, {"password": 0}))
    return users

@api_router.post("/admin/approve-officer/{user_id}")
def approve_officer(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    res = db.users.update_one({"id": user_id}, {"$set": {"role": "OFFICER", "officerRequestStatus": "APPROVED", "updated_at": datetime.utcnow()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True}

@api_router.post("/admin/reject-officer/{user_id}")
def reject_officer(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    res = db.users.update_one({"id": user_id}, {"$set": {"officerRequestStatus": "REJECTED", "updated_at": datetime.utcnow()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True}


# Test endpoint
@api_router.get("/test")
def test_endpoint():
    return {"message": "Test endpoint is working"}

# Migration endpoint to assign existing complaints to officers
@api_router.post("/admin/migrate-complaints")
def migrate_complaints(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    print("🔄 Starting complaint migration...")
    
    # Get all complaints
    complaints = list(db.complaints.find({}))
    print(f"📊 Found {len(complaints)} complaints to migrate")
    
    updated_count = 0
    
    for complaint in complaints:
        pincode = complaint.get('pincode', '')
        complaint_id = complaint.get('id')
        
        # Find officer for this pincode
        assigned_to = None
        status = "NO_OFFICER"
        
        if pincode:
            officer = db.officers.find_one({
                "pincodes": pincode,
                "is_active": True
            })
            if officer:
                assigned_to = officer["id"]
                status = "PENDING"
                print(f"✅ Assigning complaint {complaint_id} (pincode: {pincode}) to {officer['full_name']}")
            else:
                print(f"⚠️ No officer found for complaint {complaint_id} (pincode: {pincode})")
        else:
            print(f"⚠️ No pincode for complaint {complaint_id}")
        
        # Update the complaint
        result = db.complaints.update_one(
            {"id": complaint_id},
            {
                "$set": {
                    "assigned_to": assigned_to,
                    "status": status,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            updated_count += 1
    
    print(f"🎉 Migration complete! Updated {updated_count} complaints")
    
    # Verify the results
    assigned_count = db.complaints.count_documents({"assigned_to": {"$ne": None}})
    no_officer_count = db.complaints.count_documents({"status": "NO_OFFICER"})
    
    return {
        "message": f"Migration complete! Updated {updated_count} complaints",
        "assigned_count": assigned_count,
        "no_officer_count": no_officer_count
    }

# Test endpoint
@api_router.get("/test-analytics")
def test_analytics():
    return {"message": "Analytics endpoint is working", "total": db.complaints.count_documents({})}

# Public Analytics
@api_router.get("/analytics/public")
def public_analytics():
    total = db.complaints.count_documents({})
    by_status = {
        "PENDING": db.complaints.count_documents({"status": "PENDING"}),
        "IN_PROGRESS": db.complaints.count_documents({"status": "IN_PROGRESS"}),
        "RESOLVED": db.complaints.count_documents({"status": "RESOLVED"}),
    }
    
    # Get category breakdown
    category_pipeline = [
        {"$group": {
            "_id": "$category", 
            "total": {"$sum": 1},
            "resolved": {"$sum": {"$cond": [{"$eq": ["$status", "RESOLVED"]}, 1, 0]}}
        }},
        {"$sort": {"total": -1}},
        {"$limit": 10}
    ]
    by_category = [{"name": doc.get("_id", "Unknown"), "total": doc.get("total", 0), "resolved": doc.get("resolved", 0)} for doc in db.complaints.aggregate(category_pipeline)]
    
    # Get 7-day trend
    today = datetime.utcnow().date()
    trend = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        start = datetime(day.year, day.month, day.day)
        end = start + timedelta(days=1)
        count = db.complaints.count_documents({"created_at": {"$gte": start, "$lt": end}})
        trend.append({"date": day.isoformat(), "count": count})
    
    # Get top locations
    location_pipeline = [
        {"$group": {"_id": "$address", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    top_locations = [{"location": doc.get("_id", "Unknown"), "count": doc.get("count", 0)} for doc in db.complaints.aggregate(location_pipeline)]
    
    return {
        "total": total, 
        "byStatus": by_status, 
        "byCategory": by_category,
        "trend7d": trend, 
        "topLocations": top_locations
    }


# Officer Management Endpoints
@api_router.post("/admin/officers", response_model=Officer)
def create_officer(
    officer_data: OfficerCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new officer (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if username already exists
    existing_officer = db.officers.find_one({"username": officer_data.username})
    if existing_officer:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create officer
    officer = Officer(
        username=officer_data.username,
        full_name=officer_data.full_name,
        pincodes=officer_data.pincodes,
        created_by=current_user.id
    )
    
    # Hash password and store separately
    hashed_password = hash_password(officer_data.password)
    
    officer_dict = officer.dict()
    officer_dict["password_hash"] = hashed_password
    
    db.officers.insert_one(officer_dict)
    
    # Automatically assign existing "NO_OFFICER" complaints to this officer
    if officer_data.pincodes:
        assigned_count = 0
        for pincode in officer_data.pincodes:
            result = db.complaints.update_many(
                {
                    "pincode": pincode,
                    "status": "NO_OFFICER"
                },
                {
                    "$set": {
                        "assigned_to": officer.id,
                        "status": "PENDING",
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            assigned_count += result.modified_count
            print(f"✅ Assigned {result.modified_count} complaints with pincode {pincode} to officer {officer.full_name}")
        
        if assigned_count > 0:
            print(f"🎉 Total {assigned_count} complaints assigned to {officer.full_name}")
    
    return Officer(**officer_dict)

@api_router.get("/admin/officers", response_model=List[Officer])
def get_officers(current_user: User = Depends(get_current_user)):
    """Get all officers (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officers = list(db.officers.find({"is_active": True}).sort("created_at", -1))
    return [Officer(**officer) for officer in officers]

@api_router.put("/admin/officers/{officer_id}", response_model=Officer)
def update_officer(
    officer_id: str,
    officer_data: OfficerUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update officer details (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officer = db.officers.find_one({"id": officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    update_dict = {k: v for k, v in officer_data.dict().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.utcnow()
        db.officers.update_one({"id": officer_id}, {"$set": update_dict})
    
    updated_officer = db.officers.find_one({"id": officer_id})
    return Officer(**updated_officer)

@api_router.put("/admin/officers/{officer_id}/password")
def update_officer_password(
    officer_id: str,
    password_data: OfficerPasswordUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update officer password (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officer = db.officers.find_one({"id": officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    hashed_password = hash_password(password_data.new_password)
    db.officers.update_one(
        {"id": officer_id}, 
        {"$set": {"password_hash": hashed_password, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Password updated successfully"}

@api_router.delete("/admin/officers/{officer_id}")
def deactivate_officer(
    officer_id: str,
    current_user: User = Depends(get_current_user)
):
    """Deactivate officer (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officer = db.officers.find_one({"id": officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    db.officers.update_one(
        {"id": officer_id}, 
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Officer deactivated successfully"}

@api_router.get("/admin/officers/{officer_id}/pincodes")
def get_officer_pincodes(
    officer_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get pincodes assigned to an officer (Admin only)"""
    if current_user.role not in ["ADMIN", "admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    officer = db.officers.find_one({"id": officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")
    
    return {"pincodes": officer.get("pincodes", [])}
