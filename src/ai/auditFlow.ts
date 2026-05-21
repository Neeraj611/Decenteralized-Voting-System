import { z } from 'zod';
import { ai } from './genkit';

export const auditReportFlow = ai.defineFlow(
    {
        name: 'auditReportFlow',
        inputSchema: z.object({
            electionTitle: z.string(),
            results: z.record(z.string(), z.number()),
            candidates: z.array(z.object({
                id: z.string(),
                name: z.string(),
                party: z.string(),
            })),
            chainLength: z.number(),
        }),
        outputSchema: z.object({
            summary: z.string(),
            securityAnalysis: z.string(),
            verdict: z.string(),
        }),
    },
    async (input: { electionTitle: string; results: Record<string, number>; candidates: { id: string; name: string; party: string }[]; chainLength: number }) => {
        const prompt = `
      You are an independent digital election auditor for "DecentraVote", a blockchain-based voting system. 
      Analyze the following election data and provide a transparency report.
      
      Election: ${input.electionTitle}
      Total Blocks in Chain: ${input.chainLength}
      
      Results (Candidate IDs and Vote Counts):
      ${JSON.stringify(input.results, null, 2)}
      
      Candidates:
      ${JSON.stringify(input.candidates, null, 2)}
      
      Instructions:
      1. Provide a "summary" of the election status.
      2. Provide a "securityAnalysis" focusing on the integrity of the blockchain ledger (length: ${input.chainLength} blocks). Mention that each vote is cryptographically linked.
      3. Provide a final "verdict" on whether the election results should be considered certified based on the immutable ledger.
      
      Format your response as a professional audit report.
    `;

        const { output } = await ai.generate(prompt);

        // Fallback parsing if needed, but genkit handles outputSchema
        return {
            summary: output?.summary || "Summary not generated.",
            securityAnalysis: output?.securityAnalysis || "Security analysis pending.",
            verdict: output?.verdict || "Awaiting certification.",
        };
    }
);
