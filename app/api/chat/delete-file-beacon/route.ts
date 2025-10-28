import { del } from '@vercel/blob';

export async function POST(request: Request) {
    try {
        const body = await request.formData();
        const urlToDelete = body.get('url') as string;

        if (!urlToDelete) {
            return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400 });
        }

        await del(urlToDelete);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Failed to delete blob via beacon:', err);
        return new Response(JSON.stringify({ error: 'Failed to delete blob' }), { status: 500 });
    }
}