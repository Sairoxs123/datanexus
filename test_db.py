import aiosqlite, asyncio

async def run():
    db = await aiosqlite.connect('agent_checkpoint.db')
    cur = await db.execute("SELECT thread_id, checkpoint_id FROM checkpoints WHERE thread_id = '5c1e83dd-31ba-41a2-b561-46e9f568aa14'")
    rows = await cur.fetchall()
    print(f'Found {len(rows)} checkpoints')
    for r in rows:
        print(r[1])
    await db.close()

asyncio.run(run())
