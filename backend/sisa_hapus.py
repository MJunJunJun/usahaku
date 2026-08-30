import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['usahaku']
    
    # Hapus sisa message yang conversationId matching conversation tadi yang sudah dihapus
    result = await db['wa_messages'].delete_many({
        "conversationId": {"$in": ["171b58027c8a4e4f96fbccd1f806ac0d", "c883424ee13c4218a938c61e366ec953"]}
    })
    print(f"Dihapus sisa messages: {result.deleted_count}")
    
    # Verifikasi total
    remaining_convs = await db['wa_conversations'].count_documents({})
    remaining_msgs = await db['wa_messages'].count_documents({})
    print(f"\nSisa conversations: {remaining_convs}")
    print(f"Sisa messages: {remaining_msgs}")

asyncio.run(main())