import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

async def setup():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['usahaku']
    
    # 1. Buat conversation dummy untuk nomor 628123456789
    await db['wa_conversations'].insert_one({
        "id": "test_conv_001",
        "phone": "628123456789",
        "name": "Test User",
        "lastMessageAt": datetime.now(timezone.utc).isoformat(),
        "mode": "AUTO",
        "unreadCount": 0
    })
    
    # 2. Kirim pesan masuk (IN) ke conversation tadi
    await db['wa_messages'].insert_one({
        "id": "msg_001",
        "conversationId": "test_conv_001",
        "phone": "628123456789",
        "direction": "IN",
        "body": "Halo ini test pesan dari backend",
        "type": "text",
        "status": "sent",
        "isBot": False,
        "sentBy": "admin@usahaku.id",
        "gowaMessageId": "",
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    # 3. Kirim pesan keluar (OUT)
    await db['wa_messages'].insert_one({
        "id": "msg_002",
        "conversationId": "test_conv_001",
        "phone": "628123456789",
        "direction": "OUT",
        "body": "Terima kasih",
        "type": "text",
        "status": "sent",
        "isBot": False,
        "sentBy": "admin@usahaku.id",
        "gowaMessageId": "",
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    print("=> Setup test data selesema")

asyncio.run(setup())