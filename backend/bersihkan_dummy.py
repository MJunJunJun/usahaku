import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['usahaku']
    
    # Nomor yang ingin dibersihkan (tanpa lead 0 sesuai format di DB)
    target_phones = ["628123456789", "6281234567890"]
    
    # 1. Hapus conversations untuk nomor-target tersebut
    for phone in target_phones:
        result = await db['wa_conversations'].delete_many({"phone": phone})
        print(f"Dihapus {result.deleted_count} conversation untuk phone {phone}")
    
    # 2. (Opsional) Hapus messages yang mungkin ada (sekarang sudah 0 tapi jaga-jaga)
    # Hanya hapus messages yang conversationId sesuai dengan conversation IDs yang tadi dihapus
    # Karena messages sudah 0, langkah ini bisa lewati, tapi kita lakukan untuk keselamatan:
    # Dapatkan conversation IDs yang tadi dihapus
    convs = await db['wa_conversations'].find({"phone": {"$in": target_phones}}, {"_id": 0}).to_list(10)
    conv_ids = [c['id'] for c in convs]
    
    if conv_ids:
        # Hapus messages yang conversationId ada di daftar tadi
        result = await db['wa_messages'].delete_many({"conversationId": {"$in": conv_ids}})
        print(f"Dihapus {result.deleted_count} messages terkait conversation dummy")
    
    # Verifikasi total
    remaining_convs = await db['wa_conversations'].count_documents({})
    remaining_msgs = await db['wa_messages'].count_documents({})
    print(f"\nSisa conversations di DB: {remaining_convs}")
    print(f"Sisa messages di DB: {remaining_msgs}")

asyncio.run(main())