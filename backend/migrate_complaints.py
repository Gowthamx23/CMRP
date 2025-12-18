#!/usr/bin/env python3
"""
Migration script to assign existing complaints to officers based on pincode
"""

import os
import sys
from pymongo import MongoClient
from datetime import datetime

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# MongoDB connection - using the same connection string that was working
MONGO_URI = "mongodb+srv://cmrp:cmrp123@cluster0.7qj8x.mongodb.net/cmrp?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)
db = client.cmrp

def migrate_complaints():
    """Assign existing complaints to officers based on pincode"""
    print("🔄 Starting complaint migration...")
    
    # Get all complaints
    complaints = list(db.complaints.find({}))
    print(f"📊 Found {len(complaints)} complaints to migrate")
    
    updated_count = 0
    
    for complaint in complaints:
        pincode = complaint.get('pincode', '')
        complaint_id = complaint.get('id')
        
        # Determine assignment based on pincode
        if pincode == "534101":
            assigned_to = "officer1"
            print(f"✅ Assigning complaint {complaint_id} (pincode: {pincode}) to officer1")
        elif pincode:
            assigned_to = "officer2"
            print(f"✅ Assigning complaint {complaint_id} (pincode: {pincode}) to officer2")
        else:
            assigned_to = "officer2"  # Default to officer2 for complaints without pincode
            print(f"⚠️ Assigning complaint {complaint_id} (no pincode) to officer2")
        
        # Update the complaint
        result = db.complaints.update_one(
            {"id": complaint_id},
            {
                "$set": {
                    "assigned_to": assigned_to,
                    "status": "PENDING",
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.modified_count > 0:
            updated_count += 1
    
    print(f"🎉 Migration complete! Updated {updated_count} complaints")
    
    # Verify the results
    officer1_count = db.complaints.count_documents({"assigned_to": "officer1"})
    officer2_count = db.complaints.count_documents({"assigned_to": "officer2"})
    
    print(f"📊 Final counts:")
    print(f"   - Officer1 complaints: {officer1_count}")
    print(f"   - Officer2 complaints: {officer2_count}")

if __name__ == "__main__":
    migrate_complaints()
