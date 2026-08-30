import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['usahaku']
    
    # Cek conversations
    convs = await db['wa_conversations'].find({}, {'_id': 0}).to_list(200)
    print(f"Total conversations: {len(convs)}")
    for c in convs:
        print(f"  ID={c.get('id')}, phone={c.get('phone')}, lastMessage={c.get('lastMessage')}, mode={c.get('mode')}")
    
    # Cek messages
    msgs = await db['wa_messages'].find({}, {'_id': 0}).to_list(200)
    print(f"\nTotal messages: {len(msgs)}")
    for m in msgs:
        print(f"  convId={m.get('conversationId')}, body={m.get('body')[:30] if m.get('body') else ''}, direction={m.get('direction')}")

asyncio.run(main())