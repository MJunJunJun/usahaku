import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def clear():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['usahaku']
    result = await db['wa_messages'].delete_many({})
    print(f'Deleted {result.deleted_count} messages from wa_messages')

asyncio.run(clear())