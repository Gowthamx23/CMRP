import requests
import sys
import json
from datetime import datetime
import uuid

class CMRPAPITester:
    def __init__(self, base_url="https://428c5667-1357-4030-ba71-aff15088bff0.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.citizen_token = None
        self.admin_token = None
        self.citizen_user = None
        self.admin_user = None
        self.test_complaint_id = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        if files:
            # Remove Content-Type for file uploads
            headers.pop('Content-Type', None)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "/",
            200
        )
        return success

    def test_citizen_registration(self):
        """Test citizen user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        citizen_data = {
            "email": f"citizen_{timestamp}@test.com",
            "password": "TestPass123!",
            "full_name": f"Test Citizen {timestamp}",
            "phone": "1234567890",
            "role": "citizen"
        }
        
        success, response = self.run_test(
            "Citizen Registration",
            "POST",
            "/auth/register",
            200,
            data=citizen_data
        )
        
        if success and 'access_token' in response:
            self.citizen_token = response['access_token']
            self.citizen_user = response['user']
            print(f"   Citizen token obtained: {self.citizen_token[:20]}...")
            return True
        return False

    def test_admin_registration(self):
        """Test admin user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        admin_data = {
            "email": f"admin_{timestamp}@test.com",
            "password": "AdminPass123!",
            "full_name": f"Test Admin {timestamp}",
            "phone": "0987654321",
            "role": "admin"
        }
        
        success, response = self.run_test(
            "Admin Registration",
            "POST",
            "/auth/register",
            200,
            data=admin_data
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.admin_user = response['user']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_citizen_login(self):
        """Test citizen login"""
        if not self.citizen_user:
            print("❌ No citizen user to test login")
            return False
            
        login_data = {
            "email": self.citizen_user['email'],
            "password": "TestPass123!"
        }
        
        success, response = self.run_test(
            "Citizen Login",
            "POST",
            "/auth/login",
            200,
            data=login_data
        )
        
        return success and 'access_token' in response

    def test_admin_login(self):
        """Test admin login"""
        if not self.admin_user:
            print("❌ No admin user to test login")
            return False
            
        login_data = {
            "email": self.admin_user['email'],
            "password": "AdminPass123!"
        }
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/auth/login",
            200,
            data=login_data
        )
        
        return success and 'access_token' in response

    def test_create_complaint(self):
        """Test complaint creation"""
        if not self.citizen_token:
            print("❌ No citizen token for complaint creation")
            return False
            
        complaint_data = {
            "title": "Test Road Pothole Issue",
            "description": "There is a large pothole on Main Street causing traffic issues and vehicle damage.",
            "category": "Road & Infrastructure",
            "priority": "high",
            "latitude": 28.6139,
            "longitude": 77.2088,
            "address": "Main Street, Test City"
        }
        
        success, response = self.run_test(
            "Create Complaint",
            "POST",
            "/complaints",
            200,
            data=complaint_data,
            token=self.citizen_token
        )
        
        if success and 'id' in response:
            self.test_complaint_id = response['id']
            print(f"   Complaint ID: {self.test_complaint_id}")
            return True
        return False

    def test_get_my_complaints(self):
        """Test getting user's own complaints"""
        if not self.citizen_token:
            print("❌ No citizen token for getting complaints")
            return False
            
        success, response = self.run_test(
            "Get My Complaints",
            "GET",
            "/complaints/my",
            200,
            token=self.citizen_token
        )
        
        if success:
            print(f"   Found {len(response)} complaints")
            return True
        return False

    def test_admin_get_all_complaints(self):
        """Test admin getting all complaints"""
        if not self.admin_token:
            print("❌ No admin token for getting all complaints")
            return False
            
        success, response = self.run_test(
            "Admin Get All Complaints",
            "GET",
            "/complaints",
            200,
            token=self.admin_token
        )
        
        if success:
            print(f"   Found {len(response)} total complaints")
            return True
        return False

    def test_admin_update_complaint(self):
        """Test admin updating complaint status"""
        if not self.admin_token or not self.test_complaint_id:
            print("❌ No admin token or complaint ID for update")
            return False
            
        update_data = {
            "status": "in_progress",
            "assigned_to": "Officer John Doe",
            "admin_comments": "Complaint has been reviewed and assigned to road maintenance team."
        }
        
        success, response = self.run_test(
            "Admin Update Complaint",
            "PUT",
            f"/complaints/{self.test_complaint_id}",
            200,
            data=update_data,
            token=self.admin_token
        )
        
        return success

    def test_admin_dashboard_stats(self):
        """Test admin dashboard statistics"""
        if not self.admin_token:
            print("❌ No admin token for dashboard stats")
            return False
            
        success, response = self.run_test(
            "Admin Dashboard Stats",
            "GET",
            "/dashboard/stats",
            200,
            token=self.admin_token
        )
        
        if success:
            expected_keys = ['total_complaints', 'open_complaints', 'in_progress_complaints', 'resolved_complaints']
            has_all_keys = all(key in response for key in expected_keys)
            if has_all_keys:
                print(f"   Stats: Total={response['total_complaints']}, Open={response['open_complaints']}, In Progress={response['in_progress_complaints']}, Resolved={response['resolved_complaints']}")
                return True
            else:
                print(f"❌ Missing expected keys in stats response")
        return False

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        print("\n🔒 Testing Unauthorized Access...")
        
        # Test accessing complaints without token
        success, _ = self.run_test(
            "Unauthorized Complaints Access",
            "GET",
            "/complaints/my",
            401
        )
        
        # Test citizen accessing admin endpoints
        citizen_admin_access = self.run_test(
            "Citizen Accessing Admin Stats",
            "GET",
            "/dashboard/stats",
            403,
            token=self.citizen_token
        )[0]
        
        return success and citizen_admin_access

def main():
    print("🚀 Starting CMRP API Testing...")
    print("=" * 50)
    
    tester = CMRPAPITester()
    
    # Test sequence
    tests = [
        ("Root Endpoint", tester.test_root_endpoint),
        ("Citizen Registration", tester.test_citizen_registration),
        ("Admin Registration", tester.test_admin_registration),
        ("Citizen Login", tester.test_citizen_login),
        ("Admin Login", tester.test_admin_login),
        ("Create Complaint", tester.test_create_complaint),
        ("Get My Complaints", tester.test_get_my_complaints),
        ("Admin Get All Complaints", tester.test_admin_get_all_complaints),
        ("Admin Update Complaint", tester.test_admin_update_complaint),
        ("Admin Dashboard Stats", tester.test_admin_dashboard_stats),
        ("Unauthorized Access", tester.test_unauthorized_access),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print(f"\n{'='*50}")
    print(f"📊 FINAL RESULTS")
    print(f"{'='*50}")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print(f"\n✅ All tests passed!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())