import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def clear():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['usahaku']
    # Hapus semua conversation dan messages
    await db['wa_conversations'].delete_many({})
    await db['wa_messages'].delete_many({})
    print("=> Semua data dibersihkan")

asyncio.run(clear())