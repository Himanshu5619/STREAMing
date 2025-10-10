from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT and Password Setup
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[Dict]] = {}  # room_id -> [{ws, user_id, username}]

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str, username: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append({
            "ws": websocket,
            "user_id": user_id,
            "username": username
        })

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id] = [
                conn for conn in self.active_connections[room_id] if conn["ws"] != websocket
            ]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, message: dict, room_id: str, exclude_ws: WebSocket = None):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection["ws"] != exclude_ws:
                    try:
                        await connection["ws"].send_json(message)
                    except:
                        pass

    def get_room_users(self, room_id: str) -> List[Dict]:
        if room_id in self.active_connections:
            return [{"user_id": conn["user_id"], "username": conn["username"]} 
                    for conn in self.active_connections[room_id]]
        return []

manager = ConnectionManager()

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    avatar_color: str = "#EF4444"  # Default red
    bio: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserUpdate(BaseModel):
    avatar_color: Optional[str] = None
    bio: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Video(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    thumbnail: str
    video_url: str
    duration: int  # in seconds
    category: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    video_id: str
    host_id: str
    host_username: str
    members: List[str] = []  # List of user IDs
    max_members: int = 10
    is_private: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    current_time: float = 0.0
    is_playing: bool = False

class RoomCreate(BaseModel):
    name: str
    video_id: str
    max_members: int = 10
    is_private: bool = False

class RoomUpdate(BaseModel):
    name: Optional[str] = None
    max_members: Optional[int] = None
    is_private: Optional[bool] = None

class RoomInvite(BaseModel):
    user_ids: List[str]

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    user_id: str
    username: str
    message: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Watchlist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    video_id: str
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WatchHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    video_id: str
    video_title: str
    watched_duration: int  # seconds
    last_position: float = 0.0  # Last watched position
    watched_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WatchHistoryCreate(BaseModel):
    video_id: str
    video_title: str
    watched_duration: int
    last_position: float = 0.0

class UserStats(BaseModel):
    total_watch_time: int  # Total seconds watched
    videos_watched: int
    rooms_created: int
    rooms_joined: int

# Helper Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user_doc is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user_doc['created_at'], str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")

# Auth Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    existing_email = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        username=user_data.username,
        email=user_data.email
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    user_dict['password'] = hash_password(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user_doc = await db.users.find_one({"username": user_data.username}, {"_id": 0})
    if not user_doc or not verify_password(user_data.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**{k: v for k, v in user_doc.items() if k != 'password'})
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/auth/profile", response_model=User)
async def update_profile(update_data: UserUpdate, current_user: User = Depends(get_current_user)):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    if update_dict:
        await db.users.update_one({"id": current_user.id}, {"$set": update_dict})
    
    updated_user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if isinstance(updated_user['created_at'], str):
        updated_user['created_at'] = datetime.fromisoformat(updated_user['created_at'])
    
    return User(**updated_user)

# User Stats
@api_router.get("/users/stats", response_model=UserStats)
async def get_user_stats(current_user: User = Depends(get_current_user)):
    # Total watch time
    watch_history = await db.watch_history.find({"user_id": current_user.id}, {"_id": 0}).to_list(10000)
    total_watch_time = sum([w['watched_duration'] for w in watch_history])
    videos_watched = len(set([w['video_id'] for w in watch_history]))
    
    # Rooms created
    rooms_created = await db.rooms.count_documents({"host_id": current_user.id})
    
    # Rooms joined (from watch history in rooms)
    rooms_joined = await db.rooms.count_documents({"members": current_user.id})
    
    return UserStats(
        total_watch_time=total_watch_time,
        videos_watched=videos_watched,
        rooms_created=rooms_created,
        rooms_joined=rooms_joined
    )

# Video Routes
@api_router.get("/videos", response_model=List[Video])
async def get_videos():
    videos = await db.videos.find({}, {"_id": 0}).to_list(1000)
    for video in videos:
        if isinstance(video['created_at'], str):
            video['created_at'] = datetime.fromisoformat(video['created_at'])
    return videos

@api_router.get("/videos/{video_id}", response_model=Video)
async def get_video(video_id: str):
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if isinstance(video['created_at'], str):
        video['created_at'] = datetime.fromisoformat(video['created_at'])
    return Video(**video)

# Room Routes
@api_router.post("/rooms", response_model=Room)
async def create_room(room_data: RoomCreate, current_user: User = Depends(get_current_user)):
    # Verify video exists
    video = await db.videos.find_one({"id": room_data.video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    room = Room(
        name=room_data.name,
        video_id=room_data.video_id,
        host_id=current_user.id,
        host_username=current_user.username,
        members=[current_user.id],
        max_members=room_data.max_members,
        is_private=room_data.is_private
    )
    
    room_dict = room.model_dump()
    room_dict['created_at'] = room_dict['created_at'].isoformat()
    
    await db.rooms.insert_one(room_dict)
    
    return room

@api_router.get("/rooms", response_model=List[Room])
async def get_rooms(current_user: User = Depends(get_current_user)):
    rooms = await db.rooms.find({"is_active": True, "is_private": False}, {"_id": 0}).to_list(1000)
    for room in rooms:
        if isinstance(room['created_at'], str):
            room['created_at'] = datetime.fromisoformat(room['created_at'])
    return rooms

@api_router.get("/rooms/my", response_model=List[Room])
async def get_my_rooms(current_user: User = Depends(get_current_user)):
    rooms = await db.rooms.find(
        {"$or": [{"host_id": current_user.id}, {"members": current_user.id}], "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    for room in rooms:
        if isinstance(room['created_at'], str):
            room['created_at'] = datetime.fromisoformat(room['created_at'])
    return rooms

@api_router.get("/rooms/{room_id}", response_model=Room)
async def get_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if isinstance(room['created_at'], str):
        room['created_at'] = datetime.fromisoformat(room['created_at'])
    return Room(**room)

@api_router.put("/rooms/{room_id}", response_model=Room)
async def update_room(room_id: str, update_data: RoomUpdate, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room['host_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can update the room")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    if update_dict:
        await db.rooms.update_one({"id": room_id}, {"$set": update_dict})
    
    updated_room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if isinstance(updated_room['created_at'], str):
        updated_room['created_at'] = datetime.fromisoformat(updated_room['created_at'])
    
    return Room(**updated_room)

@api_router.post("/rooms/{room_id}/join")
async def join_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if current_user.id in room.get('members', []):
        return {"message": "Already in room"}
    
    if len(room.get('members', [])) >= room.get('max_members', 10):
        raise HTTPException(status_code=400, detail="Room is full")
    
    await db.rooms.update_one({"id": room_id}, {"$push": {"members": current_user.id}})
    
    return {"message": "Joined room successfully"}

@api_router.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    await db.rooms.update_one({"id": room_id}, {"$pull": {"members": current_user.id}})
    
    return {"message": "Left room successfully"}

@api_router.post("/rooms/{room_id}/invite")
async def invite_to_room(room_id: str, invite_data: RoomInvite, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room['host_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can invite users")
    
    for user_id in invite_data.user_ids:
        if user_id not in room.get('members', []):
            await db.rooms.update_one({"id": room_id}, {"$push": {"members": user_id}})
    
    return {"message": "Users invited successfully"}

@api_router.delete("/rooms/{room_id}/members/{user_id}")
async def remove_member(room_id: str, user_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room['host_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can remove members")
    
    await db.rooms.update_one({"id": room_id}, {"$pull": {"members": user_id}})
    
    return {"message": "Member removed successfully"}

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room['host_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Only the host can delete the room")
    
    await db.rooms.update_one({"id": room_id}, {"$set": {"is_active": False}})
    return {"message": "Room deleted successfully"}

# Watchlist Routes
@api_router.post("/watchlist/{video_id}")
async def add_to_watchlist(video_id: str, current_user: User = Depends(get_current_user)):
    # Check if already in watchlist
    existing = await db.watchlist.find_one({"user_id": current_user.id, "video_id": video_id}, {"_id": 0})
    if existing:
        return {"message": "Already in watchlist"}
    
    watchlist_item = Watchlist(user_id=current_user.id, video_id=video_id)
    watchlist_dict = watchlist_item.model_dump()
    watchlist_dict['added_at'] = watchlist_dict['added_at'].isoformat()
    
    await db.watchlist.insert_one(watchlist_dict)
    return {"message": "Added to watchlist"}

@api_router.delete("/watchlist/{video_id}")
async def remove_from_watchlist(video_id: str, current_user: User = Depends(get_current_user)):
    await db.watchlist.delete_one({"user_id": current_user.id, "video_id": video_id})
    return {"message": "Removed from watchlist"}

@api_router.get("/watchlist", response_model=List[Video])
async def get_watchlist(current_user: User = Depends(get_current_user)):
    watchlist_items = await db.watchlist.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    video_ids = [item['video_id'] for item in watchlist_items]
    
    videos = await db.videos.find({"id": {"$in": video_ids}}, {"_id": 0}).to_list(1000)
    for video in videos:
        if isinstance(video['created_at'], str):
            video['created_at'] = datetime.fromisoformat(video['created_at'])
    return videos

# Watch History Routes
@api_router.post("/watch-history")
async def add_watch_history(history_data: WatchHistoryCreate, current_user: User = Depends(get_current_user)):
    # Update or create watch history
    existing = await db.watch_history.find_one(
        {"user_id": current_user.id, "video_id": history_data.video_id},
        {"_id": 0}
    )
    
    if existing:
        # Update existing record
        await db.watch_history.update_one(
            {"user_id": current_user.id, "video_id": history_data.video_id},
            {
                "$set": {
                    "watched_duration": history_data.watched_duration,
                    "last_position": history_data.last_position,
                    "watched_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    else:
        # Create new record
        watch_history = WatchHistory(
            user_id=current_user.id,
            video_id=history_data.video_id,
            video_title=history_data.video_title,
            watched_duration=history_data.watched_duration,
            last_position=history_data.last_position
        )
        history_dict = watch_history.model_dump()
        history_dict['watched_at'] = history_dict['watched_at'].isoformat()
        await db.watch_history.insert_one(history_dict)
    
    return {"message": "Watch history updated"}

@api_router.get("/watch-history", response_model=List[WatchHistory])
async def get_watch_history(current_user: User = Depends(get_current_user)):
    history = await db.watch_history.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("watched_at", -1).to_list(1000)
    
    for item in history:
        if isinstance(item['watched_at'], str):
            item['watched_at'] = datetime.fromisoformat(item['watched_at'])
    
    return history

# Chat Routes
@api_router.get("/rooms/{room_id}/messages", response_model=List[ChatMessage])
async def get_chat_messages(room_id: str, current_user: User = Depends(get_current_user)):
    messages = await db.chat_messages.find({"room_id": room_id}, {"_id": 0}).sort("timestamp", 1).to_list(1000)
    for msg in messages:
        if isinstance(msg['timestamp'], str):
            msg['timestamp'] = datetime.fromisoformat(msg['timestamp'])
    return messages

# Search Users
@api_router.get("/users/search")
async def search_users(q: str, current_user: User = Depends(get_current_user)):
    users = await db.users.find(
        {"username": {"$regex": q, "$options": "i"}},
        {"_id": 0, "password": 0}
    ).limit(10).to_list(10)
    
    return [{"id": u["id"], "username": u["username"], "avatar_color": u.get("avatar_color", "#EF4444")} for u in users]

# WebSocket Route
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, token: str):
    try:
        # Verify token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_doc:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        username = user_doc['username']
        
        # Connect to room
        await manager.connect(websocket, room_id, user_id, username)
        
        # Notify others that user joined
        await manager.broadcast({
            "type": "user_joined",
            "user_id": user_id,
            "username": username,
            "users": manager.get_room_users(room_id)
        }, room_id)
        
        # Send current users to the new user
        await websocket.send_json({
            "type": "user_list",
            "users": manager.get_room_users(room_id)
        })
        
        try:
            while True:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "chat":
                    # Save chat message
                    chat_msg = ChatMessage(
                        room_id=room_id,
                        user_id=user_id,
                        username=username,
                        message=data.get("message", "")
                    )
                    chat_dict = chat_msg.model_dump()
                    chat_dict['timestamp'] = chat_dict['timestamp'].isoformat()
                    await db.chat_messages.insert_one(chat_dict)
                    
                    # Broadcast chat message
                    await manager.broadcast({
                        "type": "chat",
                        "user_id": user_id,
                        "username": username,
                        "message": data.get("message", "")
                    }, room_id)
                
                elif message_type == "video_action":
                    action = data.get("action")
                    current_time = data.get("currentTime", 0)
                    
                    # Update room state
                    if action in ["play", "pause"]:
                        await db.rooms.update_one(
                            {"id": room_id},
                            {"$set": {
                                "is_playing": action == "play",
                                "current_time": current_time
                            }}
                        )
                    elif action == "seek":
                        await db.rooms.update_one(
                            {"id": room_id},
                            {"$set": {"current_time": current_time}}
                        )
                    
                    # Broadcast video action
                    await manager.broadcast({
                        "type": "video_action",
                        "action": action,
                        "currentTime": current_time,
                        "user_id": user_id,
                        "username": username
                    }, room_id, exclude_ws=websocket)
                
        except WebSocketDisconnect:
            manager.disconnect(websocket, room_id)
            await manager.broadcast({
                "type": "user_left",
                "user_id": user_id,
                "username": username,
                "users": manager.get_room_users(room_id)
            }, room_id)
    
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass

# Seed initial data
@api_router.post("/seed")
async def seed_data():
    # Check if already seeded
    existing_videos = await db.videos.count_documents({})
    if existing_videos > 0:
        return {"message": "Database already seeded"}
    
    # Sample videos
    videos = [
        {
            "id": str(uuid.uuid4()),
            "title": "Big Buck Bunny",
            "description": "A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel, who are determined to squelch his happiness.",
            "thumbnail": "https://placehold.co/400x225/FF6B6B/FFFFFF?text=Big+Buck+Bunny",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "duration": 596,
            "category": "Animation",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Elephant's Dream",
            "description": "A short film about a mechanical world and two characters exploring it.",
            "thumbnail": "https://placehold.co/400x225/4ECDC4/FFFFFF?text=Elephant",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            "duration": 653,
            "category": "Sci-Fi",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "For Bigger Blazes",
            "description": "An action-packed adventure showcasing incredible fire effects.",
            "thumbnail": "https://placehold.co/400x225/FF8C42/FFFFFF?text=Blazes",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            "duration": 15,
            "category": "Action",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Sintel",
            "description": "A lonely young woman, Sintel, helps and befriends a dragon, whom she calls Scales.",
            "thumbnail": "https://placehold.co/400x225/95E1D3/FFFFFF?text=Sintel",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
            "duration": 888,
            "category": "Fantasy",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Tears of Steel",
            "description": "A group of warriors and scientists battle to preserve mankind's future.",
            "thumbnail": "https://placehold.co/400x225/AA96DA/FFFFFF?text=Tears+of+Steel",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
            "duration": 734,
            "category": "Sci-Fi",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "For Bigger Escape",
            "description": "High-speed action and thrilling escapes.",
            "thumbnail": "https://placehold.co/400x225/FCBAD3/FFFFFF?text=Escape",
            "video_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            "duration": 15,
            "category": "Action",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    await db.videos.insert_many(videos)
    
    return {"message": "Database seeded successfully", "videos_added": len(videos)}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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