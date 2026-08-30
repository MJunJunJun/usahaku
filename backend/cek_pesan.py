import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['usahaku']
    msgs = await db['wa_messages'].find({}, {'_id': 0}).to_list(100)
    print(f'Total messages: {len(msgs)}')
    for m in msgs[:10]:
        print(m)

asyncio.run(main())