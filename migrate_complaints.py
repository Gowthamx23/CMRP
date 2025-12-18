#!/usr/bin/env python3
"""
Migration script to assign existing complaints to officers based on pincode.
Run this script to fix existing complaints that don't have assigned_to field.
"""

import os
import sys
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Connect to MongoDB
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'cmrp_db')

try:
    client = MongoClient(mongo_url)
    db = client[db_name]
    
    print("🔍 Connected to MongoDB")
    
    # Find all complaints without assigned_to field
    unassigned_complaints = list(db.complaints.find({"assigned_to": {"$exists": False}}))
    print(f"📋 Found {len(unassigned_complaints)} unassigned complaints")
    
    if len(unassigned_complaints) == 0:
        print("✅ All complaints are already assigned!")
        sys.exit(0)
    
    updated_count = 0
    for complaint in unassigned_complaints:
        assigned_officer = None
        pincode = complaint.get("pincode")
        complaint_id = complaint.get("id", "unknown")
        title = complaint.get("title", "No title")
        
        print(f"🔍 Processing complaint: {title} (ID: {complaint_id})")
        print(f"   Pincode: {pincode}")
        
        if pincode == "534101":
            assigned_officer = "officer1"
        elif pincode:
            assigned_officer = "officer2"
        
        if assigned_officer:
            db.complaints.update_one(
                {"id": complaint_id}, 
                {"$set": {"assigned_to": assigned_officer}}
            )
            updated_count += 1
            print(f"   ✅ Assigned to {assigned_officer}")
        else:
            print(f"   ⚠️ No pincode found, keeping unassigned")
    
    print(f"\n🎉 Migration completed!")
    print(f"   Total unassigned complaints: {len(unassigned_complaints)}")
    print(f"   Successfully assigned: {updated_count}")
    print(f"   Remaining unassigned: {len(unassigned_complaints) - updated_count}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)

