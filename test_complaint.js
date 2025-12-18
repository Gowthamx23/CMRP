// Simple test script to verify complaint creation
// Run this in browser console after logging in as a citizen

async function testComplaintCreation() {
    const complaintData = {
        title: "Test Complaint",
        description: "This is a test complaint with pincode 534101",
        category: "Road & Infrastructure",
        priority: "medium",
        address: "Test Address",
        pincode: "534101"
    };

    try {
        const response = await fetch('/api/complaints', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(complaintData)
        });

        const result = await response.json();
        console.log('✅ Complaint created:', result);
        return result;
    } catch (error) {
        console.error('❌ Error creating complaint:', error);
    }
}

// Test function
testComplaintCreation();

