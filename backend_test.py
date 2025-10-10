#!/usr/bin/env python3
"""
WatchWave Backend API Testing Suite
Tests all backend endpoints for the streaming platform
"""

import requests
import json
import asyncio
import websockets
import time
from datetime import datetime

# Configuration
BASE_URL = "https://watchwave-864.preview.emergentagent.com/api"
WS_URL = "wss://watchwave-864.preview.emergentagent.com/ws"

class WatchWaveAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.user_data = None
        self.test_results = {
            "auth": {"passed": 0, "failed": 0, "details": []},
            "videos": {"passed": 0, "failed": 0, "details": []},
            "rooms": {"passed": 0, "failed": 0, "details": []},
            "watchlist": {"passed": 0, "failed": 0, "details": []},
            "websocket": {"passed": 0, "failed": 0, "details": []},
            "chat": {"passed": 0, "failed": 0, "details": []}
        }
        
    def log_result(self, category, test_name, success, details=""):
        """Log test result"""
        if success:
            self.test_results[category]["passed"] += 1
            status = "✅ PASS"
        else:
            self.test_results[category]["failed"] += 1
            status = "❌ FAIL"
        
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        
        self.test_results[category]["details"].append(result)
        print(result)
    
    def test_seed_database(self):
        """Seed the database with sample videos"""
        print("\n🌱 Seeding Database...")
        try:
            response = self.session.post(f"{BASE_URL}/seed")
            if response.status_code == 200:
                print("✅ Database seeded successfully")
                return True
            else:
                print(f"⚠️ Seed response: {response.status_code} - {response.text}")
                return True  # May already be seeded
        except Exception as e:
            print(f"❌ Seed failed: {e}")
            return False
    
    def test_user_registration(self):
        """Test user registration endpoint"""
        print("\n🔐 Testing User Registration...")
        
        # Generate unique user data
        timestamp = int(time.time())
        user_data = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@watchwave.com",
            "password": "SecurePass123!"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/register", json=user_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    self.user_data = data["user"]
                    self.log_result("auth", "User Registration", True, f"User ID: {self.user_data['id']}")
                    return True
                else:
                    self.log_result("auth", "User Registration", False, "Missing token or user data")
                    return False
            else:
                self.log_result("auth", "User Registration", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("auth", "User Registration", False, f"Exception: {str(e)}")
            return False
    
    def test_user_login(self):
        """Test user login endpoint"""
        print("\n🔑 Testing User Login...")
        
        if not self.user_data:
            self.log_result("auth", "User Login", False, "No user data available for login test")
            return False
        
        login_data = {
            "username": self.user_data["username"],
            "password": "SecurePass123!"
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.log_result("auth", "User Login", True, f"Token received for user: {data['user']['username']}")
                    return True
                else:
                    self.log_result("auth", "User Login", False, "Missing token or user data")
                    return False
            else:
                self.log_result("auth", "User Login", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("auth", "User Login", False, f"Exception: {str(e)}")
            return False
    
    def test_get_current_user(self):
        """Test get current user endpoint"""
        print("\n👤 Testing Get Current User...")
        
        if not self.auth_token:
            self.log_result("auth", "Get Current User", False, "No auth token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "username" in data:
                    self.log_result("auth", "Get Current User", True, f"Retrieved user: {data['username']}")
                    return True
                else:
                    self.log_result("auth", "Get Current User", False, "Invalid user data structure")
                    return False
            else:
                self.log_result("auth", "Get Current User", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("auth", "Get Current User", False, f"Exception: {str(e)}")
            return False
    
    def test_get_videos(self):
        """Test get all videos endpoint"""
        print("\n🎬 Testing Get All Videos...")
        
        try:
            response = self.session.get(f"{BASE_URL}/videos")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    self.log_result("videos", "Get All Videos", True, f"Retrieved {len(data)} videos")
                    return data
                else:
                    self.log_result("videos", "Get All Videos", False, "No videos returned or invalid format")
                    return []
            else:
                self.log_result("videos", "Get All Videos", False, f"Status: {response.status_code}, Response: {response.text}")
                return []
                
        except Exception as e:
            self.log_result("videos", "Get All Videos", False, f"Exception: {str(e)}")
            return []
    
    def test_get_video_by_id(self, video_id):
        """Test get specific video endpoint"""
        print(f"\n🎥 Testing Get Video by ID: {video_id}")
        
        try:
            response = self.session.get(f"{BASE_URL}/videos/{video_id}")
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["id"] == video_id:
                    self.log_result("videos", "Get Video by ID", True, f"Retrieved video: {data['title']}")
                    return data
                else:
                    self.log_result("videos", "Get Video by ID", False, "Video ID mismatch")
                    return None
            else:
                self.log_result("videos", "Get Video by ID", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("videos", "Get Video by ID", False, f"Exception: {str(e)}")
            return None
    
    def test_create_room(self, video_id):
        """Test create room endpoint"""
        print(f"\n🏠 Testing Create Room for video: {video_id}")
        
        if not self.auth_token:
            self.log_result("rooms", "Create Room", False, "No auth token available")
            return None
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        room_data = {
            "name": f"Test Room - {datetime.now().strftime('%H:%M:%S')}",
            "video_id": video_id
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/rooms", json=room_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "video_id" in data:
                    self.log_result("rooms", "Create Room", True, f"Room created: {data['name']} (ID: {data['id']})")
                    return data
                else:
                    self.log_result("rooms", "Create Room", False, "Invalid room data structure")
                    return None
            else:
                self.log_result("rooms", "Create Room", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("rooms", "Create Room", False, f"Exception: {str(e)}")
            return None
    
    def test_get_rooms(self):
        """Test get all rooms endpoint"""
        print("\n🏘️ Testing Get All Rooms...")
        
        if not self.auth_token:
            self.log_result("rooms", "Get All Rooms", False, "No auth token available")
            return []
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/rooms", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("rooms", "Get All Rooms", True, f"Retrieved {len(data)} rooms")
                    return data
                else:
                    self.log_result("rooms", "Get All Rooms", False, "Invalid rooms data format")
                    return []
            else:
                self.log_result("rooms", "Get All Rooms", False, f"Status: {response.status_code}, Response: {response.text}")
                return []
                
        except Exception as e:
            self.log_result("rooms", "Get All Rooms", False, f"Exception: {str(e)}")
            return []
    
    def test_get_room_by_id(self, room_id):
        """Test get specific room endpoint"""
        print(f"\n🏠 Testing Get Room by ID: {room_id}")
        
        if not self.auth_token:
            self.log_result("rooms", "Get Room by ID", False, "No auth token available")
            return None
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/rooms/{room_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data["id"] == room_id:
                    self.log_result("rooms", "Get Room by ID", True, f"Retrieved room: {data['name']}")
                    return data
                else:
                    self.log_result("rooms", "Get Room by ID", False, "Room ID mismatch")
                    return None
            else:
                self.log_result("rooms", "Get Room by ID", False, f"Status: {response.status_code}, Response: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("rooms", "Get Room by ID", False, f"Exception: {str(e)}")
            return None
    
    def test_add_to_watchlist(self, video_id):
        """Test add video to watchlist endpoint"""
        print(f"\n⭐ Testing Add to Watchlist: {video_id}")
        
        if not self.auth_token:
            self.log_result("watchlist", "Add to Watchlist", False, "No auth token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = self.session.post(f"{BASE_URL}/watchlist/{video_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_result("watchlist", "Add to Watchlist", True, data["message"])
                    return True
                else:
                    self.log_result("watchlist", "Add to Watchlist", False, "Invalid response format")
                    return False
            else:
                self.log_result("watchlist", "Add to Watchlist", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("watchlist", "Add to Watchlist", False, f"Exception: {str(e)}")
            return False
    
    def test_get_watchlist(self):
        """Test get user watchlist endpoint"""
        print("\n📋 Testing Get Watchlist...")
        
        if not self.auth_token:
            self.log_result("watchlist", "Get Watchlist", False, "No auth token available")
            return []
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/watchlist", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("watchlist", "Get Watchlist", True, f"Retrieved {len(data)} watchlist items")
                    return data
                else:
                    self.log_result("watchlist", "Get Watchlist", False, "Invalid watchlist data format")
                    return []
            else:
                self.log_result("watchlist", "Get Watchlist", False, f"Status: {response.status_code}, Response: {response.text}")
                return []
                
        except Exception as e:
            self.log_result("watchlist", "Get Watchlist", False, f"Exception: {str(e)}")
            return []
    
    def test_remove_from_watchlist(self, video_id):
        """Test remove video from watchlist endpoint"""
        print(f"\n🗑️ Testing Remove from Watchlist: {video_id}")
        
        if not self.auth_token:
            self.log_result("watchlist", "Remove from Watchlist", False, "No auth token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = self.session.delete(f"{BASE_URL}/watchlist/{video_id}", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_result("watchlist", "Remove from Watchlist", True, data["message"])
                    return True
                else:
                    self.log_result("watchlist", "Remove from Watchlist", False, "Invalid response format")
                    return False
            else:
                self.log_result("watchlist", "Remove from Watchlist", False, f"Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("watchlist", "Remove from Watchlist", False, f"Exception: {str(e)}")
            return False
    
    async def test_websocket_connection(self, room_id):
        """Test WebSocket connection and basic functionality"""
        print(f"\n🔌 Testing WebSocket Connection for room: {room_id}")
        
        if not self.auth_token:
            self.log_result("websocket", "WebSocket Connection", False, "No auth token available")
            return False
        
        ws_url = f"{WS_URL}/{room_id}?token={self.auth_token}"
        
        try:
            async with websockets.connect(ws_url) as websocket:
                # Test connection
                self.log_result("websocket", "WebSocket Connection", True, "Connected successfully")
                
                # Wait for initial user list message
                try:
                    initial_msg = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    data = json.loads(initial_msg)
                    if data.get("type") == "user_list":
                        self.log_result("websocket", "Initial User List", True, f"Received user list with {len(data.get('users', []))} users")
                    else:
                        self.log_result("websocket", "Initial User List", False, f"Unexpected message type: {data.get('type')}")
                except asyncio.TimeoutError:
                    self.log_result("websocket", "Initial User List", False, "Timeout waiting for initial message")
                
                # Test chat message
                chat_message = {
                    "type": "chat",
                    "message": "Hello from API test!"
                }
                await websocket.send(json.dumps(chat_message))
                self.log_result("websocket", "Send Chat Message", True, "Chat message sent")
                
                # Test video action
                video_action = {
                    "type": "video_action",
                    "action": "play",
                    "currentTime": 10.5
                }
                await websocket.send(json.dumps(video_action))
                self.log_result("websocket", "Send Video Action", True, "Video action sent")
                
                # Wait a bit for any responses
                try:
                    while True:
                        response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        data = json.loads(response)
                        msg_type = data.get("type")
                        if msg_type == "chat":
                            self.log_result("websocket", "Receive Chat Message", True, f"Received chat: {data.get('message', '')}")
                        elif msg_type == "video_action":
                            self.log_result("websocket", "Receive Video Action", True, f"Received action: {data.get('action', '')}")
                except asyncio.TimeoutError:
                    # No more messages, that's fine
                    pass
                
                return True
                
        except Exception as e:
            self.log_result("websocket", "WebSocket Connection", False, f"Exception: {str(e)}")
            return False
    
    def test_get_chat_messages(self, room_id):
        """Test get chat messages endpoint"""
        print(f"\n💬 Testing Get Chat Messages for room: {room_id}")
        
        if not self.auth_token:
            self.log_result("chat", "Get Chat Messages", False, "No auth token available")
            return []
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        
        try:
            response = self.session.get(f"{BASE_URL}/rooms/{room_id}/messages", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("chat", "Get Chat Messages", True, f"Retrieved {len(data)} messages")
                    return data
                else:
                    self.log_result("chat", "Get Chat Messages", False, "Invalid messages data format")
                    return []
            else:
                self.log_result("chat", "Get Chat Messages", False, f"Status: {response.status_code}, Response: {response.text}")
                return []
                
        except Exception as e:
            self.log_result("chat", "Get Chat Messages", False, f"Exception: {str(e)}")
            return []
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("🧪 WATCHWAVE BACKEND API TEST SUMMARY")
        print("="*60)
        
        total_passed = 0
        total_failed = 0
        
        for category, results in self.test_results.items():
            passed = results["passed"]
            failed = results["failed"]
            total_passed += passed
            total_failed += failed
            
            status = "✅" if failed == 0 else "❌"
            print(f"\n{status} {category.upper()}: {passed} passed, {failed} failed")
            
            for detail in results["details"]:
                print(f"  {detail}")
        
        print(f"\n{'='*60}")
        overall_status = "✅ ALL TESTS PASSED" if total_failed == 0 else f"❌ {total_failed} TESTS FAILED"
        print(f"OVERALL: {total_passed} passed, {total_failed} failed - {overall_status}")
        print("="*60)
        
        return total_failed == 0

def main():
    """Main test execution"""
    print("🚀 Starting WatchWave Backend API Tests...")
    print(f"🌐 Base URL: {BASE_URL}")
    print(f"🔌 WebSocket URL: {WS_URL}")
    
    tester = WatchWaveAPITester()
    
    # Seed database first
    tester.test_seed_database()
    
    # Test Authentication Flow
    if not tester.test_user_registration():
        print("❌ Registration failed, cannot continue with auth-dependent tests")
        tester.print_summary()
        return False
    
    tester.test_user_login()
    tester.test_get_current_user()
    
    # Test Video Management
    videos = tester.test_get_videos()
    if videos:
        # Test getting specific video
        test_video = videos[0]
        tester.test_get_video_by_id(test_video["id"])
        
        # Test Room Management with this video
        room = tester.test_create_room(test_video["id"])
        if room:
            tester.test_get_rooms()
            tester.test_get_room_by_id(room["id"])
            
            # Test WebSocket functionality
            asyncio.run(tester.test_websocket_connection(room["id"]))
            
            # Test Chat Messages
            tester.test_get_chat_messages(room["id"])
        
        # Test Watchlist Management
        tester.test_add_to_watchlist(test_video["id"])
        tester.test_get_watchlist()
        tester.test_remove_from_watchlist(test_video["id"])
    
    # Print final summary
    success = tester.print_summary()
    return success

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)