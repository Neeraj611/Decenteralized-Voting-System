import { NextRequest, NextResponse } from 'next/server';
import { auditReportFlow } from '@/ai/auditFlow';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { electionTitle, results, candidates, chainLength } = body;

        if (!electionTitle || !results || !candidates || chainLength === undefined) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Run the Genkit flow
        const report = await auditReportFlow(body);

        return NextResponse.json(report);
    } catch (error: any) {
        console.error('AI Audit Error:', error);
        return NextResponse.json({ error: error.message || 'AI processing failed' }, { status: 500 });
    }
}
